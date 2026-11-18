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
const https = require("https");
const axios = require("axios");
const knex = require("../src/config/knex");

// Agent tắt keepAlive + ép IPv4 tránh kẹt socket 6 phút trên Windows / Node 24
const httpsAgent = new https.Agent({ keepAlive: false, family: 4 });

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ORDER_FILTER = (() => {
  const idx = args.indexOf("--order");
  return idx !== -1 ? args[idx + 1] : null;
})();
const START_ORDER = (() => {
  const idx = args.indexOf("--start-order");
  return idx !== -1 ? args[idx + 1] : null;
})();
const START_OFFSET = (() => {
  const idx = args.indexOf("--start-offset");
  return idx !== -1 ? parseInt(args[idx + 1], 10) : 0;
})();
const PAGE_LIMIT = (() => {
  const idx = args.indexOf("--limit");
  return idx !== -1 ? parseInt(args[idx + 1], 10) : 300;
})();

// ─── Config GBIF ──────────────────────────────────────────────────────────
const GBIF_BASE = "https://api.gbif.org/v1/occurrence/search";
const GBIF_MAX_OFFSET = 99700; // offset + limit <= 100,000
const GBIF_RATE_LIMIT_MS = 400; // ~2.5 req/giây (an toàn với GBIF public API)

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
  skipped_literature: 0,
  skipped_duplicate: 0,
  backfilled: 0,
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
 * Parse eventDate từ GBIF → chuỗi YYYY-MM-DD hợp lệ trong partition [1800..2050]
 * GBIF trả về nhiều format:
 *   - "2023-05-12", "2023-05", "2023", "2023-05-12T00:00:00"
 *   - Khoảng ngày bẫy mẫu bảo tàng: "1999-04-28/1999-05-12" → lấy ngày bắt đầu "1999-04-28"
 *   - Fallback sang year/month/day nếu eventDate trống
 */
function parseEventDate(eventDate, gbifRecord = {}) {
  let candidate = null;

  if (eventDate) {
    // Tách khoảng ngày ISO-8601 ("start/end") trước, sau đó bỏ phần giờ "T..."
    const firstPart = String(eventDate).split("/")[0].trim().split("T")[0].trim();
    const parts = firstPart.split("-");
    if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
      candidate = `${parts[0]}-01-01`;
    } else if (parts.length === 2 && /^\d{4}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1])) {
      candidate = `${parts[0]}-${parts[1].padStart(2, "0")}-01`;
    } else if (parts.length >= 3 && /^\d{4}$/.test(parts[0])) {
      const m = parts[1].padStart(2, "0");
      const d = parts[2].slice(0, 2).padStart(2, "0");
      candidate = `${parts[0]}-${m}-${d}`;
    }
  }

  // Fallback sang trường year/month/day rời của GBIF nếu eventDate trống/lỗi
  if (!candidate && gbifRecord.year && Number.isInteger(Number(gbifRecord.year))) {
    const y = String(gbifRecord.year);
    const m = gbifRecord.month ? String(gbifRecord.month).padStart(2, "0") : "01";
    const d = gbifRecord.day ? String(gbifRecord.day).padStart(2, "0") : "01";
    candidate = `${y}-${m}-${d}`;
  }

  if (!candidate) return null;

  const dt = new Date(`${candidate}T00:00:00Z`);
  if (isNaN(dt.getTime())) return null;

  const year = dt.getUTCFullYear();
  // Bảng specimens chỉ có partition từ năm 1800 đến 2050
  if (year < 1800 || year > 2050) return null;

  return dt.toISOString().slice(0, 10);
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
 * Bảng alias: tên tỉnh cũ (trước NQ 202/2025) → tên tỉnh mới trong DB
 * GBIF dùng tên hành chính cũ → cần map sang tên sau sáp nhập
 */
/**
 * Alias: tên tỉnh cũ (GBIF, trước NQ 202/2025) → tên tỉnh mới trong DB
 * DB province_name_vn chính xác: "TP. Hồ Chí Minh", "Huế", "Khánh Hòa"...
 */
