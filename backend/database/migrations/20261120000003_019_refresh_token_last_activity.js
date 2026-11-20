/**
 * DEF-007: Thêm cột last_activity_at vào admin_refresh_tokens để kiểm soát
 * session timeout 60 phút không hoạt động (SRS §5.2, F-AU-01).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.schema.alterTable("admin_refresh_tokens", (t) => {
    t.timestamp("last_activity_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
  await knex.schema.alterTable("admin_refresh_tokens", (t) => {
    t.dropColumn("last_activity_at");
  });
};
