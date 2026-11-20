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

jest.setTimeout(20000);

describe("Sprint C Group 1 – 8-Facet Aggregations, Cascade, AND Logic & elevation_m (DEF-060)", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  let adminToken = null;
  let lepSpeciesId = null;
  let colOrderId = null;
  let colFamilyId = null;
  let colSpeciesId = null;
  let hanoiId = null;
  let lamDongId = null;
  const createdSpecIds = [];
  let s1Id = null;
  let s2Id = null;
  let s3PrivId = null;
  let s4ColId = null;

  beforeAll(async () => {
    const admin = await knex("admin_users").select("admin_id", "username").first();
    adminToken = jwt.sign(
      { adminId: Number(admin.admin_id), username: admin.username, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    const insecta = await knex("taxa").select("taxon_id").where("taxon_rank", "Class").first();
    const lepSpecies = await knex("taxa").select("taxon_id").where("taxon_rank", "Species").first();
    lepSpeciesId = Number(lepSpecies.taxon_id);

    // Create a second Order (Coleoptera -> Carabidae -> Carabus testus, IUCN=VU) for cascade & IUCN tests
    const [co] = await knex("taxa")
      .insert({
        parent_id: insecta.taxon_id,
        taxon_rank: "Order",
        scientific_name: `Coleoptera_${suffix}`,
        slug: `coleoptera-${suffix.toLowerCase()}`,
      })
      .returning("taxon_id");
    colOrderId = Number(co.taxon_id ?? co);

    const [cf] = await knex("taxa")
      .insert({
        parent_id: colOrderId,
        taxon_rank: "Family",
        scientific_name: `Carabidae_${suffix}`,
        slug: `carabidae-${suffix.toLowerCase()}`,
      })
      .returning("taxon_id");
    colFamilyId = Number(cf.taxon_id ?? cf);

    const [cs] = await knex("taxa")
      .insert({
        parent_id: colFamilyId,
        taxon_rank: "Species",
        scientific_name: `Carabus testus ${suffix}`,
        slug: `carabus-testus-${suffix.toLowerCase()}`,
        iucn_status: "VU",
      })
      .returning("taxon_id");
    colSpeciesId = Number(cs.taxon_id ?? cs);

    const provs = await knex("provinces").select("province_id", "province_code");
    hanoiId = Number(provs.find((p) => p.province_code === "HN").province_id);
    lamDongId = Number(provs.find((p) => p.province_code === "LD").province_id);

    // S1: Public, Lepidoptera, Hà Nội, 2023, elevation 350.5m, has GPS, has image + DNA, collector A
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
      taxon_id: lepSpeciesId,
      province_id: hanoiId,
      gbif_scientific_name: "Papilio demoleus",
      collection_date: "2023-06-15",
      elevation_m: 350.5,
      collection_point: knex.raw("ST_SetSRID(ST_MakePoint(105.85, 21.02), 4326)::geography"),
      is_public: true,
    });
    await knex("specimen_images").insert({
      specimen_id: s1Id,
      object_key: `specimens/${s1Id}/test.jpg`,
      license_code: "cc-by",
      is_public: true,
    });
    await knex("dna_sequences").insert({
      specimen_id: s1Id,
      taxon_id: lepSpeciesId,
      genbank_accession: `FC${suffix.slice(-6)}`,
      gene_marker: "COI",
      fasta_sequence: "ATGCGTACGT",
      sequence_length_bp: 10,
      source_db: "INTERNAL",
      is_public: true,
    });

    // S2: Public, Lepidoptera, Lâm Đồng, 2024, elevation 1450m, no GPS, collector B
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
      taxon_id: lepSpeciesId,
      province_id: lamDongId,
      gbif_scientific_name: "Papilio demoleus",
      collection_date: "2024-08-20",
      elevation_m: 1450,
      is_public: true,
    });

    // S3: Private, Lepidoptera, Lâm Đồng, 2024, elevation 1500m, has GPS, collector B
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
      taxon_id: lepSpeciesId,
      province_id: lamDongId,
      gbif_scientific_name: "Papilio demoleus",
      collection_date: "2024-08-21",
      elevation_m: 1500,
      collection_point: knex.raw("ST_SetSRID(ST_MakePoint(108.45, 11.94), 4326)::geography"),
      is_public: false,
    });

    // S4: Public, Coleoptera (Carabidae, IUCN=VU), Hà Nội, 2022, elevation 800m, has bioactivity
    const [r4] = await knex("specimen_registry")
      .insert({
        specimen_code: `FAC-S4-${suffix}`,
        basis_of_record: "PRESERVED_SPECIMEN",
        recorded_by: `CollectorC_${suffix}`,
      })
      .returning("specimen_id");
    s4ColId = Number(r4.specimen_id ?? r4);
    createdSpecIds.push(s4ColId);
    await knex("specimens").insert({
      specimen_id: s4ColId,
      taxon_id: colSpeciesId,
      province_id: hanoiId,
      gbif_scientific_name: `Carabus testus ${suffix}`,
      collection_date: "2022-04-10",
      elevation_m: 800,
      is_public: true,
    });
    await knex("bioactivity_records").insert({
      taxon_id: colSpeciesId,
      activity_type: "antimicrobial",
    });

    await esClient.indices.delete({ index: getIndexName("specimens") }).catch(() => {});
    await esClient.indices.delete({ index: getIndexName("taxa") }).catch(() => {});
    await esService.reindexAll({ refresh: true });
  }, 20000);

  afterAll(async () => {
    await esClient.indices.delete({ index: getIndexName("specimens") }).catch(() => {});
    await esClient.indices.delete({ index: getIndexName("taxa") }).catch(() => {});
    if (createdSpecIds.length) {
      await knex("specimen_images").whereIn("specimen_id", createdSpecIds).delete();
      await knex("dna_sequences").whereIn("specimen_id", createdSpecIds).delete();
      await knex("specimens").whereIn("specimen_id", createdSpecIds).delete();
      await knex("specimen_registry").whereIn("specimen_id", createdSpecIds).delete();
    }
    if (colSpeciesId) {
      await knex("bioactivity_records").where("taxon_id", colSpeciesId).delete();
      await knex("taxa").whereIn("taxon_id", [colSpeciesId, colFamilyId, colOrderId]).delete();
    }
    await closeRateLimiterRedis();
    await knex.destroy();
    await pool.end();
  });

  it("1. Privacy & recordedBy facet: Private specimen excluded from Public User facet counts, visible to Admin", async () => {
    const [pubRes, adminRes] = await Promise.all([
      request(app).get("/api/search/specimens"),
      request(app)
        .get("/api/search/specimens")
        .set("Authorization", `Bearer ${adminToken}`),
    ]);

    expect(pubRes.status).toBe(200);
    const pubCollectorB = pubRes.body.facets.recordedBy.find((b) => b.key === `CollectorB_${suffix}`);
    expect(pubCollectorB).toEqual({ key: `CollectorB_${suffix}`, count: 1 });

    const adminCollectorB = adminRes.body.facets.recordedBy.find(
      (b) => b.key === `CollectorB_${suffix}`,
    );
    expect(adminCollectorB).toEqual({ key: `CollectorB_${suffix}`, count: 2 });
  });

  it("2. Taxon cascade: selecting order=Lepidoptera restricts families facet strictly to Lepidoptera families", async () => {
    const res = await request(app).get("/api/search/specimens?order=Lepidoptera");
    expect(res.status).toBe(200);
    const familyKeys = res.body.facets.taxon.families.map((f) => f.key);
    expect(familyKeys).toContain("Papilionidae");
    expect(familyKeys).not.toContain(`Carabidae_${suffix}`);
  });

  it("3. Province + Year + hasGps AND logic & disjunctive province counts", async () => {
    const res = await request(app).get(
      `/api/search/specimens?province=${encodeURIComponent("Lâm Đồng")}&yearFrom=2024&yearTo=2024&hasGps=false`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.map((d) => Number(d.id))).toEqual([s2Id]);
    expect(res.body.facets.provinces.find((p) => p.key === "Lâm Đồng")).toEqual({
      key: "Lâm Đồng",
      count: 1,
    });
  });

  it("4. Media type facet (image, dna, bioactivity) filters and counts accurately", async () => {
    const [imgDnaRes, bioRes] = await Promise.all([
      request(app).get("/api/search/specimens?mediaType=image,dna"),
      request(app).get("/api/search/specimens?mediaType=bioactivity"),
    ]);
    expect(imgDnaRes.status).toBe(200);
    expect(imgDnaRes.body.data.map((d) => Number(d.id))).toContain(s1Id);
    expect(imgDnaRes.body.facets.media.image).toBeGreaterThanOrEqual(1);
    expect(imgDnaRes.body.facets.media.dna).toBeGreaterThanOrEqual(1);

    expect(bioRes.status).toBe(200);
    expect(bioRes.body.data.map((d) => Number(d.id))).toEqual([s4ColId]);
    expect(bioRes.body.facets.media.bioactivity).toBe(1);
  });

  it("5. IUCN status facet filters and counts VU species accurately", async () => {
    const res = await request(app).get("/api/search/specimens?iucnStatus=VU");
    expect(res.status).toBe(200);
    expect(res.body.data.map((d) => Number(d.id))).toEqual([s4ColId]);
    expect(res.body.facets.iucn.find((i) => i.key === "VU")).toEqual({ key: "VU", count: 1 });
  });

  it("6. Elevation range facet (elevationMin / elevationMax) filters accurately", async () => {
    const [highRes, lowRes] = await Promise.all([
      request(app).get("/api/search/specimens?elevationMin=1000&elevationMax=2000"),
      request(app).get("/api/search/specimens?elevationMin=200&elevationMax=500"),
    ]);
    expect(highRes.body.data.map((d) => Number(d.id))).toEqual([s2Id]);
    expect(lowRes.body.data.map((d) => Number(d.id))).toEqual([s1Id]);
  });

  it("7. Gallery privacy: User never receives Private image thumbnail_url; Admin receives full thumbnail_url", async () => {
    const [privImg] = await knex("specimen_images")
      .insert({
        specimen_id: s2Id,
        object_key: `private/secret-${suffix}.jpg`,
        thumbnail_key: `private/secret-${suffix}-thumb.jpg`,
        shot_type: "dorsal",
        is_public: false,
      })
      .returning(["image_id"]);

    await esService.reindexAll();

    const [userRes, adminRes] = await Promise.all([
      request(app).get("/api/search/specimens?limit=50"),
      request(app)
        .get("/api/search/specimens?limit=50")
        .set("Authorization", `Bearer ${adminToken}`),
    ]);

    expect(userRes.status).toBe(200);
    const userS2 = userRes.body.data.find((d) => Number(d.id) === s2Id);
    const userS1 = userRes.body.data.find((d) => Number(d.id) === s1Id);
    expect(userS2.has_public_image).toBe(false);
    expect(userS2.thumbnail_url).toBeNull();
    expect(userS2.admin_thumbnail_url).toBeUndefined();
    expect(userS1.has_public_image).toBe(true);
    expect(userS1.thumbnail_url).toMatch(/^\/api\/media\/\d+\/thumbnail$/);

    const adminS2 = adminRes.body.data.find((d) => Number(d.id) === s2Id);
    expect(adminS2.thumbnail_url).toBe(`/api/media/${privImg.image_id}/thumbnail`);
  });
});
