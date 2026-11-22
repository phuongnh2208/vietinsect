"use strict";

/**
 * backend/scripts/lib/gbifTransform.js
 * Pure helpers for Step 2 GBIF Import Pipeline:
 * - Darwin Core 22-field extraction (verbatimLocality, coordinateUncertaintyInMeters,
 *   identifiedBy, dateIdentified, license, references, rightsHolder, datasetName, issues,
 *   family, genus, species)
 * - License normalization & public/private policy (NC/ND/unknown -> is_public = false)
 * - Lowest-rank taxon resolution (Species -> Genus -> Family -> Order) with Order lineage check
 * - Admin-safe idempotent upsert (never overwrites non-null fields when updated_by IS NOT NULL)
 */

const VN_BBOX = { latMin: 8.0, latMax: 24.0, lonMin: 101.0, lonMax: 110.0 };

function isInVietnam(lat, lon) {
  if (lat == null || lon == null) return false;
  return (
    lat >= VN_BBOX.latMin &&
    lat <= VN_BBOX.latMax &&
    lon >= VN_BBOX.lonMin &&
    lon <= VN_BBOX.lonMax
  );
}

function parseIsoDate(rawDate, fallback = {}) {
  let candidate = null;
  if (rawDate) {
    const firstPart = String(rawDate).split("/")[0].trim().split("T")[0].trim();
    const parts = firstPart.split("-");
    if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
      candidate = `${parts[0]}-01-01`;
    } else if (parts.length === 2 && /^\d{4}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1])) {
      candidate = `${parts[0]}-${parts[1].padStart(2, "0")}-01`;
    } else if (parts.length >= 3 && /^\d{4}$/.test(parts[0])) {
      candidate = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].slice(0, 2).padStart(2, "0")}`;
    }
  }
  if (!candidate && fallback.year && Number.isInteger(Number(fallback.year))) {
    const y = String(fallback.year);
    const m = fallback.month ? String(fallback.month).padStart(2, "0") : "01";
    const d = fallback.day ? String(fallback.day).padStart(2, "0") : "01";
    candidate = `${y}-${m}-${d}`;
  }
  if (!candidate) return null;
  const dt = new Date(`${candidate}T00:00:00Z`);
  if (isNaN(dt.getTime())) return null;
  const year = dt.getUTCFullYear();
  if (year < 1800 || year > 2050) return null;
  return dt.toISOString().slice(0, 10);
}

/**
 * Chuẩn hóa giấy phép bản ghi GBIF (occurrence license).
 * Trả về: 'CC0' | 'CC BY' | 'CC BY-SA' | 'CC BY-NC' | 'CC BY-NC-SA' | 'CC BY-ND' | 'CC BY-NC-ND' | 'UNKNOWN'
 */
function normalizeOccurrenceLicense(raw) {
  if (!raw) return "UNKNOWN";
  const s = String(raw).toLowerCase();
  if (s.includes("zero") || s.includes("cc0") || s.includes("publicdomain")) return "CC0";
  if (s.includes("by-nc-nd") || s.includes("by_nc_nd")) return "CC BY-NC-ND";
  if (s.includes("by-nc-sa") || s.includes("by_nc_sa")) return "CC BY-NC-SA";
  if (s.includes("by-nc") || s.includes("by_nc")) return "CC BY-NC";
  if (s.includes("by-nd") || s.includes("by_nd")) return "CC BY-ND";
  if (s.includes("by-sa") || s.includes("by_sa")) return "CC BY-SA";
  if (s.includes("/by/") || s.includes("cc_by") || s.includes("cc-by") || s.startsWith("cc by")) return "CC BY";
  return "UNKNOWN";
}

/**
 * Bản ghi có giấy phép NC / ND / UNKNOWN mặc định is_public = false chờ Admin duyệt.
 * Chỉ CC0, CC BY, CC BY-SA được public mặc định.
 */
function shouldBePublicByLicense(normalizedLicense) {
  return normalizedLicense === "CC0" || normalizedLicense === "CC BY" || normalizedLicense === "CC BY-SA";
}

function normalizeSex(sex) {
  if (!sex) return null;
  const s = String(sex).toLowerCase();
  if (s === "male" || s === "m") return "male";
  if (s === "female" || s === "f") return "female";
  return null;
}

/**
 * Chuẩn hóa tên khoa học bỏ subgenus trong ngoặc và tác giả
 */
function stripSubgenus(name) {
  if (!name) return "";
  return String(name).trim().replace(/^([A-Z][a-z]+)\s+\([A-Z][a-z]+\)\s+/, "$1 ");
}

/**
 * Chọn taxon_id ở cấp thấp nhất khớp được (Species -> Genus -> Family -> Order)
 * với kiểm tra Order lineage để tránh homonym.
 */
function resolveLowestTaxonId(gbifRecord, taxaLookup) {
  if (!taxaLookup) return null;
  const orderLower = gbifRecord.order ? String(gbifRecord.order).trim().toLowerCase() : null;

  // 1. Thử khớp theo speciesKey / acceptedTaxonKey / taxonKey
  const keys = [gbifRecord.speciesKey, gbifRecord.acceptedTaxonKey, gbifRecord.taxonKey].filter(Boolean);
  for (const k of keys) {
    const hit = taxaLookup.byGbifKey?.get(String(k));
    if (hit && (!orderLower || !hit.rootOrder || hit.rootOrder === orderLower)) {
      return hit.taxon_id;
    }
  }

  // 2. Thử khớp theo tên từ thấp lên cao: species -> genus -> family -> order
  const candidates = [];
  if (gbifRecord.species) candidates.push(stripSubgenus(gbifRecord.species).toLowerCase());
  if (gbifRecord.genus) candidates.push(String(gbifRecord.genus).trim().toLowerCase());
  if (gbifRecord.family) candidates.push(String(gbifRecord.family).trim().toLowerCase());
  if (orderLower) candidates.push(orderLower);

  for (const c of candidates) {
    const list = taxaLookup.byName?.get(c);
    if (!list || list.length === 0) continue;
    const sameOrder = list.find((h) => !orderLower || !h.rootOrder || h.rootOrder === orderLower);
    if (sameOrder) return sameOrder.taxon_id;
  }

  return orderLower ? (taxaLookup.orderByName?.get(orderLower) ?? null) : null;
}

/**
 * Transform 1 GBIF occurrence record (chuẩn Darwin Core / SRS 22 trường).
 * Trường thiếu -> NULL (không sinh giá trị giả).
 */
function transformGbifRecord(gbifRecord, { taxaLookup, matchProvince } = {}) {
  const {
    occurrenceID,
    gbifID,
    datasetKey,
    datasetName,
    order: orderName,
    family,
    genus,
    species,
    speciesKey,
    scientificName,
    decimalLatitude: lat,
    decimalLongitude: lon,
    coordinateUncertaintyInMeters,
    eventDate,
    stateProvince,
    verbatimLocality,
    locality,
    recordedBy,
    identifiedBy,
    dateIdentified,
    institutionCode,
    catalogNumber,
    basisOfRecord,
    occurrenceRemarks,
    license: rawLicense,
    references,
    rightsHolder,
    issues,
  } = gbifRecord;

  if (
    basisOfRecord === "LITERATURE" ||
    basisOfRecord === "FOSSIL_SPECIMEN" ||
    basisOfRecord === "MATERIAL_CITATION"
  ) {
    return { skip: "literature" };
  }

  const occId = occurrenceID || (gbifID ? `gbif:${gbifID}` : null);
  if (!occId) return { skip: "no_occurrence_id" };

  const taxon_id = resolveLowestTaxonId(gbifRecord, taxaLookup);
  if (!taxon_id) return { skip: "no_taxon" };

  const collectionDate = parseIsoDate(eventDate, gbifRecord);
  if (!collectionDate) return { skip: "no_date" };

  if (!isInVietnam(lat, lon)) return { skip: "bbox" };

  const province_id = matchProvince ? matchProvince(stateProvince) : null;
  const normalizedLicense = normalizeOccurrenceLicense(rawLicense);
  const isPublic = shouldBePublicByLicense(normalizedLicense);

  const uncertaintyVal =
    coordinateUncertaintyInMeters != null && Number.isFinite(Number(coordinateUncertaintyInMeters))
      ? Number(coordinateUncertaintyInMeters)
      : null;

  const localityVal = (verbatimLocality || locality || "").trim().slice(0, 500) || null;
  const dateIdentifiedVal = dateIdentified ? parseIsoDate(dateIdentified) : null;

  const registry = {
    specimen_code: `GBIF-${gbifID || occId.replace(/[^a-z0-9]/gi, "")}`.slice(0, 50),
    gbif_occurrence_id: String(occId).slice(0, 100),
    gbif_dataset_key: datasetKey ? String(datasetKey).slice(0, 50) : null,
    basis_of_record: basisOfRecord ? String(basisOfRecord).slice(0, 50) : null,
    catalog_number: catalogNumber ? String(catalogNumber).slice(0, 100) : null,
    institution_code: institutionCode ? String(institutionCode).slice(0, 50) : null,
    recorded_by: recordedBy ? String(recordedBy).slice(0, 500) : null,
    occurrence_remarks: occurrenceRemarks ? String(occurrenceRemarks).slice(0, 1000) : null,
    coordinate_uncertainty_m: uncertaintyVal,
    identified_by: identifiedBy ? String(identifiedBy).trim().slice(0, 500) : null,
    date_identified: dateIdentifiedVal,
    license: normalizedLicense !== "UNKNOWN" ? normalizedLicense : (rawLicense ? String(rawLicense).slice(0, 100) : null),
    references_url: references ? String(references).trim().slice(0, 1000) : null,
    rights_holder: rightsHolder ? String(rightsHolder).trim().slice(0, 500) : null,
    dataset_name: datasetName ? String(datasetName).trim().slice(0, 500) : null,
    gbif_issues: Array.isArray(issues) && issues.length > 0 ? JSON.stringify(issues) : null,
    gbif_family: family ? String(family).trim().slice(0, 150) : null,
    gbif_genus: genus ? String(genus).trim().slice(0, 150) : null,
    gbif_species: species ? stripSubgenus(species).slice(0, 255) : null,
  };

  const gbifSciName = (species ? stripSubgenus(species) : (genus || scientificName || "")).trim().slice(0, 300) || null;
  const gbifTaxonKey = speciesKey || gbifRecord.acceptedTaxonKey || gbifRecord.taxonKey || null;

  const specimenBase = {
    taxon_id,
    province_id: province_id || null,
    locality_detail: localityVal,
    gps_accuracy_m: uncertaintyVal != null && uncertaintyVal <= 9999.99 ? uncertaintyVal : null,
    collection_date: collectionDate,
    individual_count: gbifRecord.individualCount || 1,
    sex: normalizeSex(gbifRecord.sex),
    is_public: isPublic,
    gbif_scientific_name: gbifSciName,
    gbif_taxon_key: gbifTaxonKey,
  };

  return {
    occId,
    gbifID: gbifID ? String(gbifID) : null,
    normalizedLicense,
    registry,
    specimenBase,
    lat,
    lon,
    rawRecord: gbifRecord,
  };
}

/**
 * Upsert idempotent 1 bản ghi vào PostgreSQL trong transaction:
 * - Nếu chưa có: INSERT specimen_registry + INSERT specimens.
 * - Nếu đã có (trùng gbif_occurrence_id):
 *   - Cập nhật các trường metadata mới trong specimen_registry bằng COALESCE (không xóa dữ liệu đã có).
 *   - Với bảng specimens: nếu updated_by IS NOT NULL (Admin đã chỉnh tay), CHỈ điền các cột đang NULL
 *     (COALESCE), tuyệt đối KHÔNG ghi đè dữ liệu Admin đã sửa; không đổi is_public của bản ghi cũ.
 */
async function upsertGbifRecord(trx, rec) {
  const { registry, specimenBase, lat, lon } = rec;

  const existing = await trx("specimen_registry")
    .where("gbif_occurrence_id", registry.gbif_occurrence_id)
    .select("specimen_id")
    .first();

  if (existing) {
    const specimenId = Number(existing.specimen_id);

    // Cập nhật các cột mới của specimen_registry (chỉ điền NULL hoặc metadata GBIF)
    await trx.raw(
      `UPDATE specimen_registry
       SET coordinate_uncertainty_m = COALESCE(coordinate_uncertainty_m, ?),
           identified_by            = COALESCE(identified_by, ?),
           date_identified          = COALESCE(date_identified, ?),
           license                  = COALESCE(license, ?),
           references_url           = COALESCE(references_url, ?),
           rights_holder            = COALESCE(rights_holder, ?),
           dataset_name             = COALESCE(dataset_name, ?),
           gbif_issues              = COALESCE(gbif_issues, ?::jsonb),
           gbif_family              = COALESCE(gbif_family, ?),
           gbif_genus               = COALESCE(gbif_genus, ?),
           gbif_species             = COALESCE(gbif_species, ?),
           recorded_by              = COALESCE(recorded_by, ?)
       WHERE specimen_id = ?`,
      [
        registry.coordinate_uncertainty_m,
        registry.identified_by,
        registry.date_identified,
        registry.license,
        registry.references_url,
        registry.rights_holder,
        registry.dataset_name,
        registry.gbif_issues,
        registry.gbif_family,
        registry.gbif_genus,
        registry.gbif_species,
        registry.recorded_by,
        specimenId,
      ]
    );

    // Kiểm tra xem Admin đã chỉnh tay bản ghi specimens chưa (updated_by IS NOT NULL)
    // Dùng COALESCE cho mọi trường để không bao giờ ghi đè giá trị đã có / Admin đã sửa
    await trx.raw(
      `UPDATE specimens
       SET locality_detail      = COALESCE(locality_detail, ?),
           gps_accuracy_m       = COALESCE(gps_accuracy_m, ?),
           gbif_scientific_name = COALESCE(gbif_scientific_name, ?),
           gbif_taxon_key       = COALESCE(gbif_taxon_key, ?),
           province_id          = COALESCE(province_id, ?),
           updated_at           = now()
       WHERE specimen_id = ? AND deleted_at IS NULL`,
      [
        specimenBase.locality_detail,
        specimenBase.gps_accuracy_m,
        specimenBase.gbif_scientific_name,
        specimenBase.gbif_taxon_key,
        specimenBase.province_id,
        specimenId,
      ]
    );

    return { action: "updated", specimenId };
  }

  const [insReg] = await trx("specimen_registry")
    .insert({
      specimen_code: registry.specimen_code,
      gbif_occurrence_id: registry.gbif_occurrence_id,
      gbif_dataset_key: registry.gbif_dataset_key,
      basis_of_record: registry.basis_of_record,
      catalog_number: registry.catalog_number,
      institution_code: registry.institution_code,
      recorded_by: registry.recorded_by,
      occurrence_remarks: registry.occurrence_remarks,
      coordinate_uncertainty_m: registry.coordinate_uncertainty_m,
      identified_by: registry.identified_by,
      date_identified: registry.date_identified,
      license: registry.license,
      references_url: registry.references_url,
      rights_holder: registry.rights_holder,
      dataset_name: registry.dataset_name,
      gbif_issues: registry.gbif_issues ? trx.raw("?::jsonb", [registry.gbif_issues]) : null,
      gbif_family: registry.gbif_family,
      gbif_genus: registry.gbif_genus,
      gbif_species: registry.gbif_species,
    })
    .returning("specimen_id");

  const specimenId = Number(insReg.specimen_id ?? insReg);

  await trx.raw(
    `INSERT INTO specimens
      (specimen_id, taxon_id, province_id, locality_detail, gps_accuracy_m,
       collection_date, collection_point, individual_count, sex, is_public,
       gbif_scientific_name, gbif_taxon_key, created_at, updated_at, entry_date)
     VALUES (?, ?, ?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?, ?, ?, ?, ?, now(), now(), now())`,
    [
      specimenId,
      specimenBase.taxon_id,
      specimenBase.province_id,
      specimenBase.locality_detail,
      specimenBase.gps_accuracy_m,
      specimenBase.collection_date,
      lon,
      lat,
      specimenBase.individual_count,
      specimenBase.sex,
      specimenBase.is_public,
      specimenBase.gbif_scientific_name,
      specimenBase.gbif_taxon_key,
    ]
  );

  return { action: "inserted", specimenId };
}

module.exports = {
  isInVietnam,
  parseIsoDate,
  normalizeOccurrenceLicense,
  shouldBePublicByLicense,
  resolveLowestTaxonId,
  transformGbifRecord,
  upsertGbifRecord,
};
