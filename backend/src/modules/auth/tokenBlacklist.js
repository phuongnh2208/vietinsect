"use strict";

const { getRedisState } = require("../../middleware/rateLimiter");

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
  const localExp = localJtiBlacklist.get(jti);
  if (localExp) {
    if (localExp > Date.now()) return true;
    localJtiBlacklist.delete(jti);
  }

  const { client, ready } = getRedisState();
  if (ready && client) {
    try {
      const val = await client.get(`bl:jti:${jti}`);
      return val === "1";
    } catch {
      return false;
    }
  }
  return false;
}

async function revokeUserTokensBefore(adminId, epochSeconds = Math.floor(Date.now() / 1000)) {
  if (!adminId) return;
  const key = String(adminId);
  localUserRevokedBefore.set(key, epochSeconds);

  const { client, ready } = getRedisState();
  if (ready && client) {
    await client.set(`bl:user:${key}`, String(epochSeconds), "EX", 86400).catch(() => {});
  }
}

async function isUserTokenRevoked(adminId, iatSeconds) {
  if (!adminId || !iatSeconds) return false;
  const key = String(adminId);

  const localTs = localUserRevokedBefore.get(key);
  if (localTs != null && iatSeconds <= localTs) {
    return true;
  }

  const { client, ready } = getRedisState();
  if (ready && client) {
    try {
      const val = await client.get(`bl:user:${key}`);
      if (val != null && iatSeconds <= Number(val)) {
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
