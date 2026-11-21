"use strict";

require("dotenv").config();
const request = require("supertest");
const app = require("../../app");
const knex = require("../../src/config/knex");
const pool = require("../../src/config/db");
const { closeRateLimiterRedis } = require("../../src/middleware/rateLimiter");
const { buildMediaProxyUrl } = require("../../src/modules/media/mediaUrl.util");

describe("Integration & Smoke Tests: VietInsect BigData API", () => {
  afterAll(async () => {
    await closeRateLimiterRedis();
    await knex.destroy();
    await pool.end();
  });

  test("GET /api/health returns HTTP 200 active status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  describe("1. Taxonomy & Species Backfill Verification (F-TX-01 ~ F-TX-06)", () => {
    test("GET /api/specimens/stats confirms > 3,800 Species rank rows in taxa table", async () => {
      const res = await request(app).get("/api/specimens/stats");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taxa.species).toBeGreaterThanOrEqual(3828);
      // Public user chỉ thấy số lượng mẫu công khai
      expect(res.body.data.totalSpecimens).toBe(res.body.data.publicSpecimens);
    });

    test("GET /api/taxonomy/species/papilio-demoleus resolves Species profile with linked specimens", async () => {
      const res = await request(app).get("/api/taxonomy/species/papilio-demoleus");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rank).toBe("Species");
      expect(res.body.data.scientificName).toBe("Papilio demoleus");
      expect(res.body.data.specimenCount).toBeGreaterThan(0);
    });
  });

  describe("2. Specimen Detail Redesign & Species-Level Fallback (SCR-08 / F-SP-03)", () => {
    test("GET /api/specimens/91509 returns direct image & direct COI DNA barcode", async () => {
      const res = await request(app).get("/api/specimens/91509");
      expect(res.status).toBe(200);
      expect(res.body.data.taxonRank).toBe("Species");
      expect(res.body.data.images.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.dnaSequences.length).toBeGreaterThanOrEqual(1);
    });

    test("GET /api/specimens/69023 returns species-level fallback image & DNA when direct media is 0", async () => {
      const res = await request(app).get("/api/specimens/69023");
      expect(res.status).toBe(200);
      expect(res.body.data.scientificName).toContain("Papilio demoleus");
      expect(res.body.data.speciesImages.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.speciesDnaSequences.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("3. Public / Private Isolation & MinIO Media Proxy Enforcement", () => {
    let tempPrivateImageId = null;

    beforeAll(async () => {
      const [inserted] = await knex("specimen_images")
        .insert({
          specimen_id: 91509,
          object_key: "specimens/91509/inat-736220335-medium.jpg",
          thumbnail_key: "specimens/91509/inat-736220335-medium.jpg",
          shot_type: "dorsal",
          license_code: "cc-by-nc",
          attribution: "Jest Test Private Media",
          source_provider: "MINIO",
          is_public: false,
          uploaded_at: new Date(),
        })
        .returning("image_id");
      tempPrivateImageId = Number(inserted.image_id ?? inserted);
    });

    afterAll(async () => {
      if (tempPrivateImageId) {
        await knex("specimen_images").where("image_id", tempPrivateImageId).del();
      }
    });

    test("GET /api/media/46/file serves public MinIO image (HTTP 200 image/jpeg)", async () => {
      const res = await request(app).get("/api/media/46/file");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/image\/jpeg/);
    });

    test("GET /api/media/:privateId/file blocks unauthenticated public access with HTTP 403", async () => {
      const res = await request(app).get(`/api/media/${tempPrivateImageId}/file`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("MEDIA.FORBIDDEN");
    });

    test("GET /api/media/:privateId/file allows access with valid HMAC signed grant", async () => {
      const signedUrl = buildMediaProxyUrl(tempPrivateImageId, {
        isAdmin: true,
        isEffectivelyPublic: false,
      });
      const parsed = new URL(signedUrl);
      const pathWithQuery = `${parsed.pathname}${parsed.search}`;

      const res = await request(app).get(pathWithQuery);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/image\/jpeg/);
    });
  });

  describe("4. Darwin Core Archive (DwC-A) Export & Auth Rate Limiting", () => {
    test("GET /api/specimens/export?format=dwca&order=Plecoptera returns valid ZIP archive (PK\\x03\\x04)", async () => {
      const res = await request(app)
        .get("/api/specimens/export?format=dwca&order=Plecoptera")
        .buffer(true)
        .parse((resStream, callback) => {
          const chunks = [];
          resStream.on("data", (chunk) => chunks.push(chunk));
          resStream.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/zip/);
      // Magic bytes chuẩn ZIP: 0x50 ('P'), 0x4B ('K'), 0x03, 0x04
      expect(res.body[0]).toBe(0x50);
      expect(res.body[1]).toBe(0x4b);
      expect(res.body[2]).toBe(0x03);
      expect(res.body[3]).toBe(0x04);
    });

    test("POST /api/auth/login enforces 10 req/min rate limit (HTTP 429 on 11th request)", async () => {
      const testIp = `203.0.113.${Math.floor(10 + Math.random() * 200)}`;
      let lastStatus = null;

      for (let i = 1; i <= 11; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", testIp)
          .send({});
        lastStatus = res.status;
      }

      expect(lastStatus).toBe(429);
    });
  });

  describe("5. Analytics, Species Richness & Checklist Endpoints (SCR-25, SCR-26, SCR-27)", () => {
    test("GET /api/specimens/analytics returns byYear, byMonth, speciesRichnessByProvince (34 provinces), and speciesChecklist", async () => {
      const res = await request(app).get("/api/specimens/analytics?limit=25");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.byYear)).toBe(true);
      expect(res.body.data.byYear.length).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data.speciesRichnessByProvince)).toBe(true);
      expect(res.body.data.speciesRichnessByProvince.length).toBe(34);
      expect(Array.isArray(res.body.data.speciesChecklist)).toBe(true);
      expect(res.body.data.speciesChecklist.length).toBeGreaterThan(0);
    });
  });

  describe("6. Full-System Endpoint Audit (Lookups, Map, Taxonomy Tree, DNA, Media, Admin Auth Guards)", () => {
    test("GET /api/specimens/lookups returns 16 orders and 34 provinces (NQ 202/2025/QH15)", async () => {
      const res = await request(app).get("/api/specimens/lookups");
      expect(res.status).toBe(200);
      expect(res.body.data.orders.length).toBeGreaterThanOrEqual(16);
      expect(res.body.data.provinces.length).toBe(34);
    });

    test("GET /api/specimens?limit=10&page=1 returns paginated specimens with GPS & Province", async () => {
      const res = await request(app).get("/api/specimens?limit=10&page=1");
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(10);
      expect(res.body.pagination.total).toBeGreaterThan(90000);
      expect(res.body.data[0].provinceNameVn).toBeTruthy();
      expect(res.body.data[0].latitude).not.toBeNull();
    });

    test("GET /api/specimens/map?limit=100 returns PostGIS points, 34 provinceClusters, and heatGrid", async () => {
      const res = await request(app).get("/api/specimens/map?limit=100");
      expect(res.status).toBe(200);
      expect(res.body.data.points.length).toBe(100);
      expect(res.body.data.provinceClusters.length).toBe(34);
      expect(res.body.data.heatGrid.length).toBeGreaterThan(0);
    });

    test("GET /api/taxonomy/tree returns hierarchical taxonomic tree with rolled-up specimen counts", async () => {
      const res = await request(app).get("/api/taxonomy/tree");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    test("GET /api/dna and GET /api/dna/stats return COI DNA sequences and barcode stats", async () => {
      const [listRes, statsRes] = await Promise.all([
        request(app).get("/api/dna?limit=10"),
        request(app).get("/api/dna/stats"),
      ]);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThan(0);
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.totalSequences).toBeGreaterThanOrEqual(120);
    });

    test("GET /api/media and GET /api/media/stats return public gallery images", async () => {
      const [listRes, statsRes] = await Promise.all([
        request(app).get("/api/media?limit=10"),
        request(app).get("/api/media/stats"),
      ]);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThan(0);
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.totalImages).toBeGreaterThanOrEqual(40);
    });

    test("Protected Admin endpoints reject unauthenticated calls with HTTP 401", async () => {
      const [batchRes, importRes, auditRes, configRes] = await Promise.all([
        request(app).patch("/api/specimens/batch-update").send({ specimenIds: [1], updates: {} }),
        request(app).post("/api/specimens/bulk-import").send({ rows: [] }),
        request(app).get("/api/system/audit-logs"),
        request(app).get("/api/system/configs"),
      ]);
      expect(batchRes.status).toBe(401);
      expect(importRes.status).toBe(401);
      expect(auditRes.status).toBe(401);
      expect(configRes.status).toBe(401);
    });
  });
});
