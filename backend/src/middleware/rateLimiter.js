const rateLimit = require("express-rate-limit");
const Redis = require("ioredis");
const logger = require("../config/logger");

let redisClient = null;
let redisReady = false;

try {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  redisClient.connect().catch(() => {});

  redisClient.on("ready", () => {
    redisReady = true;
    logger.info("Rate-limiter Redis store: connected");
  });

  redisClient.on("error", (err) => {
    if (redisReady) {
      logger.warn(`Rate-limiter Redis error – falling back to memory: ${err.message}`);
    }
    redisReady = false;
  });

  redisClient.on("close", () => {
    redisReady = false;
  });
} catch (err) {
  logger.warn(`Rate-limiter Redis init failed – using memory store: ${err.message}`);
}

/**
 * SRS §5.2: Redis-backed store cho express-rate-limit với prefix tách biệt từng limiter
 * và tự động fallback sang bộ nhớ trong khi Redis chưa kết nối hoặc gián đoạn tạm thời.
 */
class ResilientRedisStore {
  constructor(prefix, windowMs) {
    this.prefix = prefix;
    this.windowMs = windowMs;
    this.localHits = new Map();
  }

  init(options) {
    if (options?.windowMs) {
      this.windowMs = options.windowMs;
    }
  }

  _redisKey(key) {
    return `${this.prefix}${key}`;
  }

  _incrementLocal(key) {
    const now = Date.now();
    const existing = this.localHits.get(key);
    if (!existing || existing.resetAt <= now) {
      const entry = { count: 1, resetAt: now + this.windowMs };
      this.localHits.set(key, entry);
      return { totalHits: 1, resetTime: new Date(entry.resetAt) };
    }
    existing.count += 1;
    return { totalHits: existing.count, resetTime: new Date(existing.resetAt) };
  }

  async increment(key) {
    if (redisReady && redisClient) {
      try {
        const rKey = this._redisKey(key);
        const totalHits = await redisClient.incr(rKey);
        let pttl = await redisClient.pttl(rKey);
        if (totalHits === 1 || pttl < 0) {
          await redisClient.pexpire(rKey, this.windowMs);
          pttl = this.windowMs;
        }
        return {
          totalHits,
          resetTime: new Date(Date.now() + pttl),
        };
      } catch {
        return this._incrementLocal(key);
      }
    }
    return this._incrementLocal(key);
  }

  async decrement(key) {
    if (redisReady && redisClient) {
      try {
        await redisClient.decr(this._redisKey(key));
        return;
      } catch {
        // fallthrough
      }
    }
    const existing = this.localHits.get(key);
    if (existing && existing.count > 0) existing.count -= 1;
  }

  async resetKey(key) {
    this.localHits.delete(key);
    if (redisReady && redisClient) {
      await redisClient.del(this._redisKey(key)).catch(() => {});
    }
  }
}

const rateLimitResponse = (_req, res) => {
  res.status(429).json({
    success: false,
    code: "RATE_LIMIT",
    message: "Quá nhiều yêu cầu, vui lòng thử lại sau",
  });
};

// Global API rate limiter: 1.000 request / phút / IP (SRS §5.2)
const GLOBAL_WINDOW_MS = 60 * 1000;
const globalRateLimiter = rateLimit({
  windowMs: GLOBAL_WINDOW_MS,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  store: new ResilientRedisStore("rl:global:", GLOBAL_WINDOW_MS),
  handler: rateLimitResponse,
});

// Login/Auth mutation rate limiter: 10 request / phút / IP chống brute-force
const AUTH_WINDOW_MS = 60 * 1000;
const authRateLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new ResilientRedisStore("rl:auth:", AUTH_WINDOW_MS),
  handler: rateLimitResponse,
});

async function closeRateLimiterRedis() {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
  }
}

function getRedisState() {
  return { client: redisClient, ready: redisReady };
}

module.exports = { globalRateLimiter, authRateLimiter, closeRateLimiterRedis, getRedisState };
