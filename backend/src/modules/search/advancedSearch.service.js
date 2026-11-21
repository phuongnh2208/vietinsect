"use strict";

const { Parser } = require("node-sql-parser");
const knex = require("../../config/knex");
const { insertAuditLog } = require("../system/system.repository");

const sqlParser = new Parser();
const MAX_SQL_ROWS = 500;
const SQL_TIMEOUT_MS = 3000;
const MAX_QB_RULES = 20;
const MAX_QB_DEPTH = 3;
const MAX_QB_VALUE_LEN = 200;

const ALLOWED_SQL_FUNCTIONS = new Set([
  // Aggregates & math
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "round",
  "floor",
  "ceil",
  "ceiling",
  "abs",
  // String, null, conditional
  "lower",
  "upper",
  "trim",
  "btrim",
  "ltrim",
  "rtrim",
  "length",
  "char_length",
  "substring",
  "substr",
  "replace",
  "concat",
  "coalesce",
  "nullif",
  "greatest",
  "least",
  // Date / time
  "date_trunc",
  "extract",
  "date_part",
  "to_char",
  "now",
  "current_date",
  "current_timestamp",
  "age",
  "cast",
  // PostGIS read-only spatial helpers
  "st_x",
  "st_y",
  "st_astext",
  "st_asgeojson",
  "st_distance",
  "st_dwithin",
  "st_within",
  "st_contains",
  "st_intersects",
  "st_centroid",
  "st_area",
  "st_srid",
  "st_setsrid",
  "st_makepoint",
  "st_geomfromtext",
  // SQL grammar constructs followed by '('
  "in",
  "values",
  "exists",
  "over",
  "filter",
  "within",
  "position",
]);

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
  /\b(pg_catalog|information_schema|pg_sleep|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_activity|dblink|lo_import|lo_export|admin_users|audit_logs|system_config|saved_filters|es_sync_outbox)\b/i;

function createSqlError(message, code = "SQL.FORBIDDEN_QUERY", statusCode = 400) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

/**
 * Loại bỏ comment khối lồng nhau và comment dòng --
 */
function stripSqlCommentsAndLiterals(rawSql) {
  let s = rawSql;
  // Strip nested block comments iteratively
  let prev;
  let guard = 0;
  do {
    prev = s;
    s = s.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, " ");
    guard += 1;
  } while (s !== prev && guard < 20);

  if (s.includes("/*") || s.includes("*/")) {
    throw createSqlError("Phát hiện comment SQL lồng nhau hoặc không đóng hợp lệ");
  }

  // Strip single-line comments
  s = s.replace(/--[^\r\n]*/g, " ");
  return s.trim();
}

/**
 * Kiểm tra nghiêm ngặt câu lệnh SQL chỉ-đọc cho Admin (SCR-16, F-SR-04, DEF-115):
 * - Parse AST bằng node-sql-parser (dialect Postgresql) kết hợp kiểm tra từ vựng
 * - Chỉ cho phép 1 statement SELECT duy nhất (chặn CTE ghi WITH ... INSERT/UPDATE/DELETE và SELECT ... INTO)
 * - Chỉ cho phép gọi hàm nằm trong ALLOWED_SQL_FUNCTIONS whitelist
 * - Chặn pg_catalog, information_schema và các bảng hệ thống nhạy cảm
 */
