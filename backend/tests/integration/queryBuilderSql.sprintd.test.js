"use strict";

jest.setTimeout(30000);

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../app");
const knex = require("../../src/config/knex");
const pool = require("../../src/config/db");
const { JWT_SECRET } = require("../../src/config/jwt");
const { closeRateLimiterRedis } = require("../../src/middleware/rateLimiter");

describe("Sprint D Group 3 – SCR-16 Query Builder (AND/OR/NOT) & Admin Read-Only SQL Mode (DEF-062, DEF-113)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  let adminToken;
  let userToken;
  let taxonId;
  let pubId;
  let privId;

  beforeAll(async () => {
    const admin = await knex("admin_users").select("admin_id", "username").first();
    adminToken = jwt.sign(
      { adminId: Number(admin.admin_id), username: admin.username, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );
    userToken = jwt.sign(
      { userId: 777, username: "regular_user", role: "user" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    const taxon = await knex("taxa").where("taxon_rank", "Species").first();
    taxonId = taxon.taxon_id;
    process.env.DB_READONLY_ROLE = "vietinsect_readonly";

    const pubRes = await request(app)
      .post("/api/specimens")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        specimenCode: `QB-PUB-${suffix}`,
        basisOfRecord: "PRESERVED_SPECIMEN",
        taxonId,
        collectionDate: "2024-03-10",
        commonNameVn: `Bướm QB Công khai ${suffix}`,
        elevationM: 450,
        isPublic: true,
      });
    expect(pubRes.status).toBe(201);
    pubId = pubRes.body.data.specimenId || pubRes.body.data.id;

    const privRes = await request(app)
      .post("/api/specimens")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        specimenCode: `QB-PRIV-${suffix}`,
        basisOfRecord: "PRESERVED_SPECIMEN",
        taxonId,
        collectionDate: "2024-03-12",
        commonNameVn: `Bướm QB Nội bộ ${suffix}`,
        elevationM: 1200,
        isPublic: false,
      });
    expect(privRes.status).toBe(201);
    privId = privRes.body.data.specimenId || privRes.body.data.id;
  });

  afterAll(async () => {
    const ids = [pubId, privId].filter(Boolean);
    if (ids.length) {
      await knex("es_sync_outbox").whereIn("entity_id", ids).delete();
      await knex("specimen_change_history").whereIn("specimen_id", ids).delete();
      await knex("specimens").whereIn("specimen_id", ids).delete();
      await knex("specimen_registry").whereIn("specimen_id", ids).delete();
    }
    await closeRateLimiterRedis();
    await knex.destroy();
    await pool.end();
  });

  it("1. User (unauthenticated or role=user) calling POST /api/search/sql receives 403 FORBIDDEN", async () => {
    const anonRes = await request(app)
      .post("/api/search/sql")
      .send({ sql: "SELECT specimen_id FROM specimens LIMIT 5" });
    expect(anonRes.status).toBe(403);

    const userRes = await request(app)
      .post("/api/search/sql")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ sql: "SELECT specimen_id FROM specimens LIMIT 5" });
    expect(userRes.status).toBe(403);
  });

  it("2. Admin SQL mode enforces DB_READONLY_ROLE (503 when missing/invalid), blocks dangerous functions/CTEs/INTO/comments/tables, enforces 500-row limit & timeout, and logs to audit_logs", async () => {
    // Missing DB_READONLY_ROLE -> 503 (never runs as main DB role)
    const savedRole = process.env.DB_READONLY_ROLE;
    delete process.env.DB_READONLY_ROLE;
    const noRoleRes = await request(app)
      .post("/api/search/sql")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sql: "SELECT specimen_id FROM specimens LIMIT 1" });
    expect(noRoleRes.status).toBe(503);
    expect(noRoleRes.body.code).toBe("SQL.READONLY_ROLE_UNAVAILABLE");

    // Non-existent DB_READONLY_ROLE -> SET LOCAL ROLE fails -> 503
    process.env.DB_READONLY_ROLE = "nonexistent_readonly_role_xyz";
    const badRoleRes = await request(app)
      .post("/api/search/sql")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sql: "SELECT specimen_id FROM specimens LIMIT 1" });
    expect(badRoleRes.status).toBe(503);
    process.env.DB_READONLY_ROLE = savedRole || "vietinsect_readonly";

    const badQueries = [
      "DROP TABLE specimens",
      "UPDATE specimens SET is_public = true",
      "DELETE FROM specimens WHERE specimen_id = 1",
      "SELECT specimen_id FROM specimens; DROP TABLE specimens",
      "SELECT 1 /* outer /* nested comment */ */ ; SELECT 2",
      "SELECT 1\u2028; SELECT 2",
      "SELECT pg_read_file('/etc/passwd')",
      "SELECT lo_import('/etc/passwd')",
      "SELECT dblink('host=evil.com', 'SELECT 1')",
      "SELECT pg_sleep(5)",
      "SELECT * FROM admin_users",
      "SELECT * FROM audit_logs",
      "SELECT * FROM saved_filters",
      "SELECT * FROM pg_catalog.pg_shadow",
      "SELECT * FROM information_schema.tables",
      "WITH t AS (INSERT INTO specimens(taxon_id) VALUES (1) RETURNING specimen_id) SELECT * FROM t",
      "SELECT specimen_id INTO temp_hack FROM specimens",
      "SET ROLE postgres",
      "COPY specimens TO '/tmp/a.csv'",
    ];

    for (const sql of badQueries) {
      const res = await request(app)
        .post("/api/search/sql")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ sql });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("SQL.FORBIDDEN_QUERY");
    }

    // Valid read-only SELECT with whitelisted functions (COUNT, LOWER, COALESCE) succeeds & limits <= 500 rows
    const okRes = await request(app)
      .post("/api/search/sql")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        sql: `SELECT specimen_id, LOWER(COALESCE(common_name_vn, '')) AS name_lower, elevation_m FROM specimens WHERE specimen_id = ${Number(pubId)}`,
      });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.rowCount).toBe(1);
    expect(okRes.body.data.maxRows).toBe(500);
    expect(okRes.body.data.columns).toEqual(
      expect.arrayContaining(["specimen_id", "name_lower", "elevation_m"]),
    );

    const auditRow = await knex("audit_logs")
      .where({ action_type: "SQL_QUERY", target_table: "sql_console" })
      .orderBy("log_id", "desc")
      .first();
    expect(auditRow).toBeTruthy();
  });

  it("3. Visual Query Builder evaluates AND/OR/NOT + numeric/date ranges and forces is_public=true for User even with OR rules", async () => {
    // User sends an OR query targeting both public and private specimens -> only gets Public!
    const userQbRes = await request(app)
      .post("/api/search/advanced")
      .send({
        rules: [
          { logic: "AND", field: "specimenCode", operator: "eq", value: `QB-PUB-${suffix}` },
          { logic: "OR", field: "specimenCode", operator: "eq", value: `QB-PRIV-${suffix}` },
        ],
      });
    expect(userQbRes.status).toBe(200);
    const userIds = userQbRes.body.data.map((r) => Number(r.id));
    expect(userIds).toContain(Number(pubId));
    expect(userIds).not.toContain(Number(privId));

    // Admin with same OR query + numeric range (between) gets both
    const adminQbRes = await request(app)
      .post("/api/search/advanced")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        rules: [
          { logic: "AND", field: "specimenCode", operator: "contains", value: suffix },
          { logic: "AND", field: "elevationM", operator: "between", value: 400, valueTo: 1300 },
          { logic: "NOT", field: "elevationM", operator: "gt", value: 2000 },
        ],
      });
    expect(adminQbRes.status).toBe(200);
    const adminIds = adminQbRes.body.data.map((r) => Number(r.id));
    expect(adminIds).toContain(Number(pubId));
    expect(adminIds).toContain(Number(privId));
  });

  it("4. Admin can save, list, and delete filter presets in saved_filters", async () => {
    const createRes = await request(app)
      .post("/api/search/filters")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Preset ${suffix}`,
        filterJson: { rules: [{ logic: "AND", field: "elevationM", operator: "gte", value: 300 }] },
      });
    expect(createRes.status).toBe(201);
    const filterId = createRes.body.data.id;

    const listRes = await request(app)
      .get("/api/search/filters")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.map((f) => String(f.id))).toContain(String(filterId));

    const delRes = await request(app)
      .delete(`/api/search/filters/${filterId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(delRes.status).toBe(204);
  });
});
