const knex = require("../../config/knex");
const logger = require("../../config/logger");
const esService = require("./elasticsearch.service");

const PRIORITY_OPS = new Set(["toggle_public", "soft_delete", "restore"]);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.ES_OUTBOX_MAX_ATTEMPTS) || 5;
const DEFAULT_BASE_DELAY_MS = Number(process.env.ES_OUTBOX_BASE_DELAY_MS) || 1000;

let workerTimer = null;
let workerRunning = false;

/**
 * Ghi 1 bản ghi outbox TRONG CÙNG transaction DB với thao tác specimen.
 */
async function enqueueOutbox(trx, { entityType = "specimen", entityId, op = "upsert", priority } = {}) {
  if (!entityId) return null;
  const db = trx || knex;
  const effectivePriority =
    typeof priority === "number" ? priority : PRIORITY_OPS.has(op) ? 10 : 0;

  const [row] = await db("es_sync_outbox")
    .insert({
      entity_type: entityType,
      entity_id: Number(entityId),
      op,
      priority: effectivePriority,
      attempts: 0,
      status: "pending",
    })
    .returning("*");

  return row;
}

/**
 * Ghi hàng loạt bản ghi outbox TRONG CÙNG transaction (dùng cho batch-update / bulk-import).
 */
async function enqueueOutboxBatch(trx, entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  const db = trx || knex;
  const rows = entries
    .filter((e) => e && e.entityId)
    .map((e) => {
      const op = e.op || "upsert";
      return {
        entity_type: e.entityType || "specimen",
        entity_id: Number(e.entityId),
        op,
        priority: typeof e.priority === "number" ? e.priority : PRIORITY_OPS.has(op) ? 10 : 0,
        attempts: 0,
        status: "pending",
      };
    });

  if (rows.length === 0) return 0;
  const CHUNK_SIZE = 500;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await db("es_sync_outbox").insert(rows.slice(i, i + CHUNK_SIZE));
  }
  return rows.length;
}

/**
 * Đánh dấu các bản ghi pending của cùng entity là done (khi sync tức thì thành công).
 */
async function markOutboxDoneForEntity(entityType, entityId) {
  if (!entityId) return 0;
  return knex("es_sync_outbox")
    .where({
      entity_type: entityType || "specimen",
      entity_id: Number(entityId),
      status: "pending",
    })
    .update({
      status: "done",
      processed_at: knex.fn.now(),
    });
}

/**
 * Claim một lô bản ghi pending bằng SELECT ... FOR UPDATE SKIP LOCKED,
 * chuyển trạng thái sang 'processing' để 2 worker chạy song song không xử lý trùng.
 */
async function claimOutboxBatch(batchSize = 50) {
  return knex.transaction(async (trx) => {
    const claimed = await trx.raw(
      `
      SELECT id, entity_type, entity_id, op, priority, attempts
      FROM es_sync_outbox
      WHERE status = 'pending' AND next_attempt_at <= NOW()
      ORDER BY priority DESC, next_attempt_at ASC, id ASC
      LIMIT ?
      FOR UPDATE SKIP LOCKED
      `,
      [batchSize],
    );

    const rows = claimed.rows || [];
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    await trx("es_sync_outbox")
      .whereIn("id", ids)
      .update({ status: "processing" });

    return rows;
  });
}

/**
 * Xử lý 1 lô outbox:
 * - Gộp (coalesce) nhiều sự kiện cùng (entity_type, entity_id) để chỉ index 1 lần (idempotent theo _id).
 * - Lỗi → tăng attempts, exponential backoff; vượt maxAttempts → status='dead' + logger.error.
 */
