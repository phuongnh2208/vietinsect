"use strict";

const knex = require("../../src/config/knex");
const {
  transformGbifRecord,
  upsertGbifRecord,
  normalizeOccurrenceLicense,
  shouldBePublicByLicense,
} = require("../../scripts/lib/gbifTransform");

// Fixture JSON chính xác của bản ghi GBIF 6885436349 (Supella longipalpa, Hồ Chí Minh)
const FIXTURE_6885436349 = {
  gbifID: 6885436349,
  occurrenceID: "https://www.inaturalist.org/observations/412244579",
  datasetKey: "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
  datasetName: "iNaturalist research-grade observations",
  basisOfRecord: "HUMAN_OBSERVATION",
  catalogNumber: "412244579",
  institutionCode: "iNaturalist",
  recordedBy: "insect ID",
  identifiedBy: "insect ID",
  dateIdentified: "2026-11-01T19:29:15Z",
  eventDate: "2026-10-30T22:13:52",
  year: 2026,
  month: 10,
  day: 30,
  countryCode: "VN",
  stateProvince: "Hồ Chí Minh city",
  verbatimLocality: "Alley 2 Ap Bac, Tan Binh, Ho Chi Minh City, VN",
  decimalLatitude: 10.799024,
  decimalLongitude: 106.642643,
  coordinateUncertaintyInMeters: 27004,
  order: "Blattodea",
  family: "Pseudophyllodromiidae",
  genus: "Supella",
  species: "Supella longipalpa",
  scientificName: "Supella (Supella) longipalpa (Fabricius, 1798)",
  speciesKey: 1995029,
  license: "http://creativecommons.org/licenses/by/4.0/legalcode",
  references: "https://www.inaturalist.org/observations/412244579",
  rightsHolder: "insect ID",
  issues: ["CONTINENT_DERIVED_FROM_COORDINATES", "COORDINATE_ROUNDED", "TAXON_MATCH_HIGHERRANK"],
};

