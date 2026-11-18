#!/usr/bin/env node
/**
 * backend/scripts/relink-specimens-taxa.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Re-link specimens.taxon_id từ Order-level xuống Species-level.
 *
 * Hiện tại gbif-import.js gán taxon_id = Order-level taxon (Coleoptera, Odonata...)
 * Sau khi col-sync-taxa.js chạy và bảng taxa đã có Species-level taxa,
 * script này sẽ:
 *   1. Lấy specimen_registry.occurrence_remarks (chứa scientificName từ GBIF)
 *   2. Tìm taxa.taxon_id khớp scientific_name ở rank Species
 *   3. UPDATE specimens.taxon_id = species-level taxon_id
 *
 * Nếu không tìm thấy Species, thử Genus → Family → giữ nguyên Order.
 *
 * Cách dùng:
 *   node scripts/relink-specimens-taxa.js              # update tất cả
 *   node scripts/relink-specimens-taxa.js --dry-run    # preview, không update
 *   node scripts/relink-specimens-taxa.js --order Odonata
 *   node scripts/relink-specimens-taxa.js --batch 500  # batch size (default 200)
 *
 * SRS §6.5: Knex cho tất cả DB operations
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

require("dotenv").config();
const knex = require("../src/config/knex");

// ─── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN      = args.includes("--dry-run");
const ORDER_FILTER = (() => { const i = args.indexOf("--order");  return i !== -1 ? args[i+1] : null; })();
const BATCH_SIZE   = (() => { const i = args.indexOf("--batch");  return i !== -1 ? parseInt(args[i+1],10) : 2000; })();

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// ─── Stats ──────────────────────────────────────────────────────────────────
const stats = {
  total: 0,
  relinkSpecies: 0,
  relinkGenus: 0,
  relinkFamily: 0,
  unchanged: 0,  // already at species/genus/family
  noName: 0,     // occurrence_remarks is null
  errors: 0,
};

// ─── Build taxa lookup cache ────────────────────────────────────────────────
// Map: lowercase(scientific_name) → { taxon_id, taxon_rank }
let taxaCache = {};
// Map: string(gbif_taxon_key) → { taxon_id, taxon_rank }
let gbifKeyCache = {};

async function buildTaxaCache() {
  log("📋 Đang build taxa cache...");
  const rows = await knex("taxa")
    .select("taxon_id", "scientific_name", "taxon_rank", "gbif_taxon_key")
    .whereIn("taxon_rank", ["Species", "Genus", "Family"]);

  for (const r of rows) {
    const key = r.scientific_name.trim().toLowerCase();
    if (!taxaCache[key]) {
      taxaCache[key] = { taxon_id: r.taxon_id, taxon_rank: r.taxon_rank };
    }
    if (r.gbif_taxon_key != null) {
      gbifKeyCache[String(r.gbif_taxon_key)] = {
        taxon_id: r.taxon_id,
        taxon_rank: r.taxon_rank,
      };
    }
  }
  log(`   Cache: ${Object.keys(taxaCache).length} names, ${Object.keys(gbifKeyCache).length} GBIF keys (Species+Genus+Family)`);
}

// ─── Parse scientific name levels ──────────────────────────────────────────
/**
 * Từ "Apis mellifera Linnaeus, 1758" → ["Apis mellifera", "Apis"]
 * Từ "Apis" → ["Apis"]
 */
function nameLevels(sciName) {
  if (!sciName) return [];
  const parts = sciName.trim().split(/\s+/);
  const levels = [];

  if (parts.length >= 2) {
    // Binomial: "Genus species" (bỏ authorship)
    levels.push(`${parts[0]} ${parts[1]}`.toLowerCase());
  }
  // Genus only
  if (parts.length >= 1) {
    levels.push(parts[0].toLowerCase());
  }
  return levels;
}

// ─── Main relink logic ──────────────────────────────────────────────────────

