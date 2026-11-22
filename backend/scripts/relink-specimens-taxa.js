#!/usr/bin/env node
/**
 * backend/scripts/relink-specimens-taxa.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Re-link specimens.taxon_id xuống bậc phân loại thấp nhất khớp được
 * (Species → Genus → Family) theo thứ tự ưu tiên:
 *   1. gbif_taxon_key / usageKey (tự động trỏ về accepted_taxon_id nếu là synonym)
 *   2. Tên chuẩn hóa (bỏ tác giả, năm, subgenus trong ngoặc) khớp canonicalName
 *      (tự động trỏ về accepted_taxon_id nếu là synonym)
 *   3. Chống homonym: kiểm tra lineage Order tổ tiên của taxon khớp phải trùng
 *      với Order tổ tiên hiện tại của mẫu; nếu lệch → KHÔNG relink và ghi
 *      relink_conflicts.csv.
 *
 * Tính năng:
 *   - Idempotent, chạy trong transaction theo lô (--batch)
 *   - Đẩy sự kiện đồng bộ Elasticsearch vào es_sync_outbox trong cùng transaction
 *   - Ghi audit_logs & REFRESH MATERIALIZED VIEW mv_taxon_dwc_flat khi chạy thật
 *   - Hỗ trợ --dry-run, --limit <N>, --batch <N>, --order <Order>,
 *     --preview-out <path>, --conflicts-out <path>, --simulate-backfill
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const knex = require("../src/config/knex");
const { parseAcceptedBinomial } = require("./backfill-species-taxa");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SIMULATE_BACKFILL = args.includes("--simulate-backfill");
const ORDER_FILTER = (() => { const i = args.indexOf("--order"); return i !== -1 ? args[i + 1] : null; })();
const BATCH_SIZE = (() => { const i = args.indexOf("--batch"); return i !== -1 ? Math.max(1, parseInt(args[i + 1], 10) || 1000) : 1000; })();
const LIMIT = (() => { const i = args.indexOf("--limit"); return i !== -1 ? Math.max(1, parseInt(args[i + 1], 10) || 0) : null; })();
const PREVIEW_OUT = (() => { const i = args.indexOf("--preview-out"); return i !== -1 ? args[i + 1] : null; })();
const CONFLICTS_OUT = (() => {
  const i = args.indexOf("--conflicts-out");
  return i !== -1 ? args[i + 1] : path.resolve(process.cwd(), "relink_conflicts.csv");
})();

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const RANK_DEPTH = {
  Order: 1,
  Family: 2,
  Genus: 3,
  Species: 4,
  Subspecies: 5,
};

function normalizedNameLevels(sciName) {
  if (!sciName || typeof sciName !== "string") return [];
  const trimmed = sciName.trim();
  if (!trimmed || /^BOLD:/i.test(trimmed)) return [];
  const noSubgenus = trimmed.replace(/^([A-Z][a-z]+)\s+\([A-Z][a-z]+\)\s+/, "$1 ");
  const parts = noSubgenus.split(/\s+/);
  const levels = [];
  if (parts.length >= 2 && /^[a-z][a-z-]+$/.test(parts[1])) {
    levels.push(`${parts[0]} ${parts[1]}`.toLowerCase());
  }
  if (parts.length >= 1) {
    levels.push(parts[0].toLowerCase());
  }
  return levels;
}

async function buildTaxaCache(db, extraVirtualSpecies = []) {
  const rows = await db("taxa").select(
    "taxon_id", "parent_id", "accepted_taxon_id", "scientific_name",
    "taxon_rank", "gbif_taxon_key", "taxonomic_status"
  );

  const byId = new Map();
  for (const r of rows) byId.set(Number(r.taxon_id), r);
  for (const v of extraVirtualSpecies) byId.set(Number(v.taxon_id), v);

  const resolveAccepted = (r) => {
    let cur = r;
    let guard = 0;
    while (cur && cur.taxonomic_status !== "accepted" && cur.accepted_taxon_id && guard < 5) {
      const next = byId.get(Number(cur.accepted_taxon_id));
      if (!next) break;
      cur = next;
      guard++;
    }
    return cur;
  };

  const orderCache = new Map();
  const getRootOrder = (taxonId) => {
    const id = Number(taxonId);
    if (orderCache.has(id)) return orderCache.get(id);
    let cur = byId.get(id);
    let guard = 0;
    let found = null;
    while (cur && guard < 12) {
      if (cur.taxon_rank === "Order") {
        found = cur.scientific_name.trim().toLowerCase();
        break;
      }
      cur = cur.parent_id ? byId.get(Number(cur.parent_id)) : null;
      guard++;
    }
    orderCache.set(id, found);
    return found;
  };

  // taxaCache: lowercase(name) -> array of candidate accepted targets (để chống homonym theo Order)
  const taxaCache = new Map();
  const gbifKeyCache = new Map();

  const allNodes = [...rows, ...extraVirtualSpecies];
  for (const r of allNodes) {
    if (!["Species", "Genus", "Family"].includes(r.taxon_rank)) continue;
    const acc = resolveAccepted(r);
    if (!acc) continue;
    const target = {
      taxon_id: Number(acc.taxon_id),
      taxon_rank: acc.taxon_rank,
      scientific_name: acc.scientific_name,
      rootOrder: getRootOrder(acc.taxon_id),
    };

    const key = r.scientific_name.trim().toLowerCase();
    if (!taxaCache.has(key)) taxaCache.set(key, []);
    const list = taxaCache.get(key);
    if (!list.some((x) => x.taxon_id === target.taxon_id)) {
      list.push(target);
    }

    if (r.gbif_taxon_key != null) {
      gbifKeyCache.set(String(r.gbif_taxon_key), target);
    }
  }

  return { taxaCache, gbifKeyCache, getRootOrder, byId };
}

/**
 * Mô phỏng trong bộ nhớ các loài mới từ backfill-species-taxa.js (KHÔNG ghi DB)
 */
