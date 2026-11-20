/**
 * C-11 / DEF-060: Thêm cột tùy chọn elevation_m (NUMERIC(7,2), nullable,
 * ánh xạ Darwin Core minimumElevationInMeters) vào bảng specimens + index.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE specimens
      ADD COLUMN IF NOT EXISTS elevation_m NUMERIC(7, 2);
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_specimens_elevation_m
      ON specimens (elevation_m)
      WHERE elevation_m IS NOT NULL;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.raw(`DROP INDEX IF EXISTS idx_specimens_elevation_m;`);
  await knex.raw(`
    ALTER TABLE specimens
      DROP COLUMN IF EXISTS elevation_m;
  `);
};
