/**
 * Migration 014: Add gbif_scientific_name to specimens
 * ─────────────────────────────────────────────────────
 * Lưu tên khoa học gốc từ GBIF occurrence để:
 *  1. Relink specimens.taxon_id xuống Species-level sau COL sync
 *  2. Hiển thị tên định danh ban đầu (traceability)
 *
 * Cũng thêm:
 *  - gbif_taxon_key: taxonKey của GBIF record (species-level key)
 *  - INDEX trên gbif_scientific_name để relink-specimens-taxa.js nhanh
 */

exports.up = async function (knex) {
  await knex.schema.alterTable("specimens", (t) => {
    // Tên khoa học từ GBIF occurrence (verbatim, e.g. "Apis mellifera Linnaeus, 1758")
    t.string("gbif_scientific_name", 300).nullable();
    // GBIF species-level taxonKey (species/variety/subspecies)
    t.bigInteger("gbif_taxon_key").nullable();
  });

  // Index để relink-specimens-taxa.js lookup nhanh
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS idx_specimens_gbif_sci_name
     ON specimens (gbif_scientific_name)
     WHERE gbif_scientific_name IS NOT NULL`
  );
};

exports.down = async function (knex) {
  await knex.raw("DROP INDEX IF EXISTS idx_specimens_gbif_sci_name");
  await knex.schema.alterTable("specimens", (t) => {
    t.dropColumn("gbif_scientific_name");
    t.dropColumn("gbif_taxon_key");
  });
};
