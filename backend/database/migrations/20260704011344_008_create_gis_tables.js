/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.schema.createTable("ecological_zones", (t) => {
    t.bigIncrements("zone_id").primary();
    t.string("zone_name", 255).notNullable();
    t.string("zone_type", 50);
    t.text("description");
    t.string("source", 255);
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(`ALTER TABLE ecological_zones ADD COLUMN boundary GEOMETRY(MultiPolygon, 4326) NOT NULL`);
  await knex.raw(`CREATE INDEX idx_eco_zones_boundary ON ecological_zones USING GIST (boundary)`);

  await knex.schema.createTable("map_layers", (t) => {
    t.bigIncrements("layer_id").primary();
    t.bigInteger("uploaded_by").references("admin_id").inTable("admin_users");
    t.string("layer_name", 255).notNullable();
    t.string("layer_type", 20);
    t.string("category", 50);
    t.string("raster_object_key", 500);
    t.jsonb("style_config");
    t.smallint("display_order").notNullable().defaultTo(0);
    t.boolean("is_visible_to_user").notNullable().defaultTo(false);
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("map_layer_features", (t) => {
    t.bigIncrements("feature_id").primary();
    t.bigInteger("layer_id").notNullable().references("layer_id").inTable("map_layers").onDelete("CASCADE");
    t.string("feature_name", 255);
    t.jsonb("properties");
  });
  await knex.raw(`ALTER TABLE map_layer_features ADD COLUMN geom GEOMETRY(Geometry, 4326) NOT NULL`);
  await knex.raw(`CREATE INDEX idx_layer_features_geom ON map_layer_features USING GIST (geom)`);
  await knex.raw(`CREATE INDEX idx_layer_features_layer ON map_layer_features (layer_id)`);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("map_layer_features");
  await knex.schema.dropTableIfExists("map_layers");
  await knex.schema.dropTableIfExists("ecological_zones");
};