async function buildVirtualBackfillSpecies(db) {
  const allTaxa = await db("taxa").select(
    "taxon_id", "parent_id", "accepted_taxon_id", "taxon_rank", "scientific_name", "taxonomic_status"
  );
  const byId = new Map();
  for (const t of allTaxa) byId.set(Number(t.taxon_id), t);
  const genusByName = new Map();
  const speciesByName = new Map();
  for (const t of allTaxa) {
    if (t.taxonomic_status !== "accepted") continue;
    const lower = t.scientific_name.trim().toLowerCase();
    if (t.taxon_rank === "Genus" && !genusByName.has(lower)) genusByName.set(lower, Number(t.taxon_id));
    if (t.taxon_rank === "Species" && !speciesByName.has(lower)) speciesByName.set(lower, Number(t.taxon_id));
  }

  const spRows = await db("specimens")
    .whereNull("deleted_at")
    .whereNotNull("gbif_scientific_name")
    .select("gbif_scientific_name", "gbif_taxon_key");

  const virtuals = [];
  const seen = new Set();
  let nextVirtualId = -1;
  for (const row of spRows) {
    if (!row.gbif_scientific_name || !/\s/.test(row.gbif_scientific_name.trim())) continue;
    const parsed = parseAcceptedBinomial(row.gbif_scientific_name);
    if (!parsed.valid) continue;
    const spLower = parsed.binomial.toLowerCase();
    if (speciesByName.has(spLower) || seen.has(spLower)) continue;
    const parentId = genusByName.get(parsed.genusName.toLowerCase());
    if (!parentId) continue;
    seen.add(spLower);
    virtuals.push({
      taxon_id: nextVirtualId--,
      parent_id: parentId,
      accepted_taxon_id: null,
      scientific_name: parsed.binomial,
      taxon_rank: "Species",
      gbif_taxon_key: row.gbif_taxon_key ? String(row.gbif_taxon_key) : null,
      taxonomic_status: "accepted",
    });
  }
  return virtuals;
}

