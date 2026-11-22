#!/usr/bin/env node
/**
 * backend/scripts/gbif-import-v2.js
 * Step 2 Controlled GBIF Importer:
 * - Uses gbifTransform.js (Darwin Core 22 fields, lowest-rank taxon_id, Admin-safe upsert, license policy)
 * - Saves raw GBIF JSON into MongoDB collection `gbif_raw` (_id = gbifID)
 * - Enqueues es_sync_outbox & writes audit_logs
 * - Exports newly created gbif_occurrence_id list to --new-occ-out for rollback_step2.js
 * - Stops immediately on error (no mass retry)
 */

"use strict";

require("dotenv").config();
const fs = require("fs");
const https = require("https");
const axios = require("axios");
let MongoClient = null;
try { ({ MongoClient } = require("mongodb")); } catch (_) { /* optional */ }
const knex = require("../src/config/knex");
const { transformGbifRecord, upsertGbifRecord } = require("./lib/gbifTransform");

const httpsAgent = new https.Agent({ keepAlive: false, family: 4 });

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ORDER_NAME = (() => { const i = args.indexOf("--order"); return i !== -1 ? args[i + 1] : "Blattodea"; })();
const MAX_LIMIT = (() => { const i = args.indexOf("--limit"); return i !== -1 ? parseInt(args[i + 1], 10) : 1000; })();
const NEW_OCC_OUT = (() => { const i = args.indexOf("--new-occ-out"); return i !== -1 ? args[i + 1] : null; })();
const REVIEW_CSV_OUT = (() => { const i = args.indexOf("--review-out"); return i !== -1 ? args[i + 1] : null; })();
const ROLLBACK_JSON_OUT = (() => { const i = args.indexOf("--rollback-out"); return i !== -1 ? args[i + 1] : null; })();

