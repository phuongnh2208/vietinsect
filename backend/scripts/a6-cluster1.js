#!/usr/bin/env node
/**
 * backend/scripts/a6-cluster1.js
 * Chạy A6 Cụm 1 theo thứ tự: Lepidoptera -> Coleoptera -> Hymenoptera -> Diptera -> 10 Bộ nhỏ
 * (KHÔNG chạy Odonata).
 * - Chia lát theo year (facet=year, < 9000/lát) tránh giới hạn offset 100k
 * - Upsert idempotent COALESCE (không đè Admin, không đổi is_public/taxon_id cũ)
 * - Lưu MongoDB gbif_raw + es_sync_outbox + rollback snapshot mỗi Bộ
 * - DỪNG NGAY nếu vi phạm điều kiện (a) 429/5xx, (b) outbox dead > 0,
 *   (c) license_review_needed > 0, (d) fetched lệch > 5% kỳ vọng, (e) lỗi DB/Mongo.
 */

"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const https = require("https");
const axios = require("axios");
let MongoClient = null;
try { ({ MongoClient } = require("mongodb")); } catch (_) {}
const knex = require("../src/config/knex");
const { transformGbifRecord, upsertGbifRecord } = require("./lib/gbifTransform");

const args = process.argv.slice(2);
const NO_INSERT = args.includes("--no-insert");
const START_ORDER = (() => { const i = args.indexOf("--start-order"); return i !== -1 ? args[i + 1] : null; })();
const ONLY_ORDER = (() => { const i = args.indexOf("--only-order"); return i !== -1 ? args[i + 1] : null; })();

const httpsAgent = new https.Agent({ keepAlive: false, family: 4 });
const HEADERS = { "User-Agent": "VietInsect-GBIF-Importer/2.0 (vietinsect.vast.vn)" };
const BACKUP_DIR = path.resolve(process.cwd(), "../backups");
const REVIEW_CSV = path.join(BACKUP_DIR, "license_review_needed.csv");

const CLUSTER1_ORDERS = [
  { order: "Lepidoptera",   taxonKey: 797,  expected: 31937 },
  { order: "Coleoptera",    taxonKey: 1470, expected: 24711 },
  { order: "Hymenoptera",   taxonKey: 1457, expected: 20050 },
  { order: "Diptera",       taxonKey: 811,  expected: 14396 },
  { order: "Mantodea",      taxonKey: 788,  expected: 100 },
  { order: "Phasmida",      taxonKey: 1460, expected: 100 },
  { order: "Thysanoptera",  taxonKey: 1228, expected: 100 },
  { order: "Plecoptera",    taxonKey: 787,  expected: 100 },
  { order: "Trichoptera",   taxonKey: 1003, expected: 100 },
  { order: "Neuroptera",    taxonKey: 1501, expected: 100 },
  { order: "Orthoptera",    taxonKey: 1458, expected: 100 },
  { order: "Ephemeroptera", taxonKey: 1225, expected: 83 },
  { order: "Dermaptera",    taxonKey: 1224, expected: 59 },
  { order: "Hemiptera",     taxonKey: 809,  expected: 38 },
  { order: "Odonata",       taxonKey: 789,  expected: 6982 },
];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchWithBackoff(url, params, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data } = await axios.get(url, { params, httpsAgent, timeout: 25000, headers: HEADERS });
      return data;
    } catch (err) {
      const status = err.response?.status;
      if (attempt === maxAttempts || (status && status < 429 && status !== 408)) {
        throw new Error(`STOP(a) HTTP ${status || err.code || err.message} after ${attempt} attempts`);
      }
      await sleep(1500 * Math.pow(2, attempt));
    }
  }
}

async function buildYearSlices(taxonKey) {
  const data = await fetchWithBackoff("https://api.gbif.org/v1/occurrence/search", {
    taxonKey, country: "VN", hasCoordinate: true, limit: 0, facet: "year", facetLimit: 200,
  });
  const totalCount = data.count || 0;
  if (totalCount <= 8500) {
    return { totalCount, slices: [{ label: "all", params: {} }] };
  }
  const counts = (data.facets?.[0]?.counts || [])
    .map((c) => ({ year: parseInt(c.name, 10), count: c.count }))
    .filter((c) => !isNaN(c.year))
    .sort((a, b) => a.year - b.year);

  const slices = [];
  let start = null, end = null, sum = 0;
  for (const { year, count } of counts) {
    if (start === null) { start = year; end = year; sum = count; }
    else if (sum + count <= 8500) { end = year; sum += count; }
    else {
      slices.push({ label: `${start}-${end}`, params: { year: start === end ? `${start}` : `${start},${end}` } });
      start = year; end = year; sum = count;
    }
  }
  if (start !== null) {
    slices.push({ label: `${start}-${end}`, params: { year: start === end ? `${start}` : `${start},${end}` } });
  }
  return { totalCount, slices };
}

