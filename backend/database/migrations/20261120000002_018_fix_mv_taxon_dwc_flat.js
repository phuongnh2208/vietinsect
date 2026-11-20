/**
 * DEF-107: Sửa Materialized View mv_taxon_dwc_flat so sánh LOWER(taxon_rank)
 * (dữ liệu thực tế lưu Title Case 'Species'/'Order'/..., trong khi migration 010 lọc chữ thường nên view luôn rỗng).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS mv_taxon_dwc_flat`);
  await knex.raw(`
    CREATE MATERIALIZED VIEW mv_taxon_dwc_flat AS
    WITH RECURSIVE taxon_path AS (
      SELECT taxon_id, taxon_id AS species_id, taxon_rank, scientific_name, parent_id
      FROM taxa WHERE LOWER(taxon_rank) = 'species'
      UNION ALL
      SELECT t.taxon_id, tp.species_id, t.taxon_rank, t.scientific_name, t.parent_id
      FROM taxa t JOIN taxon_path tp ON t.taxon_id = tp.parent_id
    )
    SELECT
      species_id AS taxon_id,
      MAX(scientific_name) FILTER (WHERE LOWER(taxon_rank) = 'kingdom') AS kingdom,
      MAX(scientific_name) FILTER (WHERE LOWER(taxon_rank) = 'phylum')  AS phylum,
      MAX(scientific_name) FILTER (WHERE LOWER(taxon_rank) = 'class')   AS class,
      MAX(scientific_name) FILTER (WHERE LOWER(taxon_rank) = 'order')   AS "order",
      MAX(scientific_name) FILTER (WHERE LOWER(taxon_rank) = 'family')  AS family,
      MAX(scientific_name) FILTER (WHERE LOWER(taxon_rank) = 'genus')   AS genus,
      MAX(scientific_name) FILTER (WHERE LOWER(taxon_rank) = 'species') AS species
    FROM taxon_path
    GROUP BY species_id
  `);
  await knex.raw(`CREATE UNIQUE INDEX idx_mv_taxon_dwc_flat ON mv_taxon_dwc_flat (taxon_id)`);
  await knex.raw(`REFRESH MATERIALIZED VIEW mv_taxon_dwc_flat`);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS mv_taxon_dwc_flat`);
  await knex.raw(`
    CREATE MATERIALIZED VIEW mv_taxon_dwc_flat AS
    WITH RECURSIVE taxon_path AS (
      SELECT taxon_id, taxon_id AS species_id, taxon_rank, scientific_name, parent_id
      FROM taxa WHERE taxon_rank = 'species'
      UNION ALL
      SELECT t.taxon_id, tp.species_id, t.taxon_rank, t.scientific_name, t.parent_id
      FROM taxa t JOIN taxon_path tp ON t.taxon_id = tp.parent_id
    )
    SELECT
      species_id AS taxon_id,
      MAX(scientific_name) FILTER (WHERE taxon_rank = 'kingdom') AS kingdom,
      MAX(scientific_name) FILTER (WHERE taxon_rank = 'phylum')  AS phylum,
      MAX(scientific_name) FILTER (WHERE taxon_rank = 'class')   AS class,
      MAX(scientific_name) FILTER (WHERE taxon_rank = 'order')   AS "order",
      MAX(scientific_name) FILTER (WHERE taxon_rank = 'family')  AS family,
      MAX(scientific_name) FILTER (WHERE taxon_rank = 'genus')   AS genus,
      MAX(scientific_name) FILTER (WHERE taxon_rank = 'species') AS species
    FROM taxon_path
    GROUP BY species_id
  `);
  await knex.raw(`CREATE UNIQUE INDEX idx_mv_taxon_dwc_flat ON mv_taxon_dwc_flat (taxon_id)`);
};
