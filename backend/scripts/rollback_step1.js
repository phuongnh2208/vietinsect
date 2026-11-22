#!/usr/bin/env node
/**
 * backend/scripts/rollback_step1.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Đọc file preview_changes.csv (có cột specimen_id, old_taxon_id),
 * khôi phục specimens.taxon_id về old_taxon_id trong transaction theo lô,
 * ghi audit_logs, đẩy es_sync_outbox và REFRESH mv_taxon_dwc_flat.
 *
 * Cách dùng:
 *   node scripts/rollback_step1.js --file ../backups/preview_changes_step1.csv --dry-run
 *   node scripts/rollback_step1.js --file ../backups/preview_changes_step1.csv
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

require("dotenv").config();
const fs = require("fs");
const knex = require("../src/config/knex");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FILE_PATH = (() => {
  const i = args.indexOf("--file");
  return i !== -1 ? args[i + 1] : null;
})();
const BATCH_SIZE = 500;

function parseCsvRows(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const spIdx = headers.indexOf("specimen_id");
  const oldIdx = headers.indexOf("old_taxon_id");
  if (spIdx === -1 || oldIdx === -1) {
    throw new Error("CSV thiếu cột specimen_id hoặc old_taxon_id");
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const specimen_id = Number(parts[spIdx]);
    const old_taxon_id = Number(parts[oldIdx]);
    if (Number.isFinite(specimen_id) && Number.isFinite(old_taxon_id)) {
      rows.push({ specimen_id, old_taxon_id });
    }
  }
  return rows;
}

async function runRollback(db = knex, { filePath = FILE_PATH, dryRun = DRY_RUN, rows = null } = {}) {
  const targetRows = rows || parseCsvRows(fs.readFileSync(filePath, "utf8"));
  if (targetRows.length === 0) return { restored: 0, outboxEnqueued: 0 };

  let restored = 0;
  let outboxEnqueued = 0;

  if (!dryRun) {
    for (let i = 0; i < targetRows.length; i += BATCH_SIZE) {
      const chunk = targetRows.slice(i, i + BATCH_SIZE);
      await db.transaction(async (trx) => {
        const placeholders = chunk.map(() => "(?::bigint, ?::bigint)").join(", ");
        const bindings = [];
        for (const r of chunk) bindings.push(r.specimen_id, r.old_taxon_id);

        const res = await trx.raw(
          `UPDATE specimens AS s
           SET taxon_id = v.old_taxon_id, updated_at = now()
           FROM (VALUES ${placeholders}) AS v(specimen_id, old_taxon_id)
           WHERE s.specimen_id = v.specimen_id AND s.taxon_id <> v.old_taxon_id`,
          bindings
        );
        restored += res.rowCount || 0;

        await trx("es_sync_outbox").insert(
          chunk.map((r) => ({
            entity_type: "specimen",
            entity_id: r.specimen_id,
            op: "upsert",
            priority: 1,
            status: "pending",
          }))
        );
        outboxEnqueued += chunk.length;
      });
    }

    await db("audit_logs").insert({
      action_type: "ROLLBACK_RELINK_STEP1",
      target_table: "specimens",
      details: JSON.stringify({ requested: targetRows.length, restored, outboxEnqueued }),
    });
    await db.raw("REFRESH MATERIALIZED VIEW mv_taxon_dwc_flat");
  }

  return { requested: targetRows.length, restored, outboxEnqueued };
}

if (require.main === module) {
  if (!FILE_PATH) {
    console.error("❌ Cần truyền --file <path-to-preview_changes.csv>");
    process.exit(1);
  }
  runRollback()
    .then((res) => {
      console.log("✅ Rollback result:", res);
      return knex.destroy();
    })
    .catch((err) => {
      console.error("💥 Rollback error:", err.message);
      knex.destroy().finally(() => process.exit(1));
    });
}

module.exports = { parseCsvRows, runRollback };
