/**
 * taxonomy.repository.js — dùng Knex query builder (SRS §6.5).
 * Toàn bộ công việc DB của module taxonomy đi qua đây, không có pg raw pool.
 * Export `knex` để service dùng knex.transaction() khi bulk import Specimen.
 */
const knex = require("../../config/knex");

// Danh sách column rõ ràng để tránh SELECT *. Thứ tự khớp với toTaxonDto() trong service.
const TAXON_COLUMNS = [
  "taxon_id", "parent_id", "accepted_taxon_id", "taxon_rank", "scientific_name",
  "slug", "specific_epithet", "infraspecific_epithet", "scientific_name_authorship",
  "year_described", "vernacular_name_vn", "vernacular_name_en", "taxonomic_status",
  "nomenclatural_code", "col_id", "itis_tsn", "gbif_taxon_key", "iucn_status",
  "is_verified", "taxon_notes", "created_by", "created_at", "updated_at",
];

async function findAll() {
  return knex("taxa").select(TAXON_COLUMNS).orderBy("scientific_name", "asc");
}

async function findByRanks(ranks) {
  return knex("taxa")
    .select(TAXON_COLUMNS)
    .whereIn("taxon_rank", ranks)
    .orderBy("scientific_name", "asc");
}

async function countChildrenByParentIds(parentIds) {
  if (!parentIds || parentIds.length === 0) return [];
  const rows = await knex("taxa")
    .whereIn("parent_id", parentIds)
    .groupBy("parent_id")
    .select("parent_id")
    .count("* as count");
  return rows.map((r) => ({ parent_id: Number(r.parent_id), count: parseInt(r.count, 10) }));
}

async function findChildren(parentId) {
  return knex("taxa")
    .select(TAXON_COLUMNS)
    .where("parent_id", parentId)
    .orderBy("scientific_name", "asc");
}

/**
 * Cộng dồn số mẫu vật từ bậc sâu (Subspecies/Species/Genus) ngược lên Family/Order
 * để cây phân loại lazy-load (dừng ở Family) vẫn hiển thị đúng tổng mẫu vật.
 */
async function countSpecimensRollup({ includePrivate = false } = {}) {
  const visSql = includePrivate ? "" : "AND s.is_public = true";
  const { rows } = await knex.raw(`
    SELECT
      COALESCE(
        CASE WHEN t1.taxon_rank IN ('Kingdom','Phylum','Class','Order','Family') THEN t1.taxon_id END,
        CASE WHEN t2.taxon_rank IN ('Kingdom','Phylum','Class','Order','Family') THEN t2.taxon_id END,
        CASE WHEN t3.taxon_rank IN ('Kingdom','Phylum','Class','Order','Family') THEN t3.taxon_id END,
        t1.taxon_id
      ) AS taxon_id,
      COUNT(*)::int AS count
    FROM specimens s
    JOIN taxa t1 ON s.taxon_id = t1.taxon_id
    LEFT JOIN taxa t2 ON t1.parent_id = t2.taxon_id
    LEFT JOIN taxa t3 ON t2.parent_id = t3.taxon_id
    WHERE s.deleted_at IS NULL ${visSql}
    GROUP BY 1
  `);
  return rows.map((r) => ({ taxon_id: Number(r.taxon_id), count: Number(r.count) }));
}

async function findById(taxonId) {
  const row = await knex("taxa").select(TAXON_COLUMNS).where("taxon_id", taxonId).first();
  return row || null;
}

// BUG #1: truy vấn thẳng bằng cột slug có UNIQUE INDEX — không còn full scan.
async function findBySlug(slug) {
  const row = await knex("taxa").select(TAXON_COLUMNS).where("slug", slug).first();
  return row || null;
}

async function findByScientificName(scientificName) {
  const row = await knex("taxa")
    .select(TAXON_COLUMNS)
    .whereRaw("lower(scientific_name) = lower(?)", [scientificName])
    .first();
  return row || null;
}

