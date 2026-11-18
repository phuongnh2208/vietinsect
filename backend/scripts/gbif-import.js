#!/usr/bin/env node
/**
 * backend/scripts/gbif-import.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pipeline: GBIF Occurrence API → VietInsect DB (specimens table)
 *
 * Cách dùng:
 *   node scripts/gbif-import.js                # import thật
 *   node scripts/gbif-import.js --dry-run      # chỉ log, không insert
 *   node scripts/gbif-import.js --order Odonata  # chỉ import 1 bộ
 *   node scripts/gbif-import.js --limit 500    # số records / page (default 300)
 *
 * Yêu cầu:
 *   - PostgreSQL đang chạy, migration đã apply (kể cả 013_add_gbif_fields)
 *   - Seed 001_seed_lookups.js và 002_seed_taxa.js đã chạy
 *   - Biến môi trường trong backend/.env
 *
 * SRS §6.5: dùng Knex cho tất cả DB operations
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

require("dotenv").config();
const axios = require("axios");
const knex = require("../src/config/knex");

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ORDER_FILTER = (() => {
  const idx = args.indexOf("--order");
  return idx !== -1 ? args[idx + 1] : null;
})();
const PAGE_LIMIT = (() => {
  const idx = args.indexOf("--limit");
  return idx !== -1 ? parseInt(args[idx + 1], 10) : 300;
})();

// ─── Config GBIF ──────────────────────────────────────────────────────────
const GBIF_BASE = "https://api.gbif.org/v1/occurrence/search";
const GBIF_MAX_OFFSET = 99700; // offset + limit <= 100,000
const GBIF_RATE_LIMIT_MS = 1200; // ~1 req/giây (có buffer)

// ─── Mapping: Order → GBIF taxonKey ──────────────────────────────────────
const INSECTA_ORDERS = [
  { order: "Coleoptera",    taxonKey: 1470 },
  { order: "Lepidoptera",   taxonKey: 797  },
  { order: "Hymenoptera",   taxonKey: 1457 },
  { order: "Diptera",       taxonKey: 811  },
  { order: "Hemiptera",     taxonKey: 809  },
  { order: "Orthoptera",    taxonKey: 1458 },
  { order: "Odonata",       taxonKey: 789  },
  { order: "Blattodea",     taxonKey: 800  },
  { order: "Mantodea",      taxonKey: 788  },
  { order: "Neuroptera",    taxonKey: 1501 },
  { order: "Trichoptera",   taxonKey: 1003 },
  { order: "Ephemeroptera", taxonKey: 1225 },
  { order: "Plecoptera",    taxonKey: 787  },
  { order: "Thysanoptera",  taxonKey: 1228 },
  { order: "Dermaptera",    taxonKey: 1224 },
  { order: "Phasmida",      taxonKey: 1460 }, // GBIF Backbone: "Phasmida" (không phải "Phasmatodea"); key=1460
];

// ─── Vietnam bounding box (lat, lon) ─────────────────────────────────────
const VN_BBOX = { latMin: 8.0, latMax: 24.0, lonMin: 101.0, lonMax: 110.0 };

// ─── Stats tổng hợp ───────────────────────────────────────────────────────
const stats = {
  fetched: 0,
  inserted: 0,
  skipped_no_taxon: 0,
  skipped_no_date: 0,
  skipped_bbox: 0,
  skipped_duplicate: 0,
  errors: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/** Kiểm tra tọa độ nằm trong VN bbox */
function isInVietnam(lat, lon) {
  if (lat == null || lon == null) return false;
  return (
    lat >= VN_BBOX.latMin &&
    lat <= VN_BBOX.latMax &&
    lon >= VN_BBOX.lonMin &&
    lon <= VN_BBOX.lonMax
  );
}

/**
 * Parse eventDate từ GBIF → JavaScript Date
 * GBIF trả về nhiều format: "2023-05-12", "2023-05", "2023", "2023-05-12T00:00:00"
 */