const PROVINCE_ALIASES = {
  // TP. Hồ Chí Minh
  "hồ chí minh city":        "tp. hồ chí minh",
  "ho chi minh city":        "ho chi minh city",  // sẽ match EN "Ho Chi Minh City"
  "hcm":                     "tp. hồ chí minh",
  "tp hồ chí minh":          "tp. hồ chí minh",
  "thành phố hồ chí minh":   "tp. hồ chí minh",
  "bình dương":              "tp. hồ chí minh",   // NQ 202: sáp nhập vào HCM
  "binh duong":              "tp. hồ chí minh",
  "bình phước":              "đồng nai",           // NQ 202: → Đồng Nai
  "binh phuoc":              "dong nai",
  // Thừa Thiên Huế → Huế
  "thừa thiên - huế":        "huế",
  "thừa thiên huế":          "huế",
  "thua thien hue":          "hue",
  "thua thien - hue":        "hue",
  "thua thien-hue":          "hue",
  // Quảng Nam → Đà Nẵng (NQ 202)
  "quảng nam":               "đà nẵng",
  "quang nam":               "da nang",
  // Phú Yên → Khánh Hòa (NQ 202)
  "phú yên":                 "khánh hòa",
  "phu yen":                 "khanh hoa",
  // Bến Tre, Tiền Giang → Đồng Tháp (NQ 202)
  "bến tre":                 "đồng tháp",
  "ben tre":                 "dong thap",
  "tiền giang":              "đồng tháp",
  "tien giang":              "dong thap",
  // Long An → Tây Ninh (NQ 202)
  "long an":                 "tây ninh",
  // Vĩnh Phúc → Phú Thọ (NQ 202)
  "vĩnh phúc":               "phú thọ",
  "vinh phuc":               "phu tho",
  // Hòa Bình → Hà Nội (NQ 202)
  "hòa bình":                "hà nội",
  "hoa binh":                "ha noi",
  // Hà Giang, Lào Cai → Lào Cai (NQ 202 giữ Lào Cai)
  "hà giang":                "lào cai",
  "ha giang":                "lao cai",
  // Yên Bái → Tuyên Quang (NQ 202)
  "yên bái":                 "tuyên quang",
  "yen bai":                 "tuyen quang",
  // Bắc Giang → Bắc Ninh (NQ 202)
  "bắc giang":               "bắc ninh",
  "bac giang":               "bac ninh",
  // Hải Dương → Hưng Yên (NQ 202)
  "hải dương":               "hưng yên",
  "hai duong":               "hung yen",
  // Thái Bình → Hà Tĩnh... (giữ nguyên)
  // Ninh Thuận → Khánh Hòa (NQ 202)
  "ninh thuận":              "khánh hòa",
  "ninh thuan":              "khanh hoa",
  // Bình Thuận → Khánh Hòa (NQ 202)
  "bình thuận":              "khánh hòa",
  "binh thuan":              "khanh hoa",
  // Kon Tum → Gia Lai (NQ 202)
  "kon tum":                 "gia lai",
  // Trà Vinh → Vĩnh Long (NQ 202)
  "trà vinh":                "vĩnh long",
  "tra vinh":                "vinh long",
  // Kiên Giang → An Giang (NQ 202)
  "kiên giang":              "an giang",
  "kien giang":              "an giang",
  // Bạc Liêu → Cà Mau (NQ 202)
  "bạc liêu":                "cà mau",
  "bac lieu":                "ca mau",
};

/**
 * Fuzzy match stateProvince → province_id
 * Thứ tự: alias → exact VN → exact EN → substring VN → substring EN
 */
