const pool = require("../../config/db");

const TAXON_COLUMNS = `
  taxon_id, parent_id, accepted_taxon_id, taxon_rank, scientific_name,
  specific_epithet, infraspecific_epithet, scientific_name_authorship, year_described,
  vernacular_name_vn, vernacular_name_en, taxonomic_status, nomenclatural_code,
  col_id, itis_tsn, gbif_taxon_key, iucn_status, is_verified, taxon_notes,
  created_by, created_at, updated_at
`;

async function findAll() {
  const { rows } = await pool.query(`SELECT ${TAXON_COLUMNS} FROM taxa ORDER BY scientific_name ASC`);
  return rows;
}

async function findById(taxonId) {
  const { rows } = await pool.query(`SELECT ${TAXON_COLUMNS} FROM taxa WHERE taxon_id = $1`, [taxonId]);
  return rows[0] || null;
}

async function findByScientificName(scientificName) {
  const { rows } = await pool.query(
    `SELECT ${TAXON_COLUMNS} FROM taxa WHERE lower(scientific_name) = lower($1)`,
    [scientificName],
  );
  return rows[0] || null;
}

async function search(query, limit = 10) {
  const { rows } = await pool.query(
    `SELECT ${TAXON_COLUMNS} FROM taxa
     WHERE scientific_name ILIKE $1 OR vernacular_name_vn ILIKE $1 OR vernacular_name_en ILIKE $1
     ORDER BY scientific_name ASC
     LIMIT $2`,
    [`%${query}%`, limit],
  );
  return rows;
}

async function countChildren(taxonId) {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM taxa WHERE parent_id = $1", [taxonId]);
  return rows[0].count;
}

async function countSpecimensByTaxon() {
  const { rows } = await pool.query(
    "SELECT taxon_id, COUNT(*)::int AS count FROM specimens WHERE deleted_at IS NULL GROUP BY taxon_id",
  );
  return rows;
}

async function countSpecimens(taxonId) {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM specimens WHERE taxon_id = $1 AND deleted_at IS NULL",
    [taxonId],
  );
  return rows[0].count;
}

async function create(data, adminId) {
  const { rows } = await pool.query(
    `INSERT INTO taxa (
       parent_id, taxon_rank, scientific_name, specific_epithet, infraspecific_epithet,
       scientific_name_authorship, year_described, vernacular_name_vn, vernacular_name_en,
       col_id, itis_tsn, gbif_taxon_key, iucn_status, taxon_notes, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING ${TAXON_COLUMNS}`,
    [
      data.parentId || null,
      data.taxonRank,
      data.scientificName,
      data.specificEpithet || null,
      data.infraspecificEpithet || null,
      data.scientificNameAuthorship || null,
      data.yearDescribed || null,
      data.vernacularNameVn || null,
      data.vernacularNameEn || null,
      data.colId || null,
      data.itisTsn || null,
      data.gbifTaxonKey || null,
      data.iucnStatus || null,
      data.taxonNotes || null,
      adminId || null,
    ],
  );
  return rows[0];
}

async function update(taxonId, data) {
  const { rows } = await pool.query(
    `UPDATE taxa SET
       parent_id = COALESCE($2, parent_id),
       taxon_rank = COALESCE($3, taxon_rank),
       scientific_name = COALESCE($4, scientific_name),
       specific_epithet = COALESCE($5, specific_epithet),
       infraspecific_epithet = COALESCE($6, infraspecific_epithet),
       scientific_name_authorship = COALESCE($7, scientific_name_authorship),
       year_described = COALESCE($8, year_described),
       vernacular_name_vn = COALESCE($9, vernacular_name_vn),
       vernacular_name_en = COALESCE($10, vernacular_name_en),
       col_id = COALESCE($11, col_id),
       itis_tsn = COALESCE($12, itis_tsn),
       gbif_taxon_key = COALESCE($13, gbif_taxon_key),
       iucn_status = COALESCE($14, iucn_status),
       taxon_notes = COALESCE($15, taxon_notes),
       updated_at = NOW()
     WHERE taxon_id = $1
     RETURNING ${TAXON_COLUMNS}`,
    [
      taxonId,
      data.parentId,
      data.taxonRank,
      data.scientificName,
      data.specificEpithet,
      data.infraspecificEpithet,
      data.scientificNameAuthorship,
      data.yearDescribed,
      data.vernacularNameVn,
      data.vernacularNameEn,
      data.colId,
      data.itisTsn,
      data.gbifTaxonKey,
      data.iucnStatus,
      data.taxonNotes,
    ],
  );
  return rows[0] || null;
}

async function setSynonym(taxonId, acceptedTaxonId) {
  const { rows } = await pool.query(
    `UPDATE taxa SET taxonomic_status = 'synonym', accepted_taxon_id = $2, updated_at = NOW()
     WHERE taxon_id = $1
     RETURNING ${TAXON_COLUMNS}`,
    [taxonId, acceptedTaxonId],
  );
  return rows[0] || null;
}

async function clearSynonym(taxonId) {
  const { rows } = await pool.query(
    `UPDATE taxa SET taxonomic_status = 'accepted', accepted_taxon_id = NULL, updated_at = NOW()
     WHERE taxon_id = $1
     RETURNING ${TAXON_COLUMNS}`,
    [taxonId],
  );
  return rows[0] || null;
}

async function markVerified(taxonId, isVerified) {
  await pool.query("UPDATE taxa SET is_verified = $2 WHERE taxon_id = $1", [taxonId, isVerified]);
}

async function remove(taxonId) {
  await pool.query("DELETE FROM taxa WHERE taxon_id = $1", [taxonId]);
}

async function findProfile(taxonId) {
  const { rows } = await pool.query("SELECT * FROM species_profiles WHERE taxon_id = $1", [taxonId]);
  return rows[0] || null;
}

async function upsertProfile(taxonId, data) {
  const { rows } = await pool.query(
    `INSERT INTO species_profiles (taxon_id, morphology_description, ecology_description, distribution_summary, economic_value_description, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (taxon_id) DO UPDATE SET
       morphology_description = EXCLUDED.morphology_description,
       ecology_description = EXCLUDED.ecology_description,
       distribution_summary = EXCLUDED.distribution_summary,
       economic_value_description = EXCLUDED.economic_value_description,
       updated_at = NOW()
     RETURNING *`,
    [
      taxonId,
      data.morphologyDescription || null,
      data.ecologyDescription || null,
      data.distributionSummary || null,
      data.economicValueDescription || null,
    ],
  );
  return rows[0];
}

async function listBioactivity(taxonId) {
  const { rows } = await pool.query(
    "SELECT * FROM bioactivity_records WHERE taxon_id = $1 ORDER BY created_at DESC",
    [taxonId],
  );
  return rows;
}

async function createBioactivity(taxonId, data, adminId) {
  const { rows } = await pool.query(
    `INSERT INTO bioactivity_records (
       taxon_id, activity_type, activity_level, test_condition, description,
       reference_doi, reference_title, image_object_key, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      taxonId,
      data.activityType,
      data.activityLevel || null,
      data.testCondition || null,
      data.description || null,
      data.referenceDoi || null,
      data.referenceTitle || null,
      data.imageObjectKey || null,
      adminId || null,
    ],
  );
  return rows[0];
}

async function removeBioactivity(bioactivityId) {
  await pool.query("DELETE FROM bioactivity_records WHERE bioactivity_id = $1", [bioactivityId]);
}

module.exports = {
  findAll,
  findById,
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