function parseEventDate(eventDate) {
  if (!eventDate) return null;
  // Lấy phần YYYY-MM-DD (bỏ time nếu có)
  const dateStr = String(eventDate).split("T")[0];
  const parts = dateStr.split("-");
  if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
    // Chỉ có năm → dùng 01-01
    return new Date(`${parts[0]}-01-01`);
  }
  if (parts.length === 2) {
    // YYYY-MM → dùng ngày 01
    return new Date(`${parts[0]}-${parts[1]}-01`);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB Cache: taxon_id lookup & province_id fuzzy match
// ─────────────────────────────────────────────────────────────────────────────

/** Cache: order name (lowercase) → taxon_id */
let taxonCache = null;

async function loadTaxonCache() {
  const rows = await knex("taxa")
    .select("taxon_id", "scientific_name")
    .where("taxon_rank", "Order")
    .whereIn(
      "scientific_name",
      INSECTA_ORDERS.map((o) => o.order)
    );
  taxonCache = {};
  for (const r of rows) {
    taxonCache[r.scientific_name.toLowerCase()] = r.taxon_id;
  }
  log(
    `📋 Taxon cache: ${Object.keys(taxonCache).length} orders → [${Object.keys(taxonCache).join(", ")}]`
  );
}

function getTaxonId(orderName) {
  if (!orderName) return null;
  return taxonCache[orderName.toLowerCase()] ?? null;
}

/** Cache: province name variants → province_id */
let provinceCache = null;

async function loadProvinceCache() {
  const rows = await knex("provinces").select(
    "province_id",
    "province_name_vn",
    "province_name_en"
  );
  provinceCache = [];
  for (const r of rows) {
    provinceCache.push({
      id: r.province_id,
      en: r.province_name_en.toLowerCase(),
      vn: r.province_name_vn.toLowerCase(),
    });
  }
  log(`📋 Province cache: ${provinceCache.length} provinces loaded`);
}

/**
 * Fuzzy match stateProvince → province_id
 * Thử exact match trước, rồi substring match
 */
function matchProvince(stateProvince) {
  if (!stateProvince || !provinceCache) return null;
  const q = stateProvince.toLowerCase().trim();

  // 1. Exact match EN
  let found = provinceCache.find((p) => p.en === q);
  if (found) return found.id;

  // 2. Exact match VN
  found = provinceCache.find((p) => p.vn === q);
  if (found) return found.id;

  // 3. Substring match EN (q chứa tên tỉnh hoặc ngược lại)
  found = provinceCache.find(
    (p) => q.includes(p.en) || p.en.includes(q)
  );
  if (found) return found.id;

  // 4. Substring match VN
  found = provinceCache.find(
    (p) => q.includes(p.vn) || p.vn.includes(q)
  );
  if (found) return found.id;

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GBIF API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch 1 trang GBIF occurrence
 * @param {number} taxonKey
 * @param {number} offset
 * @param {number} limit
 * @returns {{ results: Array, endOfRecords: boolean, count: number }}
 */
async function fetchPage(taxonKey, offset, limit) {
  const params = {
    taxonKey,
    country: "VN",
    limit,
    offset,
    hasCoordinate: true,       // chỉ lấy record có tọa độ
    hasGeospatialIssue: false, // loại bỏ record tọa độ sai
  };

  const { data } = await axios.get(GBIF_BASE, {
    params,
    timeout: 30_000,
    headers: { "User-Agent": "VietInsect-GBIF-Pipeline/1.0 (vietinsect.vast.vn)" },
  });

  return {
    results: data.results || [],
    endOfRecords: data.endOfRecords,
    count: data.count,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform: GBIF record → DB rows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transform 1 GBIF occurrence record thành { registry, specimen }
 * Trả về null nếu record không đủ dữ liệu để insert
 */
function transformRecord(gbifRecord) {
  const {
    occurrenceID,
    gbifID,
    datasetKey,
    order: orderName,
    decimalLatitude: lat,
    decimalLongitude: lon,
    eventDate,
    stateProvince,
    recordedBy,
    institutionCode,
    catalogNumber,
    basisOfRecord,
    occurrenceRemarks,
  } = gbifRecord;

  // ── Validation bắt buộc ──────────────────────────────────────────────────

  // 1. Phải có occurrenceID (dùng gbifID làm fallback)
  const occId = occurrenceID || (gbifID ? `gbif:${gbifID}` : null);
  if (!occId) return { skip: "no_occurrence_id" };

  // 2. Phải match được taxon
  const taxon_id = getTaxonId(orderName);
  if (!taxon_id) return { skip: "no_taxon" };

  // 3. Phải có ngày thu mẫu hợp lệ
  const collectionDate = parseEventDate(eventDate);
  if (!collectionDate) return { skip: "no_date" };

  // 4. Tọa độ trong bbox VN (đã filter hasCoordinate=true ở GBIF, nhưng vẫn kiểm tra)
  if (!isInVietnam(lat, lon)) return { skip: "bbox" };

  // ── Province lookup ───────────────────────────────────────────────────────
  const province_id = matchProvince(stateProvince);

  // ── Build rows ────────────────────────────────────────────────────────────

  /** specimen_registry row */
  const registry = {
    specimen_code: `GBIF-${gbifID || occId.replace(/[^a-z0-9]/gi, "")}`.slice(0, 50),
    gbif_occurrence_id: String(occId).slice(0, 100),
    gbif_dataset_key: datasetKey ? String(datasetKey).slice(0, 50) : null,
    basis_of_record: basisOfRecord ? String(basisOfRecord).slice(0, 50) : null,
    catalog_number: catalogNumber ? String(catalogNumber).slice(0, 100) : null,
    institution_code: institutionCode ? String(institutionCode).slice(0, 50) : null,
    recorded_by: recordedBy ? String(recordedBy).slice(0, 500) : null,
    occurrence_remarks: occurrenceRemarks
      ? String(occurrenceRemarks).slice(0, 1000)
      : null,
    // created_at = default now()
  };

  /** specimens row (cần specimen_id từ registry) */
  const specimenBase = {
    taxon_id,
    province_id: province_id || null,
    collection_date: collectionDate,
    // collection_point: PostGIS geography – dùng raw
    individual_count: gbifRecord.individualCount || 1,
    sex: normalizeSex(gbifRecord.sex),
    is_public: true,
    // created_at / updated_at / entry_date = default now()
  };

  return { occId, registry, specimenBase, lat, lon };
}

/** Chuẩn hóa sex field */
function normalizeSex(sex) {
  if (!sex) return null;
  const s = sex.toLowerCase();
  if (s === "male" || s === "m") return "male";
  if (s === "female" || s === "f") return "female";
  return null; // DB CHECK constraint: only 'male'|'female'|'unknown'
}

// ─────────────────────────────────────────────────────────────────────────────
// DB Insert (batch)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert 1 batch records trong transaction
 * Dùng ON CONFLICT DO NOTHING qua raw SQL để idempotent
 */
async function insertBatch(records) {
  if (DRY_RUN) {
    log(`[DRY-RUN] Sẽ insert ${records.length} records`);
    stats.inserted += records.length;
    return;
  }

  await knex.transaction(async (trx) => {
    for (const rec of records) {
      const { registry, specimenBase, lat, lon } = rec;

      // 1. Insert specimen_registry (ON CONFLICT DO NOTHING)
      const inserted = await trx.raw(
        `
        INSERT INTO specimen_registry
          (specimen_code, gbif_occurrence_id, gbif_dataset_key, basis_of_record,
           catalog_number, institution_code, recorded_by, occurrence_remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (gbif_occurrence_id) DO NOTHING
        RETURNING specimen_id
        `,
        [
          registry.specimen_code,
          registry.gbif_occurrence_id,
          registry.gbif_dataset_key,
          registry.basis_of_record,
          registry.catalog_number,
          registry.institution_code,
          registry.recorded_by,
          registry.occurrence_remarks,
        ]
      );

      const rows = inserted.rows;
      if (!rows || rows.length === 0) {
        // ON CONFLICT DO NOTHING → record đã tồn tại
        stats.skipped_duplicate++;
        continue;
      }

      const specimenId = rows[0].specimen_id;

      // 2. Insert specimens (partitioned by collection_date)
      //    collection_point: dùng ST_MakePoint nếu có tọa độ
      if (lat != null && lon != null) {
        await trx.raw(
          `
          INSERT INTO specimens
            (specimen_id, taxon_id, province_id, collection_date,
             collection_point, individual_count, sex, is_public,
             created_at, updated_at, entry_date)
          VALUES (?, ?, ?, ?,
                  ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
                  ?, ?, ?,
                  now(), now(), now())
          ON CONFLICT DO NOTHING
          `,
          [
            specimenId,
            specimenBase.taxon_id,
            specimenBase.province_id,
            specimenBase.collection_date,
            lon,  // ST_MakePoint(lon, lat) – PostGIS convention
            lat,
            specimenBase.individual_count,
            specimenBase.sex,
            specimenBase.is_public,
          ]
        );
      } else {
        await trx.raw(
          `
          INSERT INTO specimens
            (specimen_id, taxon_id, province_id, collection_date,
             individual_count, sex, is_public,
             created_at, updated_at, entry_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, now(), now(), now())
          ON CONFLICT DO NOTHING
          `,
          [
            specimenId,
            specimenBase.taxon_id,
            specimenBase.province_id,
            specimenBase.collection_date,
            specimenBase.individual_count,
            specimenBase.sex,
            specimenBase.is_public,
          ]
        );
      }

      stats.inserted++;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main pipeline per Order
// ─────────────────────────────────────────────────────────────────────────────

async function importOrder({ order, taxonKey }) {
  log(`\n${"═".repeat(60)}`);
  log(`🦋 Bắt đầu import Order: ${order} (taxonKey=${taxonKey})`);
  log(`${"═".repeat(60)}`);

  let offset = 0;
  let totalForOrder = 0;
  let pageNum = 0;

  while (true) {
    pageNum++;

    // Kiểm tra giới hạn GBIF
    if (offset >= GBIF_MAX_OFFSET) {
      log(
        `⚠️  Đạt giới hạn GBIF 100k (offset=${offset}) cho ${order}. Dừng.`
      );
      log(
        `   → Nếu ${order} có >100k records, cần dùng GBIF async download API.`
      );
      break;
    }

    const limit = Math.min(PAGE_LIMIT, GBIF_MAX_OFFSET - offset);

    log(`📡 Page ${pageNum}: offset=${offset}, limit=${limit}...`);

    let pageData;
    try {
      pageData = await fetchPage(taxonKey, offset, limit);
    } catch (err) {
      log(`❌ Lỗi fetch GBIF (${order} offset=${offset}): ${err.message}`);
      stats.errors++;
      // Thử lại 1 lần sau 5 giây
      await sleep(5000);
      try {
        pageData = await fetchPage(taxonKey, offset, limit);
      } catch (err2) {
        log(`❌ Retry thất bại: ${err2.message} – bỏ qua page này.`);
        stats.errors++;
        break;
      }
    }

    const { results, endOfRecords, count } = pageData;

    if (pageNum === 1) {
      log(`📊 Tổng GBIF records cho ${order} tại VN: ${count.toLocaleString()}`);
    }

    stats.fetched += results.length;
    log(
      `   Nhận ${results.length} records (endOfRecords=${endOfRecords})`
    );

    // ── Transform ────────────────────────────────────────────────────────
    const toInsert = [];

    for (const gbifRec of results) {
      const result = transformRecord(gbifRec);
      if (!result || result.skip) {
        if (result?.skip === "no_taxon") stats.skipped_no_taxon++;
        else if (result?.skip === "no_date") stats.skipped_no_date++;
        else if (result?.skip === "bbox") stats.skipped_bbox++;
        continue;
      }
      toInsert.push(result);
    }

    // ── Insert batch ─────────────────────────────────────────────────────
    if (toInsert.length > 0) {
      try {
        await insertBatch(toInsert);
        totalForOrder += toInsert.length;
        log(
          `   ✅ Inserted ${toInsert.length} records (order total: ${totalForOrder})`
        );
      } catch (err) {
        log(`   ❌ Lỗi insert batch: ${err.message}`);
        stats.errors += toInsert.length;
      }
    } else {
      log(`   ⏭️  Không có record hợp lệ trong page này.`);
    }

    if (endOfRecords) {
      log(`✅ Hoàn tất ${order}: ${totalForOrder} records được import.`);
      break;
    }

    offset += results.length;

    // Rate limiting
    await sleep(GBIF_RATE_LIMIT_MS);
  }

  return totalForOrder;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  log("🚀 VietInsect GBIF Import Pipeline");
  log(`   Mode: ${DRY_RUN ? "🔵 DRY-RUN (không insert DB)" : "🔴 PRODUCTION (insert DB)"}`);
  log(`   Page limit: ${PAGE_LIMIT} records/page`);
  if (ORDER_FILTER) log(`   Filter: chỉ import Order = ${ORDER_FILTER}`);
  log("");

  // ── Kiểm tra kết nối DB ─────────────────────────────────────────────────
  if (!DRY_RUN) {
    try {
      await knex.raw("SELECT 1");
      log("✅ Kết nối DB thành công");
    } catch (err) {
      log(`❌ Không kết nối được DB: ${err.message}`);
      log("   → Kiểm tra PostgreSQL đang chạy và .env đúng cấu hình.");
      process.exit(1);
    }
  }

  // ── Load cache ───────────────────────────────────────────────────────────
  if (!DRY_RUN) {
    await loadTaxonCache();
    await loadProvinceCache();

    // Validate taxon cache (cần ít nhất 1 order để import)
    if (Object.keys(taxonCache).length === 0) {
      log("❌ Không tìm thấy Order nào trong bảng taxa!");
      log("   → Chạy: npx knex seed:run --specific=002_seed_taxa.js trước.");
      process.exit(1);
    }
  } else {
    // Dry-run: tạo fake cache để test transform
    taxonCache = {};
    for (const o of INSECTA_ORDERS) {
      taxonCache[o.order.toLowerCase()] = Math.floor(Math.random() * 1000) + 1;
    }
    provinceCache = [];
    log("[DRY-RUN] Dùng fake taxon cache và province cache rỗng");
  }

  // ── Chọn orders cần import ───────────────────────────────────────────────
  let ordersToImport = INSECTA_ORDERS;
  if (ORDER_FILTER) {
    ordersToImport = INSECTA_ORDERS.filter(
      (o) => o.order.toLowerCase() === ORDER_FILTER.toLowerCase()
    );
    if (ordersToImport.length === 0) {
      log(`❌ Không tìm thấy order "${ORDER_FILTER}"`);
      log(
        `   Các order hợp lệ: ${INSECTA_ORDERS.map((o) => o.order).join(", ")}`
      );
      process.exit(1);
    }
  }

  const startTime = Date.now();

  // ── Import từng order tuần tự ────────────────────────────────────────────
  for (const orderConfig of ordersToImport) {
    await importOrder(orderConfig);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  log(`\n${"═".repeat(60)}`);
  log("📊 KẾT QUẢ IMPORT");
  log(`${"═".repeat(60)}`);
  log(`   Tổng records GBIF đã fetch   : ${stats.fetched.toLocaleString()}`);
  log(`   Đã insert vào DB             : ${stats.inserted.toLocaleString()}`);
  log(`   Bỏ qua (không khớp taxon)   : ${stats.skipped_no_taxon.toLocaleString()}`);
  log(`   Bỏ qua (không có ngày)       : ${stats.skipped_no_date.toLocaleString()}`);
  log(`   Bỏ qua (ngoài bbox VN)       : ${stats.skipped_bbox.toLocaleString()}`);
  log(`   Trùng lặp (đã tồn tại)       : ${stats.skipped_duplicate.toLocaleString()}`);
  log(`   Lỗi                          : ${stats.errors.toLocaleString()}`);
  log(`   Thời gian chạy               : ${elapsed} phút`);
  if (DRY_RUN) {
    log("\n   [DRY-RUN] Không có dữ liệu nào được ghi vào DB.");
  }
  log(`${"═".repeat(60)}\n`);

  // Đóng Knex pool
  await knex.destroy();
}

main().catch((err) => {
  console.error("💥 Unhandled error:", err);
  knex.destroy().finally(() => process.exit(1));
});
