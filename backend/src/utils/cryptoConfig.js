const fs = require("fs");
const crypto = require("crypto");

let _keyringCache = null;

/**
 * SRS §5.2: Mã hóa AES-256-GCM có đánh phiên bản khóa (key_version) hỗ trợ xoay vòng khóa không gián đoạn.
 *
 * Cấu trúc tệp khóa ngoài repo (CONFIG_ENCRYPTION_KEY_FILE):
 *   { "currentVersion": "v1", "keys": { "v1": { "secret": "<64-hex>", "salt": "<32-hex>" } } }
 * (Tương thích ngược với định dạng đơn { "secret": "...", "salt": "..." } -> mặc định "v1").
 */
function loadKeyring() {
  if (_keyringCache) return _keyringCache;

  const derivedByVersion = new Map();
  let currentVersion = "v1";

  const keyFilePath = process.env.CONFIG_ENCRYPTION_KEY_FILE;
  if (keyFilePath) {
    if (!fs.existsSync(keyFilePath)) {
      throw new Error(
        `CRITICAL: Tệp khóa gốc CONFIG_ENCRYPTION_KEY_FILE không tồn tại tại đường dẫn: ${keyFilePath}`,
      );
    }
    const rawContent = fs.readFileSync(keyFilePath, "utf8").trim();
    const parsed = JSON.parse(rawContent);

    if (parsed.keys && typeof parsed.keys === "object") {
      currentVersion = parsed.currentVersion || Object.keys(parsed.keys)[0] || "v1";
      for (const [ver, entry] of Object.entries(parsed.keys)) {
        if (!entry?.secret || String(entry.secret).length < 32) {
          throw new Error(`CRITICAL: Khóa gốc phiên bản ${ver} không hợp lệ (< 32 ký tự).`);
        }
        const salt = entry.salt || `vietinsect-aes256gcm-salt-${ver}`;
        derivedByVersion.set(ver, crypto.scryptSync(String(entry.secret), String(salt), 32));
      }
    } else if (parsed.secret && String(parsed.secret).length >= 32) {
      currentVersion = parsed.keyVersion || "v1";
      const salt = parsed.salt || "vietinsect-aes256gcm-salt-v2";
      derivedByVersion.set(currentVersion, crypto.scryptSync(String(parsed.secret), String(salt), 32));
    }
  } else if (process.env.CONFIG_ENCRYPTION_SECRET) {
    const secret = process.env.CONFIG_ENCRYPTION_SECRET;
    if (secret.length >= 32) {
      currentVersion = process.env.CONFIG_ENCRYPTION_KEY_VERSION || "v1";
      const salt = process.env.CONFIG_ENCRYPTION_SALT || "vietinsect-aes256gcm-salt-v2";
      derivedByVersion.set(currentVersion, crypto.scryptSync(secret, salt, 32));
    }
  }

  if (derivedByVersion.size === 0 || !derivedByVersion.has(currentVersion)) {
    throw new Error(
      "CRITICAL: Chưa cấu hình khóa gốc AES-256-GCM hợp lệ (>= 32 ký tự). " +
        "Hãy cấu hình CONFIG_ENCRYPTION_KEY_FILE trỏ tới tệp khóa ngoài repo (kèm sao lưu DR riêng).",
    );
  }

  _keyringCache = { currentVersion, derivedByVersion };
  return _keyringCache;
}

function encryptSecret(plainText) {
  if (plainText == null || plainText === "") return null;
  const { currentVersion, derivedByVersion } = loadKeyring();
  const key = derivedByVersion.get(currentVersion);
  const iv = crypto.randomBytes(12); // 96-bit IV chuẩn NIST cho AES-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: true,
    alg: "AES-256-GCM",
    keyVersion: currentVersion,
    iv: iv.toString("hex"),
    tag: authTag.toString("hex"),
    ciphertext: encrypted.toString("hex"),
  };
}

function decryptSecret(payload) {
  if (!payload || !payload.encrypted || !payload.ciphertext || !payload.iv || !payload.tag) {
    return null;
  }
  const { currentVersion, derivedByVersion } = loadKeyring();
  const ver = payload.keyVersion || currentVersion;
  const key = derivedByVersion.get(ver);
  if (!key) {
    throw new Error(`Không tìm thấy khóa giải mã cho phiên bản keyVersion=${ver}`);
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "hex"));
  decipher.setAuthTag(Buffer.from(payload.tag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function maskSecret(plainText) {
  if (!plainText) return "";
  const str = String(plainText);
  if (str.length <= 6) return "••••••••";
  return `${"•".repeat(12)}${str.slice(-4)}`;
}

module.exports = {
  encryptSecret,
  decryptSecret,
  maskSecret,
};