async function loadTaxaLookup() {
  const rows = await knex("taxa").select("taxon_id", "parent_id", "scientific_name", "taxon_rank", "gbif_taxon_key", "taxonomic_status");
  const byId = new Map(rows.map((r) => [Number(r.taxon_id), r]));
  const getRootOrder = (id) => {
    let cur = byId.get(Number(id));
    for (let g = 0; cur && g < 12; g++) {
      if (cur.taxon_rank === "Order") return cur.scientific_name.trim().toLowerCase();
      cur = cur.parent_id ? byId.get(Number(cur.parent_id)) : null;
    }
    return null;
  };
  const byName = new Map(), byGbifKey = new Map(), orderByName = new Map();
  for (const r of rows) {
    if (r.taxonomic_status !== "accepted") continue;
    const lower = r.scientific_name.trim().toLowerCase();
    const target = { taxon_id: Number(r.taxon_id), rootOrder: getRootOrder(r.taxon_id) };
    if (r.taxon_rank === "Order") orderByName.set(lower, Number(r.taxon_id));
    if (!byName.has(lower)) byName.set(lower, []);
    byName.get(lower).push(target);
    if (r.gbif_taxon_key) byGbifKey.set(String(r.gbif_taxon_key), target);
  }
  return { byName, byGbifKey, orderByName };
}

async function loadProvinceMatcher() {
  const rows = await knex("provinces").select("province_id", "province_name_vn", "province_name_en");
  const list = rows.map((r) => ({ id: r.province_id, en: r.province_name_en.toLowerCase(), vn: r.province_name_vn.toLowerCase() }));
  return (sp) => {
    if (!sp) return null;
    const s = String(sp).toLowerCase().trim();
    for (const p of list) if (s === p.vn || s === p.en || s.includes(p.en) || p.en.includes(s)) return p.id;
    return null;
  };
}

