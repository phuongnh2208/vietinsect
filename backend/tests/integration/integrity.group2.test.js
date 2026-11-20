"use strict";

require("dotenv").config();
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../app");
const knex = require("../../src/config/knex");
const pool = require("../../src/config/db");
const { JWT_SECRET } = require("../../src/config/jwt");
const { closeRateLimiterRedis } = require("../../src/middleware/rateLimiter");

describe("Group 2 – Data Integrity Tests", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  let adminToken = null;
  let taxonId = null;
  const createdDnaIds = [];
  const createdSpecIds = [];

  beforeAll(async () => {
    const admin = await knex("admin_users").select("admin_id", "username").first();
    adminToken = jwt.sign(
      { adminId: Number(admin.admin_id), username: admin.username, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );
    const taxon = await knex("taxa").select("taxon_id").where("taxon_rank", "Species").first();
    taxonId = Number(taxon.taxon_id);
  });

  afterAll(async () => {
    if (createdDnaIds.length) {
      await knex("dna_sequences").whereIn("dna_id", createdDnaIds).delete();
    }
    if (createdSpecIds.length) {
      await knex("specimen_change_history").whereIn("specimen_id", createdSpecIds).delete();
      await knex("specimens").whereIn("specimen_id", createdSpecIds).delete();
      await knex("specimen_registry").whereIn("specimen_id", createdSpecIds).delete();
    }
    await closeRateLimiterRedis();
    await knex.destroy();
    await pool.end();
  });

  test("DEF-075: soft-delete sets DNA is_orphaned=true with warning; restore clears it; hard-delete sets specimen_id=NULL", async () => {
    const [reg] = await knex("specimen_registry")
      .insert({
        specimen_code: `TEST-ORPH-${suffix}`,
        basis_of_record: "PRESERVED_SPECIMEN",
      })
      .returning("specimen_id");
    const specId = Number(reg.specimen_id ?? reg);
    createdSpecIds.push(specId);

    await knex("specimens").insert({
      specimen_id: specId,
      taxon_id: taxonId,
      gbif_scientific_name: `Testus orphanus ${suffix}`,
      collection_date: "2024-06-01",
      is_public: true,
    });

    const [dna] = await knex("dna_sequences")
      .insert({
        specimen_id: specId,
        taxon_id: taxonId,
        genbank_accession: `OR${suffix.slice(-6)}`,
        gene_marker: "COI",
        fasta_sequence: "ATGCGTACGTAGCTAGCTAG",
        sequence_length_bp: 20,
        source_db: "INTERNAL",
        is_public: true,
        is_orphaned: false,
      })
      .returning("dna_id");
    const dnaId = Number(dna.dna_id ?? dna);
    createdDnaIds.push(dnaId);

    // 1. Soft-delete via API
    const delRes = await request(app)
      .delete(`/api/specimens/${specId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.orphanedDnaCount).toBe(1);
    expect(delRes.body.warning).toBeTruthy();

    const dnaAfterSoft = await knex("dna_sequences").where("dna_id", dnaId).first();
    expect(dnaAfterSoft).toBeTruthy();
    expect(dnaAfterSoft.is_orphaned).toBe(true);

    // 2. Restore via API
    const restoreRes = await request(app)
      .post(`/api/specimens/${specId}/restore`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data.unorphanedDnaCount).toBe(1);

    const dnaAfterRestore = await knex("dna_sequences").where("dna_id", dnaId).first();
    expect(dnaAfterRestore.is_orphaned).toBe(false);

    // 3. Hard-delete specimen_registry -> FK ON DELETE SET NULL keeps DNA with specimen_id = NULL
    await knex("specimens").where("specimen_id", specId).delete();
    await knex("specimen_registry").where("specimen_id", specId).delete();

    const dnaAfterHard = await knex("dna_sequences").where("dna_id", dnaId).first();
    expect(dnaAfterHard).toBeTruthy();
    expect(dnaAfterHard.specimen_id).toBeNull();
  });

  test("DEF-027 & DEF-034: bulk-import leaves optional registry fields NULL and rejects unmatched scientificName", async () => {
    const validTaxon = await knex("taxa")
      .select("taxon_id", "scientific_name")
      .where("taxon_id", taxonId)
      .first();
    const code = `TEST-IMP-${suffix}`;

    const res = await request(app)
      .post("/api/specimens/bulk-import")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        rows: [
          {
            specimenCode: code,
            scientificName: validTaxon.scientific_name,
            collectionDate: "2024-05-10",
            basisOfRecord: "PRESERVED_SPECIMEN",
          },
          {
            specimenCode: `TEST-UNMATCHED-${suffix}`,
            scientificName: "Nonexistentus fakus 9999",
            collectionDate: "2024-05-10",
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.insertedCount).toBe(1);
    expect(res.body.data.errors).toHaveLength(1);
    expect(res.body.data.errors[0].row).toBe(2);

    const reg = await knex("specimen_registry").where("specimen_code", code).first();
    expect(reg).toBeTruthy();
    createdSpecIds.push(Number(reg.specimen_id));
    expect(reg.recorded_by).toBeNull();
    expect(reg.institution_code).toBeNull();
    expect(reg.catalog_number).toBeNull();
    expect(reg.basis_of_record).toBe("PRESERVED_SPECIMEN");
  });

  test("DEF-035 & DEF-038: batch-update and bulk-import validate basisOfRecord (UPPER_SNAKE) and sex (400 not 500)", async () => {
    const [badBasis, badSex] = await Promise.all([
      request(app)
        .patch("/api/specimens/batch-update")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ specimenIds: [1], updates: { basisOfRecord: "PreservedSpecimen" } }),
      request(app)
        .patch("/api/specimens/batch-update")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ specimenIds: [1], updates: { sex: "indeterminate" } }),
    ]);

    expect(badBasis.status).toBe(400);
    expect(badSex.status).toBe(400);
  });

  test("DEF-022: POST /api/specimens rejects future collectionDate with HTTP 400", async () => {
    const res = await request(app)
      .post("/api/specimens")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        taxonId,
        collectionDate: "2049-12-31",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tương lai/i);
  });

  test("DEF-109: global JSON limit rejects 1MB body on /api/auth/login with 413, while /bulk-import allows up to 10mb", async () => {
    const bigString = "a".repeat(1024 * 1024);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: bigString });

    expect(res.status).toBe(413);
  });

  test("DEF-033: POST /api/specimens/bulk-import rejects > 5000 rows with HTTP 400", async () => {
    const rows = Array.from({ length: 5001 }, (_, i) => ({
      scientificName: "Papilio demoleus",
      collectionDate: "2024-01-01",
      specimenCode: `OVF-${i}`,
    }));
    const res = await request(app)
      .post("/api/specimens/bulk-import")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ rows });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/5\.000|5000/);
  });

  test("DEF-107: mv_taxon_dwc_flat is populated with Species rows", async () => {
    const [mvRow, spRow] = await Promise.all([
      knex("mv_taxon_dwc_flat").count("* as cnt").first(),
      knex("taxa").where("taxon_rank", "Species").count("* as cnt").first(),
    ]);
    const mvCount = parseInt(mvRow.cnt, 10);
    const spCount = parseInt(spRow.cnt, 10);
    expect(spCount).toBeGreaterThanOrEqual(1);
    expect(mvCount).toBe(spCount);
  });

  test("DEF-108: GET /api/specimens/analytics reports specimen_count = 0 for a province with no specimens", async () => {
    const sampleProv = await knex("provinces").select("province_type", "region").first();
    const [prov] = await knex("provinces")
      .insert({
        province_code: `T${suffix.slice(-5)}`,
        province_name_vn: `Tỉnh Test Rỗng ${suffix}`,
        province_name_en: `Empty Test Province ${suffix}`,
        province_type: sampleProv.province_type,
        region: sampleProv.region,
      })
      .returning("province_id");
    const provId = Number(prov.province_id ?? prov);

    try {
      const res = await request(app).get("/api/specimens/analytics");
      expect(res.status).toBe(200);
      const found = res.body.data.speciesRichnessByProvince.find(
        (p) => Number(p.province_id) === provId,
      );
      expect(found).toBeTruthy();
      expect(found.specimen_count).toBe(0);
    } finally {
      await knex("provinces").where("province_id", provId).delete();
    }
  });

  test("DEF-105: GET /api/specimens/export supports dwca (.zip) and xlsx formats", async () => {
    const [dwcaRes, xlsxRes] = await Promise.all([
      request(app).get("/api/specimens/export?format=dwca"),
      request(app).get("/api/specimens/export?format=xlsx"),
    ]);
    expect(dwcaRes.status).toBe(200);
    expect(dwcaRes.headers["content-type"]).toMatch(/application\/zip/);
    expect(xlsxRes.status).toBe(200);
    expect(xlsxRes.headers["content-type"]).toMatch(/spreadsheetml/);
  });
});
