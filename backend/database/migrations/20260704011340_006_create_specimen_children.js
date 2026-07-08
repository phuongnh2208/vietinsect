/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.schema.createTable("specimen_images", (t) => {
    t.bigIncrements("image_id").primary();
    t.bigInteger("specimen_id").notNullable().references("specimen_id").inTable("specimen_registry").onDelete("CASCADE");
    t.bigInteger("uploaded_by").references("admin_id").inTable("admin_users");
    t.string("object_key", 500).notNullable();
    t.string("thumbnail_key", 500);
    t.string("shot_type", 30);
    t.integer("file_size_bytes");
    t.integer("width_px");
    t.integer("height_px");
    t.timestamp("uploaded_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("specimen_change_history", (t) => {
    t.bigIncrements("change_id").primary();
    t.bigInteger("specimen_id").notNullable().references("specimen_id").inTable("specimen_registry").onDelete("CASCADE");
    t.bigInteger("changed_by").references("admin_id").inTable("admin_users");
    t.timestamp("changed_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.string("field_name", 100).notNullable();
    t.text("old_value");
    t.text("new_value");
  });

  await knex.raw(`CREATE INDEX idx_images_specimen ON specimen_images (specimen_id)`);
  await knex.raw(`CREATE INDEX idx_changes_specimen ON specimen_change_history (specimen_id)`);
};


/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("specimen_change_history");
  await knex.schema.dropTableIfExists("specimen_images");
};