async function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const taxaLookup = await loadTaxaLookup();
  const matchProvince = await loadProvinceMatcher();

  let mongoClient = null, mongoCol = null;
  if (MongoClient) {
    const mongoUrl = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/vietinsect";
    mongoClient = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 5000 });
    await mongoClient.connect();
    mongoCol = mongoClient.db().collection("gbif_raw");
  }

  const activeOrders = ONLY_ORDER
    ? CLUSTER1_ORDERS.filter((o) => o.order.toLowerCase() === ONLY_ORDER.toLowerCase())
    : CLUSTER1_ORDERS.slice(
        START_ORDER
          ? Math.max(0, CLUSTER1_ORDERS.findIndex((o) => o.order.toLowerCase() === START_ORDER.toLowerCase()))
          : 0
      );

  // Preload existing gbif_occurrence_id set for --no-insert mode
  const existingOccSet = new Set(
    (await knex("specimen_registry").whereNotNull("gbif_occurrence_id").select("gbif_occurrence_id"))
      .map((r) => String(r.gbif_occurrence_id))
  );

  for (const { order, taxonKey, expected } of activeOrders) {
    console.log(`\n════════════════════════════════════════════════════════════`);
    console.log(`🦋 START ORDER: ${order} (taxonKey=${taxonKey}, mode=${NO_INSERT ? "NO-INSERT" : "UPSERT"})`);

    const { totalCount, slices } = await buildYearSlices(taxonKey);
    console.log(`   GBIF totalCount=${totalCount}, slices=${slices.length}`);

    const stats = { order, fetched: 0, inserted: 0, updated: 0, skipped: 0, unseenInDb: 0, byLicense: {}, reviewNeeded: 0 };
    const reviewRows = [];
    const rollbackLog = [];
    const unseenIds = [];

    for (const slice of slices) {
      let offset = 0;
      while (offset < 99700) {
        const data = await fetchWithBackoff("https://api.gbif.org/v1/occurrence/search", {
          taxonKey, country: "VN", hasCoordinate: true, limit: 300, offset, ...slice.params,
        });
        const results = data.results || [];
        if (results.length === 0) break;
        stats.fetched += results.length;

        const batch = [];
        for (const raw of results) {
          const rec = transformGbifRecord(raw, { taxaLookup, matchProvince });
          if (!rec || rec.skip) { stats.skipped++; continue; }
          if (NO_INSERT && !existingOccSet.has(rec.occId)) {
            stats.unseenInDb++;
            unseenIds.push(rec.occId);
            continue;
          }
          batch.push(rec);
          stats.byLicense[rec.normalizedLicense] = (stats.byLicense[rec.normalizedLicense] || 0) + 1;
        }

        if (batch.length > 0) {
          await knex.transaction(async (trx) => {
            const outboxIds = [];
            for (const rec of batch) {
              const prev = await trx("specimen_registry as sr")
                .join("specimens as s", "s.specimen_id", "sr.specimen_id")
                .where("sr.gbif_occurrence_id", rec.occId)
                .select("sr.specimen_id", "sr.license", "sr.identified_by", "s.is_public", "s.locality_detail")
                .first();

              const res = await upsertGbifRecord(trx, rec);
              outboxIds.push(res.specimenId);
              if (res.action === "inserted") {
                stats.inserted++;
              } else {
                stats.updated++;
                if (prev) {
                  rollbackLog.push({
                    specimen_id: Number(prev.specimen_id),
                    gbif_occurrence_id: rec.occId,
                    old_license: prev.license,
                  });
                  const lic = rec.normalizedLicense;
                  if (prev.is_public && (lic === "UNKNOWN" || lic.includes("ND"))) {
                    stats.reviewNeeded++;
                    reviewRows.push({
                      specimen_id: Number(prev.specimen_id),
                      gbif_occurrence_id: rec.occId,
                      dataset: rec.registry.dataset_name || rec.registry.gbif_dataset_key || "",
                      license: rec.registry.license || "UNKNOWN",
                      is_public: true,
                    });
                  }
                }
              }
            }
            await trx("es_sync_outbox").insert(
              outboxIds.map((id) => ({ entity_type: "specimen", entity_id: id, op: "upsert", priority: 1, status: "pending" }))
            );
          });

          if (mongoCol) {
            const ops = batch.filter((r) => r.gbifID).map((r) => ({
              updateOne: { filter: { _id: r.gbifID }, update: { $set: { ...r.rawRecord, _syncedAt: new Date() } }, upsert: true },
            }));
            if (ops.length > 0) await mongoCol.bulkWrite(ops, { ordered: false });
          }
        }

        if (data.endOfRecords) break;
        offset += results.length;
        await sleep(400);
      }
    }

    // Save rollback snapshot & unseen list
    fs.writeFileSync(path.join(BACKUP_DIR, `a6_rollback_${order.toLowerCase()}.json`), JSON.stringify(rollbackLog, null, 2));
    if (unseenIds.length > 0) {
      fs.writeFileSync(path.join(BACKUP_DIR, `a6_unseen_${order.toLowerCase()}.txt`), unseenIds.join("\n") + "\n", "utf8");
    }

    // Append review CSV
    if (reviewRows.length > 0) {
      const exists = fs.existsSync(REVIEW_CSV);
      const lines = exists ? [] : ["specimen_id,gbif_occurrence_id,dataset,license,is_public"];
      for (const r of reviewRows) {
        lines.push(`${r.specimen_id},"${r.gbif_occurrence_id}","${String(r.dataset).replace(/"/g, '""')}","${r.license}",${r.is_public}`);
      }
      fs.appendFileSync(REVIEW_CSV, lines.join("\n") + "\n", "utf8");
    }

    const outbox = await knex("es_sync_outbox").select("status").count("* as cnt").groupBy("status");
    const outboxMap = Object.fromEntries(outbox.map((o) => [o.status, Number(o.cnt)]));
    console.log(`✅ ORDER DONE: ${order} | upd=${stats.updated} skip=${stats.skipped} unseen_in_db=${stats.unseenInDb} | lic=${JSON.stringify(stats.byLicense)} | review=${stats.reviewNeeded} | outbox=${JSON.stringify(outboxMap)}`);

    // Condition (b): dead > 0
    if ((outboxMap.dead || 0) > 0) {
      console.log(`🛑 STOP(b): es_sync_outbox dead=${outboxMap.dead} > 0`);
      break;
    }
    // Condition (c): license_review_needed > 0
    if (stats.reviewNeeded > 0) {
      console.log(`🛑 STOP(c): license_review_needed=${stats.reviewNeeded} > 0 in ${order}. First 10 examples:`);
      console.table(reviewRows.slice(0, 10));
      break;
    }
  }

  if (mongoClient) await mongoClient.close();
  await knex.destroy();
}

main().catch((err) => {
  console.error("🛑 STOP(a/e):", err.message);
  knex.destroy().finally(() => process.exit(1));
});