async function processOutboxBatch({
  batchSize = 50,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  indexFn = esService.indexSpecimenNow,
  refresh = false,
} = {}) {
  const claimed = await claimOutboxBatch(batchSize);
  if (claimed.length === 0) {
    return { claimed: 0, processed: 0, failed: 0, dead: 0 };
  }

  // Coalesce multiple events for the same entity
  const grouped = new Map();
  for (const row of claimed) {
    const key = `${row.entity_type}:${row.entity_id}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        entityType: row.entity_type,
        entityId: Number(row.entity_id),
        maxPriority: Number(row.priority || 0),
        rows: [],
      });
    }
    const g = grouped.get(key);
    g.rows.push(row);
    if (Number(row.priority || 0) > g.maxPriority) {
      g.maxPriority = Number(row.priority || 0);
    }
  }

  let processed = 0;
  let failed = 0;
  let dead = 0;

  for (const group of grouped.values()) {
    const rowIds = group.rows.map((r) => r.id);
    try {
      await indexFn(group.entityId, { refresh: refresh || group.maxPriority >= 10 });
      await knex("es_sync_outbox")
        .whereIn("id", rowIds)
        .update({
          status: "done",
          last_error: null,
          processed_at: knex.fn.now(),
        });
      processed += rowIds.length;
    } catch (err) {
      const errMsg = String(err?.message || err || "Unknown ES sync error").slice(0, 1000);
      for (const row of group.rows) {
        const nextAttempts = Number(row.attempts || 0) + 1;
        if (nextAttempts >= maxAttempts) {
          await knex("es_sync_outbox")
            .where("id", row.id)
            .update({
              attempts: nextAttempts,
              status: "dead",
              last_error: errMsg,
              processed_at: knex.fn.now(),
            });
          dead += 1;
          logger.error(
            `[ES OUTBOX DEAD] id=${row.id} entity=${row.entity_type}:${row.entity_id} op=${row.op} attempts=${nextAttempts}: ${errMsg}`,
          );
        } else {
          const delayMs = baseDelayMs * Math.pow(2, nextAttempts - 1);
          await knex("es_sync_outbox")
            .where("id", row.id)
            .update({
              attempts: nextAttempts,
              status: "pending",
              last_error: errMsg,
              next_attempt_at: knex.raw(`NOW() + (? * INTERVAL '1 millisecond')`, [delayMs]),
            });
          failed += 1;
          logger.warn(
            `[ES OUTBOX RETRY] id=${row.id} entity=${row.entity_type}:${row.entity_id} attempt=${nextAttempts}/${maxAttempts} nextInMs=${delayMs}: ${errMsg}`,
          );
        }
      }
    }
  }

  return { claimed: claimed.length, processed, failed, dead };
}

/**
 * Trả về tình trạng outbox cho /api/health và admin endpoint.
 */
async function getOutboxStats() {
  try {
    const res = await knex.raw(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
        COUNT(*) FILTER (WHERE status = 'dead')::int AS dead,
        COALESCE(
          EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE status = 'pending'))),
          0
        )::float AS oldest_pending_age_seconds
      FROM es_sync_outbox
    `);
    const row = res.rows?.[0] || {};
    return {
      pending: Number(row.pending || 0),
      processing: Number(row.processing || 0),
      dead: Number(row.dead || 0),
      oldestPendingAgeSeconds: Math.round(Number(row.oldest_pending_age_seconds || 0) * 100) / 100,
    };
  } catch (err) {
    logger.warn(`[ES OUTBOX STATS] ${err?.message}`);
    return { pending: 0, processing: 0, dead: 0, oldestPendingAgeSeconds: 0, error: err?.message };
  }
}

/**
 * Đưa các bản ghi dead về pending để xử lý lại (vận hành sự cố).
 */
async function retryDeadOutbox(limit = 100) {
  const res = await knex.raw(
    `
    WITH target AS (
      SELECT id FROM es_sync_outbox
      WHERE status = 'dead'
      ORDER BY priority DESC, id ASC
      LIMIT ?
    )
    UPDATE es_sync_outbox
    SET status = 'pending', attempts = 0, next_attempt_at = NOW(), processed_at = NULL
    WHERE id IN (SELECT id FROM target)
    RETURNING id
    `,
    [limit],
  );
  return (res.rows || []).length;
}

/**
 * Dọn dẹp bảng outbox:
 * - Xóa dòng status = 'done' quá doneRetentionDays ngày (mặc định 7 ngày)
 * - Xóa dòng status = 'dead' quá deadRetentionDays ngày (mặc định 90 ngày, giữ lại 90 ngày để điều tra)
 */
async function cleanupOutbox({ doneRetentionDays = 7, deadRetentionDays = 90 } = {}) {
  const deletedDone = await knex("es_sync_outbox")
    .where("status", "done")
    .whereRaw(`COALESCE(processed_at, created_at) < NOW() - (? * INTERVAL '1 day')`, [
      Number(doneRetentionDays),
    ])
    .delete();

  const deletedDead = await knex("es_sync_outbox")
    .where("status", "dead")
    .whereRaw(`created_at < NOW() - (? * INTERVAL '1 day')`, [Number(deadRetentionDays)])
    .delete();

  if (deletedDone > 0 || deletedDead > 0) {
    logger.info(
      `[ES OUTBOX CLEANUP] deletedDone=${deletedDone} (> ${doneRetentionDays}d), deletedDead=${deletedDead} (> ${deadRetentionDays}d)`,
    );
  }
  return { deletedDone: Number(deletedDone || 0), deletedDead: Number(deletedDead || 0) };
}

let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 giờ/lần

function startOutboxWorker({ intervalMs = 5000 } = {}) {
  if (workerTimer) return;
  workerTimer = setInterval(async () => {
    if (workerRunning) return;
    workerRunning = true;
    try {
      await processOutboxBatch();
      if (Date.now() - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
        lastCleanupAt = Date.now();
        await cleanupOutbox();
      }
    } catch (err) {
      logger.error(`[ES OUTBOX WORKER] ${err?.message}`);
    } finally {
      workerRunning = false;
    }
  }, intervalMs);
  if (typeof workerTimer.unref === "function") {
    workerTimer.unref();
  }
  logger.info(`ES Outbox worker started (interval=${intervalMs}ms)`);
}

function stopOutboxWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}

module.exports = {
  enqueueOutbox,
  enqueueOutboxBatch,
  markOutboxDoneForEntity,
  claimOutboxBatch,
  processOutboxBatch,
  getOutboxStats,
  retryDeadOutbox,
  cleanupOutbox,
  startOutboxWorker,
  stopOutboxWorker,
};