function matchProvince(stateProvince) {
  if (!stateProvince || !provinceCache) return null;
  const q = stateProvince.toLowerCase().trim();

  // 0. Alias lookup (tên cũ → tên mới)
  const aliased = PROVINCE_ALIASES[q] || q;

  // 1. Exact match VN (dùng aliased)
  let found = provinceCache.find((p) => p.vn === aliased);
  if (found) return found.id;

  // 2. Exact match EN
  found = provinceCache.find((p) => p.en === aliased);
  if (found) return found.id;

  // 3. Exact match VN (original q, trường hợp alias không cần)
  found = provinceCache.find((p) => p.vn === q);
  if (found) return found.id;

  // 4. Exact match EN
  found = provinceCache.find((p) => p.en === q);
  if (found) return found.id;

  // 5. Substring match VN
  found = provinceCache.find(
    (p) => q.includes(p.vn) || p.vn.includes(q)
  );
  if (found) return found.id;

  // 6. Substring match EN
  found = provinceCache.find(
    (p) => q.includes(p.en) || p.en.includes(q)
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
// Ngưỡng an toàn dưới mốc 10.000 của Elasticsearch bên GBIF (tránh deep-paging treo >30s)
const GBIF_SAFE_WINDOW = 9000;
// Số dataset tối đa per sub-slice (dùng để gom dataset nhỏ, không chia lẻ)
const MAX_DATASETS_PER_SUBSLICE = 20;

async function fetchPage(taxonKey, offset, limit, extraParams = {}) {
  const params = {
    taxonKey,
    country: "VN",
    limit,
    offset,
    hasCoordinate: true,       // chỉ lấy record có tọa độ
    hasGeospatialIssue: false, // loại bỏ record tọa độ sai
    ...extraParams,
  };

  const { data } = await axios.get(GBIF_BASE, {
    params,
    timeout: 25_000,
    signal: AbortSignal.timeout(25_000), // Hard wall-clock deadline chống treo TCP 6 phút
    httpsAgent,
    headers: { "User-Agent": "VietInsect-GBIF-Pipeline/1.2 (vietinsect.vast.vn)" },
  });

  return {
    results: data.results || [],
    endOfRecords: data.endOfRecords,
    count: data.count,
  };
}

/**
 * Lấy dataset facet để chia nhỏ 1 lát (extraParams) theo datasetKey
 * Dùng khi lát đó vẫn > GBIF_SAFE_WINDOW sau khi chia theo year/basisOfRecord.
 * Trả về mảng sub-slices, mỗi sub-slice < GBIF_SAFE_WINDOW records.
 * Các dataset nhỏ được gom chung vào sub-slice "others" để giảm số lượng requests.
 */
async function buildSubSlicesByDataset(taxonKey, extraParams, parentLabel) {
  let dsData;
  try {
    const res = await axios.get(GBIF_BASE, {
      params: {
        taxonKey,
        country: "VN",
        hasCoordinate: true,
        hasGeospatialIssue: false,
        ...extraParams,
        facet: "DATASET_KEY",
        facetLimit: 1000,
        limit: 0,
      },
      timeout: 20_000,
      signal: AbortSignal.timeout(20_000),
      httpsAgent,
      headers: { "User-Agent": "VietInsect-GBIF-Pipeline/1.2 (vietinsect.vast.vn)" },
    });
    dsData = res.data;
  } catch (err) {
    log(`⚠️  Không lấy được DATASET_KEY facet cho lát "${parentLabel}" (${err.message}). Giữ lát gốc.`);
    return null; // caller sẽ giữ lát gốc
  }

  const dsFacet = (dsData.facets || []).find((f) => f.field === "DATASET_KEY");
  const dsCounts = (dsFacet?.counts || [])
    .map((c) => ({ key: c.name, count: Number(c.count) }))
    .sort((a, b) => b.count - a.count);

  if (dsCounts.length === 0) return null;

  const subSlices = [];
  let othersKeys = [];
  let othersSum = 0;

  for (const { key, count } of dsCounts) {
    if (count > GBIF_SAFE_WINDOW) {
      // Dataset đơn vẫn > 9.000 — chia thêm theo MONTH để hạn chế offset
      // GBIF không hỗ trợ month facet trực tiếp nhưng month=1..12 thì được
      // Dùng 2 half-years (month=1,2,3,4,5,6 và month=7,8,9,10,11,12)
      for (const [halfLabel, months] of [
        ["H1", "1,2,3,4,5,6"],
        ["H2", "7,8,9,10,11,12"],
      ]) {
        subSlices.push({
          label: `${parentLabel} ds=${key.slice(0, 8)} ${halfLabel}`,
          extraParams: { ...extraParams, datasetKey: key, month: months },
          expectedCount: Math.ceil(count / 2),
        });
      }
      continue;
    }

    // Dataset vừa phải — gom vào "others" batch
    if (othersSum + count <= GBIF_SAFE_WINDOW && othersKeys.length < MAX_DATASETS_PER_SUBSLICE) {
      othersKeys.push(key);
      othersSum += count;
    } else {
      if (othersKeys.length > 0) {
        subSlices.push({
          label: `${parentLabel} ds=[${othersKeys.length}datasets]`,
          extraParams: { ...extraParams, datasetKey: othersKeys },
          expectedCount: othersSum,
        });
      }
      othersKeys = [key];
      othersSum = count;
    }
  }

  if (othersKeys.length > 0) {
    subSlices.push({
      label: `${parentLabel} ds=[${othersKeys.length}datasets]`,
      extraParams: { ...extraParams, datasetKey: othersKeys },
      expectedCount: othersSum,
    });
  }

  return subSlices.length > 0 ? subSlices : null;
}

/**
 * Chia nhỏ truy vấn theo khoảng năm, và sub-slice theo datasetKey nếu lát vẫn > GBIF_SAFE_WINDOW
 * Lý do: GBIF Elasticsearch bị nghẽn nặng (30s–360s/trang) ngay khi offset >= 10.000.
 * Khi mỗi lát cắt <= 9.000 records, offset luôn < 10.000 và mỗi trang trả về trong ~0.8s!
 */
async function buildSlicesForOrder(taxonKey) {
  const { data } = await axios.get(GBIF_BASE, {
    params: {
      taxonKey,
      country: "VN",
      hasCoordinate: true,
      hasGeospatialIssue: false,
      facet: "YEAR",
      facetLimit: 300,
      limit: 0,
    },
    timeout: 20_000,
    signal: AbortSignal.timeout(20_000),
    httpsAgent,
    headers: { "User-Agent": "VietInsect-GBIF-Pipeline/1.2 (vietinsect.vast.vn)" },
  });

  const totalCount = data.count || 0;
  if (totalCount <= GBIF_SAFE_WINDOW) {
    return {
      totalCount,
      slices: [{ label: "all", extraParams: {}, expectedCount: totalCount }],
    };
  }

  const facet = (data.facets || []).find((f) => f.field === "YEAR");
  const yearCounts = (facet?.counts || [])
    .map((c) => ({ year: Number(c.name), count: Number(c.count) }))
    .filter((x) => Number.isInteger(x.year) && x.year >= 1800 && x.year <= 2050)
    .sort((a, b) => a.year - b.year);

  // Xây dựng các year-slices ban đầu (gom các năm nhỏ, tách các năm lớn)
  const yearSlices = [];
  let curStart = null;
  let curEnd = null;
  let curSum = 0;

  for (const { year, count } of yearCounts) {
    if (count > GBIF_SAFE_WINDOW) {
      if (curStart !== null) {
        const yParam = curStart === curEnd ? `${curStart}` : `${curStart},${curEnd}`;
        yearSlices.push({ label: `year=${yParam}`, extraParams: { year: yParam }, expectedCount: curSum });
        curStart = null; curEnd = null; curSum = 0;
      }
      // Năm quá lớn: tách theo basisOfRecord (HUMAN_OBS vs phần còn lại)
      yearSlices.push({
        label: `year=${year} (HUMAN_OBS)`,
        extraParams: { year: `${year}`, basisOfRecord: "HUMAN_OBSERVATION" },
        expectedCount: count,
      });
      yearSlices.push({
        label: `year=${year} (SPECIMENS)`,
        extraParams: {
          year: `${year}`,
          basisOfRecord: [
            "PRESERVED_SPECIMEN",
            "MATERIAL_SAMPLE",
            "MACHINE_OBSERVATION",
            "OBSERVATION",
            "OCCURRENCE",
            "LIVING_SPECIMEN",
          ],
        },
        expectedCount: count,
      });
      continue;
    }

    if (curStart === null) {
      curStart = year;
      curEnd = year;
      curSum = count;
    } else if (curSum + count <= GBIF_SAFE_WINDOW) {
      curEnd = year;
      curSum += count;
    } else {
      const yParam = curStart === curEnd ? `${curStart}` : `${curStart},${curEnd}`;
      yearSlices.push({ label: `year=${yParam}`, extraParams: { year: yParam }, expectedCount: curSum });
      curStart = year;
      curEnd = year;
      curSum = count;
    }
  }

  if (curStart !== null) {
    const yParam = curStart === curEnd ? `${curStart}` : `${curStart},${curEnd}`;
    yearSlices.push({ label: `year=${yParam}`, extraParams: { year: yParam }, expectedCount: curSum });
  }

  // ── Sub-slice các lát vẫn > GBIF_SAFE_WINDOW theo datasetKey ────────────
  const finalSlices = [];
  for (const slice of yearSlices) {
    if (slice.expectedCount <= GBIF_SAFE_WINDOW) {
      finalSlices.push(slice);
      continue;
    }

    log(`   🔍 Lát "${slice.label}" có ~${slice.expectedCount.toLocaleString()} records > ${GBIF_SAFE_WINDOW} → chia theo dataset...`);
    const subSlices = await buildSubSlicesByDataset(taxonKey, slice.extraParams, slice.label);
    if (subSlices && subSlices.length > 0) {
      log(`      → Chia thành ${subSlices.length} sub-lát theo dataset`);
      finalSlices.push(...subSlices);
    } else {
      // Fallback: giữ lát gốc (sẽ gặp vấn đề deep-paging nhưng không bỏ sót dữ liệu)
      log(`      → Giữ lát gốc (có thể bị timeout ở page 35+)`);
      finalSlices.push(slice);
    }
  }

  return { totalCount, slices: finalSlices };
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
    // Tên khoa học để relink xuống species-level sau COL sync
    scientificName,
    species,          // "Genus species" không có authorship
    speciesKey,       // GBIF taxonKey ở mức species
  } = gbifRecord;

  // ── Validation bắt buộc ──────────────────────────────────────────────────

  // 0. Loại bỏ tài liệu tham khảo thuần túy / trích dẫn bài báo / hóa thạch (không phải mẫu thực địa)
  if (
    basisOfRecord === "LITERATURE" ||
    basisOfRecord === "FOSSIL_SPECIMEN" ||
    basisOfRecord === "MATERIAL_CITATION"
  ) {
    return { skip: "literature" };
  }

  // 1. Phải có occurrenceID (dùng gbifID làm fallback)
  const occId = occurrenceID || (gbifID ? `gbif:${gbifID}` : null);
  if (!occId) return { skip: "no_occurrence_id" };

  // 2. Phải match được taxon
  const taxon_id = getTaxonId(orderName);
  if (!taxon_id) return { skip: "no_taxon" };

  // 3. Phải có ngày thu mẫu hợp lệ (hỗ trợ cả khoảng ngày "1999-04-28/1999-05-12" & year fallback)
  const collectionDate = parseEventDate(eventDate, gbifRecord);
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
  // gbif_scientific_name: ưu tiên 'species' (binomial không authorship), fallback scientificName
  const gbifSciName = (species || gbifRecord.genus || scientificName || "").trim().slice(0, 300) || null;
  const gbifTaxonKey = speciesKey || gbifRecord.acceptedTaxonKey || gbifRecord.taxonKey || null;

  const specimenBase = {
    taxon_id,
    province_id: province_id || null,
    collection_date: collectionDate,
    // collection_point: PostGIS geography – dùng raw
    individual_count: gbifRecord.individualCount || 1,
    sex: normalizeSex(gbifRecord.sex),
    is_public: true,
    gbif_scientific_name: gbifSciName,
    gbif_taxon_key: gbifTaxonKey,
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
        // ON CONFLICT DO NOTHING → record đã tồn tại; backfill các cột mới nếu đang NULL
        if (specimenBase.gbif_scientific_name || specimenBase.gbif_taxon_key || specimenBase.province_id) {
          await trx.raw(
            `
            UPDATE specimens s
            SET gbif_scientific_name = COALESCE(s.gbif_scientific_name, ?),
                gbif_taxon_key       = COALESCE(s.gbif_taxon_key, ?),
                province_id          = COALESCE(s.province_id, ?),
                updated_at           = now()
            FROM specimen_registry sr
            WHERE s.specimen_id = sr.specimen_id
              AND sr.gbif_occurrence_id = ?
              AND (s.gbif_scientific_name IS NULL OR s.gbif_taxon_key IS NULL OR (s.province_id IS NULL AND ?::smallint IS NOT NULL))
            `,
            [
              specimenBase.gbif_scientific_name,
              specimenBase.gbif_taxon_key,
              specimenBase.province_id,
              registry.gbif_occurrence_id,
              specimenBase.province_id,
            ]
          );
        }
        stats.skipped_duplicate++;
        continue;
      }

      const specimenId = rows[0].specimen_id;

      // 2. Insert specimens (partitioned by collection_date, PK = (specimen_id, collection_date))
      //    collection_point: dùng ST_MakePoint nếu có tọa độ
      if (lat != null && lon != null) {
        await trx.raw(
          `
          INSERT INTO specimens
            (specimen_id, taxon_id, province_id, collection_date,
             collection_point, individual_count, sex, is_public,
             gbif_scientific_name, gbif_taxon_key,
             created_at, updated_at, entry_date)
          VALUES (?, ?, ?, ?,
                  ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
                  ?, ?, ?,
                  ?, ?,
                  now(), now(), now())
          ON CONFLICT (specimen_id, collection_date) DO UPDATE SET
            gbif_scientific_name = COALESCE(specimens.gbif_scientific_name, EXCLUDED.gbif_scientific_name),
            gbif_taxon_key       = COALESCE(specimens.gbif_taxon_key, EXCLUDED.gbif_taxon_key),
            updated_at           = now()
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
            specimenBase.gbif_scientific_name,
            specimenBase.gbif_taxon_key,
          ]
        );
      } else {
        await trx.raw(
          `
          INSERT INTO specimens
            (specimen_id, taxon_id, province_id, collection_date,
             individual_count, sex, is_public,
             gbif_scientific_name, gbif_taxon_key,
             created_at, updated_at, entry_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now(), now(), now())
          ON CONFLICT (specimen_id, collection_date) DO UPDATE SET
            gbif_scientific_name = COALESCE(specimens.gbif_scientific_name, EXCLUDED.gbif_scientific_name),
            gbif_taxon_key       = COALESCE(specimens.gbif_taxon_key, EXCLUDED.gbif_taxon_key),
            updated_at           = now()
          `,
          [
            specimenId,
            specimenBase.taxon_id,
            specimenBase.province_id,
            specimenBase.collection_date,
            specimenBase.individual_count,
            specimenBase.sex,
            specimenBase.is_public,
            specimenBase.gbif_scientific_name,
            specimenBase.gbif_taxon_key,
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

async function importOrder({ order, taxonKey }, initialOffset = 0) {
  log(`\n${"═".repeat(60)}`);
  log(`🦋 Bắt đầu import Order: ${order} (taxonKey=${taxonKey})`);
  log(`${"═".repeat(60)}`);

  let slicePlan;
  try {
    slicePlan = await buildSlicesForOrder(taxonKey);
  } catch (err) {
    log(`⚠️  Không lấy được YEAR facet cho ${order} (${err.message}), chạy 1 lát mặc định.`);
    slicePlan = { totalCount: 0, slices: [{ label: "all", extraParams: {}, expectedCount: 0 }] };
  }

  log(`📊 Tổng GBIF records cho ${order} tại VN: ${slicePlan.totalCount.toLocaleString()} → chia thành ${slicePlan.slices.length} lát (<${GBIF_SAFE_WINDOW}/lát)`);

  let totalForOrder = 0;

  for (let sIdx = 0; sIdx < slicePlan.slices.length; sIdx++) {
    const slice = slicePlan.slices[sIdx];
    let offset = sIdx === 0 ? initialOffset : 0;
    let pageNum = Math.floor(offset / PAGE_LIMIT);

    if (slicePlan.slices.length > 1) {
      log(`\n   🔹 Lát [${sIdx + 1}/${slicePlan.slices.length}] (${slice.label}, ~${slice.expectedCount.toLocaleString()} records)`);
    }

    while (true) {
      pageNum++;

      if (offset >= GBIF_MAX_OFFSET) {
        log(`⚠️  Đạt giới hạn offset=${offset} ở lát ${slice.label}. Chuyển lát tiếp theo.`);
        break;
      }

      const limit = Math.min(PAGE_LIMIT, GBIF_MAX_OFFSET - offset);
      log(`📡 [${slice.label}] Page ${pageNum}: offset=${offset}, limit=${limit}...`);

      let pageData = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          pageData = await fetchPage(taxonKey, offset, limit, slice.extraParams);
          break;
        } catch (err) {
          log(`⚠️  Lỗi fetch GBIF lần ${attempt}/3 (${order} ${slice.label} offset=${offset}): ${err.message}`);
          if (attempt === 3) {
            log(`❌ Thất bại cả 3 lần tại offset=${offset} – chuyển trang tiếp theo.`);
            stats.errors++;
          } else {
            await sleep(2000 * attempt);
          }
        }
      }

      if (!pageData) {
        offset += limit;
        continue;
      }

      const { results, endOfRecords } = pageData;
      stats.fetched += results.length;
      log(`   Nhận ${results.length} records (endOfRecords=${endOfRecords})`);

      // ── Transform ────────────────────────────────────────────────────────
      const toInsert = [];
      const pageSkips = { no_taxon: 0, no_date: 0, bbox: 0, literature: 0 };

      for (const gbifRec of results) {
        const result = transformRecord(gbifRec);
        if (!result || result.skip) {
          if (result?.skip === "no_taxon") { stats.skipped_no_taxon++; pageSkips.no_taxon++; }
          else if (result?.skip === "no_date") { stats.skipped_no_date++; pageSkips.no_date++; }
          else if (result?.skip === "bbox") { stats.skipped_bbox++; pageSkips.bbox++; }
          else if (result?.skip === "literature") { stats.skipped_literature++; pageSkips.literature++; }
          continue;
        }
        toInsert.push(result);
      }

      // ── Insert batch ─────────────────────────────────────────────────────
      if (toInsert.length > 0) {
        try {
          const beforeIns = stats.inserted;
          const beforeDup = stats.skipped_duplicate;
          await insertBatch(toInsert);
          const newAdded = stats.inserted - beforeIns;
          const dupSkipped = stats.skipped_duplicate - beforeDup;
          totalForOrder += newAdded;
          log(
            `   ✅ Mới: +${newAdded}, đã có (backfill): ${dupSkipped} (order new total: ${totalForOrder})`
          );
        } catch (err) {
          log(`   ❌ Lỗi insert batch: ${err.message}`);
          stats.errors += toInsert.length;
        }
      } else {
        log(
          `   ⏭️  Không có record hợp lệ (no_date=${pageSkips.no_date}, bbox=${pageSkips.bbox}, lit=${pageSkips.literature}, no_taxon=${pageSkips.no_taxon})`
        );
      }

      if (endOfRecords || results.length === 0) {
        break;
      }

      offset += results.length;
      await sleep(GBIF_RATE_LIMIT_MS);
    }
  }

  log(`✅ Hoàn tất ${order}: +${totalForOrder} records mới được import.`);
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
  } else if (START_ORDER) {
    const startIdx = INSECTA_ORDERS.findIndex(
      (o) => o.order.toLowerCase() === START_ORDER.toLowerCase()
    );
    if (startIdx === -1) {
      log(`❌ Không tìm thấy --start-order "${START_ORDER}"`);
      process.exit(1);
    }
    ordersToImport = INSECTA_ORDERS.slice(startIdx);
    log(`⏩ Bắt đầu từ Order: ${ordersToImport[0].order} (còn ${ordersToImport.length} orders)`);
  }

  const startTime = Date.now();

  // ── Import từng order tuần tự ────────────────────────────────────────────
  for (let i = 0; i < ordersToImport.length; i++) {
    const initialOffset = i === 0 ? START_OFFSET : 0;
    await importOrder(ordersToImport[i], initialOffset);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  log(`\n${"═".repeat(60)}`);
  log("📊 KẾT QUẢ IMPORT");
  log(`${"═".repeat(60)}`);
  log(`   Tổng records GBIF đã fetch   : ${stats.fetched.toLocaleString()}`);
  log(`   Đã insert mới vào DB         : ${stats.inserted.toLocaleString()}`);
  log(`   Đã có / backfill metadata    : ${stats.skipped_duplicate.toLocaleString()}`);
  log(`   Bỏ qua (không khớp taxon)   : ${stats.skipped_no_taxon.toLocaleString()}`);
  log(`   Bỏ qua (không có ngày)       : ${stats.skipped_no_date.toLocaleString()}`);
  log(`   Bỏ qua (ngoài bbox VN)       : ${stats.skipped_bbox.toLocaleString()}`);
  log(`   Bỏ qua (tài liệu/hóa thạch)  : ${stats.skipped_literature.toLocaleString()}`);
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
