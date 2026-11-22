#!/usr/bin/env node
/**
 * backend/scripts/rollback_step2.js
 * Đọc danh sách gbif_occurrence_id mới tạo trong đợt chạy Bước 2 và xóa mềm (deleted_at = now()),
 * ghi audit_logs và đẩy es_sync_outbox.
 *
 * Cách dùng:
 *   node scripts/rollback_step2.js --file ../backups/step2_blattodea_new_occurrences.txt --dry-run
 *   node scripts/rollback_step2.js --file ../backups/step2_blattodea_new_occurrences.txt
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

async function runRollbackStep2(db = knex, { filePath = FILE_PATH, dryRun = DRY_RUN } = {}) {
  const occIds = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (occIds.length === 0) return { requested: 0, softDeleted: 0 };

  const regRows = await db("specimen_registry")
    .whereIn("gbif_occurrence_id", occIds)
    .select("specimen_id");
  const specimenIds = regRows.map((r) => Number(r.specimen_id));

  if (dryRun || specimenIds.length === 0) {
    return { requested: occIds.length, matched: specimenIds.length, softDeleted: 0, dryRun };
  }

  let softDeleted = 0;
  await db.transaction(async (trx) => {
    softDeleted = await trx("specimens")
      .whereIn("specimen_id", specimenIds)
      .whereNull("deleted_at")
      .update({ deleted_at: trx.fn.now(), updated_at: trx.fn.now() });

    await trx("es_sync_outbox").insert(
      specimenIds.map((id) => ({
        entity_type: "specimen",
        entity_id: id,
        op: "delete",
        priority: 1,
        status: "pending",
      }))
    );

    await trx("audit_logs").insert({
      action_type: "ROLLBACK_GBIF_STEP2",
      target_table: "specimens",
      details: JSON.stringify({ requested: occIds.length, softDeleted }),
    });
  });

  return { requested: occIds.length, softDeleted };
}

if (require.main === module) {
  if (!FILE_PATH) {
    console.error("❌ Cần truyền --file <path>");
    process.exit(1);
  }
  runRollbackStep2()
    .then((r) => {
      console.log("✅ Rollback Step 2:", r);
      return knex.destroy();
    })
    .catch((e) => {
      console.error("💥", e.message);
      knex.destroy().finally(() => process.exit(1));
    });
}

module.exports = { runRollbackStep2 };
