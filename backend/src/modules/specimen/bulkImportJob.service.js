"use strict";

const crypto = require("crypto");
const ExcelJS = require("exceljs");
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

async function loadImportLookupMaps(db = knex) {
  const [taxaRows, provRows] = await Promise.all([
    db("taxa").select("taxon_id", "scientific_name", "taxon_rank"),
    db("provinces").select("province_id", "province_name_vn", "province_name_en", "province_code"),
  ]);

  const taxonMap = new Map();
  for (const t of taxaRows) {
    taxonMap.set(String(t.scientific_name).trim().toLowerCase(), t.taxon_id);
  }

  const provMap = new Map();
  for (const p of provRows) {
    if (p.province_name_vn) provMap.set(String(p.province_name_vn).trim().toLowerCase(), p.province_id);
    if (p.province_name_en) provMap.set(String(p.province_name_en).trim().toLowerCase(), p.province_id);
    if (p.province_code) provMap.set(String(p.province_code).trim().toLowerCase(), p.province_id);
  }

  return { taxonMap, provMap };
}

function parseOptionalNumber(val) {
  if (val === undefined || val === null || String(val).trim() === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/**
 * Xử lý 1 lô import trong transaction DB:
 * - Lỗi từng dòng không làm hỏng toàn bộ lô (dùng SAVEPOINT).
 * - Ghi đầy đủ 22 trường chuẩn Darwin Core (gồm PostGIS collection_point, tỉnh/huyện/xã, độ cao, giới tính...).
 * - Ghi es_sync_outbox trong cùng transaction (không gọi ES từng dòng).
 */
async function processBatchRows(batch, adminId, lookupMaps = null) {
  let inserted = 0;
  let failed = 0;
  const insertedIds = [];
  const rowErrors = [];

  await knex.transaction(async (trx) => {
    const maps = lookupMaps || (await loadImportLookupMaps(trx));

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

        const sciName = String(row.scientificName || row.gbifScientificName || "").trim();
        let taxonId = row.taxonId ? Number(row.taxonId) : null;
        if (!taxonId && sciName) {
          taxonId =
            maps.taxonMap.get(sciName.toLowerCase()) ||
            maps.taxonMap.get(sciName.split(/\s+/)[0].toLowerCase()) ||
            (row.genusName && maps.taxonMap.get(String(row.genusName).trim().toLowerCase())) ||
            (row.familyName && maps.taxonMap.get(String(row.familyName).trim().toLowerCase())) ||
            (row.orderName && maps.taxonMap.get(String(row.orderName).trim().toLowerCase())) ||
            null;
        }
        if (!taxonId && sciName) {
          const found = await trx("taxa")
            .whereRaw("LOWER(scientific_name) = LOWER(?)", [sciName])
            .first();
          taxonId = found?.taxon_id || null;
        }
        if (!taxonId) {
          throw new Error(`Không tìm thấy taxon '${sciName || row.scientificName}'`);
        }

        const provinceId =
          (row.provinceId && Number(row.provinceId)) ||
          (row.provinceName && maps.provMap.get(String(row.provinceName).trim().toLowerCase())) ||
          null;

        const lat = parseOptionalNumber(row.latitude);
        const lon = parseOptionalNumber(row.longitude);
        if ((lat != null && lon == null) || (lat == null && lon != null)) {
          throw new Error("Vĩ độ (latitude) và kinh độ (longitude) phải được cung cấp đồng thời");
        }
        const pointExpr =
          lat != null && lon != null
            ? trx.raw("ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography", [lon, lat])
            : null;

        const code =
          (row.specimenCode && String(row.specimenCode).trim()) ||
          `IMP-${Date.now().toString(36).toUpperCase()}-${rowIndex}`;

        const [reg] = await trx("specimen_registry")
          .insert({
            specimen_code: code,
            basis_of_record: row.basisOfRecord || "PRESERVED_SPECIMEN",
            catalog_number: row.catalogNumber ? String(row.catalogNumber).trim() : null,
            institution_code: row.institutionCode ? String(row.institutionCode).trim() : null,
            recorded_by: row.recordedBy ? String(row.recordedBy).trim() : "Bulk Import",
            identified_by: row.identifiedBy ? String(row.identifiedBy).trim() : null,
            occurrence_remarks: row.occurrenceRemarks ? String(row.occurrenceRemarks).trim() : null,
          })
          .returning("specimen_id");

        const specimenId = reg.specimen_id;

        await trx("specimens").insert({
          specimen_id: specimenId,
          taxon_id: taxonId,
          province_id: provinceId,
          habitat_id: row.habitatId ? Number(row.habitatId) : null,
          life_stage_id: row.lifeStageId ? Number(row.lifeStageId) : null,
          status_id: row.statusId ? Number(row.statusId) : null,
          gbif_scientific_name: sciName || null,
          common_name_vn: row.commonNameVn ? String(row.commonNameVn).trim() : null,
          common_name_en: row.commonNameEn ? String(row.commonNameEn).trim() : null,
          district: row.district ? String(row.district).trim() : null,
          commune: row.commune ? String(row.commune).trim() : null,
          locality_detail: row.localityDetail ? String(row.localityDetail).trim() : null,
          collection_point: pointExpr,
          gps_accuracy_m: parseOptionalNumber(row.gpsAccuracyM),
          elevation_m: parseOptionalNumber(row.elevationM),
          collection_date: String(row.collectionDate).trim(),
          sex: row.sex ? String(row.sex).trim().toLowerCase() : null,
          individual_count: Math.max(1, parseInt(row.individualCount, 10) || 1),
          storage_number: row.storageNumber ? String(row.storageNumber).trim() : null,
          notes: row.notes ? String(row.notes).trim() : null,
          is_public: row.isPublic !== false && String(row.isPublic).toLowerCase() !== "false",
          created_by: adminId || null,
          updated_by: adminId || null,
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
      const lookupMaps = await loadImportLookupMaps(knex).catch(() => null);
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const slice = rows.slice(i, i + BATCH_SIZE).map((row, idx) => ({
          row,
          rowIndex: i + idx + 1,
        }));
        const res = await processBatchRows(slice, adminId, lookupMaps);
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

const TEMPLATE_22_COLUMNS = [
  { key: "specimenCode", vn: "Mã mẫu vật", en: "Specimen Code", note: "Chuỗi duy nhất (VD: VAST-2026-0001)" },
  { key: "scientificName", vn: "Tên khoa học *", en: "Scientific Name *", note: "Bắt buộc (VD: Papilio demoleus)" },
  { key: "commonNameVn", vn: "Tên tiếng Việt", en: "Vietnamese Common Name", note: "VD: Bướm phượng chanh" },
  { key: "commonNameEn", vn: "Tên tiếng Anh", en: "English Common Name", note: "VD: Lime Butterfly" },
  { key: "orderName", vn: "Bộ", en: "Order", note: "VD: Lepidoptera" },
  { key: "familyName", vn: "Họ", en: "Family", note: "VD: Papilionidae" },
  { key: "genusName", vn: "Giống", en: "Genus", note: "VD: Papilio" },
  { key: "provinceName", vn: "Tỉnh/Thành phố", en: "Province", note: "34 tỉnh/thành Việt Nam" },
  { key: "district", vn: "Quận/Huyện", en: "District", note: "Tùy chọn" },
  { key: "commune", vn: "Xã/Phường", en: "Commune", note: "Tùy chọn" },
  { key: "localityDetail", vn: "Địa điểm chi tiết", en: "Locality Detail", note: "VD: VQG Cúc Phương" },
  { key: "latitude", vn: "Vĩ độ (WGS84)", en: "Decimal Latitude", note: "Số thực 8.18–23.39" },
  { key: "longitude", vn: "Kinh độ (WGS84)", en: "Decimal Longitude", note: "Số thực 102.14–109.46" },
  { key: "gpsAccuracyM", vn: "Sai số GPS (m)", en: "Coordinate Uncertainty (m)", note: "Số dương (VD: 10)" },
  { key: "elevationM", vn: "Độ cao (m)", en: "Elevation (m)", note: "Số thực (-500..9000)" },
  { key: "collectionDate", vn: "Ngày thu mẫu *", en: "Event Date *", note: "Bắt buộc chuẩn YYYY-MM-DD" },
  { key: "recordedBy", vn: "Người thu mẫu", en: "Recorded By", note: "VD: VAST Field Team" },
  { key: "institutionCode", vn: "Mã cơ quan", en: "Institution Code", note: "VD: VAST" },
  { key: "basisOfRecord", vn: "Loại bản ghi DwC", en: "Basis Of Record", note: "PRESERVED_SPECIMEN / HUMAN_OBSERVATION" },
  { key: "sex", vn: "Giới tính", en: "Sex", note: "male / female / unknown" },
  { key: "individualCount", vn: "Số lượng cá thể", en: "Individual Count", note: "Số nguyên >= 1" },
  { key: "isPublic", vn: "Công khai", en: "Is Public", note: "true / false" },
];

async function generateImportTemplateExcel() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "VietInsect - VAST";
  const sheet = wb.addWorksheet("VietInsect_22Cols_Template");

  sheet.addRow(TEMPLATE_22_COLUMNS.map((c) => c.key));
  sheet.addRow(TEMPLATE_22_COLUMNS.map((c) => `${c.vn} / ${c.en}`));
  sheet.addRow(TEMPLATE_22_COLUMNS.map((c) => c.note));

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/**
 * Đọc file Excel (.xlsx) thành danh sách headers + rows chuẩn hóa (bỏ qua dòng mô tả song ngữ & ghi chú nếu dùng template chuẩn).
 */
async function parseImportExcelBuffer(fileBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fileBuffer);
  const sheet = wb.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    const err = new Error("Tệp Excel trống hoặc không có dòng dữ liệu");
    err.statusCode = 400;
    err.code = "IMPORT.EMPTY_FILE";
    throw err;
  }

  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.text || cell.value || "").trim();
  });
  const cleanHeaders = headers.filter(Boolean);
  if (cleanHeaders.length === 0) {
    const err = new Error("Không đọc được dòng tiêu đề cột từ tệp Excel");
    err.statusCode = 400;
    err.code = "IMPORT.INVALID_HEADER";
    throw err;
  }

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    let hasValue = false;
    headers.forEach((h, idx) => {
      if (!h) return;
      const cell = row.getCell(idx + 1);
      let rawVal = cell.value;
      if (rawVal instanceof Date && !Number.isNaN(rawVal.getTime())) {
        rawVal = rawVal.toISOString().slice(0, 10);
      } else if (rawVal && typeof rawVal === "object") {
        rawVal = cell.text || "";
      }
      const strVal = rawVal == null ? "" : String(rawVal).trim();
      if (strVal !== "") hasValue = true;
      obj[h] = strVal;
    });

    if (!hasValue) return;
    // Bỏ qua dòng 2–3 nếu là dòng nhãn song ngữ / hướng dẫn của chính template VietInsect
    const firstVal = String(Object.values(obj)[0] || "");
    if (
      (rowNumber === 2 || rowNumber === 3) &&
      (firstVal.includes("Mã mẫu vật / Specimen Code") || firstVal.startsWith("Chuỗi duy nhất (VD:"))
    ) {
      return;
    }
    rows.push(obj);
  });

  if (rows.length > MAX_IMPORT_ROWS) {
    const err = new Error(`Vượt quá giới hạn tối đa ${MAX_IMPORT_ROWS} dòng/lần import`);
    err.statusCode = 400;
    err.code = "IMPORT.LIMIT_EXCEEDED";
    throw err;
  }

  return { headers: cleanHeaders, rows };
}

module.exports = {
  MAX_IMPORT_ROWS,
  PREVIEW_LIMIT,
  TEMPLATE_22_COLUMNS,
  previewImportRows,
  processBatchRows,
  startBulkImportJob,
  getImportJob,
  generateImportTemplateExcel,
  parseImportExcelBuffer,
};
