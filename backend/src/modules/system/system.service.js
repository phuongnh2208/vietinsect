const systemRepository = require("./system.repository");
const { encryptSecret, decryptSecret, maskSecret } = require("../../utils/cryptoConfig");
const logger = require("../../config/logger");

// Danh mục khóa cấu hình chuẩn (các khóa isSecret=true luôn được mã hóa AES-256-GCM trong DB)
const DEFAULT_SYSTEM_CONFIGS = [
  {
    key: "default_public_license",
    category: "compliance",
    isSecret: false,
    description: "Giấy phép mặc định cho dữ liệu mở xuất bản trên cổng VietInsect (SRS §6.2)",
    defaultValue: "CC BY 4.0",
  },
  {
    key: "dwca_exclude_nc_nd_media",
    category: "compliance",
    isSecret: false,
    description: "Tự động loại bỏ ảnh CC-BY-NC / ND khi đóng gói Darwin Core Archive cho GBIF",
    defaultValue: true,
  },
  {
    key: "minio_media_bucket",
    category: "storage",
    isSecret: false,
    description: "Tên bucket lưu trữ hình ảnh mẫu vật nội bộ trên cụm MinIO Việt Nam",
    defaultValue: "vietinsect-media",
  },
  {
    key: "ncbi_rate_limit_rps",
    category: "integration",
    isSecret: false,
    description: "Giới hạn tốc độ truy vấn NCBI E-utilities (3 req/s mặc định, 10 req/s khi có API Key)",
    defaultValue: 3,
  },
  {
    key: "ncbi_api_key",
    category: "secrets",
    isSecret: true,
    description: "NCBI Entrez API Key (mã hóa AES-256-GCM trong CSDL, nâng tốc độ lên 10 req/s)",
    defaultValue: "",
  },
  {
    key: "gbif_download_credentials",
    category: "secrets",
    isSecret: true,
    description: "Thông tin xác thực GBIF Occurrence Download API bất đồng bộ (mã hóa AES-256-GCM)",
    defaultValue: "",
  },
];

const SECRET_KEYS_SET = new Set(
  DEFAULT_SYSTEM_CONFIGS.filter((c) => c.isSecret).map((c) => c.key),
);

function isSecretConfigKey(key) {
  return SECRET_KEYS_SET.has(key) || /secret|password|token|api_key/i.test(key);
}

async function logAudit(entry) {
  try {
    await systemRepository.insertAuditLog(entry);
  } catch (err) {
    logger.warn(`Không thể ghi audit_logs (${entry.actionType}): ${err.message}`);
  }
}

async function ensureDefaultConfigs() {
  const existing = await systemRepository.findAllConfigs();
  const existingKeys = new Set(existing.map((r) => r.config_key));

  for (const def of DEFAULT_SYSTEM_CONFIGS) {
    if (!existingKeys.has(def.key)) {
      const storedPayload = def.isSecret
        ? { isSecret: true, description: def.description, secret: null }
        : { isSecret: false, description: def.description, value: def.defaultValue };
      await systemRepository.upsertConfig(def.key, storedPayload, def.category, null);
    }
  }
}

function toConfigDto(row) {
  const raw = row.config_value || {};
  const secretFlag = Boolean(raw.isSecret || isSecretConfigKey(row.config_key));

  if (secretFlag) {
    let masked = "";
    let hasValue = false;
    if (raw.secret?.encrypted) {
      try {
        const plain = decryptSecret(raw.secret);
        if (plain) {
          hasValue = true;
          masked = maskSecret(plain);
        }
      } catch {
        hasValue = true;
        masked = "••••••••••••";
      }
    }
    return {
      key: row.config_key,
      category: row.config_category || "secrets",
      isSecret: true,
      hasValue,
      value: masked, // Không bao giờ trả plaintext API key ra response
      encryption: "AES-256-GCM",
      description: raw.description || "",
      updatedAt: row.updated_at,
    };
  }

  return {
    key: row.config_key,
    category: row.config_category || "general",
    isSecret: false,
    hasValue: raw.value !== undefined && raw.value !== null && raw.value !== "",
    value: raw.value ?? null,
    encryption: null,
    description: raw.description || "",
    updatedAt: row.updated_at,
  };
}

async function listConfigs() {
  await ensureDefaultConfigs();
  const rows = await systemRepository.findAllConfigs();
  return rows.map(toConfigDto);
}

async function updateConfig(key, { value, category, description, isSecret }, adminId, ipAddress) {
  const current = await systemRepository.findConfigByKey(key);
  const currentVal = current?.config_value || {};
  const treatAsSecret = Boolean(isSecret || currentVal.isSecret || isSecretConfigKey(key));
  const nextCategory = category || current?.config_category || (treatAsSecret ? "secrets" : "general");
  const nextDesc = description !== undefined ? description : currentVal.description || "";

  let storedPayload;
  if (treatAsSecret) {
    const encryptedObj = value ? encryptSecret(String(value)) : null;
    storedPayload = {
      isSecret: true,
      description: nextDesc,
      secret: encryptedObj,
    };
  } else {
    storedPayload = {
      isSecret: false,
      description: nextDesc,
      value,
    };
  }

  const updated = await systemRepository.upsertConfig(key, storedPayload, nextCategory, adminId);

  await logAudit({
    adminId,
    actionType: "UPDATE_CONFIG",
    targetTable: "system_config",
    targetId: key,
    ipAddress,
    // Không bao giờ ghi giá trị bí mật vào bảng log
    details: {
      key,
      category: nextCategory,
      encrypted: treatAsSecret ? "AES-256-GCM" : false,
    },
  });

  return toConfigDto(updated);
}

/**
 * Dùng nội bộ cho các service/script backend đọc API key đã giải mã từ system_config.
 */
async function getDecryptedSecret(key) {
  const row = await systemRepository.findConfigByKey(key);
  if (!row?.config_value?.secret?.encrypted) return null;
  try {
    return decryptSecret(row.config_value.secret);
  } catch {
    return null;
  }
}

async function listAuditLogs(filters) {
  const res = await systemRepository.findAuditLogs(filters);
  return {
    items: res.items.map((r) => ({
      id: Number(r.log_id),
      adminId: r.admin_id ? Number(r.admin_id) : null,
      adminUsername: r.admin_username || "system",
      adminFullName: r.admin_full_name || null,
      actionType: r.action_type,
      targetTable: r.target_table,
      targetId: r.target_id,
      ipAddress: r.ip_address || null,
      timestamp: r.log_timestamp,
      details: r.details || null,
    })),
    pagination: {
      total: res.total,
      page: res.page,
      limit: res.limit,
      totalPages: res.totalPages,
    },
  };
}

module.exports = {
  logAudit,
  listConfigs,
  updateConfig,
  getDecryptedSecret,
  listAuditLogs,
};
