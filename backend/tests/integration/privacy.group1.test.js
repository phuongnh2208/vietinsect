"use strict";

require("dotenv").config();
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../app");
const knex = require("../../src/config/knex");
const pool = require("../../src/config/db");
const { JWT_SECRET } = require("../../src/config/jwt");
const { closeRateLimiterRedis } = require("../../src/middleware/rateLimiter");

describe("Group 1 – Privacy & Permission Isolation (DEF-089)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  const adminToken = jwt.sign(
    { adminId: 1, username: "admin", role: "admin" },
    JWT_SECRET,
    { expiresIn: "1h" },
  );

  let taxonId = null;
  let privateSpecId = null;
  let deletedSpecId = null;
  let dnaPrivateSpecId = null;
  let dnaDeletedSpecId = null;
  let dnaOrphanPublicId = null;

  beforeAll(async () => {
    const taxon = await knex("taxa").select("taxon_id").where("taxon_rank", "Species").first();
    taxonId = Number(taxon.taxon_id);

    // 1. Insert Private specimen
    const [regPriv] = await knex("specimen_registry")
      .insert({
        specimen_code: `TEST-PRIV-${suffix}`,
        basis_of_record: "PRESERVED_SPECIMEN",
        recorded_by: "Secret Collector",
      })
      .returning("specimen_id");
    privateSpecId = Number(regPriv.specimen_id ?? regPriv);

    await knex("specimens").insert({
      specimen_id: privateSpecId,
      taxon_id: taxonId,
      gbif_scientific_name: `Testus privatus ${suffix}`,
      collection_date: "2024-05-01",
      collection_point: knex.raw("ST_SetSRID(ST_MakePoint(105.85, 21.02), 4326)::geography"),
      is_public: false,
    });

    // 2. Insert Soft-deleted specimen (is_public = true, deleted_at = NOW())
    const [regDel] = await knex("specimen_registry")
      .insert({
        specimen_code: `TEST-DEL-${suffix}`,
        basis_of_record: "PRESERVED_SPECIMEN",
        recorded_by: "Deleted Collector",
      })
      .returning("specimen_id");
    deletedSpecId = Number(regDel.specimen_id ?? regDel);

    await knex("specimens").insert({
      specimen_id: deletedSpecId,
      taxon_id: taxonId,
      gbif_scientific_name: `Testus deletus ${suffix}`,
      collection_date: "2024-05-02",
      collection_point: knex.raw("ST_SetSRID(ST_MakePoint(105.86, 21.03), 4326)::geography"),
      is_public: true,
      deleted_at: knex.fn.now(),
    });

    // 3. Insert Public DNA attached to Private specimen
    const [dPriv] = await knex("dna_sequences")
      .insert({
        specimen_id: privateSpecId,
        taxon_id: taxonId,
        genbank_accession: `TP${suffix.slice(-6)}`,
        gene_marker: "COI",
        scientific_name_verbatim: `Testus privatus ${suffix}`,
        fasta_sequence: "ATGCGTACGTAGCTAGCTAG",
        sequence_length_bp: 20,
        gc_content_pct: 50.0,
        source_db: "INTERNAL",
        is_public: true,
        is_orphaned: false,
      })
      .returning("dna_id");
    dnaPrivateSpecId = Number(dPriv.dna_id ?? dPriv);

    // 4. Insert Public DNA attached to Soft-deleted specimen
    const [dDel] = await knex("dna_sequences")
      .insert({
        specimen_id: deletedSpecId,
        taxon_id: taxonId,
        genbank_accession: `TD${suffix.slice(-6)}`,
        gene_marker: "COI",
        scientific_name_verbatim: `Testus deletus ${suffix}`,
        fasta_sequence: "ATGCGTACGTAGCTAGCTAG",
        sequence_length_bp: 20,
        gc_content_pct: 50.0,
        source_db: "INTERNAL",
        is_public: true,
        is_orphaned: false,
      })
      .returning("dna_id");
    dnaDeletedSpecId = Number(dDel.dna_id ?? dDel);

    // 5. Insert Orphan Public DNA (specimen_id IS NULL)
    const [dOrph] = await knex("dna_sequences")
      .insert({
        specimen_id: null,
        taxon_id: taxonId,
        genbank_accession: `TO${suffix.slice(-6)}`,
        gene_marker: "COI",
        scientific_name_verbatim: `Testus orphanus ${suffix}`,
        fasta_sequence: "ATGCGTACGTAGCTAGCTAG",
        sequence_length_bp: 20,
        gc_content_pct: 50.0,
        source_db: "INTERNAL",
        is_public: true,
        is_orphaned: true,
      })
      .returning("dna_id");
    dnaOrphanPublicId = Number(dOrph.dna_id ?? dOrph);
  });

  afterAll(async () => {
    const dnaIds = [dnaPrivateSpecId, dnaDeletedSpecId, dnaOrphanPublicId].filter(Boolean);
    if (dnaIds.length) {
      await knex("dna_sequences").whereIn("dna_id", dnaIds).delete();
    }
    const specIds = [privateSpecId, deletedSpecId].filter(Boolean);
    if (specIds.length) {
      await knex("specimens").whereIn("specimen_id", specIds).delete();
      await knex("specimen_registry").whereIn("specimen_id", specIds).delete();
    }
    await closeRateLimiterRedis();
    await knex.destroy();
    await pool.end();
  });

  test("DEF-089: Public GET /api/dna hides DNA linked to Private or soft-deleted specimens, shows orphan Public DNA", async () => {
    const res = await request(app).get(`/api/dna?q=${suffix}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((d) => Number(d.id));
    expect(ids).not.toContain(dnaPrivateSpecId);
    expect(ids).not.toContain(dnaDeletedSpecId);
    expect(ids).toContain(dnaOrphanPublicId);
  });

  test("DEF-089: Public GET /api/dna/:id and /fasta return 404 for DNA linked to Private or soft-deleted specimens", async () => {
    const [rPriv, rDel, fPriv, fDel, rOrph] = await Promise.all([
      request(app).get(`/api/dna/${dnaPrivateSpecId}`),
      request(app).get(`/api/dna/${dnaDeletedSpecId}`),
      request(app).get(`/api/dna/${dnaPrivateSpecId}/fasta`),
      request(app).get(`/api/dna/${dnaDeletedSpecId}/fasta`),
      request(app).get(`/api/dna/${dnaOrphanPublicId}`),
    ]);
    expect(rPriv.status).toBe(404);
    expect(rDel.status).toBe(404);
    expect(fPriv.status).toBe(404);
    expect(fDel.status).toBe(404);
    expect(rOrph.status).toBe(200);
  });

  test("DEF-089: Admin GET /api/dna/:id and /fasta still see DNA linked to Private and soft-deleted specimens", async () => {
    const [rPriv, rDel, fPriv] = await Promise.all([
      request(app)
        .get(`/api/dna/${dnaPrivateSpecId}`)
        .set("Authorization", `Bearer ${adminToken}`),
      request(app)
        .get(`/api/dna/${dnaDeletedSpecId}`)
        .set("Authorization", `Bearer ${adminToken}`),
      request(app)
        .get(`/api/dna/${dnaPrivateSpecId}/fasta`)
        .set("Authorization", `Bearer ${adminToken}`),
    ]);
    expect(rPriv.status).toBe(200);
    expect(rDel.status).toBe(200);
    expect(fPriv.status).toBe(200);
  });

  test("Public specimen endpoints (list, detail, map, export GeoJSON) hide Private and soft-deleted specimens", async () => {
    const [listRes, privDetail, delDetail, mapRes, geoRes] = await Promise.all([
      request(app).get(`/api/specimens?q=${suffix}`),
      request(app).get(`/api/specimens/${privateSpecId}`),
      request(app).get(`/api/specimens/${deletedSpecId}`),
      request(app).get(`/api/specimens/map?q=${suffix}`),
      request(app).get(`/api/specimens/export?format=geojson&q=${suffix}`),
    ]);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(0);
    expect(privDetail.status).toBe(404);
    expect(delDetail.status).toBe(404);
    expect(mapRes.status).toBe(200);
    expect(mapRes.body.data.points).toHaveLength(0);
    expect(geoRes.status).toBe(200);
    const geoJson = JSON.parse(geoRes.text || geoRes.body.toString("utf8"));
    expect(geoJson.features).toHaveLength(0);
  });
});
