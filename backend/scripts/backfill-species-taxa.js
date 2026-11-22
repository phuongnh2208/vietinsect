#!/usr/bin/env node
/**
 * backend/scripts/backfill-species-taxa.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Trích xuất các loài nhị danh (binomial species) hợp lệ từ bảng specimens,
 * CHỈ tạo mới Species khi:
 *   1. Tên nhị danh hợp lệ (đã bỏ subgenus trong ngoặc, bỏ tác giả/năm,
 *      loại sp./cf./aff./nr./indet./lai/phân loài/BOLD BIN).
 *   2. Đã có Genus cha (taxonomic_status = 'accepted') tồn tại trong bảng taxa.
 * Các tên không đạt điều kiện được xuất ra file CSV (unmatched_taxa.csv) để
 * người dùng duyệt thủ công — KHÔNG tự tạo Genus hay gắn bừa vào Order.
 *
 * Tính năng:
 *   - Idempotent (ON CONFLICT DO NOTHING)
 *   - Chạy trong transaction theo lô (--batch, default 500)
 *   - Ghi audit_logs & REFRESH MATERIALIZED VIEW mv_taxon_dwc_flat khi chạy thật
 *   - Hỗ trợ --dry-run, --limit <N>, --batch <N>, --unmatched-out <path>
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const knex = require("../src/config/knex");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const BATCH_SIZE = (() => {
  const i = args.indexOf("--batch");
  return i !== -1 ? Math.max(1, parseInt(args[i + 1], 10) || 500) : 500;
})();
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i !== -1 ? Math.max(1, parseInt(args[i + 1], 10) || 0) : null;
})();
const UNMATCHED_OUT = (() => {
  const i = args.indexOf("--unmatched-out");
  return i !== -1 ? args[i + 1] : path.resolve(process.cwd(), "unmatched_taxa.csv");
})();

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function slugify(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const EXCLUDED_EPITHETS = new Set([
  "sp", "sp.", "spp", "spp.", "cf", "cf.", "aff", "aff.",
  "indet", "indet.", "nr", "nr.", "gen", "gen.", "complex", "group", "hybrid",
]);

/**
 * Chuẩn hóa tên khoa học:
 * - Loại bỏ BOLD BIN, lai (× / " x "), open nomenclature (sp./cf./aff./nr./indet.), phân loài (trinomial).
 * - Bỏ subgenus trong ngoặc, ví dụ: "Supella (Supella) longipalpa (Fabricius, 1798)" → "Supella longipalpa".
 */
