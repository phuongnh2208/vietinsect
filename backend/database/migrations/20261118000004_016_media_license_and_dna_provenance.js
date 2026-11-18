/**
 * Migration 016:
 *  1. Thêm cột retrieved_at cho dna_sequences (lưu thời điểm truy xuất nguồn quốc tế INSDC/BOLD)
 *  2. Mở rộng bảng specimen_images cho MinIO Object Storage & Kiểm soát bản quyền ảnh (SRS §6.2):
 *     - license_code: 'cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa' (loại bỏ *-nd và copyright)
 *     - attribution: thông tin ghi công tác giả bắt buộc
 *     - source_url: URL gốc để đối chiếu nguồn
 *     - external_photo_id: mã ảnh iNaturalist/GBIF (chống import trùng)
 *     - source_provider: 'MINIO' | 'INATURALIST' | 'GBIF'
 *     - is_public: phân quyền hiển thị ảnh
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("dna_sequences", (t) => {
    t.timestamp("retrieved_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable("specimen_images", (t) => {
    t.string("license_code", 30).nullable();
    t.string("attribution", 500).nullable();
    t.string("source_url", 500).nullable();
    t.string("external_photo_id", 100).nullable();
    t.string("source_provider", 30).notNullable().defaultTo("MINIO");
    t.boolean("is_public").notNullable().defaultTo(true);
  });

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_specimen_images_ext_photo
    ON specimen_images (external_photo_id)
    WHERE external_photo_id IS NOT NULL
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_specimen_images_license
    ON specimen_images (license_code)
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS idx_specimen_images_license`);
  await knex.raw(`DROP INDEX IF EXISTS idx_specimen_images_ext_photo`);

  await knex.schema.alterTable("specimen_images", (t) => {
    t.dropColumn("license_code");
    t.dropColumn("attribution");
    t.dropColumn("source_url");
    t.dropColumn("external_photo_id");
    t.dropColumn("source_provider");
    t.dropColumn("is_public");
  });

  await knex.schema.alterTable("dna_sequences", (t) => {
    t.dropColumn("retrieved_at");
  });
};