const ORDER_KEYS = {
  coleoptera: 1470, lepidoptera: 797, hymenoptera: 1457, diptera: 811,
  hemiptera: 809, orthoptera: 1458, odonata: 789, blattodea: 800,
  mantodea: 788, neuroptera: 1501, trichoptera: 1003, ephemeroptera: 1225,
  plecoptera: 787, thysanoptera: 1228, dermaptera: 1224, phasmida: 1460,
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function loadTaxaLookup() {
  const rows = await knex("taxa").select(
    "taxon_id", "parent_id", "accepted_taxon_id", "scientific_name",
    "taxon_rank", "gbif_taxon_key", "taxonomic_status"
  );
  const byId = new Map();
  for (const r of rows) byId.set(Number(r.taxon_id), r);

  const getRootOrder = (id) => {
    let cur = byId.get(Number(id));
    let g = 0;
    while (cur && g < 12) {
      if (cur.taxon_rank === "Order") return cur.scientific_name.trim().toLowerCase();
      cur = cur.parent_id ? byId.get(Number(cur.parent_id)) : null;
      g++;
    }
    return null;
  };

  const byName = new Map();
  const byGbifKey = new Map();
  const orderByName = new Map();

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
  const list = rows.map((r) => ({
    id: r.province_id,
    en: r.province_name_en.toLowerCase(),
    vn: r.province_name_vn.toLowerCase(),
  }));
  return (stateProvince) => {
    if (!stateProvince) return null;
    const s = String(stateProvince).toLowerCase().trim();
    for (const p of list) {
      if (s === p.vn || s === p.en || s.includes(p.en) || p.en.includes(s)) return p.id;
    }
    return null;
  };
}

async function main() {
  const taxonKey = ORDER_KEYS[ORDER_NAME.toLowerCase()];
  if (!taxonKey) throw new Error(`Unknown order: ${ORDER_NAME}`);

  console.log(`🚀 GBIF Import v2 | Order=${ORDER_NAME} (key=${taxonKey}) | Limit=${MAX_LIMIT} | Mode=${DRY_RUN ? "DRY-RUN" : "PRODUCTION"}`);

  const taxaLookup = await loadTaxaLookup();
  const matchProvince = await loadProvinceMatcher();

  // Existing occurrence IDs in DB for dry-run classification
  const existingRows = await knex("specimen_registry").whereNotNull("gbif_occurrence_id").select("gbif_occurrence_id");
  const existingOccSet = new Set(existingRows.map((r) => String(r.gbif_occurrence_id)));

  // Fetch up to MAX_LIMIT records from GBIF
  const allRaw = [];
  let offset = 0;
  while (allRaw.length < MAX_LIMIT) {
    const pageLimit = Math.min(300, MAX_LIMIT - allRaw.length);
    const { data } = await axios.get("https://api.gbif.org/v1/occurrence/search", {
      params: { taxonKey, country: "VN", hasCoordinate: true, limit: pageLimit, offset },
      httpsAgent,
      timeout: 20000,
      headers: { "User-Agent": "VietInsect-GBIF-Importer/2.0 (vietinsect.vast.vn)" },
    });
    const results = data.results || [];
    allRaw.push(...results);
    if (data.endOfRecords || results.length === 0) break;
    offset += results.length;
    await sleep(400);
  }

  console.log(`📡 Fetched ${allRaw.length} raw records from GBIF for ${ORDER_NAME}`);

  const stats = { fetched: allRaw.length, inserted: 0, updated: 0, skipped: 0, byLicense: {}, byPublic: { true: 0, false: 0 } };
  const newOccIds = [];
  const transformed = [];

  for (const raw of allRaw) {
    const rec = transformGbifRecord(raw, { taxaLookup, matchProvince });
    if (!rec || rec.skip) {
      stats.skipped++;
      continue;
    }
    transformed.push(rec);
    const lic = rec.normalizedLicense;
    stats.byLicense[lic] = (stats.byLicense[lic] || 0) + 1;
    stats.byPublic[String(rec.specimenBase.is_public)]++;
    if (DRY_RUN) {
      if (existingOccSet.has(rec.occId)) stats.updated++;
      else stats.inserted++;
    }
  }

  if (!DRY_RUN) {
    // Connect MongoDB for gbif_raw (C-10)
    let mongoClient = null;
    let mongoCol = null;
    const mongoUrl = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/vietinsect";
    if (MongoClient) {
      try {
        mongoClient = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 5000 });
        await mongoClient.connect();
        mongoCol = mongoClient.db().collection("gbif_raw");
      } catch (e) {
        console.log("⚠️ MongoDB gbif_raw unavailable, continuing PG upsert:", e.message);
        mongoClient = null;
        mongoCol = null;
      }
    }

    const touchedIds = [];
    const reviewNeeded = [];
    const rollbackLog = [];

    for (let i = 0; i < transformed.length; i += 100) {
      const chunk = transformed.slice(i, i + 100);
      await knex.transaction(async (trx) => {
        for (const rec of chunk) {
          // Check existing record for review CSV & rollback snapshot
          const prev = await trx("specimen_registry as sr")
            .join("specimens as s", "s.specimen_id", "sr.specimen_id")
            .where("sr.gbif_occurrence_id", rec.occId)
            .select("sr.specimen_id", "sr.license", "sr.identified_by", "s.is_public", "s.locality_detail")
            .first();

          const res = await upsertGbifRecord(trx, rec);
          if (res.action === "inserted") {
            stats.inserted++;
            newOccIds.push(rec.occId);
          } else {
            stats.updated++;
            if (prev) {
              rollbackLog.push({
                specimen_id: Number(prev.specimen_id),
                gbif_occurrence_id: rec.occId,
                old_license: prev.license,
                old_identified_by: prev.identified_by,
                old_locality_detail: prev.locality_detail,
              });
              const lic = rec.normalizedLicense;
              if (prev.is_public && (lic === "UNKNOWN" || lic.includes("ND"))) {
                reviewNeeded.push({
                  specimen_id: Number(prev.specimen_id),
                  gbif_occurrence_id: rec.occId,
                  dataset: rec.registry.dataset_name || rec.registry.gbif_dataset_key || "",
                  license: rec.registry.license || "UNKNOWN",
                  is_public: true,
                });
              }
            }
          }
          touchedIds.push(res.specimenId);
        }
        await trx("es_sync_outbox").insert(
          chunk.map((_, idx) => ({
            entity_type: "specimen",
            entity_id: touchedIds[touchedIds.length - chunk.length + idx],
            op: "upsert",
            priority: 1,
            status: "pending",
          }))
        );
      });

      if (mongoCol) {
        const ops = chunk
          .filter((r) => r.gbifID)
          .map((r) => ({
            updateOne: {
              filter: { _id: r.gbifID },
              update: { $set: { ...r.rawRecord, _syncedAt: new Date() } },
              upsert: true,
            },
          }));
        if (ops.length > 0) await mongoCol.bulkWrite(ops, { ordered: false });
      }
    }

    await knex("audit_logs").insert({
      action_type: "GBIF_IMPORT_STEP2",
      target_table: "specimens",
      details: JSON.stringify({ order: ORDER_NAME, ...stats }),
    });

    if (NEW_OCC_OUT && newOccIds.length > 0) {
      fs.writeFileSync(NEW_OCC_OUT, newOccIds.join("\n") + "\n", "utf8");
      console.log(`📝 Wrote ${newOccIds.length} new gbif_occurrence_id(s) to ${NEW_OCC_OUT}`);
    }
    if (REVIEW_CSV_OUT && reviewNeeded.length > 0) {
      const lines = ["specimen_id,gbif_occurrence_id,dataset,license,is_public"];
      for (const r of reviewNeeded) {
        lines.push(`${r.specimen_id},"${r.gbif_occurrence_id}","${String(r.dataset).replace(/"/g, '""')}","${r.license}",${r.is_public}`);
      }
      fs.writeFileSync(REVIEW_CSV_OUT, lines.join("\n") + "\n", "utf8");
      console.log(`⚠️ Wrote ${reviewNeeded.length} license review rows to ${REVIEW_CSV_OUT}`);
    }
    if (ROLLBACK_JSON_OUT && rollbackLog.length > 0) {
      fs.writeFileSync(ROLLBACK_JSON_OUT, JSON.stringify(rollbackLog, null, 2), "utf8");
      console.log(`📝 Wrote ${rollbackLog.length} rollback entries to ${ROLLBACK_JSON_OUT}`);
    }
    stats.licenseReviewNeeded = reviewNeeded.length;

    if (mongoClient) await mongoClient.close();
  }

  console.log("📊 SUMMARY:", JSON.stringify(stats, null, 2));
  await knex.destroy();
}

main().catch((err) => {
  console.error("💥 STOPPED ON ERROR (no mass retry):", err.message);
  knex.destroy().finally(() => process.exit(1));
});
