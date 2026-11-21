"use strict";

jest.setTimeout(25000);

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../app");
const knex = require("../../src/config/knex");
const pool = require("../../src/config/db");
const { JWT_SECRET } = require("../../src/config/jwt");
const { esClient } = require("../../src/config/elasticsearch");
const esService = require("../../src/modules/search/elasticsearch.service");
const esOutbox = require("../../src/modules/search/esOutbox.service");
const logger = require("../../src/config/logger");
const { closeRateLimiterRedis } = require("../../src/middleware/rateLimiter");

describe("Sprint C Group 3 – PostgreSQL Transactional Outbox for ES Sync (DEF-112)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  let adminToken;
  let taxonId;
  let specimenId;

  beforeAll(async () => {
    await esService.ensureIndices();
    const admin = await knex("admin_users").select("admin_id", "username").first();
    adminToken = jwt.sign(
      { adminId: Number(admin.admin_id), username: admin.username, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    const taxon = await knex("taxa").where("taxon_rank", "Species").first();
    taxonId = taxon.taxon_id;

    // Create a clean public specimen for outbox tests
    const createRes = await request(app)
      .post("/api/specimens")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        specimenCode: `OUTBOX-${suffix}-01`,
        basisOfRecord: "PRESERVED_SPECIMEN",
        taxonId,
        collectionDate: "2024-05-01",
        commonNameVn: `Bọ Outbox ${suffix}`,
        isPublic: true,
      });
    expect(createRes.status).toBe(201);
    specimenId = createRes.body.data.specimenId || createRes.body.data.id;
    await esService.indexSpecimenNow(specimenId, { refresh: true });
    if (specimenId) {
      await knex("es_sync_outbox").where("entity_id", specimenId).delete();
    }
  });

  afterAll(async () => {
    if (specimenId) {
      await knex("es_sync_outbox").where("entity_id", specimenId).delete();
      await knex("specimen_change_history").where("specimen_id", specimenId).delete();
      await knex("specimens").where("specimen_id", specimenId).delete();
      await knex("specimen_registry").where("specimen_id", specimenId).delete();
    }
    await closeRateLimiterRedis();
    await knex.destroy();
    await pool.end();
  });

  it("(a) ES fails → DB update still returns 200 and outbox records a pending row", async () => {
    const spy = jest.spyOn(esClient, "index").mockRejectedValue(new Error("ES_DOWN_TEST"));
    try {
      const res = await request(app)
        .put(`/api/specimens/${specimenId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ notes: `Updated while ES down ${suffix}` });
      expect(res.status).toBe(200);

      const rows = await knex("es_sync_outbox")
        .where({ entity_type: "specimen", entity_id: specimenId, status: "pending" });
      expect(rows.length).toBeGreaterThanOrEqual(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("(b) Simulate worker/process restart → ES is synced once ES recovers, and /api/health hides counts from non-Admin while showing details to Admin", async () => {
    // Public /api/health only exposes aggregate status (ok/degraded), NOT counts
    const publicHealthRes = await request(app).get("/api/health");
    expect(publicHealthRes.status).toBe(200);
    expect(["ok", "degraded"]).toContain(publicHealthRes.body.services.esOutbox.status);
    expect(publicHealthRes.body.services.esOutbox.pending).toBeUndefined();
    expect(publicHealthRes.body.services.esOutbox.dead).toBeUndefined();
    expect(publicHealthRes.body.services.esOutbox.oldestPendingAgeSeconds).toBeUndefined();

    // Admin /api/health exposes full outbox metrics
    const adminHealthRes = await request(app)
      .get("/api/health")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminHealthRes.status).toBe(200);
    expect(adminHealthRes.body.services.esOutbox).toEqual(
      expect.objectContaining({
        status: expect.stringMatching(/^(ok|degraded)$/),
        pending: expect.any(Number),
        dead: expect.any(Number),
        oldestPendingAgeSeconds: expect.any(Number),
      }),
    );

    // Fresh worker batch processes the pending row from (a)
    const batchRes = await esOutbox.processOutboxBatch({ refresh: true });
    expect(batchRes.processed).toBeGreaterThanOrEqual(1);

    const remaining = await knex("es_sync_outbox")
      .where({ entity_type: "specimen", entity_id: specimenId, status: "pending" });
    expect(remaining.length).toBe(0);

    const searchRes = await request(app)
      .get("/api/search/specimens")
      .query({ q: `Updated while ES down ${suffix}` });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.map((d) => Number(d.id))).toContain(Number(specimenId));
  });

  it("(c) togglePublic to Private while ES fails → after ES recovers & worker runs, User cannot see specimen", async () => {
    const spy = jest.spyOn(esClient, "index").mockRejectedValue(new Error("ES_DOWN_TOGGLE"));
    try {
      const toggleRes = await request(app)
        .patch(`/api/specimens/${specimenId}/public`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isPublic: false });
      expect(toggleRes.status).toBe(200);

      const pendingPriority = await knex("es_sync_outbox")
        .where({ entity_type: "specimen", entity_id: specimenId, status: "pending" })
        .orderBy("id", "desc")
        .first();
      expect(pendingPriority).toBeTruthy();
      expect(Number(pendingPriority.priority)).toBe(10);
    } finally {
      spy.mockRestore();
    }

    // ES recovers → worker processes priority outbox row
    const batchRes = await esOutbox.processOutboxBatch({ refresh: true });
    expect(batchRes.processed).toBeGreaterThanOrEqual(1);

    // Public User must NOT see the Private specimen
    const userRes = await request(app)
      .get("/api/search/specimens")
      .query({ q: `OUTBOX-${suffix}-01` });
    expect(userRes.status).toBe(200);
    expect(userRes.body.data.map((d) => Number(d.id))).not.toContain(Number(specimenId));

    // Admin still sees it
    const adminRes = await request(app)
      .get("/api/search/specimens")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ q: `OUTBOX-${suffix}-01` });
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.map((d) => Number(d.id))).toContain(Number(specimenId));
  });

  it("(d) Retries exceeding maxAttempts transition row to dead and log logger.error", async () => {
    const row = await esOutbox.enqueueOutbox(null, {
      entityType: "specimen",
      entityId: specimenId,
      op: "upsert",
      priority: 5,
    });
    const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
    const failingIndex = jest.fn().mockRejectedValue(new Error("PERMANENT_ES_ERROR"));

    try {
      // Attempt 1 → pending with backoff
      await esOutbox.processOutboxBatch({
        maxAttempts: 2,
        baseDelayMs: 1,
        indexFn: failingIndex,
      });
      // Wait > 5ms so next_attempt_at <= NOW()
      await new Promise((r) => setTimeout(r, 20));
      // Attempt 2 → dead
      const res2 = await esOutbox.processOutboxBatch({
        maxAttempts: 2,
        baseDelayMs: 1,
        indexFn: failingIndex,
      });
      expect(res2.dead).toBeGreaterThanOrEqual(1);

      const updated = await knex("es_sync_outbox").where("id", row.id).first();
      expect(updated.status).toBe("dead");
      expect(updated.attempts).toBe(2);
      expect(updated.last_error).toContain("PERMANENT_ES_ERROR");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("[ES OUTBOX DEAD]"));

      // Admin retry-dead endpoint requeues dead row back to pending
      const retryRes = await request(app)
        .post("/api/search/outbox/retry-dead")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ limit: 10 });
      expect(retryRes.status).toBe(200);
      expect(retryRes.body.data.requeued).toBeGreaterThanOrEqual(1);

      await knex("es_sync_outbox").where("id", row.id).delete();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("(e) Two concurrent workers do NOT double-process the same outbox row (FOR UPDATE SKIP LOCKED)", async () => {
    const row = await esOutbox.enqueueOutbox(null, {
      entityType: "specimen",
      entityId: specimenId,
      op: "upsert",
      priority: 10,
    });

    const spyIndex = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return true;
    });

    const [w1, w2] = await Promise.all([
      esOutbox.processOutboxBatch({ batchSize: 10, indexFn: spyIndex }),
      esOutbox.processOutboxBatch({ batchSize: 10, indexFn: spyIndex }),
    ]);

    expect(w1.processed + w2.processed).toBe(1);
    expect(spyIndex).toHaveBeenCalledTimes(1);

    const finalRow = await knex("es_sync_outbox").where("id", row.id).first();
    expect(finalRow.status).toBe("done");
  });

  it("(f) cleanupOutbox deletes done rows > 7 days and dead rows > 90 days while retaining recent done and dead <= 90 days", async () => {
    const inserted = await knex("es_sync_outbox")
      .insert([
        {
          entity_type: "specimen",
          entity_id: specimenId,
          op: "upsert",
          priority: 0,
          status: "done",
          created_at: knex.raw("NOW() - INTERVAL '10 days'"),
          processed_at: knex.raw("NOW() - INTERVAL '8 days'"),
        },
        {
          entity_type: "specimen",
          entity_id: specimenId,
          op: "upsert",
          priority: 0,
          status: "done",
          created_at: knex.raw("NOW() - INTERVAL '2 days'"),
          processed_at: knex.raw("NOW() - INTERVAL '2 days'"),
        },
        {
          entity_type: "specimen",
          entity_id: specimenId,
          op: "upsert",
          priority: 0,
          status: "dead",
          created_at: knex.raw("NOW() - INTERVAL '30 days'"),
        },
        {
          entity_type: "specimen",
          entity_id: specimenId,
          op: "upsert",
          priority: 0,
          status: "dead",
          created_at: knex.raw("NOW() - INTERVAL '95 days'"),
        },
      ])
      .returning("id");

    const [oldDoneId, recentDoneId, recentDeadId, oldDeadId] = inserted.map((r) => r.id);

    const result = await esOutbox.cleanupOutbox({ doneRetentionDays: 7, deadRetentionDays: 90 });
    expect(result.deletedDone).toBeGreaterThanOrEqual(1);
    expect(result.deletedDead).toBeGreaterThanOrEqual(1);

    const remaining = await knex("es_sync_outbox")
      .whereIn("id", [oldDoneId, recentDoneId, recentDeadId, oldDeadId])
      .select("id");
    const remainingIds = remaining.map((r) => r.id);
    expect(remainingIds).not.toContain(oldDoneId);
    expect(remainingIds).toContain(recentDoneId);
    expect(remainingIds).toContain(recentDeadId);
    expect(remainingIds).not.toContain(oldDeadId);

    await knex("es_sync_outbox").whereIn("id", [recentDoneId, recentDeadId]).delete();
  });
});
