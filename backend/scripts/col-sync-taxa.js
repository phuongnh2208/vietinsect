#!/usr/bin/env node
/**
 * backend/scripts/col-sync-taxa.js  (v2 — VN-focused)
 * ─────────────────────────────────────────────────────────────────────────────
 * Sync cây phân loại vào bảng taxa dùng GBIF Species API (Backbone taxonomy).
 *
 * Phiên bản 2 tối ưu: chỉ sync taxa có occurrence thực tế tại Việt Nam
 * thay vì toàn bộ cây phân loại thế giới (~700 Lepidoptera families).
 *
 * Lý do dùng GBIF thay COL trực tiếp:
 *  - GBIF species/children API hỗ trợ DFS theo taxonKey chuẩn
 *  - COL API không có filter parent hiệu quả qua REST
 *  - GBIF Backbone đồng bộ với COL và ITIS → gbif_taxon_key sẵn có
 *  - Dữ liệu nhất quán với pipeline GBIF occurrence đang chạy
 *
 * Chiến lược: 2-pass per Order
 *   Pass 1: Dùng Occurrence facet → lấy danh sách familyKey có record VN
 *   Pass 2: Với mỗi family VN → fetch Genera → (opt) Species
 *
 * Cách dùng:
 *   node scripts/col-sync-taxa.js                     # sync tất cả 16 orders
 *   node scripts/col-sync-taxa.js --order Odonata     # sync 1 order
 *   node scripts/col-sync-taxa.js --dry-run           # log, không insert DB
 *   node scripts/col-sync-taxa.js --rank family       # dừng ở Family
 *   node scripts/col-sync-taxa.js --rank genus        # dừng ở Genus (default)
 *   node scripts/col-sync-taxa.js --rank species      # sync tới Species (rất chậm)
 *   node scripts/col-sync-taxa.js --max-species 5000  # giới hạn species/order
 *   node scripts/col-sync-taxa.js --no-vn-filter      # sync toàn bộ (global)
 *
 * SRS §6.5: Knex cho tất cả DB operations
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

require("dotenv").config();
const https = require("https");
const axios = require("axios");
const knex  = require("../src/config/knex");

// Tắt keepAlive + ép IPv4 tránh kẹt socket trên Windows / Node 24
const httpsAgent = new https.Agent({ keepAlive: false, family: 4 });

// ─── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN     = args.includes("--dry-run");
const ORDER_FILTER = (() => { const i = args.indexOf("--order");        return i !== -1 ? args[i+1] : null; })();
const START_ORDER  = (() => { const i = args.indexOf("--start-order");  return i !== -1 ? args[i+1] : null; })();
const STOP_RANK    = (() => { const i = args.indexOf("--rank");         return i !== -1 ? args[i+1].toLowerCase() : "genus"; })();
const MAX_SPECIES  = (() => { const i = args.indexOf("--max-species");  return i !== -1 ? parseInt(args[i+1],10) : 50000; })();
const NO_VN_FILTER = args.includes("--no-vn-filter"); // sync toàn cầu (chậm)

// ─── Rank order ─────────────────────────────────────────────────────────────
const RANKS = ["order","family","genus","species"];

// ─── GBIF API config ────────────────────────────────────────────────────────
const GBIF_SPECIES_BASE   = "https://api.gbif.org/v1/species";
const GBIF_OCC_BASE       = "https://api.gbif.org/v1/occurrence/search";
const GBIF_RATE           = 100; // ms between requests (10 req/s, GBIF public limit)
const GBIF_LIMIT          = 1000; // max per page cho species children API
const FACET_LIMIT         = 1000; // max families per order từ facet

// ─── 16 Orders Insecta với GBIF taxonKey (đã verify) ───────────────────────
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
  { order: "Phasmida",      taxonKey: 1460 },
];

// ─── Slug function (đồng bộ taxonomy.service.js) ───────────────────────────
function slugify(name) {
  return name.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── Stats ──────────────────────────────────────────────────────────────────
const stats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Cache: gbifTaxonKey → taxon_id DB ─────────────────────────────────────
let gbifKeyCache = {};

async function loadGbifKeyCache() {
  const rows = await knex("taxa").select("taxon_id","gbif_taxon_key").whereNotNull("gbif_taxon_key");
  for (const r of rows) {
    gbifKeyCache[String(r.gbif_taxon_key)] = r.taxon_id;
  }
  log(`📋 GBIF key cache: ${Object.keys(gbifKeyCache).length} taxa đã có gbif_taxon_key`);
}

async function gbifGet(url, params = {}, timeoutMs = 20000) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data } = await axios.get(url, {
        params,
        timeout: timeoutMs,
        signal: AbortSignal.timeout(timeoutMs),
        httpsAgent,
        headers: { "User-Agent": "VietInsect-Taxa-Sync/2.1 (vietinsect.vast.vn)" },
      });
      return data;
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(1000 * attempt);
    }
  }
}

// ─── Pass 1: Lấy familyKeys có occurrence tại VN (từ occurrence facet) ─────

async function getVnFamilyKeys(taxonKey) {
  if (NO_VN_FILTER) return null; // null = lấy tất cả

  try {
    const data = await gbifGet(GBIF_OCC_BASE, {
      taxonKey,
      country: "VN",
      facet: "FAMILY_KEY",
      facetLimit: FACET_LIMIT,
      limit: 0,
    });

    const facet = (data.facets || []).find(f => f.field === "FAMILY_KEY");
    if (!facet || !facet.counts) return new Set();

    const keys = new Set(facet.counts.map(c => Number(c.name)));
    log(`   🗺  Families có record VN: ${keys.size}`);
    return keys;
  } catch (err) {
    log(`⚠️  Không lấy được VN facet, fallback lấy tất cả: ${err.message}`);
    return null; // fallback: lấy tất cả
  }
}

// ─── Lấy metadata 1 taxon theo key ─────────────────────────────────────────

async function fetchTaxonByKey(taxonKey) {
  try {
    await sleep(GBIF_RATE);
    return await gbifGet(`${GBIF_SPECIES_BASE}/${taxonKey}`, {}, 15000);
  } catch (err) {
    log(`⚠️  Lỗi fetch taxon ${taxonKey}: ${err.message}`);
    return null;
  }
}

// ─── GBIF Species API: lấy genera của 1 family (chỉ rank GENUS) ─────────────
// Dùng /children của family → chỉ trả về GENUS (đã verified)

async function fetchGeneraForFamily(familyKey, maxItems = 10000) {
  const results = [];
  let offset = 0;

  while (results.length < maxItems) {
    try {
      await sleep(GBIF_RATE);
      const data = await gbifGet(`${GBIF_SPECIES_BASE}/${familyKey}/children`, {
        limit: GBIF_LIMIT,
        offset,
      });

      const accepted = (data.results || []).filter(r =>
        r.rank === "GENUS" &&
        (r.taxonomicStatus === "ACCEPTED" || r.taxonomicStatus === "DOUBTFUL")
      );
      results.push(...accepted);

      if (data.endOfRecords) break;
      offset += data.results.length;
      if (data.results.length === 0) break;
    } catch (err) {
      log(`⚠️  Lỗi fetch genera family ${familyKey}: ${err.message}`);
      break;
    }
  }

  return results;
}

// ─── GBIF Species API: lấy species của 1 genus ──────────────────────────────

async function fetchSpeciesForGenus(genusKey, maxItems = 1000) {
  const results = [];
  let offset = 0;

  while (results.length < maxItems) {
    try {
      await sleep(GBIF_RATE);
      const data = await gbifGet(`${GBIF_SPECIES_BASE}/${genusKey}/children`, {
        limit: GBIF_LIMIT,
        offset,
      });

      const accepted = (data.results || []).filter(r =>
        r.rank === "SPECIES" &&
        (r.taxonomicStatus === "ACCEPTED" || r.taxonomicStatus === "DOUBTFUL")
      );
      results.push(...accepted);

      if (data.endOfRecords) break;
      offset += data.results.length;
      if (data.results.length === 0) break;
    } catch (err) {
      log(`⚠️  Lỗi fetch species genus ${genusKey}: ${err.message}`);
      break;
    }
  }

  return results;
}

// ─── DB upsert ──────────────────────────────────────────────────────────────

function capitalizeFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

async function upsertTaxon(gbifRecord, parentDbId) {
  const gbifKey  = String(gbifRecord.key);
  const sciName  = gbifRecord.canonicalName || gbifRecord.scientificName;
  const rank     = (gbifRecord.rank || "").toLowerCase();
  const authorship = gbifRecord.authorship || gbifRecord.scientificNameAuthorship || null;
  const year       = gbifRecord.publishedIn
    ? parseInt((gbifRecord.publishedIn.match(/\b(1[6-9]\d{2}|20\d{2})\b/) || [])[1], 10) || null
    : null;

  if (!sciName) { stats.skipped++; return null; }

  // Đã có trong cache → trả về DB id ngay (tránh hàng nghìn lệnh UPDATE thừa khi chạy lại)
  if (gbifKeyCache[gbifKey]) {
    stats.updated++;
    return gbifKeyCache[gbifKey];
  }

  // Insert mới
  if (DRY_RUN) {
    stats.inserted++;
    const fakeId = -(Object.keys(gbifKeyCache).length + 1);
    gbifKeyCache[gbifKey] = fakeId;
    return fakeId;
  }

  // Sinh slug unique
  let slug = slugify(sciName);
  const slugExists = await knex("taxa").where("slug", slug).first();
  if (slugExists) slug = `${slug}-${gbifKey}`;

  try {
    const [row] = await knex("taxa").insert({
      parent_id:                  parentDbId,
      taxon_rank:                 capitalizeFirst(rank),
      scientific_name:            sciName,
      slug,
      scientific_name_authorship: authorship,
      year_described:             year,
      taxonomic_status:           "accepted",
      nomenclatural_code:         "ICZN",
      gbif_taxon_key:             gbifKey,
      is_verified:                true,
      created_at:                 new Date(),
      updated_at:                 new Date(),
    }).returning("taxon_id");

    const newId = row.taxon_id ?? row;
    gbifKeyCache[gbifKey] = newId;
    stats.inserted++;
    return newId;
  } catch (err) {
    log(`❌ Insert lỗi [${sciName}]: ${err.message.slice(0,100)}`);
    stats.errors++;
    return null;
  }
}

// ─── DFS sync cho 1 Order ───────────────────────────────────────────────────

async function syncOrder({ order, taxonKey }) {
  const stopIdx = RANKS.indexOf(STOP_RANK);

  log(`\n${"═".repeat(60)}`);
  log(`🦋 Sync Order: ${order} (taxonKey=${taxonKey})`);
  log(`${"═".repeat(60)}`);

  // Tìm taxon_id Order trong DB (đã seed)
  const orderRow = await knex("taxa")
    .where("taxon_rank", "Order")
    .whereRaw("LOWER(scientific_name) = ?", [order.toLowerCase()])
    .first();

  if (!orderRow) {
    log(`❌ Không tìm thấy Order "${order}" trong DB. Seed 002_seed_taxa.js trước.`);
    return;
  }
  const orderDbId = orderRow.taxon_id;
  if (!gbifKeyCache[String(taxonKey)]) gbifKeyCache[String(taxonKey)] = orderDbId;
  log(`   DB taxon_id: ${orderDbId}`);

  let familyCount  = 0;
  let genusCount   = 0;
  let speciesCount = 0;

  // ── Lấy familyKeys có occurrence VN ──────────────────────────────────────
  const vnFamilyKeys = await getVnFamilyKeys(taxonKey);
  await sleep(GBIF_RATE);

  // ── Xác định danh sách families cần sync ─────────────────────────────────
  let familyKeys;

  if (vnFamilyKeys && vnFamilyKeys.size > 0) {
    // Dùng VN facet keys trực tiếp — không cần fetch toàn bộ children
    familyKeys = [...vnFamilyKeys];
    log(`   📂 Syncing ${familyKeys.length} Families từ VN occurrence facet`);
  } else if (vnFamilyKeys && vnFamilyKeys.size === 0) {
    log(`   ⚠️  Không có occurrence VN cho order này. Bỏ qua.`);
    return;
  } else {
    // NO_VN_FILTER hoặc facet thất bại → fetch toàn bộ từ children (global)
    log(`   📂 Fetching Families từ GBIF Backbone (global)...`);
    const { data } = await axios.get(`${GBIF_SPECIES_BASE}`, {
      params: {
        orderKey: taxonKey,
        rank: "FAMILY",
        datasetKey: "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c",
        status: "ACCEPTED",
        limit: GBIF_LIMIT,
        offset: 0,
      },
      timeout: 20000,
      headers: { "User-Agent": "VietInsect-Taxa-Sync/2.0 (vietinsect.vast.vn)" },
    });
    // Paginate nếu cần
    let allFamilies = data.results || [];
    let offset = data.results.length;
    while (!data.endOfRecords && allFamilies.length < 5000) {
      await sleep(GBIF_RATE);
      const { data: d2 } = await axios.get(GBIF_SPECIES_BASE, {
        params: { orderKey: taxonKey, rank: "FAMILY", datasetKey: "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c", status: "ACCEPTED", limit: GBIF_LIMIT, offset },
        timeout: 20000, headers: { "User-Agent": "VietInsect-Taxa-Sync/2.0 (vietinsect.vast.vn)" },
      });
      allFamilies.push(...(d2.results || []));
      if (d2.endOfRecords || d2.results.length === 0) break;
      offset += d2.results.length;
    }
    familyKeys = allFamilies.map(f => f.key);
    log(`   → ${familyKeys.length} Families`);
  }

  // ── Sync mỗi family ───────────────────────────────────────────────────────
  for (let fi = 0; fi < familyKeys.length; fi++) {
    const famKey = familyKeys[fi];

    // Lấy metadata family
    const famData = await fetchTaxonByKey(famKey);
    if (!famData) continue;

    // Chỉ lấy FAMILY rank
    if (famData.rank !== "FAMILY") continue;

    const famDbId = await upsertTaxon(famData, orderDbId);
    if (famDbId) familyCount++;

    if (stopIdx <= RANKS.indexOf("family")) {
      log(`   [${fi+1}/${familyKeys.length}] Family: ${famData.canonicalName || "?"}`);
      continue;
    }

    // ── Genera ────────────────────────────────────────────────────────────
    const genera = await fetchGeneraForFamily(famKey);
    log(`   [${fi+1}/${familyKeys.length}] ${famData.canonicalName || "?"}: ${genera.length} genera | total genera=${genusCount}`);

    for (const gen of genera) {
      const genDbId = await upsertTaxon(gen, famDbId);
      if (genDbId) genusCount++;
      if (stopIdx <= RANKS.indexOf("genus")) continue; // dừng ở Genus
      if (speciesCount >= MAX_SPECIES) break;

      // ── Species ───────────────────────────────────────────────────────
      const sppList = await fetchSpeciesForGenus(gen.key, MAX_SPECIES - speciesCount);
      for (const sp of sppList) {
        const spDbId = await upsertTaxon(sp, genDbId);
        if (spDbId) speciesCount++;
        if (speciesCount >= MAX_SPECIES) break;
      }
      if (speciesCount >= MAX_SPECIES) {
        log(`   ⚠️  Đạt giới hạn --max-species ${MAX_SPECIES}. Dừng.`);
        break;
      }
    }
    if (speciesCount >= MAX_SPECIES) break;
  }

  log(`✅ ${order} xong:`);
  log(`   Families: ${familyCount} | Genera: ${genusCount} | Species: ${speciesCount}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log("🚀 VietInsect Taxa Sync v2 (GBIF Backbone, VN-focused)");
  log(`   Mode: ${DRY_RUN ? "🔵 DRY-RUN" : "🔴 PRODUCTION"}`);
  log(`   Dừng ở rank: ${STOP_RANK} | Max species/order: ${MAX_SPECIES.toLocaleString()}`);
  log(`   VN filter: ${NO_VN_FILTER ? "TẮT (sync toàn cầu)" : "BẬT (chỉ taxa có occurrence VN)"}`);
  if (ORDER_FILTER) log(`   Filter: chỉ sync Order = ${ORDER_FILTER}`);
  log("");

  if (!DRY_RUN) {
    await knex.raw("SELECT 1");
    log("✅ DB connected");
  }

  await loadGbifKeyCache();

  let ordersToSync = INSECTA_ORDERS;
  if (ORDER_FILTER) {
    ordersToSync = INSECTA_ORDERS.filter(o => o.order.toLowerCase() === ORDER_FILTER.toLowerCase());
    if (!ordersToSync.length) {
      log(`❌ Không tìm thấy order "${ORDER_FILTER}". Hợp lệ: ${INSECTA_ORDERS.map(o=>o.order).join(", ")}`);
      process.exit(1);
    }
  } else if (START_ORDER) {
    const idx = INSECTA_ORDERS.findIndex(o => o.order.toLowerCase() === START_ORDER.toLowerCase());
    if (idx === -1) {
      log(`❌ Không tìm thấy --start-order "${START_ORDER}"`);
      process.exit(1);
    }
    ordersToSync = INSECTA_ORDERS.slice(idx);
    log(`⏩ Bắt đầu sync từ Order: ${ordersToSync[0].order} (còn ${ordersToSync.length} orders)`);
  }

  const startTime = Date.now();

  for (const orderConfig of ordersToSync) {
    try {
      await syncOrder(orderConfig);
    } catch (err) {
      log(`❌ Lỗi sync ${orderConfig.order}: ${err.message}`);
      stats.errors++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  log(`\n${"═".repeat(60)}`);
  log("📊 KẾT QUẢ SYNC TAXA");
  log(`${"═".repeat(60)}`);
  log(`   Inserted (mới)    : ${stats.inserted.toLocaleString()}`);
  log(`   Updated (đã có)   : ${stats.updated.toLocaleString()}`);
  log(`   Skipped           : ${stats.skipped.toLocaleString()}`);
  log(`   Errors            : ${stats.errors.toLocaleString()}`);
  log(`   Thời gian         : ${elapsed} phút`);
  if (DRY_RUN) log("   [DRY-RUN] Không có gì được ghi vào DB.");
  log(`${"═".repeat(60)}\n`);

  if (!DRY_RUN) await knex.destroy();
}

main().catch(err => {
  console.error("💥", err.message);
  knex.destroy().finally(() => process.exit(1));
});