function parseAcceptedBinomial(rawName) {
  if (!rawName || typeof rawName !== "string") {
    return { valid: false, reason: "empty_name" };
  }
  const trimmed = rawName.trim();
  if (/^BOLD:/i.test(trimmed)) {
    return { valid: false, reason: "bold_bin" };
  }
  if (/[×]|\s+x\s+/i.test(trimmed)) {
    return { valid: false, reason: "hybrid" };
  }
  if (/\b(sp\.?|spp\.?|cf\.?|aff\.?|nr\.?|indet\.?)\b/i.test(trimmed)) {
    return { valid: false, reason: "open_nomenclature" };
  }

  // Bỏ subgenus dạng "(Supella)" đứng ngay sau Genus
  const cleaned = trimmed.replace(/^([A-Z][a-z]+)\s+\([A-Z][a-z]+\)\s+/, "$1 ");

  // Kiểm tra phân loài (trinomial): Genus species subspecies (3 từ đầu viết thường từ thứ 2 & 3)
  if (/^[A-Z][a-z]+\s+[a-z][a-z-]{1,}\s+[a-z][a-z-]{1,}(\s|$)/.test(cleaned)) {
    return { valid: false, reason: "trinomial_subspecies" };
  }

  const match = cleaned.match(/^([A-Z][a-z]+)\s+([a-z][a-z-]{1,})(?:\s+(.*))?$/);
  if (!match) {
    return { valid: false, reason: "not_binomial" };
  }

  const genusName = match[1];
  const epithet = match[2];
  const rest = (match[3] || "").trim();

  if (EXCLUDED_EPITHETS.has(epithet.toLowerCase())) {
    return { valid: false, reason: "open_nomenclature" };
  }

  let authorship = null;
  let yearDescribed = null;
  if (rest) {
    const yearMatch = rest.match(/\b(1[7-9]\d{2}|20\d{2})\b/);
    if (yearMatch) yearDescribed = parseInt(yearMatch[1], 10);
    if (/^[A-Z(]/.test(rest)) authorship = rest.slice(0, 120);
  }

  return {
    valid: true,
    binomial: `${genusName} ${epithet}`,
    genusName,
    epithet,
    authorship,
    yearDescribed,
  };
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function runBackfill(db = knex, opts = {}) {
  const dryRun = opts.dryRun ?? DRY_RUN;
  const batchSize = opts.batchSize ?? BATCH_SIZE;
  const limit = opts.limit ?? LIMIT;
  const unmatchedOut = opts.unmatchedOut ?? UNMATCHED_OUT;
  const silent = opts.silent ?? false;
  const emit = (m) => { if (!silent) log(m); };

  emit("🦋 VietInsect Species Taxa Backfill Pipeline (v2 - Strict Accepted Genus Rule)");
  emit(`   Mode: ${dryRun ? "🔵 DRY-RUN" : "🔴 PRODUCTION"} | Batch: ${batchSize}${limit ? ` | Limit: ${limit}` : ""}`);

  await db.raw("SELECT 1");

  const allTaxa = await db("taxa").select(
    "taxon_id", "parent_id", "accepted_taxon_id", "taxon_rank",
    "scientific_name", "slug", "gbif_taxon_key", "taxonomic_status"
  );

  const byId = new Map();
  const existingSlugs = new Set();
  const existingGbifKeys = new Set();
  const genusByName = new Map();
  const speciesByName = new Map();

  for (const t of allTaxa) {
    byId.set(Number(t.taxon_id), t);
    if (t.slug) existingSlugs.add(t.slug);
    if (t.gbif_taxon_key) existingGbifKeys.add(String(t.gbif_taxon_key));
  }

  const resolveAccepted = (t) => {
    let cur = t;
    let guard = 0;
    while (cur && cur.taxonomic_status !== "accepted" && cur.accepted_taxon_id && guard < 5) {
      const next = byId.get(Number(cur.accepted_taxon_id));
      if (!next) break;
      cur = next;
      guard++;
    }
    return cur;
  };

  for (const t of allTaxa) {
    const acc = resolveAccepted(t);
    if (!acc || acc.taxonomic_status !== "accepted") continue;
    const lowerName = t.scientific_name.trim().toLowerCase();
    if (acc.taxon_rank === "Genus" && !genusByName.has(lowerName)) {
      genusByName.set(lowerName, Number(acc.taxon_id));
    } else if (acc.taxon_rank === "Species" && !speciesByName.has(lowerName)) {
      speciesByName.set(lowerName, Number(acc.taxon_id));
    }
  }

  emit(`📋 Taxa hiện có: ${allTaxa.length.toLocaleString()} (Accepted Genus=${genusByName.size}, Accepted Species=${speciesByName.size})`);

  let q = db("specimens as s")
    .join("taxa as t", "s.taxon_id", "t.taxon_id")
    .whereNull("s.deleted_at")
    .whereNotNull("s.gbif_scientific_name")
    .select("s.gbif_scientific_name", "s.gbif_taxon_key", "s.common_name_vn", "s.common_name_en");

  if (limit) q = q.limit(limit);
  const specimenRows = await q;

  const candidateSpeciesMap = new Map();
  const unmatchedMap = new Map(); // rawName -> { rawName, gbifTaxonKey, reason, count }

  for (const row of specimenRows) {
    const raw = row.gbif_scientific_name;
    // Bỏ qua các tên 1 từ (Order/Family/Genus) — không phải ứng viên Species
    if (!raw || !/\s/.test(raw.trim())) continue;

    const parsed = parseAcceptedBinomial(raw);
    if (!parsed.valid) {
      const key = `${raw.trim().toLowerCase()}|${parsed.reason}`;
      const prev = unmatchedMap.get(key);
      if (prev) prev.count++;
      else unmatchedMap.set(key, { rawName: raw.trim(), gbifTaxonKey: row.gbif_taxon_key || "", reason: parsed.reason, count: 1 });
      continue;
    }

    const speciesLower = parsed.binomial.toLowerCase();
    if (speciesByName.has(speciesLower)) continue;

    const genusLower = parsed.genusName.toLowerCase();
    const genusParentId = genusByName.get(genusLower);
    if (!genusParentId) {
      const key = `${parsed.binomial.toLowerCase()}|missing_accepted_genus`;
      const prev = unmatchedMap.get(key);
      if (prev) prev.count++;
      else unmatchedMap.set(key, { rawName: parsed.binomial, gbifTaxonKey: row.gbif_taxon_key || "", reason: "missing_accepted_genus", count: 1 });
      continue;
    }

    if (!candidateSpeciesMap.has(speciesLower)) {
      candidateSpeciesMap.set(speciesLower, {
        binomial: parsed.binomial,
        genusParentId,
        epithet: parsed.epithet,
        authorship: parsed.authorship,
        yearDescribed: parsed.yearDescribed,
        gbifTaxonKey: row.gbif_taxon_key ? String(row.gbif_taxon_key) : null,
        commonNameVn: row.common_name_vn || null,
        commonNameEn: row.common_name_en || null,
      });
    }
  }

  const speciesToInsert = [];
  let suffixCounter = 1;
  for (const [, sp] of candidateSpeciesMap.entries()) {
    let slug = slugify(sp.binomial);
    if (existingSlugs.has(slug)) {
      slug = sp.gbifTaxonKey && !existingSlugs.has(`${slug}-${sp.gbifTaxonKey}`)
        ? `${slug}-${sp.gbifTaxonKey}`
        : `${slug}-sp-${suffixCounter++}`;
    }
    existingSlugs.add(slug);

    let gbifKeyToAssign = null;
    if (sp.gbifTaxonKey && !existingGbifKeys.has(sp.gbifTaxonKey)) {
      gbifKeyToAssign = sp.gbifTaxonKey;
      existingGbifKeys.add(sp.gbifTaxonKey);
    }

    speciesToInsert.push({
      parent_id: sp.genusParentId,
      taxon_rank: "Species",
      scientific_name: sp.binomial,
      slug,
      specific_epithet: sp.epithet,
      scientific_name_authorship: sp.authorship,
      year_described: sp.yearDescribed,
      vernacular_name_vn: sp.commonNameVn,
      vernacular_name_en: sp.commonNameEn,
      taxonomic_status: "accepted",
      nomenclatural_code: "ICZN",
      gbif_taxon_key: gbifKeyToAssign,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  // Ghi unmatched_taxa.csv nếu có tên không đạt điều kiện
  const unmatchedList = Array.from(unmatchedMap.values()).sort((a, b) => b.count - a.count);
  if (unmatchedOut && unmatchedList.length > 0) {
    const lines = ["raw_name,gbif_taxon_key,reason,specimen_count"];
    for (const u of unmatchedList) {
      lines.push([csvEscape(u.rawName), csvEscape(u.gbifTaxonKey), csvEscape(u.reason), u.count].join(","));
    }
    fs.writeFileSync(unmatchedOut, lines.join("\n") + "\n", "utf8");
    emit(`📝 Đã xuất ${unmatchedList.length} tên chưa khớp ra ${unmatchedOut}`);
  }

  let insertedCount = 0;
  if (!dryRun && speciesToInsert.length > 0) {
    for (let i = 0; i < speciesToInsert.length; i += batchSize) {
      const chunk = speciesToInsert.slice(i, i + batchSize);
      await db.transaction(async (trx) => {
        const res = await trx("taxa")
          .insert(chunk)
          .onConflict("slug")
          .ignore()
          .returning("taxon_id");
        insertedCount += res.length;
      });
    }

    // Ghi audit_logs
    await db("audit_logs").insert({
      action_type: "BACKFILL_SPECIES_TAXA",
      target_table: "taxa",
      details: JSON.stringify({
        eligibleSpecies: speciesToInsert.length,
        insertedSpecies: insertedCount,
        unmatchedCount: unmatchedList.length,
      }),
    });

    // REFRESH mv_taxon_dwc_flat (DEF-110)
    await db.raw("REFRESH MATERIALIZED VIEW mv_taxon_dwc_flat");
    emit("🔄 Đã REFRESH MATERIALIZED VIEW mv_taxon_dwc_flat");
  }

  emit(`\n${"═".repeat(60)}`);
  emit("📊 KẾT QUẢ BACKFILL SPECIES TAXA (v2)");
  emit(`${"═".repeat(60)}`);
  emit(`   Loài đủ điều kiện tạo mới (có Genus accepted): ${speciesToInsert.length}`);
  emit(`   Loài không đạt điều kiện (ghi unmatched CSV) : ${unmatchedList.length}`);
  emit(`   Đã insert thật vào DB                        : ${dryRun ? 0 : insertedCount}`);
  if (dryRun) emit("   [DRY-RUN] Không có dữ liệu nào bị thay đổi.");
  emit(`${"═".repeat(60)}\n`);

  return {
    eligibleCount: speciesToInsert.length,
    insertedCount: dryRun ? 0 : insertedCount,
    unmatchedCount: unmatchedList.length,
    unmatchedList,
  };
}

if (require.main === module) {
  runBackfill()
    .then(() => knex.destroy())
    .catch((err) => {
      console.error("💥 Fatal:", err);
      knex.destroy().finally(() => process.exit(1));
    });
}

module.exports = { parseAcceptedBinomial, runBackfill };