function validateReadOnlySelectSql(rawSql) {
  if (!rawSql || typeof rawSql !== "string" || !rawSql.trim()) {
    throw createSqlError("Vui lòng nhập câu lệnh SQL SELECT", "SQL.EMPTY_QUERY", 400);
  }
  if (rawSql.length > 4000) {
    throw createSqlError("Câu lệnh SQL vượt quá độ dài cho phép (4000 ký tự)");
  }
  // Chặn ký tự điều khiển / unicode lạ ngoài khoảng chuẩn
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u2028\u2029\uFEFF]/.test(rawSql)) {
    throw createSqlError("Câu lệnh SQL chứa ký tự điều khiển hoặc Unicode không hợp lệ");
  }

  const withoutComments = stripSqlCommentsAndLiterals(rawSql);
  const strippedTrailingSemicolon = withoutComments.replace(/;\s*$/, "").trim();

  if (strippedTrailingSemicolon.includes(";")) {
    throw createSqlError("Không cho phép thực thi nhiều câu lệnh SQL (chặn dấu ';')");
  }

  // Mask string literals '....' before keyword/function scan
  const maskedLiterals = strippedTrailingSemicolon.replace(/'(?:''|[^'])*'/g, "''");

  if (!/^(SELECT|WITH)\b/i.test(maskedLiterals)) {
    throw createSqlError("Chế độ SQL chỉ cho phép câu lệnh SELECT");
  }

  if (/\bINTO\b/i.test(maskedLiterals)) {
    throw createSqlError("Không cho phép SELECT ... INTO");
  }

  if (FORBIDDEN_SQL_KEYWORDS.test(maskedLiterals)) {
    throw createSqlError("Câu lệnh chứa từ khóa bị cấm (chỉ cho phép SELECT chỉ-đọc)");
  }

  if (FORBIDDEN_SQL_IDENTIFIERS.test(maskedLiterals)) {
    throw createSqlError("Câu lệnh truy cập bảng hoặc hàm hệ thống bị hạn chế");
  }

  // Kiểm tra whitelist hàm SQL: mọi định danh theo sau bởi '(' phải thuộc ALLOWED_SQL_FUNCTIONS
  const fnRegex = /\b([a-zA-Z_][a-zA-Z0-9_.]*)\s*\(/g;
  let match;
  while ((match = fnRegex.exec(maskedLiterals)) !== null) {
    const fnName = match[1].toLowerCase();
    if (!ALLOWED_SQL_FUNCTIONS.has(fnName)) {
      throw createSqlError(`Hàm SQL '${match[1]}' không nằm trong danh sách cho phép`, "SQL.FORBIDDEN_QUERY", 400);
    }
  }

  // Parse AST bằng node-sql-parser (PostgreSQL dialect)
  let ast;
  try {
    ast = sqlParser.astify(strippedTrailingSemicolon, { database: "Postgresql" });
  } catch (parseErr) {
    throw createSqlError(`Cú pháp SQL không hợp lệ hoặc không được phép: ${parseErr.message}`);
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1 || !statements[0] || statements[0].type !== "select") {
    throw createSqlError("Chỉ cho phép duy nhất 1 câu lệnh SELECT");
  }

  const selectAst = statements[0];
  if (selectAst.into && (selectAst.into.expr || selectAst.into.position)) {
    throw createSqlError("Không cho phép SELECT ... INTO");
  }

  if (Array.isArray(selectAst.with)) {
    for (const cte of selectAst.with) {
      const subAst = cte?.stmt?.ast || cte?.stmt;
      if (!subAst || subAst.type !== "select") {
        throw createSqlError("CTE (WITH) chỉ được phép chứa câu lệnh SELECT chỉ-đọc");
      }
    }
  }

  return strippedTrailingSemicolon;
}

