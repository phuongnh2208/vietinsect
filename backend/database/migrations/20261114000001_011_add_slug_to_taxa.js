exports.up = async (knex) => {
  // 1. Thêm cột slug nullable trước
  await knex.schema.alterTable("taxa", (t) => {
    t.string("slug", 255).nullable();
  });
  // 2. Backfill: sinh slug từ scientific_name bằng SQL thuần cho existing rows
  await knex.raw(`
    UPDATE taxa SET slug = lower(regexp_replace(lower(trim(scientific_name)), '[^a-z0-9]+', '-', 'g'))
  `);
  // 3. Thêm NOT NULL + UNIQUE INDEX
  await knex.schema.alterTable("taxa", (t) => {
    t.string("slug", 255).notNullable().alter();
  });
  await knex.raw("CREATE UNIQUE INDEX uq_taxa_slug ON taxa (slug)");
};

exports.down = async (knex) => {
  await knex.raw("DROP INDEX IF EXISTS uq_taxa_slug");
  await knex.schema.alterTable("taxa", (t) => {
    t.dropColumn("slug");
  });
};
