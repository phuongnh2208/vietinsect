/**
 * Migration 013 – Thêm trường GBIF vào specimen_registry
 *
 * Mục đích:
 *  - Lưu GBIF occurrenceID (unique) để import idempotent (re-run không trùng)
 *  - Lưu basis_of_record (DwC) và gbif_dataset_key để tra cứu nguồn gốc
 *  - Thêm catalog_number và recorded_by vào specimen_registry (DwC standard)
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
  await knex.schema.alterTable("specimen_registry", (t) => {
    // GBIF / DwC fields
    t.string("gbif_occurrence_id", 100).unique().nullable();
    t.string("gbif_dataset_key", 50).nullable();
    t.string("basis_of_record", 50).nullable(); // e.g. HUMAN_OBSERVATION, PRESERVED_SPECIMEN
    t.string("catalog_number", 100).nullable();
    t.string("institution_code", 50).nullable();
    t.string("recorded_by", 500).nullable();
    t.string("occurrence_remarks", 1000).nullable();
  });

  // Index để lookup nhanh khi import
  await knex.raw(
    `CREATE INDEX idx_registry_gbif ON specimen_registry (gbif_occurrence_id) WHERE gbif_occurrence_id IS NOT NULL`
  );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
  await knex.raw(`DROP INDEX IF EXISTS idx_registry_gbif`);
  await knex.schema.alterTable("specimen_registry", (t) => {
    t.dropColumn("gbif_occurrence_id");
    t.dropColumn("gbif_dataset_key");
    t.dropColumn("basis_of_record");
    t.dropColumn("catalog_number");
    t.dropColumn("institution_code");
    t.dropColumn("recorded_by");
    t.dropColumn("occurrence_remarks");
  });
};
