"use strict";

const knex = require("../../config/knex");
const { insertAuditLog } = require("../system/system.repository");

const MAX_SQL_ROWS = 500;
const SQL_TIMEOUT_MS = 3000;

const FIELD_MAP = {
  scientificName: { col: "t1.scientific_name", type: "text" },
  commonNameVn: { col: "s.common_name_vn", type: "text" },
  specimenCode: { col: "sr.specimen_code", type: "text" },
  province: { col: "p.province_name_vn", type: "text" },
  provinceId: { col: "s.province_id", type: "number" },
  recordedBy: { col: "sr.recorded_by", type: "text" },
  iucnStatus: { col: "t1.iucn_status", type: "text" },
  elevationM: { col: "s.elevation_m", type: "number" },
  bodyLengthMm: { col: "s.elevation_m", type: "number" },
  gpsAccuracyM: { col: "s.gps_accuracy_m", type: "number" },
  collectionDate: { col: "s.collection_date", type: "date" },
  notes: { col: "s.notes", type: "text" },
  order: {
    col: `COALESCE(
      CASE WHEN t1.taxon_rank = 'Order' THEN t1.scientific_name END,
      CASE WHEN t2.taxon_rank = 'Order' THEN t2.scientific_name END,
      CASE WHEN t3.taxon_rank = 'Order' THEN t3.scientific_name END,
      CASE WHEN t4.taxon_rank = 'Order' THEN t4.scientific_name END
    )`,
    type: "text",
  },
  family: {
    col: `COALESCE(
      CASE WHEN t1.taxon_rank = 'Family' THEN t1.scientific_name END,
      CASE WHEN t2.taxon_rank = 'Family' THEN t2.scientific_name END,
      CASE WHEN t3.taxon_rank = 'Family' THEN t3.scientific_name END
    )`,
    type: "text",
  },
  genus: {
    col: `COALESCE(
      CASE WHEN t1.taxon_rank = 'Genus' THEN t1.scientific_name END,
      CASE WHEN t2.taxon_rank = 'Genus' THEN t2.scientific_name END
    )`,
    type: "text",
  },
};

const FORBIDDEN_SQL_KEYWORDS =
  /\b(DROP|UPDATE|DELETE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|EXECUTE|EXEC|CALL|DO|SET|RESET|VACUUM|ANALYZE|REFRESH|LOCK|COMMENT|SECURITY|REASSIGN|CLUSTER|DISCARD|LOAD|LISTEN|NOTIFY|UNLISTEN|PREPARE|DEALLOCATE)\b/i;

const FORBIDDEN_SQL_IDENTIFIERS =
  /\b(pg_sleep|pg_read_file|pg_ls_dir|pg_stat_activity|dblink|lo_import|lo_export|admin_users|audit_logs|system_config)\b/i;

function createSqlError(message, code = "SQL.FORBIDDEN_QUERY", statusCode = 400) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

/**
 * Kiểm tra nghiêm ngặt câu lệnh SQL chỉ-đọc cho Admin (SCR-16, F-SR-04):
 * - Chỉ cho phép 1 câu lệnh SELECT duy nhất
 * - Chặn; (nhiều câu lệnh), comment ẩn lệnh, từ khóa DDL/DML và bảng hệ thống nhạy cảm
 */
function validateReadOnlySelectSql(rawSql) {
  if (!rawSql || typeof rawSql !== "string" || !rawSql.trim()) {
    throw createSqlError("Vui lòng nhập câu lệnh SQL SELECT", "SQL.EMPTY_QUERY", 400);
  }
  if (rawSql.length > 4000) {
    throw createSqlError("Câu lệnh SQL vượt quá độ dài cho phép (4000 ký tự)");
  }

  // Loại bỏ comment -- và /* */ để kiểm tra
  const withoutComments = rawSql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ")
    .trim();

  // Chỉ cho phép dấu ; tùy chọn duy nhất ở cuối cùng
  const strippedTrailingSemicolon = withoutComments.replace(/;\s*$/, "").trim();
  if (strippedTrailingSemicolon.includes(";")) {
    throw createSqlError("Không cho phép thực thi nhiều câu lệnh SQL (chặn dấu ';')");
  }

  if (!/^SELECT\b/i.test(strippedTrailingSemicolon)) {
    throw createSqlError("Chế độ SQL chỉ cho phép câu lệnh SELECT");
  }

  if (FORBIDDEN_SQL_KEYWORDS.test(strippedTrailingSemicolon)) {
    throw createSqlError("Câu lệnh chứa từ khóa bị cấm (chỉ cho phép SELECT chỉ-đọc)");
  }

  if (FORBIDDEN_SQL_IDENTIFIERS.test(strippedTrailingSemicolon)) {
    throw createSqlError("Câu lệnh truy cập bảng hoặc hàm hệ thống bị hạn chế");
  }

  return strippedTrailingSemicolon;
}

