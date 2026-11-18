exports.up = async (knex) => {
  await knex.schema.createTable("admin_refresh_tokens", (t) => {
    t.bigIncrements("token_id").primary();
    t.bigInteger("admin_id").notNullable().references("admin_id").inTable("admin_users").onDelete("CASCADE");
    t.string("token_hash", 64).notNullable(); // SHA-256 hex của refresh token
    t.timestamp("expires_at", { useTz: true }).notNullable();
    t.timestamp("revoked_at", { useTz: true }).nullable();
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw("CREATE INDEX idx_refresh_tokens_hash ON admin_refresh_tokens (token_hash)");
  await knex.raw("CREATE INDEX idx_refresh_tokens_admin ON admin_refresh_tokens (admin_id)");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("admin_refresh_tokens");
};
