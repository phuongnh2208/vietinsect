"use strict";

const crypto = require("crypto");
const knex = require("../../config/knex");
const logger = require("../../config/logger");
const { emitImportProgress } = require("../../config/socket");
const { enqueueOutboxBatch } = require("../search/esOutbox.service");
const { insertAuditLog } = require("../system/system.repository");

const MAX_IMPORT_ROWS = 5000;
const PREVIEW_LIMIT = 20;
const BATCH_SIZE = 50;

const importJobs = new Map();

function validateRow(row, index) {
  const errors = [];
  const warnings = [];
  if (!row || typeof row !== "object") {
    errors.push("Dòng dữ liệu rỗng hoặc không hợp lệ");
    return { rowIndex: index + 1, severity: "error", errors, warnings, data: row };
  }

  if (!row.scientificName && !row.taxonId) {
    errors.push("Thiếu Tên khoa học (scientificName) hoặc taxonId");
  }
  if (!row.collectionDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.collectionDate).trim())) {
    errors.push("Ngày thu mẫu phải đúng định dạng YYYY-MM-DD");
  }
  if (row.latitude != null && row.latitude !== "") {
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      errors.push("Tọa độ GPS không hợp lệ");
    } else if (lat < 8.18 || lat > 23.39 || lon < 102.14 || lon > 109.46) {
      warnings.push("Tọa độ nằm ngoài khung lãnh thổ Việt Nam");
    }
  } else {
    warnings.push("Chưa có tọa độ GPS");
  }

  const severity = errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok";
  return { rowIndex: index + 1, severity, errors, warnings, data: row };
}

function previewImportRows(rows = []) {
  if (!Array.isArray(rows)) {
    const err = new Error("Dữ liệu import phải là mảng các dòng");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    const err = new Error(`Vượt quá giới hạn tối đa ${MAX_IMPORT_ROWS} dòng/lần import`);
    err.statusCode = 400;
    err.code = "IMPORT.LIMIT_EXCEEDED";
    throw err;
  }

  const previewRows = rows.slice(0, PREVIEW_LIMIT).map((r, idx) => validateRow(r, idx));
  let errorCount = 0;
  let warningCount = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const v = i < PREVIEW_LIMIT ? previewRows[i] : validateRow(rows[i], i);
    if (v.severity === "error") errorCount += 1;
    else if (v.severity === "warning") warningCount += 1;
  }

  return {
    totalRows: rows.length,
    previewLimit: PREVIEW_LIMIT,
    errorCount,
    warningCount,
    previewRows,
  };
}

/**
 * Xử lý 1 lô import trong transaction DB:
 * - Lỗi từng dòng không làm hỏng toàn bộ lô (dùng SAVEPOINT).
 * - Ghi es_sync_outbox trong cùng transaction (không gọi ES từng dòng).
 */
