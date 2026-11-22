/**
 * Migration 023: Bổ sung các trường Darwin Core / GBIF còn thiếu vào specimen_registry
 * - coordinate_uncertainty_m (numeric 10,2 — hỗ trợ giá trị > 9999m của GBIF)
 * - identified_by, date_identified
 * - license, references_url, rights_holder, dataset_name
 * - gbif_issues (jsonb — phục vụ cảnh báo chất lượng F-AI-04)
 * - gbif_family, gbif_genus, gbif_species
 * (Lưu ý: locality_detail cho verbatimLocality đã có sẵn trên bảng specimens)
 */

exports.up = async function (knex) {
  const cols = [
    ["coordinate_uncertainty_m", (t) => t.decimal("coordinate_uncertainty_m", 10, 2)],
    ["identified_by", (t) => t.string("identified_by", 500)],
    ["date_identified", (t) => t.date("date_identified")],
    ["license", (t) => t.string("license", 100)],
    ["references_url", (t) => t.string("references_url", 1000)],
    ["rights_holder", (t) => t.string("rights_holder", 500)],
    ["dataset_name", (t) => t.string("dataset_name", 500)],
    ["gbif_issues", (t) => t.jsonb("gbif_issues")],
    ["gbif_family", (t) => t.string("gbif_family", 150)],
    ["gbif_genus", (t) => t.string("gbif_genus", 150)],
    ["gbif_species", (t) => t.string("gbif_species", 255)],
  ];

  for (const [name, def] of cols) {
    const exists = await knex.schema.hasColumn("specimen_registry", name);
    if (!exists) {
      await knex.schema.alterTable("specimen_registry", (table) => {
        def(table).nullable();
      });
    }
  }
};

exports.down = async function (knex) {
  const names = [
    "coordinate_uncertainty_m",
    "identified_by",
    "date_identified",
    "license",
    "references_url",
    "rights_holder",
    "dataset_name",
    "gbif_issues",
    "gbif_family",
    "gbif_genus",
    "gbif_species",
  ];
  for (const name of names) {
    const exists = await knex.schema.hasColumn("specimen_registry", name);
    if (exists) {
      await knex.schema.alterTable("specimen_registry", (table) => {
        table.dropColumn(name);
      });
    }
  }
};
