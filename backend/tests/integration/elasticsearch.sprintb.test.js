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

describe("Sprint B Group 2A – Elasticsearch Search & Sync Tests (DEF-059)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  let adminToken = null;
  let esUp = false;
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

    const taxon = await knex("taxa").select("taxon_id", "parent_id").where("taxon_rank", "Species").first();
    taxonId = Number(taxon.taxon_id);

    // Insert a synonym taxon pointing to taxonId (Papilio demoleus)
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

    // 1. Public specimen with Vietnamese accents, locality & notes
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
    esUp = health.status === "up";
    if (esUp) {
      await esService.reindexAll({ refresh: true });
    }
  });

  afterAll(async () => {
    if (esUp) {
      await esClient.indices.delete({ index: getIndexName("specimens") }).catch(() => {});
      await esClient.indices.delete({ index: getIndexName("taxa") }).catch(() => {});
    }
    const specIds = [pubSpecId, privSpecId, delSpecId].filter(Boolean);
    if (specIds.length) {
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

  test("GET /api/health reports Elasticsearch service status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.services).toBeDefined();
    expect(["up", "down"]).toContain(res.body.services.elasticsearch.status);
  });

  test("DEF-059: ES down returns HTTP 503 (never silently falls back to SQL)", async () => {
    const spy = jest.spyOn(esClient, "search").mockRejectedValueOnce(new Error("Connection refused"));
    try {
      const res = await request(app).get("/api/search/specimens?q=Papilio");
      expect(res.status).toBe(503);
      expect(res.body.code).toBe("SEARCH.ES_UNAVAILABLE");
    } finally {
      spy.mockRestore();
    }
  });

  test("DEF-059 (Live ES): Vietnamese accent-insensitive search, notes/code/locality, synonym, privacy & idempotent reindex", async () => {
    if (!esUp) {
      console.warn("Elasticsearch not reachable — skipping live ES assertions");
      return;
    }

    // 1. "bo canh cung" matches "Bọ cánh cứng ánh kim" (accent-insensitive)
    const viRes = await request(app).get("/api/search/specimens?q=bo%20canh%20cung");
    expect(viRes.status).toBe(200);
    const viIds = viRes.body.data.map((d) => Number(d.id));
    expect(viIds).toContain(pubSpecId);
    // Private & soft-deleted must NOT appear for public User
    expect(viIds).not.toContain(privSpecId);
    expect(viIds).not.toContain(delSpecId);

    // 2. Search by specimen_code, locality, and notes
    const [codeRes, locRes, notesRes] = await Promise.all([
      request(app).get(`/api/search/specimens?q=ES-PUB-${suffix}`),
      request(app).get("/api/search/specimens?q=Cuc%20Phuong"),
      request(app).get(`/api/search/specimens?q=${encodeURIComponent(`Ghi chu dac biet mau ${suffix}`)}`),
    ]);
    expect(codeRes.body.data.map((d) => Number(d.id))).toContain(pubSpecId);
    expect(locRes.body.data.map((d) => Number(d.id))).toContain(pubSpecId);
    expect(notesRes.body.data.map((d) => Number(d.id))).toContain(pubSpecId);

    // 3. Admin sees Private specimen
    const adminRes = await request(app)
      .get(`/api/search/specimens?q=ES-PRIV-${suffix}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.map((d) => Number(d.id))).toContain(privSpecId);

    // 4. Synonym search resolves accepted name + notice (F-TX-03)
    const synRes = await request(app).get(
      `/api/search/specimens?q=${encodeURIComponent(`Papilio synonimus ${suffix}`)}`,
    );
    expect(synRes.status).toBe(200);
    expect(synRes.body.synonymNotice).toBeTruthy();
    expect(synRes.body.synonymNotice.acceptedName).toBe("Papilio demoleus");

    // 5. Reindex twice does NOT duplicate documents
    const beforeCount = await esClient.count({ index: getIndexName("specimens") });
    await esService.reindexAll({ refresh: true });
    const afterCount = await esClient.count({ index: getIndexName("specimens") });
    expect(afterCount.count).toBe(beforeCount.count);
  });
});