async function processBatchRows(batch, adminId) {
  let inserted = 0;
  let failed = 0;
  const insertedIds = [];
  const rowErrors = [];

  await knex.transaction(async (trx) => {
    for (const item of batch) {
      const { row, rowIndex } = item;
      const v = validateRow(row, rowIndex - 1);
      if (v.severity === "error") {
        failed += 1;
        rowErrors.push({ rowIndex, errors: v.errors });
        continue;
      }

      const spName = `sp_row_${rowIndex}`;
      try {
        await trx.raw(`SAVEPOINT ${spName}`);

        let taxonId = row.taxonId ? Number(row.taxonId) : null;
        if (!taxonId && row.scientificName) {
          const found = await trx("taxa")
            .whereRaw("LOWER(scientific_name) = LOWER(?)", [String(row.scientificName).trim()])
            .first();
          taxonId = found?.taxon_id || null;
        }
        if (!taxonId) {
          throw new Error(`Không tìm thấy taxon '${row.scientificName}'`);
        }

        const code =
          (row.specimenCode && String(row.specimenCode).trim()) ||
          `IMP-${Date.now().toString(36).toUpperCase()}-${rowIndex}`;

        const [reg] = await trx("specimen_registry")
          .insert({
            specimen_code: code,
            basis_of_record: row.basisOfRecord || "PRESERVED_SPECIMEN",
            recorded_by: row.recordedBy || "Bulk Import",
          })
          .returning("specimen_id");

        const specimenId = reg.specimen_id;

        await trx("specimens").insert({
          specimen_id: specimenId,
          taxon_id: taxonId,
          gbif_scientific_name: row.scientificName || null,
          common_name_vn: row.commonNameVn || null,
          common_name_en: row.commonNameEn || null,
          collection_date: row.collectionDate,
          locality_detail: row.localityDetail || null,
          notes: row.notes || null,
          is_public: row.isPublic !== false && row.isPublic !== "false",
          created_by: adminId || null,
        });

        await trx.raw(`RELEASE SAVEPOINT ${spName}`);
        inserted += 1;
        insertedIds.push(specimenId);
      } catch (err) {
        await trx.raw(`ROLLBACK TO SAVEPOINT ${spName}`);
        failed += 1;
        rowErrors.push({ rowIndex, errors: [err?.message || "Lỗi ghi DB"] });
      }
    }

    if (insertedIds.length > 0) {
      await enqueueOutboxBatch(
        trx,
        insertedIds.map((id) => ({ entityType: "specimen", entityId: id, op: "upsert" })),
      );
    }
  });

  return { inserted, failed, insertedIds, rowErrors };
}

function startBulkImportJob({ rows, adminId, ipAddress }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    const err = new Error("Danh sách dòng import trống");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    const err = new Error(`Vượt quá giới hạn tối đa ${MAX_IMPORT_ROWS} dòng/lần import`);
    err.statusCode = 400;
    err.code = "IMPORT.LIMIT_EXCEEDED";
    throw err;
  }

  const jobId = crypto.randomUUID();
  const job = {
    jobId,
    adminId: Number(adminId),
    status: "pending",
    total: rows.length,
    processed: 0,
    inserted: 0,
    failed: 0,
    percent: 0,
    insertedIds: [],
    rowErrors: [],
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  importJobs.set(jobId, job);

  setImmediate(async () => {
    job.status = "processing";
    emitImportProgress(adminId, job);
    try {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const slice = rows.slice(i, i + BATCH_SIZE).map((row, idx) => ({
          row,
          rowIndex: i + idx + 1,
        }));
        const res = await processBatchRows(slice, adminId);
        job.processed += slice.length;
        job.inserted += res.inserted;
        job.failed += res.failed;
        job.insertedIds.push(...res.insertedIds);
        if (job.rowErrors.length < 100) {
          job.rowErrors.push(...res.rowErrors.slice(0, 100 - job.rowErrors.length));
        }
        job.percent = Math.round((job.processed / job.total) * 100);
        emitImportProgress(adminId, job);
      }

      job.status = "done";
      job.completedAt = new Date().toISOString();
      emitImportProgress(adminId, job);

      await insertAuditLog({
        adminId,
        actionType: "BULK_IMPORT",
        targetTable: "specimens",
        targetId: jobId,
        ipAddress,
        details: { total: job.total, inserted: job.inserted, failed: job.failed },
      }).catch((e) => logger.warn(`[BULK IMPORT AUDIT] ${e?.message}`));
    } catch (err) {
      job.status = "failed";
      job.completedAt = new Date().toISOString();
      logger.error(`[BULK IMPORT FAILED] jobId=${jobId}: ${err?.message}`);
      emitImportProgress(adminId, job);
    }
  });

  return {
    jobId: job.jobId,
    status: job.status,
    total: job.total,
  };
}

function getImportJob(jobId) {
  return importJobs.get(jobId) || null;
}

module.exports = {
  MAX_IMPORT_ROWS,
  PREVIEW_LIMIT,
  previewImportRows,
  startBulkImportJob,
  getImportJob,
};