function buildRuleSqlCondition(rule) {
  const fieldKey = String(rule?.field || "");
  if (!Object.prototype.hasOwnProperty.call(FIELD_MAP, fieldKey)) {
    throw createSqlError(`Trường tìm kiếm không hợp lệ: ${fieldKey}`, "VALIDATION_ERROR", 400);
  }
  const fieldDef = FIELD_MAP[fieldKey];

  const op = String(rule.operator || "eq").toLowerCase();
  const col = fieldDef.col;
  const val = rule.value;
  const valTo = rule.valueTo;

  if (String(val ?? "").length > MAX_QB_VALUE_LEN || String(valTo ?? "").length > MAX_QB_VALUE_LEN) {
    throw createSqlError(
      `Giá trị điều kiện vượt quá độ dài tối đa ${MAX_QB_VALUE_LEN} ký tự`,
      "VALIDATION_ERROR",
      400,
    );
  }

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
 * Biên dịch đệ quy nhóm điều kiện (hỗ trợ lồng tối đa MAX_QB_DEPTH = 3 và tổng tối đa MAX_QB_RULES = 20).
 */
function compileRuleGroup(rules, depth = 1, counter = { count: 0 }) {
  if (depth > MAX_QB_DEPTH) {
    throw createSqlError(
      `Độ sâu lồng điều kiện vượt quá giới hạn tối đa (${MAX_QB_DEPTH})`,
      "VALIDATION_ERROR",
      400,
    );
  }
  if (!Array.isArray(rules)) {
    throw createSqlError("Danh sách điều kiện (rules) không hợp lệ", "VALIDATION_ERROR", 400);
  }

  const parts = [];
  const bindings = [];

  rules.forEach((rule) => {
    if (!rule || typeof rule !== "object") return;
    const logic = String(rule.logic || "AND").toUpperCase();
    if (!["AND", "OR", "NOT"].includes(logic)) {
      throw createSqlError(`Toán tử logic không hợp lệ: ${rule.logic}`, "VALIDATION_ERROR", 400);
    }

    let cond = null;
    if (Array.isArray(rule.rules)) {
      cond = compileRuleGroup(rule.rules, depth + 1, counter);
    } else {
      const hasField = rule.field !== undefined && rule.field !== null && String(rule.field).trim() !== "";
      const hasVal = rule.value !== undefined && rule.value !== null && String(rule.value).trim() !== "";
      if (!hasField && !hasVal) return;
      counter.count += 1;
      if (counter.count > MAX_QB_RULES) {
        throw createSqlError(
          `Số lượng điều kiện vượt quá giới hạn tối đa (${MAX_QB_RULES})`,
          "VALIDATION_ERROR",
          400,
        );
      }
      cond = buildRuleSqlCondition(rule);
    }

    if (!cond || !cond.sql) return;

    if (parts.length === 0) {
      parts.push(logic === "NOT" ? `NOT ${cond.sql}` : cond.sql);
    } else if (logic === "OR") {
      parts.push(`OR ${cond.sql}`);
    } else if (logic === "NOT") {
      parts.push(`AND NOT ${cond.sql}`);
    } else {
      parts.push(`AND ${cond.sql}`);
    }
    bindings.push(...cond.bindings);
  });

  if (parts.length === 0) return null;
  return { sql: `(${parts.join(" ")})`, bindings };
}

/**
 * Đánh giá truy vấn Visual Query Builder (AND / OR / NOT) trên PostgreSQL.
 * - Giới hạn tối đa 20 điều kiện, độ sâu lồng 3, độ dài giá trị 200
 * - Áp dụng statement_timeout cho cả User và Admin
 * - User (!isAdmin) luôn bị ép s.is_public = true ở tầng ngoài cùng.
 */
async function executeQueryBuilder(payload = {}, { isAdmin = false, timeoutMs = SQL_TIMEOUT_MS } = {}) {
  const rules = Array.isArray(payload.rules) ? payload.rules : [];
  if (rules.length > MAX_QB_RULES) {
    throw createSqlError(
      `Số lượng điều kiện vượt quá giới hạn tối đa (${MAX_QB_RULES})`,
      "VALIDATION_ERROR",
      400,
    );
  }
  const page = Math.max(1, Number(payload.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(payload.limit) || 25));
  const offset = (page - 1) * limit;

  const compiled = compileRuleGroup(rules, 1, { count: 0 });

  return knex.transaction(async (trx) => {
    await trx.raw("SET LOCAL TRANSACTION READ ONLY");
    await trx.raw(`SET LOCAL statement_timeout = '${Number(timeoutMs) || SQL_TIMEOUT_MS}ms'`);

    const baseQb = trx({ s: "specimens" })
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

    if (compiled && compiled.sql) {
      baseQb.whereRaw(compiled.sql, compiled.bindings);
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
  });
}

/**
 * Thực thi SQL trực tiếp cho Admin (DEF-115):
 * - BẮT BUỘC DB_READONLY_ROLE (thiếu cấu hình hoặc SET LOCAL ROLE lỗi → trả 503, KHÔNG chạy bằng role chính)
 * - Chạy trong transaction READ ONLY + search_path cố định + statement_timeout + LIMIT 500
 * - Mọi truy vấn đều ghi vào audit_logs
 */
async function executeAdminSql(rawSql, { adminId, ipAddress, timeoutMs = SQL_TIMEOUT_MS } = {}) {
  const readonlyRole = process.env.DB_READONLY_ROLE ? String(process.env.DB_READONLY_ROLE).trim() : "";
  if (!readonlyRole) {
    throw createSqlError(
      "Chế độ SQL trực tiếp tạm ngừng do chưa cấu hình DB_READONLY_ROLE",
      "SQL.READONLY_ROLE_UNAVAILABLE",
      503,
    );
  }

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
      await trx.raw("SET LOCAL search_path = public, pg_temp");
      await trx.raw(`SET LOCAL statement_timeout = '${Number(timeoutMs) || SQL_TIMEOUT_MS}ms'`);
      try {
        await trx.raw("SET LOCAL ROLE ??", [readonlyRole]);
      } catch (roleErr) {
        const err = createSqlError(
          `Không thể kích hoạt role chỉ-đọc (${readonlyRole}): ${roleErr.message}`,
          "SQL.READONLY_ROLE_UNAVAILABLE",
          503,
        );
        throw err;
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
    if (err?.statusCode === 503) {
      throw err;
    }
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
