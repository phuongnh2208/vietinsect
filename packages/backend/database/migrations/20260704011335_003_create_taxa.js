/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.schema.createTable("taxa", (t) => {
    t.bigIncrements("taxon_id").primary();
    t.bigInteger("parent_id").references("taxon_id").inTable("taxa").onDelete("RESTRICT");
    t.bigInteger("accepted_taxon_id").references("taxon_id").inTable("taxa").onDelete("SET NULL");
    t.string("taxon_rank", 20).notNullable();
    t.string("scientific_name", 255).notNullable();
    t.string("specific_epithet", 100);
    t.string("infraspecific_epithet", 100);
    t.string("scientific_name_authorship", 255);
    t.smallint("year_described");
    t.string("vernacular_name_vn", 255);
    t.string("vernacular_name_en", 255);
    t.string("taxonomic_status", 20).notNullable().defaultTo("accepted");
    t.string("nomenclatural_code", 20).defaultTo("ICZN");
    t.string("col_id", 50);
    t.string("itis_tsn", 50);
    t.string("gbif_taxon_key", 50);
    t.string("iucn_status", 5);
    t.boolean("is_verified").notNullable().defaultTo(false);
    t.text("taxon_notes");
    t.bigInteger("created_by").references("admin_id").inTable("admin_users").onDelete("SET NULL");
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`CREATE INDEX idx_taxa_parent ON taxa (parent_id)`);
  await knex.raw(`CREATE INDEX idx_taxa_rank ON taxa (taxon_rank)`);
  await knex.raw(`CREATE INDEX idx_taxa_name_trgm ON taxa USING GIN (scientific_name gin_trgm_ops)`);
  await knex.raw(`CREATE UNIQUE INDEX uq_taxa_col_id ON taxa (col_id) WHERE col_id IS NOT NULL`);

  await knex.schema.createTable("species_profiles", (t) => {
    t.bigInteger("taxon_id").primary().references("taxon_id").inTable("taxa").onDelete("CASCADE");
    t.text("morphology_description");
    t.text("ecology_description");
    t.text("distribution_summary");
    t.text("economic_value_description");
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("bioactivity_records", (t) => {
    t.bigIncrements("bioactivity_id").primary();
    t.bigInteger("taxon_id").notNullable().references("taxon_id").inTable("taxa").onDelete("CASCADE");
    t.string("activity_type", 100).notNullable();
    t.string("activity_level", 100);
    t.text("test_condition");
    t.text("description");
    t.string("reference_doi", 255);
    t.string("reference_title", 500);
    t.string("image_object_key", 500);
    t.bigInteger("created_by").references("admin_id").inTable("admin_users").onDelete("SET NULL");
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};


/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("bioactivity_records");
  await knex.schema.dropTableIfExists("species_profiles");
  await knex.schema.dropTableIfExists("taxa");
};