async function runRelink(db = knex, opts = {}) {
  const dryRun = opts.dryRun ?? DRY_RUN;
  const simulateBackfill = opts.simulateBackfill ?? SIMULATE_BACKFILL;
  const orderFilter = opts.orderFilter ?? ORDER_FILTER;
  const batchSize = opts.batchSize ?? BATCH_SIZE;
  const limit = opts.limit ?? LIMIT;
  const previewOut = opts.previewOut ?? PREVIEW_OUT;
  const conflictsOut = opts.conflictsOut ?? CONFLICTS_OUT;
  const silent = opts.silent ?? false;
  const emit = (m) => { if (!silent) log(m); };

  const stats = {
    total: 0,
    changed: 0,
    unchanged: 0,
    conflicts: 0,
    noName: 0,
    outboxEnqueued: 0,
    transitions: {
      "Order->Species": 0,
      "Order->Genus": 0,
      "Order->Family": 0,
      "Family->Species": 0,
      "Family->Genus": 0,
      "Genus->Species": 0,
    },
  };
  const conflicts = [];
  const previewRows = [];

  emit("🔗 VietInsect Specimen-Taxa Relinker (v3 - Homonym-Safe + Transition Matrix)");
  emit(`   Mode: ${dryRun ? "🔵 DRY-RUN" : "🔴 PRODUCTION"}${simulateBackfill ? " + SIMULATE_BACKFILL" : ""} | Batch: ${batchSize}${limit ? ` | Limit: ${limit}` : ""}`);

  await db.raw("SELECT 1");
  const virtualSpecies = (dryRun && simulateBackfill) ? await buildVirtualBackfillSpecies(db) : [];
  if (virtualSpecies.length > 0) {
    emit(`🧪 Mô phỏng in-memory +${virtualSpecies.length} Species từ backfill (không ghi DB)`);
  }

  const { taxaCache, gbifKeyCache, getRootOrder } = await buildTaxaCache(db, virtualSpecies);

  let baseQuery = db("specimens as s")
    .join("taxa as t", "s.taxon_id", "t.taxon_id")
    .whereNull("s.deleted_at")
    .whereIn("t.taxon_rank", ["Order", "Family", "Genus"])
    .where(function () {
      this.whereNotNull("s.gbif_scientific_name").orWhereNotNull("s.gbif_taxon_key");
    });

  if (orderFilter) {
    baseQuery = baseQuery.where("t.scientific_name", "ilike", orderFilter);
  }

  const totalRow = await baseQuery.clone().count("s.specimen_id as cnt").first();
  const totalCountNum = Math.min(parseInt(totalRow.cnt, 10) || 0, limit || Infinity);

  let lastSpecimenId = 0;
  let processed = 0;

  while (processed < totalCountNum) {
    const fetchSize = Math.min(batchSize, totalCountNum - processed);
    const rows = await baseQuery
      .clone()
      .select(
        "s.specimen_id",
        "s.taxon_id as current_taxon_id",
        "s.gbif_scientific_name",
        "s.gbif_taxon_key",
        "t.scientific_name as current_taxon_name",
        "t.taxon_rank as current_rank"
      )
      .where("s.specimen_id", ">", lastSpecimenId)
      .orderBy("s.specimen_id", "asc")
      .limit(fetchSize);

    if (rows.length === 0) break;

    const updates = [];
    for (const row of rows) {
      stats.total++;
      const sciName = row.gbif_scientific_name;
      const taxonKey = row.gbif_taxon_key;
      if (!sciName && !taxonKey) {
        stats.noName++;
        continue;
      }

      const currentOrder = getRootOrder(row.current_taxon_id);
      const currentDepth = RANK_DEPTH[row.current_rank] || 0;
      let bestHit = null;
      let conflictHit = null;

      // 1. Khớp theo gbif_taxon_key
      if (taxonKey != null && gbifKeyCache.has(String(taxonKey))) {
        const hit = gbifKeyCache.get(String(taxonKey));
        if (currentOrder && hit.rootOrder && hit.rootOrder !== currentOrder) {
          conflictHit = { hit, reason: `gbif_key_order_mismatch(${currentOrder}!=${hit.rootOrder})` };
        } else {
          bestHit = hit;
        }
      }

      // 2. Khớp theo tên chuẩn hóa (ưu tiên ứng viên cùng Order để chống homonym)
      const candidates = normalizedNameLevels(sciName);
      for (const cand of candidates) {
        const list = taxaCache.get(cand);
        if (!list || list.length === 0) continue;

        const sameOrderHits = list.filter((h) => !currentOrder || !h.rootOrder || h.rootOrder === currentOrder);
        if (sameOrderHits.length > 0) {
          sameOrderHits.sort((a, b) => (RANK_DEPTH[b.taxon_rank] || 0) - (RANK_DEPTH[a.taxon_rank] || 0));
          const top = sameOrderHits[0];
          if (!bestHit || (RANK_DEPTH[top.taxon_rank] || 0) > (RANK_DEPTH[bestHit.taxon_rank] || 0)) {
            bestHit = top;
            conflictHit = null;
          }
          if (top.taxon_rank === "Species") break;
        } else if (!bestHit && !conflictHit) {
          const mismatch = list[0];
          conflictHit = {
            hit: mismatch,
            reason: `homonym_order_mismatch(${currentOrder}!=${mismatch.rootOrder})`,
          };
        }
      }

      if (!bestHit && conflictHit) {
        stats.conflicts++;
        conflicts.push({
          specimen_id: Number(row.specimen_id),
          gbif_scientific_name: sciName || "",
          current_taxon: `${row.current_taxon_name} (${row.current_rank})`,
          matched_taxon: `${conflictHit.hit.scientific_name} (${conflictHit.hit.taxon_rank})`,
          reason: conflictHit.reason,
        });
        stats.unchanged++;
        continue;
      }

      const targetDepth = bestHit ? RANK_DEPTH[bestHit.taxon_rank] || 0 : 0;
      const sameScientificName =
        bestHit &&
        row.current_taxon_name &&
        bestHit.scientific_name.trim().toLowerCase() === row.current_taxon_name.trim().toLowerCase();
      if (
        !bestHit ||
        Number(bestHit.taxon_id) === Number(row.current_taxon_id) ||
        targetDepth <= currentDepth ||
        sameScientificName
      ) {
        stats.unchanged++;
        continue;
      }

      const transKey = `${row.current_rank}->${bestHit.taxon_rank}`;
      if (stats.transitions[transKey] != null) stats.transitions[transKey]++;
      stats.changed++;

      updates.push({
        specimen_id: Number(row.specimen_id),
        taxon_id: Number(bestHit.taxon_id),
        rank: bestHit.taxon_rank,
      });

      if (previewOut) {
        previewRows.push({
          specimen_id: Number(row.specimen_id),
          gbif_scientific_name: sciName || "",
          old_taxon_id: Number(row.current_taxon_id),
          old_taxon: row.current_taxon_name,
          new_taxon_id: Number(bestHit.taxon_id),
          new_taxon: bestHit.scientific_name,
          transition: transKey,
        });
      }
    }

    if (updates.length > 0 && !dryRun) {
      await db.transaction(async (trx) => {
        const placeholders = updates.map(() => "(?::bigint, ?::bigint)").join(", ");
        const bindings = [];
        for (const u of updates) bindings.push(u.specimen_id, u.taxon_id);

        await trx.raw(
          `UPDATE specimens AS s
           SET taxon_id = v.new_taxon_id, updated_at = now()
           FROM (VALUES ${placeholders}) AS v(specimen_id, new_taxon_id)
           WHERE s.specimen_id = v.specimen_id AND s.deleted_at IS NULL`,
          bindings
        );

        const outboxRows = updates.map((u) => ({
          entity_type: "specimen",
          entity_id: u.specimen_id,
          op: "upsert",
          priority: 1,
          status: "pending",
        }));
        await trx("es_sync_outbox").insert(outboxRows);
        stats.outboxEnqueued += outboxRows.length;
      });
    }

    lastSpecimenId = rows[rows.length - 1].specimen_id;
    processed += rows.length;
    if (rows.length < fetchSize) break;
  }

  if (conflictsOut && conflicts.length > 0) {
    const lines = ["specimen_id,gbif_scientific_name,current_taxon,matched_taxon,reason"];
    for (const c of conflicts) {
      lines.push([c.specimen_id, csvEscape(c.gbif_scientific_name), csvEscape(c.current_taxon), csvEscape(c.matched_taxon), csvEscape(c.reason)].join(","));
    }
    fs.writeFileSync(conflictsOut, lines.join("\n") + "\n", "utf8");
    emit(`⚠️ Đã xuất ${conflicts.length} homonym/lineage conflicts ra ${conflictsOut}`);
  }

  if (previewOut && previewRows.length > 0) {
    const lines = ["specimen_id,gbif_scientific_name,old_taxon_id,old_taxon,new_taxon_id,new_taxon,transition"];
    for (const p of previewRows) {
      lines.push([p.specimen_id, csvEscape(p.gbif_scientific_name), p.old_taxon_id, csvEscape(p.old_taxon), p.new_taxon_id, csvEscape(p.new_taxon), csvEscape(p.transition)].join(","));
    }
    fs.writeFileSync(previewOut, lines.join("\n") + "\n", "utf8");
    emit(`📄 Đã xuất ${previewRows.length} dòng preview ra ${previewOut}`);
  }

  if (!dryRun && stats.changed > 0) {
    await db("audit_logs").insert({
      action_type: "RELINK_SPECIMENS_TAXA",
      target_table: "specimens",
      details: JSON.stringify(stats),
    });
    await db.raw("REFRESH MATERIALIZED VIEW mv_taxon_dwc_flat");
    emit("🔄 Đã ghi audit_logs & REFRESH MATERIALIZED VIEW mv_taxon_dwc_flat");
  }

  emit(`\n${"═".repeat(60)}`);
  emit("📊 BẢNG CHUYỂN CẤP (CHỈ DÒNG THỰC SỰ ĐỔI taxon_id)");
  emit(`${"═".repeat(60)}`);
  for (const [k, v] of Object.entries(stats.transitions)) {
    emit(`   ${k.padEnd(18)}: ${v.toLocaleString()}`);
  }
  emit(`   ${"Tổng thực sự đổi".padEnd(18)}: ${stats.changed.toLocaleString()}`);
  emit(`   ${"Giữ nguyên".padEnd(18)}: ${stats.unchanged.toLocaleString()}`);
  emit(`   ${"Conflict (chặn)".padEnd(18)}: ${stats.conflicts.toLocaleString()}`);
  if (dryRun) emit("   [DRY-RUN] Không có gì được ghi vào DB.");
  emit(`${"═".repeat(60)}\n`);

  return { stats, conflicts, previewRows };
}

if (require.main === module) {
  runRelink()
    .then(() => knex.destroy())
    .catch((err) => {
      console.error("💥", err.message);
      knex.destroy().finally(() => process.exit(1));
    });
}

module.exports = { normalizedNameLevels, runRelink };
