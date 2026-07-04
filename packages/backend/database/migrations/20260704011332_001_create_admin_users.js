/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS postgis');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS btree_gist');

  await knex.schema.createTable("admin_users", (t) => {
    t.bigIncrements("admin_id").primary();
    t.string("username", 50).notNullable().unique();
    t.string("password_hash", 255).notNullable();
    t.string("full_name", 255);
    t.string("email", 255).unique();
    t.smallint("failed_login_attempts").notNullable().defaultTo(0);
    t.timestamp("locked_until", { useTz: true });
    t.timestamp("last_login_at", { useTz: true });
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("admin_users");
};