describe("Step 2 - GBIF Import Upgrade (Darwin Core 22 fields, Admin-safe Upsert, License Policy)", () => {
  const createdSpecimenIds = [];
  const createdTaxonIds = [];

  afterAll(async () => {
    if (createdSpecimenIds.length > 0) {
      await knex("specimens").whereIn("specimen_id", createdSpecimenIds).del();
      await knex("specimen_registry").whereIn("specimen_id", createdSpecimenIds).del();
    }
    if (createdTaxonIds.length > 0) {
      await knex("taxa").whereIn("taxon_id", createdTaxonIds).del();
    }
    await knex.destroy();
  });

  test("maps fixture 6885436349 accurately to all Darwin Core fields", () => {
    const mockTaxaLookup = {
      byName: new Map([["supella longipalpa", [{ taxon_id: 99999, rootOrder: "blattodea" }]]]),
      byGbifKey: new Map(),
      orderByName: new Map([["blattodea", 11]]),
    };

    const rec = transformGbifRecord(FIXTURE_6885436349, {
      taxaLookup: mockTaxaLookup,
      matchProvince: () => 29,
    });

    expect(rec.skip).toBeUndefined();
    expect(rec.specimenBase.taxon_id).toBe(99999); // Species-level, not Order
    expect(rec.specimenBase.locality_detail).toBe("Alley 2 Ap Bac, Tan Binh, Ho Chi Minh City, VN");
    expect(rec.specimenBase.collection_date).toBe("2026-10-30");
    expect(rec.specimenBase.is_public).toBe(true);
    expect(rec.registry.coordinate_uncertainty_m).toBe(27004);
    expect(rec.registry.identified_by).toBe("insect ID");
    expect(rec.registry.date_identified).toBe("2026-11-01");
    expect(rec.registry.license).toBe("CC BY");
    expect(rec.registry.references_url).toBe("https://www.inaturalist.org/observations/412244579");
    expect(rec.registry.rights_holder).toBe("insect ID");
    expect(rec.registry.dataset_name).toBe("iNaturalist research-grade observations");
    expect(JSON.parse(rec.registry.gbif_issues)).toContain("COORDINATE_ROUNDED");
    expect(rec.registry.gbif_family).toBe("Pseudophyllodromiidae");
    expect(rec.registry.gbif_genus).toBe("Supella");
    expect(rec.registry.gbif_species).toBe("Supella longipalpa");
  });

  test("missing fields produce NULL (no fake values); CC BY-NC is public; unknown/empty license defaults to is_public=false", () => {
    const minimalNc = {
      gbifID: 9999999001,
      occurrenceID: "https://example.org/occ/nc-test",
      order: "Blattodea",
      decimalLatitude: 10.8,
      decimalLongitude: 106.6,
      eventDate: "2025-05-01",
      license: "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
    };

    const minimalUnknown = {
      ...minimalNc,
      gbifID: 9999999002,
      occurrenceID: "https://example.org/occ/unknown-test",
      license: null,
    };

    const lookup = { byName: new Map(), byGbifKey: new Map(), orderByName: new Map([["blattodea", 11]]) };
    const recNc = transformGbifRecord(minimalNc, { taxaLookup: lookup });
    const recUnknown = transformGbifRecord(minimalUnknown, { taxaLookup: lookup });

    expect(normalizeOccurrenceLicense(minimalNc.license)).toBe("CC BY-NC");
    expect(shouldBePublicByLicense("CC BY-NC")).toBe(true);
    expect(shouldBePublicByLicense("CC BY-NC-SA")).toBe(true);
    expect(shouldBePublicByLicense("UNKNOWN")).toBe(false);
    expect(recNc.specimenBase.is_public).toBe(true);
    expect(recUnknown.specimenBase.is_public).toBe(false);
    expect(recNc.specimenBase.locality_detail).toBeNull();
    expect(recNc.registry.identified_by).toBeNull();
    expect(recNc.registry.date_identified).toBeNull();
    expect(recNc.registry.coordinate_uncertainty_m).toBeNull();
    expect(recNc.registry.references_url).toBeNull();
    expect(recNc.registry.rights_holder).toBeNull();
    expect(recNc.registry.dataset_name).toBeNull();
    expect(recNc.registry.gbif_issues).toBeNull();
  });

  test("upsert is idempotent (no duplicates) and NEVER overwrites Admin-edited fields", async () => {
    const uniq = Date.now().toString(36);
    let blattodea = await knex("taxa").where({ scientific_name: "Blattodea", taxon_rank: "Order" }).first();
    if (!blattodea) {
      const [ins] = await knex("taxa")
        .insert({ taxon_rank: "Order", scientific_name: "Blattodea", slug: `blattodea-${uniq}`, taxonomic_status: "accepted" })
        .returning("taxon_id");
      blattodea = { taxon_id: Number(ins.taxon_id ?? ins) };
      createdTaxonIds.push(blattodea.taxon_id);
    }
    const fixture = {
      ...FIXTURE_6885436349,
      gbifID: 8800000000 + Math.floor(Math.random() * 100000),
      occurrenceID: `https://test.vietinsect.vn/occ/${uniq}`,
      verbatimLocality: "Original GBIF Locality",
    };

    const rec = transformGbifRecord(fixture, {
      taxaLookup: { byName: new Map(), byGbifKey: new Map(), orderByName: new Map([["blattodea", Number(blattodea.taxon_id)]]) },
    });

    // 1. Insert lần 1
    let spId;
    await knex.transaction(async (trx) => {
      const r1 = await upsertGbifRecord(trx, rec);
      expect(r1.action).toBe("inserted");
      spId = r1.specimenId;
      createdSpecimenIds.push(spId);
    });

    // 2. Giả lập Admin chỉnh sửa tay locality_detail
    await knex("specimens")
      .where("specimen_id", spId)
      .update({ locality_detail: "Admin Verified Locality" });

    // 3. Chạy lại upsert lần 2 với dữ liệu GBIF mới → không nhân đôi & KHÔNG đè locality_detail của Admin
    const rec2 = transformGbifRecord(
      { ...fixture, verbatimLocality: "New GBIF Overwrite Attempt" },
      { taxaLookup: { byName: new Map(), byGbifKey: new Map(), orderByName: new Map([["blattodea", Number(blattodea.taxon_id)]]) } }
    );
    await knex.transaction(async (trx) => {
      const r2 = await upsertGbifRecord(trx, rec2);
      expect(r2.action).toBe("updated");
      expect(r2.specimenId).toBe(spId);
    });

    const rows = await knex("specimen_registry").where("gbif_occurrence_id", fixture.occurrenceID);
    expect(rows.length).toBe(1);

    const spAfter = await knex("specimens").where("specimen_id", spId).first();
    expect(spAfter.locality_detail).toBe("Admin Verified Locality");
  });
});