async function search(query, limit = 15) {
  const safeQuery = String(query || "").slice(0, 100).replace(/[%_\\]/g, "\\$&");
  return knex("taxa")
    .select(TAXON_COLUMNS)
    .whereRaw("scientific_name ILIKE ? ESCAPE '\\'", [`%${safeQuery}%`])
    .orWhereRaw("vernacular_name_vn ILIKE ? ESCAPE '\\'", [`%${safeQuery}%`])
    .orWhereRaw("vernacular_name_en ILIKE ? ESCAPE '\\'", [`%${safeQuery}%`])
    .orderBy("scientific_name", "asc")
    .limit(limit);
}

async function countSpecimensByTaxonIds(taxonIds, { includePrivate = false } = {}) {
  if (!taxonIds || taxonIds.length === 0) return [];
  const rows = await knex("specimens")
    .whereIn("taxon_id", taxonIds)
    .whereNull("deleted_at")
    .modify((q) => {
      if (!includePrivate) q.where("is_public", true);
    })
    .groupBy("taxon_id")
    .select("taxon_id")
    .count("* as count");
  return rows.map((r) => ({ taxon_id: Number(r.taxon_id), count: parseInt(r.count, 10) }));
}

async function countChildren(taxonId) {
  const [{ count }] = await knex("taxa").where("parent_id", taxonId).count("* as count");
  return parseInt(count, 10);
}

async function countSpecimensByTaxon({ includePrivate = false } = {}) {
  const rows = await knex("specimens")
    .whereNull("deleted_at")
    .modify((q) => {
      if (!includePrivate) q.where("is_public", true);
    })
    .groupBy("taxon_id")
    .select("taxon_id")
    .count("* as count");
  // Knex trả count dạng string — ép về int để service dùng trực tiếp
  return rows.map((r) => ({ taxon_id: r.taxon_id, count: parseInt(r.count, 10) }));
}

async function countSpecimens(taxonId, { includePrivate = false } = {}) {
  const [{ count }] = await knex("specimens")
    .where("taxon_id", taxonId)
    .whereNull("deleted_at")
    .modify((q) => {
      if (!includePrivate) q.where("is_public", true);
    })
    .count("* as count");
  return parseInt(count, 10);
}

async function create(data, adminId) {
  const [row] = await knex("taxa")
    .insert({
      parent_id: data.parentId || null,
      taxon_rank: data.taxonRank,
      scientific_name: data.scientificName,
      slug: data.slug,
      specific_epithet: data.specificEpithet || null,
      infraspecific_epithet: data.infraspecificEpithet || null,
      scientific_name_authorship: data.scientificNameAuthorship || null,
      year_described: data.yearDescribed || null,
      vernacular_name_vn: data.vernacularNameVn || null,
      vernacular_name_en: data.vernacularNameEn || null,
      col_id: data.colId || null,
      itis_tsn: data.itisTsn || null,
      gbif_taxon_key: data.gbifTaxonKey || null,
      iucn_status: data.iucnStatus || null,
      taxon_notes: data.taxonNotes || null,
      created_by: adminId || null,
    })
    .returning(TAXON_COLUMNS);
  return row;
}

// BUG #3: dynamic SET — undefined = không đổi; null = set NULL. Không dùng COALESCE.
const UPDATE_ALLOWED_FIELDS = [
  { key: "parentId",                 col: "parent_id" },
  { key: "taxonRank",                col: "taxon_rank" },
  { key: "scientificName",           col: "scientific_name" },
  { key: "slug",                     col: "slug" },
  { key: "specificEpithet",          col: "specific_epithet" },
  { key: "infraspecificEpithet",     col: "infraspecific_epithet" },
  { key: "scientificNameAuthorship", col: "scientific_name_authorship" },
  { key: "yearDescribed",            col: "year_described" },
  { key: "vernacularNameVn",         col: "vernacular_name_vn" },
  { key: "vernacularNameEn",         col: "vernacular_name_en" },
  { key: "colId",                    col: "col_id" },
  { key: "itisTsn",                  col: "itis_tsn" },
  { key: "gbifTaxonKey",             col: "gbif_taxon_key" },
  { key: "iucnStatus",               col: "iucn_status" },
  { key: "taxonNotes",               col: "taxon_notes" },
];

