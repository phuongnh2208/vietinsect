"use strict";

require("dotenv").config();
const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../app");
const knex = require("../../src/config/knex");
const pool = require("../../src/config/db");
const { closeRateLimiterRedis } = require("../../src/middleware/rateLimiter");

describe("Sprint B Group 1 – Auth & Security Integration Tests (DEF-007~014)", () => {
  const suffix = Date.now().toString(36);
  const testUser = `auth_test_${suffix}`;
  const testPass = "Strong@Pass1234";
  let testAdminId = null;

  beforeAll(async () => {
    const hash = await bcrypt.hash(testPass, 10);
    const [row] = await knex("admin_users")
      .insert({
        username: testUser,
        password_hash: hash,
        full_name: "Auth Test Admin",
        email: `${testUser}@vietinsect.vn`,
      })
      .returning("admin_id");
    testAdminId = Number(row.admin_id ?? row);
  });

  afterAll(async () => {
    if (testAdminId) {
      await knex("admin_refresh_tokens").where("admin_id", testAdminId).delete();
      await knex("audit_logs").where("admin_id", testAdminId).delete();
      await knex("admin_users").where("admin_id", testAdminId).delete();
    }
    await closeRateLimiterRedis();
    await knex.destroy();
    await pool.end();
  });

  test("DEF-011 & DEF-014: lock after 5 failed attempts, auto-unlock after 30m, and admin unlock endpoint", async () => {
    // Use unique X-Forwarded-For to avoid hitting 10 req/min auth rate limiter across tests
    const ip = "10.0.1.11";
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", ip)
        .send({ username: testUser, password: "WrongPassword1!" });
      expect(r.status).toBe(401);
    }

    // 6th attempt must return 423 ACCOUNT_LOCKED even with wrong password
    const lockedRes = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", ip)
      .send({ username: testUser, password: "WrongPassword1!" });
    expect(lockedRes.status).toBe(423);
    expect(lockedRes.body.code).toBe("AUTH.ACCOUNT_LOCKED");

    // Simulate 31 minutes elapsed (locked_until in the past)
    await knex("admin_users")
      .where("admin_id", testAdminId)
      .update({ locked_until: new Date(Date.now() - 60 * 1000) });

    // One wrong attempt after lock expiry resets counter to 1 (does NOT re-lock immediately)
    const afterExpiryWrong = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.1.12")
      .send({ username: testUser, password: "WrongPassword1!" });
    expect(afterExpiryWrong.status).toBe(401);

    const userRow = await knex("admin_users").where("admin_id", testAdminId).first();
    expect(userRow.failed_login_attempts).toBe(1);
    expect(userRow.locked_until).toBeNull();

    // Now lock again and unlock via Admin endpoint (DEF-014)
    await knex("admin_users")
      .where("admin_id", testAdminId)
      .update({
        failed_login_attempts: 5,
        locked_until: new Date(Date.now() + 30 * 60000),
      });

    // Login as seeded admin_test to call unlock
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.1.13")
      .send({ username: "admin_test", password: "Admin@Test1234" });
    expect(adminLogin.status).toBe(200);

    const unlockRes = await request(app)
      .post(`/api/system/admins/${testAdminId}/unlock`)
      .set("Authorization", `Bearer ${adminLogin.body.data.accessToken}`);
    expect(unlockRes.status).toBe(200);
    expect(unlockRes.body.data.unlocked).toBe(true);
  });

  test("DEF-013 & DEF-007: refresh token rotation invalidates old cookie and 60m inactivity times out", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.1.20")
      .send({ username: testUser, password: testPass });
    expect(loginRes.status).toBe(200);

    const cookies = loginRes.headers["set-cookie"] || [];
    const refreshCookie = cookies.find((c) => c.startsWith("vietinsect_refresh="));
    expect(refreshCookie).toBeTruthy();
    expect(refreshCookie.toLowerCase()).toContain("httponly");
    expect(refreshCookie.toLowerCase()).toContain("samesite=strict");

    // 1. Refresh succeeds and rotates cookie
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookie);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeTruthy();
    const rotatedCookie = (refreshRes.headers["set-cookie"] || []).find((c) =>
      c.startsWith("vietinsect_refresh="),
    );
    expect(rotatedCookie).toBeTruthy();
    expect(rotatedCookie).not.toBe(refreshCookie);

    // 2. Reusing OLD cookie fails with 401
    const replayRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookie);
    expect(replayRes.status).toBe(401);

    // 3. Simulate 61 minutes of inactivity -> refresh fails with 401 (DEF-007)
    await knex("admin_refresh_tokens")
      .where("admin_id", testAdminId)
      .whereNull("revoked_at")
      .update({ last_activity_at: new Date(Date.now() - 61 * 60 * 1000) });

    const idleRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", rotatedCookie);
    expect(idleRes.status).toBe(401);
  });

  test("DEF-009, DEF-012 & DEF-008: logout blacklists accessToken + logs audit; logout-all revokes all sessions", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.1.30")
      .send({ username: testUser, password: testPass });
    const token = loginRes.body.data.accessToken;
    const cookie = (loginRes.headers["set-cookie"] || []).find((c) =>
      c.startsWith("vietinsect_refresh="),
    );

    // Logout with Bearer token + cookie
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", cookie);
    expect(logoutRes.status).toBe(200);

    // Access token is immediately rejected (blacklisted)
    const afterLogout = await request(app)
      .get("/api/system/audit-logs")
      .set("Authorization", `Bearer ${token}`);
    expect(afterLogout.status).toBe(401);

    // Audit log recorded LOGOUT
    const logRow = await knex("audit_logs")
      .where({ admin_id: testAdminId, action_type: "LOGOUT" })
      .first();
    expect(logRow).toBeTruthy();

    // Login again and test logout-all
    const login2 = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.1.31")
      .send({ username: testUser, password: testPass });
    const token2 = login2.body.data.accessToken;

    const logoutAllRes = await request(app)
      .post("/api/auth/logout-all")
      .set("Authorization", `Bearer ${token2}`);
    expect(logoutAllRes.status).toBe(200);

    const afterLogoutAll = await request(app)
      .get("/api/system/audit-logs")
      .set("Authorization", `Bearer ${token2}`);
    expect(afterLogoutAll.status).toBe(401);
  });

  test("DEF-010: change-password rejects weak passwords with HTTP 400", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.1.40")
      .send({ username: testUser, password: testPass });
    const token = loginRes.body.data.accessToken;

    // Missing special char & uppercase
    const weakRes = await request(app)
      .post("/api/auth/change-password")
      .set("X-Forwarded-For", "10.0.1.40")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: testPass, newPassword: "alllowercase1234" });

    expect(weakRes.status).toBe(400);
    expect(weakRes.body.code).toBe("VALIDATION_ERROR");
  });
});
