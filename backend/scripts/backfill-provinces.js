#!/usr/bin/env node
/**
 * backend/scripts/backfill-provinces.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Cập nhật province_id cho các specimens chưa được map (province_id IS NULL)
 * bằng cách tra cứu lại GBIF occurrence theo gbif_occurrence_id.
 *
 * Cách dùng:
 *   node scripts/backfill-provinces.js              # cập nhật tất cả
 *   node scripts/backfill-provinces.js --dry-run    # chỉ log, không update
 *   node scripts/backfill-provinces.js --limit 1000 # tối đa N records
 *
 * Lưu ý: Script này chạy sau gbif-import.js khi province alias đã được cập nhật.
 */
"use strict";

require("dotenv").config();
const axios = require("axios");
const knex = require("../src/config/knex");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => {
  const idx = args.indexOf("--limit");
  return idx !== -1 ? parseInt(args[idx + 1], 10) : 50000;
})();

// ── Alias map (đồng bộ với gbif-import.js) ──────────────────────────────────
const PROVINCE_ALIASES = {
  "hồ chí minh city":        "tp. hồ chí minh",
  "ho chi minh city":        "tp. hồ chí minh",
  "hcm":                     "tp. hồ chí minh",
  "tp hồ chí minh":          "tp. hồ chí minh",
  "thành phố hồ chí minh":   "tp. hồ chí minh",
  "bình dương":              "tp. hồ chí minh",
  "bình phước":              "đồng nai",
  "thừa thiên - huế":        "huế",
  "thừa thiên huế":          "huế",
  "thua thien hue":          "hue",
  "thua thien - hue":        "hue",
  "quảng nam":               "đà nẵng",
  "phú yên":                 "khánh hòa",
  "bến tre":                 "đồng tháp",
  "tiền giang":              "đồng tháp",
  "long an":                 "tây ninh",
  "vĩnh phúc":               "phú thọ",
  "hòa bình":                "hà nội",
  "hà giang":                "lào cai",
  "yên bái":                 "tuyên quang",
  "bắc giang":               "bắc ninh",
  "hải dương":               "hưng yên",
  "ninh thuận":              "khánh hòa",
  "bình thuận":              "khánh hòa",
  "kon tum":                 "gia lai",
  "trà vinh":                "vĩnh long",
  "kiên giang":              "an giang",
  "bạc liêu":                "cà mau",
};

let provinceCache = null;

async function loadProvinceCache() {
  const rows = await knex("provinces").select("province_id", "province_name_vn", "province_name_en");
  provinceCache = rows.map((r) => ({
    id: r.province_id,
    vn: r.province_name_vn.toLowerCase(),
    en: r.province_name_en.toLowerCase(),
  }));
}

function matchProvince(stateProvince) {
  if (!stateProvince || !provinceCache) return null;
  const q = stateProvince.toLowerCase().trim();
  const aliased = PROVINCE_ALIASES[q] || q;

  for (const target of [aliased, q]) {
    let found = provinceCache.find((p) => p.vn === target || p.en === target);
    if (found) return found.id;
    found = provinceCache.find((p) => target.includes(p.vn) || p.vn.includes(target));
    if (found) return found.id;
    found = provinceCache.find((p) => target.includes(p.en) || p.en.includes(target));
    if (found) return found.id;
  }
  return null;
}