async function update(taxonId, data) {
  const updateData = {};
  for (const { key, col } of UPDATE_ALLOWED_FIELDS) {
    if (key in data) {
      updateData[col] = data[key]; // null = set NULL; bỏ qua khi undefined
    }
  }

  if (Object.keys(updateData).length === 0) {
    // Không có field nào thay đổi → trả về record hiện tại
    return findById(taxonId);
  }

  updateData.updated_at = knex.fn.now();

  const [row] = await knex("taxa")
    .where("taxon_id", taxonId)
    .update(updateData)
    .returning(TAXON_COLUMNS);
  return row || null;
}

async function setSynonym(taxonId, acceptedTaxonId) {
  const [row] = await knex("taxa")
    .where("taxon_id", taxonId)
    .update({ taxonomic_status: "synonym", accepted_taxon_id: acceptedTaxonId, updated_at: knex.fn.now() })
    .returning(TAXON_COLUMNS);
  return row || null;
}

async function clearSynonym(taxonId) {
  const [row] = await knex("taxa")
    .where("taxon_id", taxonId)
    .update({ taxonomic_status: "accepted", accepted_taxon_id: null, updated_at: knex.fn.now() })
    .returning(TAXON_COLUMNS);
  return row || null;
}

async function markVerified(taxonId, isVerified) {
  await knex("taxa").where("taxon_id", taxonId).update({ is_verified: isVerified });
}

async function remove(taxonId) {
  await knex("taxa").where("taxon_id", taxonId).delete();
}

async function findProfile(taxonId) {
  const row = await knex("species_profiles").where("taxon_id", taxonId).first();
  return row || null;
}

async function upsertProfile(taxonId, data) {
  const payload = {
    taxon_id: taxonId,
    morphology_description: data.morphologyDescription || null,
    ecology_description: data.ecologyDescription || null,
    distribution_summary: data.distributionSummary || null,
    economic_value_description: data.economicValueDescription || null,
    updated_at: knex.fn.now(),
  };
  const [row] = await knex("species_profiles")
    .insert(payload)
    .onConflict("taxon_id")
    .merge(["morphology_description", "ecology_description", "distribution_summary", "economic_value_description", "updated_at"])
    .returning("*");
  return row;
}

async function listBioactivity(taxonId) {
  return knex("bioactivity_records")
    .where("taxon_id", taxonId)
    .orderBy("created_at", "desc");
}

async function createBioactivity(taxonId, data, adminId) {
  const [row] = await knex("bioactivity_records")
    .insert({
      taxon_id: taxonId,
      activity_type: data.activityType,
      activity_level: data.activityLevel || null,
      test_condition: data.testCondition || null,
      description: data.description || null,
      reference_doi: data.referenceDoi || null,
      reference_title: data.referenceTitle || null,
      image_object_key: data.imageObjectKey || null,
      created_by: adminId || null,
    })
    .returning("*");
  return row;
}

async function removeBioactivity(bioactivityId) {
  await knex("bioactivity_records").where("bioactivity_id", bioactivityId).delete();
}

module.exports = {
  knex, // Export để service dùng knex.transaction() cho bulk import Specimen
  findAll,
  findByRanks,
  findChildren,
  countChildrenByParentIds,
  countSpecimensRollup,
  countSpecimensByTaxonIds,
  findById,
  findBySlug,
  findByScientificName,
  search,
  countChildren,
  countSpecimensByTaxon,
  countSpecimens,
  create,
  update,
  setSynonym,
  clearSynonym,
  markVerified,
  remove,
  findProfile,
  upsertProfile,
  listBioactivity,
  createBioactivity,
  removeBioactivity,
};