function buildRuleSqlCondition(rule) {
  const fieldDef = FIELD_MAP[rule?.field];
  if (!fieldDef) {
    throw createSqlError(`Trường tìm kiếm không hợp lệ: ${rule?.field}`, "VALIDATION_ERROR", 400);
  }

  const op = String(rule.operator || "eq").toLowerCase();
  const col = fieldDef.col;
  const val = rule.value;
  const valTo = rule.valueTo;

  const castValue = (v) => {
    if (fieldDef.type === "number") {
      const n = Number(v);
      if (Number.isNaN(n)) {
        throw createSqlError(`Giá trị số không hợp lệ cho trường ${rule.field}`, "VALIDATION_ERROR", 400);
      }
      return n;
    }
    return String(v ?? "").trim();
  };

  if (op === "between") {
    const v1 = castValue(val);
    const v2 = castValue(valTo);
    return { sql: `(${col} BETWEEN ? AND ?)`, bindings: [v1, v2] };
  }
  if (op === "contains") {
    const safe = `%${String(val ?? "").trim().replace(/[%_\\]/g, "\\$&")}%`;
    return { sql: `(${col}::text ILIKE ? ESCAPE '\\')`, bindings: [safe] };
  }
  if (op === "eq") {
    if (fieldDef.type === "text") {
      return { sql: `(LOWER(${col}::text) = LOWER(?))`, bindings: [String(val ?? "").trim()] };
    }
    return { sql: `(${col} = ?)`, bindings: [castValue(val)] };
  }
  if (op === "neq") {
    if (fieldDef.type === "text") {
      return {
        sql: `(${col} IS NULL OR LOWER(${col}::text) <> LOWER(?))`,
        bindings: [String(val ?? "").trim()],
      };
    }
    return { sql: `(${col} IS NULL OR ${col} <> ?)`, bindings: [castValue(val)] };
  }
  if (op === "gt") return { sql: `(${col} > ?)`, bindings: [castValue(val)] };
  if (op === "gte") return { sql: `(${col} >= ?)`, bindings: [castValue(val)] };
  if (op === "lt") return { sql: `(${col} < ?)`, bindings: [castValue(val)] };
  if (op === "lte") return { sql: `(${col} <= ?)`, bindings: [castValue(val)] };

  throw createSqlError(`Toán tử không hợp lệ: ${op}`, "VALIDATION_ERROR", 400);
}

/**
 * Đánh giá truy vấn Visual Query Builder (AND / OR / NOT) trên PostgreSQL.
 * User (!isAdmin) luôn bị ép s.is_public = true ở tầng ngoài cùng.
 */
async function executeQueryBuilder(payload = {}, { isAdmin = false } = {}) {
  const rules = Array.isArray(payload.rules) ? payload.rules : [];
  const page = Math.max(1, Number(payload.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(payload.limit) || 25));
  const offset = (page - 1) * limit;

  const baseQb = knex({ s: "specimens" })
    .join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id")
    .join({ t1: "taxa" }, "s.taxon_id", "t1.taxon_id")
    .leftJoin({ t2: "taxa" }, "t1.parent_id", "t2.taxon_id")
    .leftJoin({ t3: "taxa" }, "t2.parent_id", "t3.taxon_id")
    .leftJoin({ t4: "taxa" }, "t3.parent_id", "t4.taxon_id")
    .leftJoin({ p: "provinces" }, "s.province_id", "p.province_id")
    .whereNull("s.deleted_at");

  // Ép cứng is_public = true ở tầng ngoài cùng đối với User
  if (!isAdmin) {
    baseQb.where("s.is_public", true);
  }

  const activeRules = rules.filter(
    (r) => r && r.field && r.value !== undefined && r.value !== null && String(r.value).trim() !== "",
  );

  if (activeRules.length > 0) {
    const parts = [];
    const bindings = [];

    activeRules.forEach((rule, idx) => {
      const logic = String(rule.logic || "AND").toUpperCase();
      const cond = buildRuleSqlCondition(rule);
      if (idx === 0) {
        if (logic === "NOT") {
          parts.push(`NOT ${cond.sql}`);
        } else {
          parts.push(cond.sql);
        }
      } else if (logic === "OR") {
        parts.push(`OR ${cond.sql}`);
      } else if (logic === "NOT") {
        parts.push(`AND NOT ${cond.sql}`);
      } else {
        parts.push(`AND ${cond.sql}`);
      }
      bindings.push(...cond.bindings);
    });

    baseQb.whereRaw(`(${parts.join(" ")})`, bindings);
  }

  const [{ total }] = await baseQb.clone().count("* as total");
  const totalInt = parseInt(total, 10) || 0;

  const rows = await baseQb
    .clone()
    .select(
      "s.specimen_id as id",
      "sr.specimen_code as specimenCode",
      "t1.scientific_name as scientificName",
      "s.common_name_vn as commonNameVn",
      "t1.iucn_status as iucnStatus",
      "p.province_name_vn as provinceNameVn",
      "s.locality_detail as localityDetail",
      "s.elevation_m as elevationM",
      "s.gps_accuracy_m as gpsAccuracyM",
      "s.collection_date as collectionDate",
      "sr.recorded_by as recordedBy",
      "s.is_public as isPublic",
    )
    .orderBy("s.specimen_id", "desc")
    .limit(limit)
    .offset(offset);

  return {
    items: rows,
    pagination: {
      total: totalInt,
      page,
      limit,
      totalPages: Math.ceil(totalInt / limit),
    },
  };
}

