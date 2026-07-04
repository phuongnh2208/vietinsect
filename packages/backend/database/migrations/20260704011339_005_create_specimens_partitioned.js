/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE specimens (
      specimen_id     BIGINT NOT NULL REFERENCES specimen_registry(specimen_id) ON DELETE CASCADE,
      taxon_id        BIGINT NOT NULL REFERENCES taxa(taxon_id) ON DELETE RESTRICT,
      province_id     SMALLINT REFERENCES provinces(province_id) ON DELETE SET NULL,
      collector_id    BIGINT REFERENCES collectors(person_id) ON DELETE SET NULL,
      identifier_id   BIGINT REFERENCES collectors(person_id) ON DELETE SET NULL,
      habitat_id      SMALLINT REFERENCES habitat_types(habitat_id) ON DELETE SET NULL,
      life_stage_id   SMALLINT REFERENCES life_stages(stage_id) ON DELETE SET NULL,
      status_id       SMALLINT REFERENCES specimen_status_types(status_id) ON DELETE SET NULL,
      created_by      BIGINT REFERENCES admin_users(admin_id) ON DELETE SET NULL,
      updated_by      BIGINT REFERENCES admin_users(admin_id) ON DELETE SET NULL,
      common_name_vn  VARCHAR(255),
      common_name_en  VARCHAR(255),
      district        VARCHAR(100),
      commune         VARCHAR(100),
      locality_detail VARCHAR(500),
      collection_point GEOGRAPHY(Point, 4326),
      gps_accuracy_m  NUMERIC(6,2),
      collection_date DATE NOT NULL,
      sex             VARCHAR(10) CHECK (sex IN ('male','female','unknown')),
      individual_count INT NOT NULL DEFAULT 1,
      storage_number  VARCHAR(100),
      notes           TEXT,
      entry_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
      is_public       BOOLEAN NOT NULL DEFAULT false,
      deleted_at      TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (specimen_id, collection_date)
    ) PARTITION BY RANGE (collection_date)
  `);

  const startYear = 1800;
  const endYear = 2050;

  for (let y = startYear; y <= endYear; y++) {
    await knex.raw(`
        CREATE TABLE specimens_y${y}
        PARTITION OF specimens
        FOR VALUES FROM ('${y}-01-01')
        TO ('${y + 1}-01-01')
    `);
  }

  await knex.raw(
    `CREATE INDEX idx_specimens_point ON specimens USING GIST (collection_point)`,
  );
  await knex.raw(`CREATE INDEX idx_specimens_taxon ON specimens (taxon_id)`);
  await knex.raw(
    `CREATE INDEX idx_specimens_province ON specimens (province_id)`,
  );
  await knex.raw(
    `CREATE INDEX idx_specimens_public ON specimens (specimen_id) WHERE deleted_at IS NULL AND is_public = true`,
  );
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.raw(`DROP TABLE IF EXISTS specimens CASCADE`);
};
