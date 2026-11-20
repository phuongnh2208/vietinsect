"use strict";

const { getRedisState } = require("../../middleware/rateLimiter");
const AppError = require("../../utils/appError");

const REDIS_UNAVAILABLE = {
  code: "AUTH.REDIS_UNAVAILABLE",
  message: "Dịch vụ xác thực phiên (Redis) tạm thời gián đoạn, vui lòng thử lại sau",
  statusCode: 503,
};

function shouldFailClosed() {
  return process.env.REDIS_FAIL_CLOSED === "true" || process.env.NODE_ENV === "production";
}

// In-memory fallback when Redis is unavailable (e.g. unit tests without Redis)
const localJtiBlacklist = new Map(); // jti -> expiresAtMs
const localUserRevokedBefore = new Map(); // adminId -> epochSec

async function blacklistToken(jti, ttlSeconds = 900) {
  if (!jti) return;
  const ttl = Math.max(1, Math.ceil(ttlSeconds));
  localJtiBlacklist.set(jti, Date.now() + ttl * 1000);

  const { client, ready } = getRedisState();
  if (ready && client) {
    await client.set(`bl:jti:${jti}`, "1", "EX", ttl).catch(() => {});
  }
}

async function isTokenBlacklisted(jti) {
  if (!jti) return false;
  const { client, ready } = getRedisState();
  if (!ready || !client) {
    if (shouldFailClosed()) throw new AppError(REDIS_UNAVAILABLE);
    const localExp = localJtiBlacklist.get(jti);
    if (localExp) {
      if (localExp > Date.now()) return true;
      localJtiBlacklist.delete(jti);
    }
    return false;
  }

  try {
    const val = await client.get(`bl:jti:${jti}`);
    return val === "1";
  } catch {
    if (shouldFailClosed()) throw new AppError(REDIS_UNAVAILABLE);
    return false;
  }
}

async function revokeUserTokensBefore(adminId, epochMs = Date.now()) {
  if (!adminId) return;
  const key = String(adminId);
  localUserRevokedBefore.set(key, epochMs);

  const { client, ready } = getRedisState();
  if (ready && client) {
    await client.set(`bl:user:${key}`, String(epochMs), "EX", 86400).catch(() => {});
  }
}

async function isUserTokenRevoked(adminId, iatMs) {
  if (!adminId || !iatMs) return false;
  const key = String(adminId);

  const localTs = localUserRevokedBefore.get(key);
  if (localTs != null && iatMs <= localTs) {
    return true;
  }

  const { client, ready } = getRedisState();
  if (ready && client) {
    try {
      const val = await client.get(`bl:user:${key}`);
      if (val != null && iatMs <= Number(val)) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

module.exports = {
  blacklistToken,
  isTokenBlacklisted,
  revokeUserTokensBefore,
  isUserTokenRevoked,
};
