/**
 * DEF-075 + F-DN-05: Đổi khóa ngoại dna_sequences.specimen_id từ ON DELETE CASCADE
 * sang ON DELETE SET NULL để bảo toàn chuỗi DNA (trở thành orphan) khi mẫu vật bị xóa.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE dna_sequences
      DROP CONSTRAINT IF EXISTS dna_sequences_specimen_id_foreign;
  `);
  await knex.raw(`
    ALTER TABLE dna_sequences
      ADD CONSTRAINT dna_sequences_specimen_id_foreign
      FOREIGN KEY (specimen_id)
      REFERENCES specimen_registry (specimen_id)
      ON DELETE SET NULL;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE dna_sequences
      DROP CONSTRAINT IF EXISTS dna_sequences_specimen_id_foreign;
  `);
  await knex.raw(`
    ALTER TABLE dna_sequences
      ADD CONSTRAINT dna_sequences_specimen_id_foreign
      FOREIGN KEY (specimen_id)
      REFERENCES specimen_registry (specimen_id)
      ON DELETE CASCADE;
  `);
};