/**
 * Thực thi SQL trực tiếp cho Admin:
 * - Chỉ cho phép SELECT單 câu lệnh
 * - Chạy trong transaction READ ONLY + statement_timeout + LIMIT 500
 * - Mọi truy vấn (thành công hoặc bị từ chối) đều ghi vào audit_logs
 */
async function executeAdminSql(rawSql, { adminId, ipAddress } = {}) {
  let cleanSql;
  try {
    cleanSql = validateReadOnlySelectSql(rawSql);
  } catch (err) {
    await insertAuditLog({
      adminId,
      actionType: "SQL_QUERY_REJECTED",
      targetTable: "sql_console",
      targetId: null,
      ipAddress,
      details: { sql: String(rawSql || "").slice(0, 500), reason: err.message },
    }).catch(() => {});
    throw err;
  }

  try {
    const result = await knex.transaction(async (trx) => {
      await trx.raw("SET LOCAL TRANSACTION READ ONLY");
      await trx.raw(`SET LOCAL statement_timeout = '${SQL_TIMEOUT_MS}ms'`);
      if (process.env.DB_READONLY_ROLE) {
        await trx.raw("SET LOCAL ROLE ??", [process.env.DB_READONLY_ROLE]);
      }
      const wrappedSql = `SELECT * FROM (${cleanSql}) AS _admin_sql_q LIMIT ${MAX_SQL_ROWS}`;
      return trx.raw(wrappedSql);
    });

    const rows = result.rows || [];
    const columns = (result.fields || []).map((f) => f.name);

    await insertAuditLog({
      adminId,
      actionType: "SQL_QUERY",
      targetTable: "sql_console",
      targetId: null,
      ipAddress,
      details: { sql: cleanSql.slice(0, 500), rowCount: rows.length },
    });

    return {
      columns,
      rows,
      rowCount: rows.length,
      maxRows: MAX_SQL_ROWS,
    };
  } catch (err) {
    await insertAuditLog({
      adminId,
      actionType: "SQL_QUERY_ERROR",
      targetTable: "sql_console",
      targetId: null,
      ipAddress,
      details: { sql: cleanSql.slice(0, 500), error: err?.message },
    }).catch(() => {});
    const e = new Error(`Lỗi thực thi SQL: ${err?.message}`);
    e.statusCode = 400;
    e.code = "SQL.EXECUTION_ERROR";
    throw e;
  }
}

async function listSavedFilters(adminId) {
  return knex("saved_filters")
    .where("admin_id", Number(adminId))
    .orderBy("created_at", "desc")
    .select("filter_id as id", "filter_name as name", "filter_json as filterJson", "created_at as createdAt");
}

async function createSavedFilter(adminId, { name, filterJson }) {
  if (!name || !String(name).trim()) {
    throw createSqlError("Vui lòng nhập tên bộ lọc", "VALIDATION_ERROR", 400);
  }
  const [row] = await knex("saved_filters")
    .insert({
      admin_id: Number(adminId),
      filter_name: String(name).trim().slice(0, 255),
      filter_json: JSON.stringify(filterJson || {}),
    })
    .returning(["filter_id as id", "filter_name as name", "filter_json as filterJson", "created_at as createdAt"]);
  return row;
}

async function deleteSavedFilter(adminId, filterId) {
  return knex("saved_filters")
    .where({ filter_id: Number(filterId), admin_id: Number(adminId) })
    .delete();
}

module.exports = {
  validateReadOnlySelectSql,
  executeQueryBuilder,
  executeAdminSql,
  listSavedFilters,
  createSavedFilter,
  deleteSavedFilter,
};
