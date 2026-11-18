const crypto = require("crypto");
const { JWT_SECRET } = require("../../config/jwt");

const PRIVATE_MEDIA_URL_TTL_SEC = 15 * 60; // 15 phút cho ảnh Private khi Admin xem trên trình duyệt

// Dẫn xuất khóa con độc lập qua HKDF để tách biệt khóa ký URL ảnh khỏi khóa ký JWT
const MEDIA_SIGNING_KEY = Buffer.from(
  crypto.hkdfSync(
    "sha256",
    Buffer.from(JWT_SECRET, "utf8"),
    Buffer.from("vietinsect-media-hkdf-salt-v1", "utf8"),
    Buffer.from("media-proxy-url-signature", "utf8"),
    32,
  ),
);

function getApiPublicOrigin() {
  if (process.env.API_PUBLIC_URL) {
    return process.env.API_PUBLIC_URL.replace(/\/+$/, "");
  }
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

function signMediaAccess(imageId, expUnixSec) {
  return crypto
    .createHmac("sha256", MEDIA_SIGNING_KEY)
    .update(`vietinsect-media:${Number(imageId)}:${Number(expUnixSec)}`)
    .digest("hex");
}

function verifyMediaAccess(imageId, expUnixSec, sigHex) {
  if (!expUnixSec || !sigHex) return false;
  const exp = Number(expUnixSec);
  if (!Number.isInteger(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = signMediaAccess(imageId, exp);
  if (String(sigHex).length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(String(sigHex), "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function buildMediaProxyUrl(imageId, { isAdmin = false, isEffectivelyPublic = true } = {}) {
  const id = Number(imageId);
  const base = `${getApiPublicOrigin()}/api/media/${id}/file`;
  if (!isEffectivelyPublic && isAdmin) {
    const exp = Math.floor(Date.now() / 1000) + PRIVATE_MEDIA_URL_TTL_SEC;
    const sig = signMediaAccess(id, exp);
    return `${base}?exp=${exp}&sig=${sig}`;
  }
  return base;
}

module.exports = {
  buildMediaProxyUrl,
  verifyMediaAccess,
};