async function main() {
  console.log(`[backfill] Mode: ${DRY_RUN ? "DRY-RUN" : "PRODUCTION"} | Limit: ${LIMIT}`);

  await knex.raw("SELECT 1");
  console.log("[backfill] ✅ DB connected");

  // Bước 1: Khớp không gian PostGIS (Nearest Province Centroid) cho các mẫu đã có tọa độ GPS
  if (!DRY_RUN) {
    const spatialRes = await knex.raw(`
      WITH prov_centroids AS (
        SELECT
          province_id,
          ST_SetSRID(
            ST_MakePoint(
              AVG(ST_X(collection_point::geometry)),
              AVG(ST_Y(collection_point::geometry))
            ),
            4326
          )::geography AS center_pt
        FROM specimens
        WHERE province_id IS NOT NULL
          AND collection_point IS NOT NULL
          AND deleted_at IS NULL
        GROUP BY province_id
      )
      UPDATE specimens AS s
      SET province_id = nearest.province_id
      FROM (
        SELECT
          s2.specimen_id,
          s2.collection_date,
          (
            SELECT pc.province_id
            FROM prov_centroids pc
            ORDER BY s2.collection_point <-> pc.center_pt
            LIMIT 1
          ) AS province_id
        FROM specimens s2
        WHERE s2.province_id IS NULL
          AND s2.collection_point IS NOT NULL
          AND s2.deleted_at IS NULL
      ) AS nearest
      WHERE s.specimen_id = nearest.specimen_id
        AND s.collection_date = nearest.collection_date
    `);
    console.log(`[backfill] 🗺️ PostGIS Spatial Backfill đã gán tỉnh/thành cho: ${spatialRes.rowCount} mẫu vật có tọa độ GPS.`);
  }

  if (args.includes("--spatial-only")) {
    await knex.destroy();
    return;
  }

  await loadProvinceCache();
  console.log(`[backfill] Province cache: ${provinceCache.length} provinces`);

  // Lấy tất cả specimens có province_id NULL kèm gbif_occurrence_id
  const nullRecords = await knex("specimens as s")
    .join("specimen_registry as r", "s.specimen_id", "r.specimen_id")
    .whereNull("s.province_id")
    .whereNotNull("r.gbif_occurrence_id")
    .select("s.specimen_id", "s.collection_date", "r.gbif_occurrence_id")
    .limit(LIMIT);

  console.log(`[backfill] Specimens cần backfill: ${nullRecords.length}`);
  if (nullRecords.length === 0) {
    console.log("[backfill] ✅ Không có gì cần cập nhật.");
    await knex.destroy();
    return;
  }

  // Lấy occurrenceIDs từ GBIF theo batch
  const BATCH = 50;
  let updated = 0;
  let stillNull = 0;

  for (let i = 0; i < nullRecords.length; i += BATCH) {
    const batch = nullRecords.slice(i, i + BATCH);
    const occIds = batch.map((r) => r.gbif_occurrence_id).filter(Boolean);

    // Fetch từ GBIF occurrence API (theo occurrenceID list)
    for (const rec of batch) {
      if (!rec.gbif_occurrence_id) continue;
      try {
        // Extract gbifID numeric từ occurrenceID
        // Format: "https://www.inaturalist.org/observations/123" hoặc "gbif:123456789"
        let gbifId = null;
        if (rec.gbif_occurrence_id.startsWith("gbif:")) {
          gbifId = rec.gbif_occurrence_id.replace("gbif:", "");
        } else {
          // iNat URL → không có GBIF occurrence ID số, dùng search
          const url = rec.gbif_occurrence_id;
          const inatId = url.split("/").pop();
          if (!inatId) { stillNull++; continue; }
          // Search qua GBIF
          const res = await axios.get("https://api.gbif.org/v1/occurrence/search", {
            params: { occurrenceId: url, limit: 1 },
            timeout: 10000,
          });
          if (res.data.results?.[0]) {
            const sp = res.data.results[0].stateProvince;
            const pid = matchProvince(sp);
            if (pid && !DRY_RUN) {
              await knex("specimens")
                .where("specimen_id", rec.specimen_id)
                .where("collection_date", rec.collection_date)
                .update({ province_id: pid });
              updated++;
            } else if (pid) {
              updated++;
            } else {
              stillNull++;
            }
          } else {
            stillNull++;
          }
          await new Promise(r => setTimeout(r, 300));
          continue;
        }

        if (gbifId) {
          const res = await axios.get(`https://api.gbif.org/v1/occurrence/${gbifId}`, { timeout: 10000 });
          const sp = res.data.stateProvince;
          const pid = matchProvince(sp);
          if (pid && !DRY_RUN) {
            await knex("specimens")
              .where("specimen_id", rec.specimen_id)
              .where("collection_date", rec.collection_date)
              .update({ province_id: pid });
            updated++;
          } else if (pid) {
            updated++;
          } else {
            stillNull++;
          }
          await new Promise(r => setTimeout(r, 300));
        }
      } catch (err) {
        stillNull++;
      }
    }

    if ((i / BATCH) % 10 === 0) {
      console.log(`[backfill] Tiến độ: ${Math.min(i + BATCH, nullRecords.length)}/${nullRecords.length} | Updated: ${updated} | Still null: ${stillNull}`);
    }
  }

  console.log("\n[backfill] ══════════════════════════════");
  console.log(`[backfill] Đã cập nhật province_id : ${updated}`);
  console.log(`[backfill] Vẫn không map được       : ${stillNull}`);
  console.log(`[backfill] Mode: ${DRY_RUN ? "DRY-RUN (không ghi DB)" : "PRODUCTION"}`);

  await knex.destroy();
}

main().catch((err) => {
  console.error("💥", err.message);
  knex.destroy().finally(() => process.exit(1));
});
