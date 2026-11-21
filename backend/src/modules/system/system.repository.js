const knex = require("../../config/knex");

function normalizeClientIp(rawIp) {
  if (!rawIp) return null;
  let ip = String(rawIp).split(",")[0].trim();
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return "127.0.0.1";
  if (ip.toLowerCase().startsWith("::ffff:")) {
    ip = ip.slice(7);
  }
  if (!/^[0-9a-fA-F:.]+$/.test(ip)) return null;
  return ip;
}

async function insertAuditLog({ adminId, actionType, targetTable, targetId, ipAddress, details }) {
  // Cột ip_address kiểu INET — chuẩn hóa IPv6 loopback (::1) & IPv6-mapped IPv4 (::ffff:x.x.x.x) về IPv4 chuẩn
  const cleanIp = normalizeClientIp(ipAddress);

  await knex("audit_logs").insert({
    admin_id: adminId || null,
    action_type: String(actionType || "SYSTEM").slice(0, 50),
    target_table: targetTable ? String(targetTable).slice(0, 50) : null,
    target_id: targetId != null ? String(targetId).slice(0, 50) : null,
    ip_address: cleanIp,
    details: details ? JSON.stringify(details) : null,
  });
}

async function findAuditLogs(filters = {}) {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25));
  const offset = (page - 1) * limit;

  const baseQb = knex({ al: "audit_logs" }).leftJoin(
    { a: "admin_users" },
    "al.admin_id",
    "a.admin_id",
  );

  if (filters.actionType && filters.actionType.trim()) {
    baseQb.where("al.action_type", filters.actionType.trim().toUpperCase());
  }
  if (filters.targetTable && filters.targetTable.trim()) {
    baseQb.where("al.target_table", filters.targetTable.trim());
  }
  if (filters.dateFrom) {
    baseQb.where("al.log_timestamp", ">=", `${filters.dateFrom}T00:00:00Z`);
  }
  if (filters.dateTo) {
    baseQb.where("al.log_timestamp", "<=", `${filters.dateTo}T23:59:59Z`);
  }
  if (filters.q && filters.q.trim()) {
    const safe = `%${String(filters.q.trim()).slice(0, 100).replace(/[%_\\]/g, "\\$&")}%`;
    baseQb.andWhere((sub) => {
      sub
        .whereRaw("a.username ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("al.target_id ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("al.target_table ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("al.action_type ILIKE ? ESCAPE '\\'", [safe]);
    });
  }

  const [{ total }] = await baseQb.clone().count("* as total");
  const totalInt = parseInt(total, 10);

  const rows = await baseQb
    .clone()
    .select(
      "al.log_id",
      "al.admin_id",
      "a.username as admin_username",
      "a.full_name as admin_full_name",
      "al.action_type",
      "al.target_table",
      "al.target_id",
      knex.raw("HOST(al.ip_address) as ip_address"),
      "al.log_timestamp",
      "al.details",
    )
    .orderBy("al.log_timestamp", "desc")
    .orderBy("al.log_id", "desc")
    .limit(limit)
    .offset(offset);

  return {
    items: rows,
    total: totalInt,
    page,
    limit,
    totalPages: Math.ceil(totalInt / limit),
  };
}

async function findAllConfigs() {
  return knex("system_config").orderBy("config_category", "asc").orderBy("config_key", "asc");
}

async function findConfigByKey(key) {
  return knex("system_config").where("config_key", key).first();
}

async function upsertConfig(key, configValue, category, adminId) {
  const [row] = await knex("system_config")
    .insert({
      config_key: key,
      config_value: JSON.stringify(configValue),
      config_category: category || "general",
      updated_by: adminId || null,
      updated_at: knex.fn.now(),
    })
    .onConflict("config_key")
    .merge(["config_value", "config_category", "updated_by", "updated_at"])
    .returning("*");
  return row;
}

module.exports = {
  insertAuditLog,
  findAuditLogs,
  findAllConfigs,
  findConfigByKey,
  upsertConfig,
};
