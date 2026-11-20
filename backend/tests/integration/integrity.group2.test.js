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
});
