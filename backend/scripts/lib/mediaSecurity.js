"use strict";

/**
 * backend/scripts/lib/mediaSecurity.js
 * Bước 3 – Tiện ích bảo mật tải ảnh từ GBIF/iNaturalist vào MinIO:
 * - Whitelist host: inaturalist-open-data.s3.amazonaws.com, static.inaturalist.org
 * - Chặn IP nội bộ/loopback (kể cả sau DNS lookup), chặn redirect ra host ngoài whitelist
 * - Giới hạn kích thước stream (<= 10 MB, hủy ngay khi vượt)
 * - Kiểm tra magic bytes (JPEG, PNG, WebP)
 * - Xử lý ảnh với sharp (limitInputPixels, bỏ EXIF cho bản Public, sinh thumbnail 200x200)
 * - Dedupe bằng SHA-256 hash
 */

const dns = require("dns").promises;
const net = require("net");
const crypto = require("crypto");
const axios = require("axios");
const { normalizeOccurrenceLicense } = require("./gbifTransform");

const ALLOWED_HOSTS = new Set([
  "inaturalist-open-data.s3.amazonaws.com",
  "static.inaturalist.org",
]);

const DOWNLOADABLE_IMAGE_LICENSES = new Set(["CC0", "CC BY", "CC BY-SA"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_INPUT_PIXELS = 4096 * 4096; // 16,777,216 px

function isPrivateOrLoopbackIp(ip) {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 127) return true; // 127.0.0.0/8 loopback
    if (parts[0] === 10) return true; // 10.0.0.0/8 private
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 link-local
    if (parts[0] === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::" || low.startsWith("fc") || low.startsWith("fd") || low.startsWith("fe80")) {
      return true;
    }
    return false;
  }
  return true;
}

/**
 * Kiểm tra license của TỪNG ẢNH (multimedia.license)
 */
function classifyImageLicense(rawMediaLicense) {
  const lic = normalizeOccurrenceLicense(rawMediaLicense);
  return {
    license: lic,
    canDownloadToMinio: DOWNLOADABLE_IMAGE_LICENSES.has(lic),
  };
}

/**
 * Đổi URL iNaturalist sang kích thước "large" (~1024px).
 * Trả về null nếu URL không thuộc whitelist host hoặc không khớp mẫu iNaturalist.
 */
function toWhitelistedLargeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) return null;
  if (!parsed.pathname.includes("/photos/")) return null;
  const largePath = parsed.pathname.replace(/\/(original|medium|small|square)\./, "/large.");
  parsed.pathname = largePath;
  return parsed.toString();
}

/**
 * Kiểm tra magic bytes thực tế (JPEG, PNG, WebP)
 */
function detectImageMagicBytes(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  // WebP: RIFF....WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

async function assertSafeUrl(urlStr, dnsLookup = dns.lookup) {
  const parsed = new URL(urlStr);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("BLOCKED_PROTOCOL");
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("BLOCKED_HOST_NOT_WHITELISTED");
  }
  if (net.isIP(parsed.hostname) && isPrivateOrLoopbackIp(parsed.hostname)) {
    throw new Error("BLOCKED_PRIVATE_IP");
  }
  const addrs = await dnsLookup(parsed.hostname, { all: true });
  for (const a of addrs) {
    if (isPrivateOrLoopbackIp(a.address)) {
      throw new Error(`BLOCKED_DNS_PRIVATE_IP:${a.address}`);
    }
  }
}

/**
 * Tải ảnh an toàn với giới hạn stream <= 10 MB, chặn redirect ra ngoài whitelist,
 * kiểm tra magic bytes và tính SHA-256 hash.
 */
async function safeDownloadImage(urlStr, { timeoutMs = 15000, maxBytes = MAX_BYTES, httpClient = axios, dnsLookup = dns.lookup } = {}) {
  await assertSafeUrl(urlStr, dnsLookup);

  const res = await httpClient.get(urlStr, {
    responseType: "stream",
    timeout: timeoutMs,
    maxRedirects: 0,
    validateStatus: (s) => s >= 200 && s < 400,
    headers: { "User-Agent": "VietInsect-Media-Sync/2.0 (vietinsect.vast.vn)" },
  });

  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers?.location;
    if (!loc) throw new Error("BLOCKED_REDIRECT_NO_LOCATION");
    await assertSafeUrl(new URL(loc, urlStr).toString(), dnsLookup);
    throw new Error("BLOCKED_REDIRECT");
  }

  const chunks = [];
  let totalBytes = 0;

  await new Promise((resolve, reject) => {
    res.data.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        res.data.destroy();
        reject(new Error(`BLOCKED_FILE_TOO_LARGE:${totalBytes}`));
        return;
      }
      chunks.push(chunk);
    });
    res.data.on("end", resolve);
    res.data.on("error", reject);
  });

  const buffer = Buffer.concat(chunks);
  const mime = detectImageMagicBytes(buffer);
  if (!mime) {
    throw new Error("BLOCKED_INVALID_MAGIC_BYTES");
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  return { buffer, mime, sha256, bytes: buffer.length };
}

module.exports = {
  ALLOWED_HOSTS,
  MAX_BYTES,
  MAX_INPUT_PIXELS,
  isPrivateOrLoopbackIp,
  classifyImageLicense,
  toWhitelistedLargeUrl,
  detectImageMagicBytes,
  assertSafeUrl,
  safeDownloadImage,
};
