/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  // Bảng tỉnh/thành phố
  await knex.schema.createTable("provinces", (t) => {
    t.increments("province_id").primary();
    t.string("province_code", 10).notNullable().unique();
    t.string("province_name_vn", 100).notNullable();
    t.string("province_name_en", 100).notNullable();
    t.enu("province_type", ["province", "city"]).notNullable();
    t.string("region", 20);
    t.text("note");
  });
  await knex.raw(`
    ALTER TABLE provinces
    ADD COLUMN boundary GEOMETRY(MultiPolygon, 4326)
  `);
  await knex.raw(`CREATE INDEX idx_provinces_boundary ON provinces USING GIST (boundary)`);

  // Danh mục sinh cảnh
  await knex.schema.createTable("habitat_types", (t) => {
    t.increments("habitat_id").primary();
    t.string("code", 50).notNullable().unique();
    t.string("label_vn", 100).notNullable();
    t.string("label_en", 100).notNullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.smallint("sort_order").notNullable().defaultTo(0);
  });

  // Giai đoạn phát triển
  await knex.schema.createTable("life_stages", (t) => {
    t.increments("stage_id").primary();
    t.string("code", 50).notNullable().unique();
    t.string("label_vn", 100).notNullable();
    t.string("label_en", 100).notNullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.smallint("sort_order").notNullable().defaultTo(0);
  });

  // Trạng thái mẫu vật
  await knex.schema.createTable("specimen_status_types", (t) => {
    t.increments("status_id").primary();
    t.string("code", 50).notNullable().unique();
    t.string("label_vn", 100).notNullable();
    t.string("label_en", 100).notNullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.smallint("sort_order").notNullable().defaultTo(0);
  });

  // Người thu mẫu / định loại
  await knex.schema.createTable("collectors", (t) => {
    t.bigIncrements("person_id").primary();
    t.string("full_name", 255).notNullable();
    t.string("organization", 255);
    t.string("email", 255);
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("collectors");
  await knex.schema.dropTableIfExists("specimen_status_types");
  await knex.schema.dropTableIfExists("life_stages");
  await knex.schema.dropTableIfExists("habitat_types");
  await knex.schema.dropTableIfExists("provinces");
};
