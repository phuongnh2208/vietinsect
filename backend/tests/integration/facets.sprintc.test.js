"use strict";

require("dotenv").config();
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../app");
const knex = require("../../src/config/knex");
const pool = require("../../src/config/db");
const { JWT_SECRET } = require("../../src/config/jwt");
const { esClient, getIndexName } = require("../../src/config/elasticsearch");
const esService = require("../../src/modules/search/elasticsearch.service");
const { closeRateLimiterRedis } = require("../../src/middleware/rateLimiter");

jest.setTimeout(15000);

describe("Sprint C Group 1 – 8-Facet Aggregations, AND Logic & elevation_m (DEF-060)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  let adminToken = null;
  let taxonId = null;
  let hanoiId = null;
  let lamDongId = null;
  const createdSpecIds = [];
  let s1Id = null;
  let s2Id = null;
  let s3PrivId = null;

  beforeAll(async () => {
    const admin = await knex("admin_users").select("admin_id", "username").first();
    adminToken = jwt.sign(
      { adminId: Number(admin.admin_id), username: admin.username, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    const taxon = await knex("taxa").select("taxon_id").where("taxon_rank", "Species").first();
    taxonId = Number(taxon.taxon_id);

    const provs = await knex("provinces").select("province_id", "province_code");
    hanoiId = Number(provs.find((p) => p.province_code === "HN").province_id);
    lamDongId = Number(provs.find((p) => p.province_code === "LD").province_id);

    // S1: Public, Hà Nội, 2023, elevation 350m, has GPS, collector A
    const [r1] = await knex("specimen_registry")
      .insert({
        specimen_code: `FAC-S1-${suffix}`,
        basis_of_record: "PRESERVED_SPECIMEN",
        recorded_by: `CollectorA_${suffix}`,
      })
      .returning("specimen_id");
    s1Id = Number(r1.specimen_id ?? r1);
    createdSpecIds.push(s1Id);
    await knex("specimens").insert({
      specimen_id: s1Id,
      taxon_id: taxonId,
      province_id: hanoiId,
      gbif_scientific_name: "Papilio demoleus",
      collection_date: "2023-06-15",
      elevation_m: 350.5,
      collection_point: knex.raw("ST_SetSRID(ST_MakePoint(105.85, 21.02), 4326)::geography"),
      is_public: true,
    });

    // S2: Public, Lâm Đồng, 2024, elevation 1450m, no GPS, collector B
    const [r2] = await knex("specimen_registry")
      .insert({
        specimen_code: `FAC-S2-${suffix}`,
        basis_of_record: "PRESERVED_SPECIMEN",
        recorded_by: `CollectorB_${suffix}`,
      })
      .returning("specimen_id");
    s2Id = Number(r2.specimen_id ?? r2);
    createdSpecIds.push(s2Id);
    await knex("specimens").insert({
      specimen_id: s2Id,
      taxon_id: taxonId,
      province_id: lamDongId,
      gbif_scientific_name: "Papilio demoleus",
      collection_date: "2024-08-20",
      elevation_m: 1450,
      is_public: true,
    });

    // S3: Private, Lâm Đồng, 2024, elevation 1500m, has GPS, collector B
    const [r3] = await knex("specimen_registry")
      .insert({
        specimen_code: `FAC-S3-${suffix}`,
        basis_of_record: "PRESERVED_SPECIMEN",
        recorded_by: `CollectorB_${suffix}`,
      })
      .returning("specimen_id");
    s3PrivId = Number(r3.specimen_id ?? r3);
    createdSpecIds.push(s3PrivId);
    await knex("specimens").insert({
      specimen_id: s3PrivId,
      taxon_id: taxonId,
      province_id: lamDongId,
      gbif_scientific_name: "Papilio demoleus",
      collection_date: "2024-08-21",
      elevation_m: 1500,
      collection_point: knex.raw("ST_SetSRID(ST_MakePoint(108.45, 11.94), 4326)::geography"),
      is_public: false,
    });

    await esClient.indices.delete({ index: getIndexName("specimens") }).catch(() => {});
    await esClient.indices.delete({ index: getIndexName("taxa") }).catch(() => {});
    await esService.reindexAll({ refresh: true });
  }, 15000);

  afterAll(async () => {
    await esClient.indices.delete({ index: getIndexName("specimens") }).catch(() => {});
    await esClient.indices.delete({ index: getIndexName("taxa") }).catch(() => {});
    if (createdSpecIds.length) {
      await knex("specimens").whereIn("specimen_id", createdSpecIds).delete();
      await knex("specimen_registry").whereIn("specimen_id", createdSpecIds).delete();
    }
    await closeRateLimiterRedis();
    await knex.destroy();
    await pool.end();
  });

  it("returns all 8 facet dimensions with accurate counts matching manual DB counts (Private excluded for User)", async () => {
    const [pubRes, adminRes] = await Promise.all([
      request(app).get("/api/search/specimens"),
      request(app)
        .get("/api/search/specimens")
        .set("Authorization", `Bearer ${adminToken}`),
    ]);

    expect(pubRes.status).toBe(200);
    const f = pubRes.body.facets;
    expect(f).toBeDefined();
    expect(f.taxon).toBeDefined();
    expect(f.provinces).toBeDefined();
    expect(f.years).toBeDefined();
    expect(f.media).toBeDefined();
    expect(f.iucn).toBeDefined();
    expect(f.elevation).toBeDefined();
    expect(f.recordedBy).toBeDefined();
    expect(f.hasGps).toBeDefined();

    // Private S3 must NOT contribute to Public User facet count for CollectorB
    const pubCollectorB = f.recordedBy.find((b) => b.key === `CollectorB_${suffix}`);
    expect(pubCollectorB).toEqual({ key: `CollectorB_${suffix}`, count: 1 });

    // Admin sees both S2 and S3 for CollectorB (count = 2)
    const adminCollectorB = adminRes.body.facets.recordedBy.find(
      (b) => b.key === `CollectorB_${suffix}`,
    );
    expect(adminCollectorB).toEqual({ key: `CollectorB_${suffix}`, count: 2 });
  });

  it("applies AND logic across facets and returns disjunctive province counts (GBIF style)", async () => {
    const res = await request(app).get(
      `/api/search/specimens?province=${encodeURIComponent("Lâm Đồng")}&yearFrom=2024&yearTo=2024&hasGps=false`,
    );
    expect(res.status).toBe(200);
    const ids = res.body.data.map((d) => Number(d.id));
    expect(ids).toEqual([s2Id]);

    // Disjunctive facet: provinces facet ignores province filter while keeping year+hasGps filters
    const ldBucket = res.body.facets.provinces.find((p) => p.key === "Lâm Đồng");
    expect(ldBucket).toEqual({ key: "Lâm Đồng", count: 1 });
  });

  it("filters accurately by elevationMin / elevationMax (C-11 elevation_m)", async () => {
    const [highRes, lowRes] = await Promise.all([
      request(app).get("/api/search/specimens?elevationMin=1000&elevationMax=2000"),
      request(app).get("/api/search/specimens?elevationMin=200&elevationMax=500"),
    ]);

    expect(highRes.status).toBe(200);
    expect(highRes.body.data.map((d) => Number(d.id))).toEqual([s2Id]);

    expect(lowRes.status).toBe(200);
    expect(lowRes.body.data.map((d) => Number(d.id))).toEqual([s1Id]);
  });
});
