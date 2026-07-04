/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE audit_logs (
      log_id        BIGSERIAL,
      admin_id      BIGINT REFERENCES admin_users(admin_id),
      action_type   VARCHAR(50) NOT NULL,
      target_table  VARCHAR(50),
      target_id     VARCHAR(50),
      ip_address    INET,
      log_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
      details       JSONB,
      PRIMARY KEY (log_id, log_timestamp)
    ) PARTITION BY RANGE (log_timestamp)
  `);

  // Tạo partition cho 12 tháng
  const startYear = 2025;
  const endYear = 2050;

  for (let y = startYear; y <= endYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const month = String(m).padStart(2, "0");

      const nextYear = m === 12 ? y + 1 : y;
      const nextMonth = m === 12 ? "01" : String(m + 1).padStart(2, "0");

      await knex.raw(`
        CREATE TABLE audit_logs_${y}_${month}
        PARTITION OF audit_logs
        FOR VALUES FROM ('${y}-${month}-01')
        TO ('${nextYear}-${nextMonth}-01')
        `);
    }
  }
  await knex.raw(
    `CREATE INDEX idx_audit_admin ON audit_logs (admin_id, log_timestamp)`,
  );
  await knex.raw(
    `CREATE INDEX idx_audit_details ON audit_logs USING GIN (details)`,
  );

  await knex.schema.createTable("system_config", (t) => {
    t.string("config_key", 100).primary();
    t.bigInteger("updated_by").references("admin_id").inTable("admin_users");
    t.jsonb("config_value");
    t.string("config_category", 50);
    t.timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("saved_filters", (t) => {
    t.bigIncrements("filter_id").primary();
    t.bigInteger("admin_id").references("admin_id").inTable("admin_users");
    t.string("filter_name", 255).notNullable();
    t.jsonb("filter_json").notNullable();
    t.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("gbif_export_logs", (t) => {
    t.bigIncrements("export_id").primary();
    t.bigInteger("created_by").references("admin_id").inTable("admin_users");
    t.string("dataset_version", 20);
    t.timestamp("export_date", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.integer("record_count");
    t.string("file_object_key", 500);
    t.string("doi", 100);
    t.string("status", 20);
  });

  await knex.schema.createTable("report_configs", (t) => {
    t.bigIncrements("report_config_id").primary();
    t.bigInteger("created_by").references("admin_id").inTable("admin_users");
    t.string("name", 255).notNullable();
    t.jsonb("fields_json").notNullable();
    t.jsonb("filters_json");
    t.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("report_configs");
  await knex.schema.dropTableIfExists("gbif_export_logs");
  await knex.schema.dropTableIfExists("saved_filters");
  await knex.schema.dropTableIfExists("system_config");
  await knex.raw(`DROP TABLE IF EXISTS audit_logs CASCADE`);
};