async function relinkBatch(rows) {
  const updates = []; // { specimen_id, taxon_id }

  for (const row of rows) {
    stats.total++;
    const sciName = row.gbif_scientific_name;
    const taxonKey = row.gbif_taxon_key;

    if (!sciName && !taxonKey) {
      stats.noName++;
      continue;
    }

    let found = null;
    let foundRank = null;

    // 1. Ưu tiên khớp chính xác gbif_taxon_key
    if (taxonKey != null && gbifKeyCache[String(taxonKey)]) {
      const hit = gbifKeyCache[String(taxonKey)];
      found = hit.taxon_id;
      foundRank = hit.taxon_rank;
    }

    // 2. Fallback theo tên khoa học: Species → Genus
    if (!found && sciName) {
      const candidates = nameLevels(sciName);
      for (const candidate of candidates) {
        const hit = taxaCache[candidate];
        if (hit) {
          found = hit.taxon_id;
          foundRank = hit.taxon_rank;
          break;
        }
      }
    }

    if (!found || Number(found) === Number(row.current_taxon_id)) {
      stats.unchanged++;
      continue;
    }

    updates.push({ specimen_id: Number(row.specimen_id), taxon_id: Number(found), rank: foundRank });
  }

  if (updates.length === 0) return;

  if (!DRY_RUN) {
    try {
      const placeholders = updates.map(() => "(?::bigint, ?::bigint)").join(", ");
      const bindings = [];
      for (const u of updates) {
        bindings.push(u.specimen_id, u.taxon_id);
      }
      await knex.raw(
        `UPDATE specimens AS s
         SET taxon_id = v.new_taxon_id, updated_at = now()
         FROM (VALUES ${placeholders}) AS v(specimen_id, new_taxon_id)
         WHERE s.specimen_id = v.specimen_id AND s.deleted_at IS NULL`,
        bindings,
      );
    } catch (err) {
      log(`❌ Lỗi bulk update batch (${updates.length} rows): ${err.message.slice(0, 120)}`);
      stats.errors += updates.length;
      return;
    }
  }

  for (const u of updates) {
    if (u.rank === "Species") stats.relinkSpecies++;
    else if (u.rank === "Genus") stats.relinkGenus++;
    else if (u.rank === "Family") stats.relinkFamily++;
  }
}

async function main() {
  log("🔗 VietInsect Specimen-Taxa Relinker");
  log(`   Mode: ${DRY_RUN ? "🔵 DRY-RUN" : "🔴 PRODUCTION"}`);
  log(`   Batch size: ${BATCH_SIZE}`);
  if (ORDER_FILTER) log(`   Filter: Order = ${ORDER_FILTER}`);
  log("");

  await knex.raw("SELECT 1");
  log("✅ DB connected");

  await buildTaxaCache();

  // ── Query specimens cần relink ─────────────────────────────────────────
  let baseQuery = knex("specimens as s")
    .join("taxa as t", "s.taxon_id", "t.taxon_id")
    .whereNull("s.deleted_at")
    .whereIn("t.taxon_rank", ["Order"])
    .where(function () {
      this.whereNotNull("s.gbif_scientific_name").orWhereNotNull("s.gbif_taxon_key");
    });

  if (ORDER_FILTER) {
    baseQuery = baseQuery.where("t.scientific_name", "ilike", ORDER_FILTER);
  }

  const totalRow = await baseQuery.clone().count("s.specimen_id as cnt").first();
  const totalCountNum = parseInt(totalRow.cnt, 10) || 0;
  log(`\n📦 Specimens cần relink: ${totalCountNum}`);

  if (totalCountNum === 0) {
    log("✅ Không có gì cần relink (hoặc chưa backfill gbif_scientific_name).");
    await knex.destroy();
    return;
  }

  // ── Keyset pagination theo specimen_id (tránh nhảy dòng khi taxon_rank thay đổi) ──
  let lastSpecimenId = 0;
  let processed = 0;
  const startTime = Date.now();

  while (true) {
    const rows = await baseQuery
      .clone()
      .select(
        "s.specimen_id",
        "s.taxon_id as current_taxon_id",
        "s.gbif_scientific_name",
        "s.gbif_taxon_key",
        "t.scientific_name as current_taxon_name",
        "t.taxon_rank as current_rank",
      )
      .where("s.specimen_id", ">", lastSpecimenId)
      .orderBy("s.specimen_id", "asc")
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;

    await relinkBatch(rows);
    lastSpecimenId = rows[rows.length - 1].specimen_id;
    processed += rows.length;

    const pct = Math.min(100, Math.round((processed / totalCountNum) * 100));
    log(`   Tiến độ: ${processed}/${totalCountNum} (${pct}%) | Species=${stats.relinkSpecies} Genus=${stats.relinkGenus} Unchanged=${stats.unchanged}`);

    if (rows.length < BATCH_SIZE) break;
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  log(`\n${"═".repeat(60)}`);
  log("📊 KẾT QUẢ RELINK");
  log(`${"═".repeat(60)}`);
  log(`   Tổng specimens xử lý: ${stats.total.toLocaleString()}`);
  log(`   Re-link → Species    : ${stats.relinkSpecies.toLocaleString()}`);
  log(`   Re-link → Genus      : ${stats.relinkGenus.toLocaleString()}`);
  log(`   Re-link → Family     : ${stats.relinkFamily.toLocaleString()}`);
  log(`   Giữ nguyên (không tìm thấy): ${stats.unchanged.toLocaleString()}`);
  log(`   Không có scientificName    : ${stats.noName.toLocaleString()}`);
  log(`   Errors               : ${stats.errors.toLocaleString()}`);
  log(`   Thời gian            : ${elapsed} phút`);
  if (DRY_RUN) log("   [DRY-RUN] Không có gì được ghi vào DB.");
  log(`${"═".repeat(60)}\n`);

  await knex.destroy();
}

main().catch(err => {
  console.error("💥", err.message);
  knex.destroy().finally(() => process.exit(1));
});
