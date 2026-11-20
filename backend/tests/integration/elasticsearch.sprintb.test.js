"use strict";

require("dotenv").config();
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../app");
const knex = require("../../src/config/knex");
const pool = require("../../src/config/db");
const { JWT_SECRET } = require("../../src/config/jwt");
const { esClient, getIndexName, checkEsHealth } = require("../../src/config/elasticsearch");
const esService = require("../../src/modules/search/elasticsearch.service");
const { closeRateLimiterRedis } = require("../../src/middleware/rateLimiter");

describe("Sprint B Group 2A – Elasticsearch Search, Security & Sync Tests (DEF-059)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  let adminToken = null;
  let taxonId = null;
  let synTaxonId = null;
  let pubSpecId = null;
  let privSpecId = null;
  let delSpecId = null;

  beforeAll(async () => {
    const admin = await knex("admin_users").select("admin_id", "username").first();
    adminToken = jwt.sign(
      { adminId: Number(admin.admin_id), username: admin.username, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    const taxon = await knex("taxa")
      .select("taxon_id", "parent_id")
      .where("taxon_rank", "Species")
      .first();
    taxonId = Number(taxon.taxon_id);

    const [syn] = await knex("taxa")
      .insert({
        parent_id: taxon.parent_id,
        taxon_rank: "Species",
        scientific_name: `Papilio synonimus ${suffix}`,
        slug: `papilio-synonimus-${suffix.toLowerCase()}`,
        taxonomic_status: "synonym",
        accepted_taxon_id: taxonId,
      })
      .returning("taxon_id");
    synTaxonId = Number(syn.taxon_id ?? syn);

    // 1. Public specimen
    const [rPub] = await knex("specimen_registry")
      .insert({ specimen_code: `ES-PUB-${suffix}`, basis_of_record: "PRESERVED_SPECIMEN" })
      .returning("specimen_id");
    pubSpecId = Number(rPub.specimen_id ?? rPub);
    await knex("specimens").insert({
      specimen_id: pubSpecId,
      taxon_id: taxonId,
      gbif_scientific_name: "Papilio demoleus",
      common_name_vn: "Bọ cánh cứng ánh kim",
      locality_detail: "Vườn Quốc gia Cúc Phương",
      notes: `Ghi chú đặc biệt mẫu ${suffix}`,
      collection_date: "2024-05-15",
      is_public: true,
    });

    // 2. Private specimen
    const [rPriv] = await knex("specimen_registry")
      .insert({ specimen_code: `ES-PRIV-${suffix}`, basis_of_record: "PRESERVED_SPECIMEN" })
      .returning("specimen_id");
    privSpecId = Number(rPriv.specimen_id ?? rPriv);
    await knex("specimens").insert({
      specimen_id: privSpecId,
      taxon_id: taxonId,
      gbif_scientific_name: "Papilio demoleus",
      common_name_vn: "Bọ cánh cứng mật",
      notes: `Nội bộ bí mật ${suffix}`,
      collection_date: "2024-05-16",
      is_public: false,
    });

    // 3. Soft-deleted specimen
    const [rDel] = await knex("specimen_registry")
      .insert({ specimen_code: `ES-DEL-${suffix}`, basis_of_record: "PRESERVED_SPECIMEN" })
      .returning("specimen_id");
    delSpecId = Number(rDel.specimen_id ?? rDel);
    await knex("specimens").insert({
      specimen_id: delSpecId,
      taxon_id: taxonId,
      gbif_scientific_name: "Papilio demoleus",
      common_name_vn: "Bọ cánh cứng đã xóa",
      notes: `Đã xóa ${suffix}`,
      collection_date: "2024-05-17",
      is_public: true,
      deleted_at: knex.fn.now(),
    });

    const health = await checkEsHealth();
    if (health.status !== "up") {
      throw new Error("Elasticsearch must be running for Sprint B Group 2A integration tests");
    }
    await esClient.indices.delete({ index: getIndexName("specimens") }).catch(() => {});
    await esClient.indices.delete({ index: getIndexName("taxa") }).catch(() => {});
    await esService.reindexAll({ refresh: true });
  });

  afterAll(async () => {
    await esClient.indices.delete({ index: getIndexName("specimens") }).catch(() => {});
    await esClient.indices.delete({ index: getIndexName("taxa") }).catch(() => {});
    const specIds = [pubSpecId, privSpecId, delSpecId].filter(Boolean);
    if (specIds.length) {
      await knex("specimen_change_history").whereIn("specimen_id", specIds).delete();
      await knex("specimens").whereIn("specimen_id", specIds).delete();
      await knex("specimen_registry").whereIn("specimen_id", specIds).delete();
    }
    if (synTaxonId) {
      await knex("taxa").where("taxon_id", synTaxonId).delete();
    }
    await closeRateLimiterRedis();
    await knex.destroy();
    await pool.end();
  });

  it("GET /api/health reports Elasticsearch status up", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.services.elasticsearch.status).toBe("up");
  });

  it("(a) Vietnamese accent-insensitive: 'bo canh cung' matches 'Bọ cánh cứng ánh kim'", async () => {
    const res = await request(app).get("/api/search/specimens?q=bo%20canh%20cung");
    expect(res.status).toBe(200);
    const ids = res.body.data.map((d) => Number(d.id));
    expect(ids).toContain(pubSpecId);
  });

  it("(b) matches specimen_code, locality, and notes (DEF-059)", async () => {
    const [codeRes, locRes, notesRes] = await Promise.all([
      request(app).get(`/api/search/specimens?q=ES-PUB-${suffix}`),
      request(app).get("/api/search/specimens?q=Cuc%20Phuong"),
      request(app).get(
        `/api/search/specimens?q=${encodeURIComponent(`Ghi chu dac biet mau ${suffix}`)}`,
      ),
    ]);
    expect(codeRes.status).toBe(200);
    expect(codeRes.body.data.map((d) => Number(d.id))).toContain(pubSpecId);
    expect(locRes.body.data.map((d) => Number(d.id))).toContain(pubSpecId);
    expect(notesRes.body.data.map((d) => Number(d.id))).toContain(pubSpecId);
  });

  it("(c) synonym search resolves accepted name with synonymNotice (F-TX-03)", async () => {
    const res = await request(app).get(
      `/api/search/specimens?q=${encodeURIComponent(`Papilio synonimus ${suffix}`)}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.synonymNotice).toBeTruthy();
    expect(res.body.synonymNotice.acceptedName).toBe("Papilio demoleus");
    expect(res.body.data.map((d) => Number(d.id))).toContain(pubSpecId);
  });

  it("(d) Private & soft-deleted specimens are hidden for User, while Admin sees Private", async () => {
    const [pubRes, adminRes] = await Promise.all([
      request(app).get("/api/search/specimens?q=bo%20canh%20cung"),
      request(app)
        .get(`/api/search/specimens?q=ES-PRIV-${suffix}`)
        .set("Authorization", `Bearer ${adminToken}`),
    ]);

    const pubIds = pubRes.body.data.map((d) => Number(d.id));
    expect(pubIds).not.toContain(privSpecId);
    expect(pubIds).not.toContain(delSpecId);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.map((d) => Number(d.id))).toContain(privSpecId);
  });

  it("(e) toggle is_public, soft-delete, and restore update ES immediately", async () => {
    // 1. Toggle pubSpecId -> Private
    const toPriv = await request(app)
      .patch(`/api/specimens/${pubSpecId}/public`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isPublic: false });
    expect(toPriv.status).toBe(200);
    await esClient.indices.refresh({ index: getIndexName("specimens") });

    const hiddenRes = await request(app).get(`/api/search/specimens?q=ES-PUB-${suffix}`);
    expect(hiddenRes.body.data.map((d) => Number(d.id))).not.toContain(pubSpecId);

    // 2. Toggle back -> Public
    await request(app)
      .patch(`/api/specimens/${pubSpecId}/public`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isPublic: true });
    await esClient.indices.refresh({ index: getIndexName("specimens") });

    // 3. Soft-delete -> hidden from User
    const delRes = await request(app)
      .delete(`/api/specimens/${pubSpecId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
    await esClient.indices.refresh({ index: getIndexName("specimens") });

    const afterDel = await request(app).get(`/api/search/specimens?q=ES-PUB-${suffix}`);
    expect(afterDel.body.data.map((d) => Number(d.id))).not.toContain(pubSpecId);

    // 4. Restore -> visible again to User
    const restRes = await request(app)
      .post(`/api/specimens/${pubSpecId}/restore`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(restRes.status).toBe(200);
    await esClient.indices.refresh({ index: getIndexName("specimens") });

    const afterRestore = await request(app).get(`/api/search/specimens?q=ES-PUB-${suffix}`);
    expect(afterRestore.body.data.map((d) => Number(d.id))).toContain(pubSpecId);
  });

  it("(f) reindexAll run twice is idempotent and does not duplicate documents", async () => {
    const before = await esClient.count({ index: getIndexName("specimens") });
    await esService.reindexAll({ refresh: true });
    const after = await esClient.count({ index: getIndexName("specimens") });
    expect(after.count).toBe(before.count);
  });

  it("(g) ES down returns HTTP 503 (never silently falls back to SQL)", async () => {
    const spy = jest.spyOn(esClient, "search").mockRejectedValueOnce(new Error("Connection refused"));
    try {
      const res = await request(app).get("/api/search/specimens?q=Papilio");
      expect(res.status).toBe(503);
      expect(res.body.code).toBe("SEARCH.ES_UNAVAILABLE");
    } finally {
      spy.mockRestore();
    }
  });

  it("validates query params: rejects limit>100, page*limit>10000, invalid sortBy, and strips unknown DSL params", async () => {
    const [badLimit, badWindow, badSort, dslStrip] = await Promise.all([
      request(app).get("/api/search/specimens?limit=101"),
      request(app).get("/api/search/specimens?page=101&limit=100"),
      request(app).get("/api/search/specimens?sortBy=script_injection"),
      request(app).get("/api/search/specimens?q=Papilio&script=evil&query=%7B%22match_all%22%3A%7B%7D%7D"),
    ]);
    expect(badLimit.status).toBe(400);
    expect(badWindow.status).toBe(400);
    expect(badSort.status).toBe(400);
    expect(dslStrip.status).toBe(200);
  });

  it("ES write failure on togglePublic does NOT fail DB write and enqueues priority retry", async () => {
    const spy = jest.spyOn(esClient, "index").mockRejectedValue(new Error("ES write timeout"));
    try {
      const res = await request(app)
        .patch(`/api/specimens/${pubSpecId}/public`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isPublic: false });
      expect(res.status).toBe(200);

      // Wait briefly for retry backoff (150ms + 400ms)
      await new Promise((r) => setTimeout(r, 750));
      const state = esService.getSyncState();
      expect(state.needsReindex).toBe(true);
      expect(state.priorityQueueSize).toBeGreaterThanOrEqual(1);
    } finally {
      spy.mockRestore();
      // Restore pubSpecId back to public
      await request(app)
        .patch(`/api/specimens/${pubSpecId}/public`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isPublic: true });
    }
  });
});
