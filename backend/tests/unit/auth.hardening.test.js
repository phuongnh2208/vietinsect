"use strict";

jest.mock("../../src/middleware/rateLimiter", () => ({
  getRedisState: jest.fn(),
}));

const { getRedisState } = require("../../src/middleware/rateLimiter");
const { getRefreshCookieOptions } = require("../../src/modules/auth/auth.controller");
const { isTokenBlacklisted } = require("../../src/modules/auth/tokenBlacklist");

describe("Sprint B Group 1 Follow-up: Cookie env, Redis fail-closed (ADR-003)", () => {
  afterEach(() => {
    delete process.env.REDIS_FAIL_CLOSED;
    jest.clearAllMocks();
  });

  test("Refresh cookie Secure flag is false in development (http://localhost) and true in production", () => {
    const devOpts = getRefreshCookieOptions("development");
    expect(devOpts.httpOnly).toBe(true);
    expect(devOpts.sameSite).toBe("strict");
    expect(devOpts.secure).toBe(false);

    const prodOpts = getRefreshCookieOptions("production");
    expect(prodOpts.httpOnly).toBe(true);
    expect(prodOpts.sameSite).toBe("strict");
    expect(prodOpts.secure).toBe(true);
  });

  test("ADR-003: tokenBlacklist fails closed with HTTP 503 when Redis is unavailable and REDIS_FAIL_CLOSED=true", async () => {
    process.env.REDIS_FAIL_CLOSED = "true";
    getRedisState.mockReturnValue({ client: null, ready: false });

    await expect(isTokenBlacklisted("test-jti")).rejects.toMatchObject({
      statusCode: 503,
      code: "AUTH.REDIS_UNAVAILABLE",
    });
  });

  test("ADR-003: tokenBlacklist falls back to memory in dev/test when REDIS_FAIL_CLOSED is not set", async () => {
    getRedisState.mockReturnValue({ client: null, ready: false });
    await expect(isTokenBlacklisted("unknown-jti")).resolves.toBe(false);
  });
});
