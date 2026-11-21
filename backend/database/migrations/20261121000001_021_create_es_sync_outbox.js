/**
 * Migration 021: Tạo bảng es_sync_outbox (DEF-112 – PostgreSQL Transactional Outbox cho đồng bộ ES).
 * Đảm bảo sự kiện đồng bộ ES không bị mất khi backend restart hoặc ES gặp sự cố.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable("es_sync_outbox", (t) => {
    t.bigIncrements("id").primary();
    t.string("entity_type", 32).notNullable().defaultTo("specimen");
    t.bigInteger("entity_id").notNullable();
    t.string("op", 32).notNullable(); // upsert | toggle_public | soft_delete | restore
    t.smallint("priority").notNullable().defaultTo(0); // 10 = priority (is_public/soft_delete/restore), 0 = normal
    t.integer("attempts").notNullable().defaultTo(0);
    t.timestamp("next_attempt_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.text("last_error").nullable();
    t.string("status", 16).notNullable().defaultTo("pending"); // pending | processing | done | dead
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("processed_at", { useTz: true }).nullable();
  });

  await knex.raw(`
    CREATE INDEX idx_es_sync_outbox_pending_poll
    ON es_sync_outbox (priority DESC, next_attempt_at ASC, id ASC)
    WHERE status = 'pending';
  `);

  await knex.raw(`
    CREATE INDEX idx_es_sync_outbox_entity_status
    ON es_sync_outbox (entity_type, entity_id, status);
  `);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("es_sync_outbox");
};
