/**
 * Migration 015: Mở rộng bảng dna_sequences cho BOLD Systems & NCBI GenBank (SCR-20, SCR-21, SCR-22)
 * ───────────────────────────────────────────────────────────────────────────────────────────────────
 * Bổ sung:
 *  - fasta_sequence TEXT: chuỗi nucleotide A/T/G/C thực tế để hiển thị & xuất file .fasta
 *  - bin_uri VARCHAR(30): mã BOLD BIN (e.g. BOLD:AAA1234)
 *  - source_db VARCHAR(30): nguồn dữ liệu ('NCBI', 'BOLD', 'INTERNAL')
 *  - scientific_name_verbatim VARCHAR(300): tên khoa học gốc trên GenBank/BOLD
 *  - gc_content_pct NUMERIC(5,2): tỷ lệ G-C (%) tính sẵn phục vụ thống kê sinh tin học
 *  - pcr_conditions TEXT: chu trình nhiệt PCR (SCR-21)
 *  - notes TEXT: ghi chú nghiên cứu sinh học phân tử
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE dna_sequences
      ALTER COLUMN genbank_accession TYPE VARCHAR(40),
      ALTER COLUMN gene_marker TYPE VARCHAR(50)
  `);

  await knex.schema.alterTable("dna_sequences", (t) => {
    t.text("fasta_sequence").nullable();
    t.string("bin_uri", 30).nullable();
    t.string("source_db", 30).notNullable().defaultTo("NCBI");
    t.string("scientific_name_verbatim", 300).nullable();
    t.decimal("gc_content_pct", 5, 2).nullable();
    t.text("pcr_conditions").nullable();
    t.text("notes").nullable();
  });

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_dna_bold_process_unique
    ON dna_sequences (bold_process_id)
    WHERE bold_process_id IS NOT NULL
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_dna_marker ON dna_sequences (gene_marker)
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS idx_dna_marker`);
  await knex.raw(`DROP INDEX IF EXISTS idx_dna_bold_process_unique`);
  await knex.schema.alterTable("dna_sequences", (t) => {
    t.dropColumn("fasta_sequence");
    t.dropColumn("bin_uri");
    t.dropColumn("source_db");
    t.dropColumn("scientific_name_verbatim");
    t.dropColumn("gc_content_pct");
    t.dropColumn("pcr_conditions");
    t.dropColumn("notes");
  });
};
