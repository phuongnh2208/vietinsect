/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.schema.createTable("dna_sequences", (t) => {
    t.bigIncrements("dna_id").primary();
    t.bigInteger("specimen_id").references("specimen_id").inTable("specimen_registry").onDelete("CASCADE");
    t.bigInteger("taxon_id").notNullable().references("taxon_id").inTable("taxa").onDelete("RESTRICT");
    t.string("genbank_accession", 20).unique();
    t.string("gene_marker", 20);
    t.integer("sequence_length_bp");
    t.string("bold_process_id", 50);
    t.text("primers_info");
    t.date("submission_date");
    t.string("author_name", 255);
    t.boolean("is_public").notNullable().defaultTo(false);
    t.boolean("is_orphaned").notNullable().defaultTo(false);
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`CREATE INDEX idx_dna_specimen ON dna_sequences (specimen_id)`);
  await knex.raw(`CREATE INDEX idx_dna_taxon ON dna_sequences (taxon_id)`);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("dna_sequences");
};
