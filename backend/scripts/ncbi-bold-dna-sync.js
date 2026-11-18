#!/usr/bin/env node
/**
 * backend/scripts/ncbi-bold-dna-sync.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pipeline đồng bộ chuỗi mã vạch DNA côn trùng Việt Nam từ hệ thống liên thông
 * quốc tế INSDC (NCBI GenBank / ENA Search + DDBJ Asia-Pacific Flatfile Mirror)
 * & BOLD Systems cross-references:
 *   - Truy vấn 8 Bộ côn trùng lớn tại Việt Nam (country="Viet Nam")
 *   - Tải GenBank Flatfile đầy đủ (ORIGIN FASTA, AUTHORS, PCR_primers, ORGANISM lineage)
 *     tốc độ cao (~0.8s / 20 trình tự từ cụm máy chủ INSDC Nhật Bản)
 *   - Tính tỷ lệ G-C (%), khớp tự động taxon_id và specimen_id tại Việt Nam
 *
 * SRS §6.5: 100% dùng Knex query builder
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

require("dotenv").config();
const axios = require("axios");
const knex = require("../src/config/knex");
const { fetchGenBankBatch } = require("../src/modules/dna/ncbi.service");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const MAX_RECORDS = (() => {
  const i = args.indexOf("--max");
  return i !== -1 ? parseInt(args[i + 1], 10) : 240;
})();
const ORDER_FILTER = (() => {
  const i = args.indexOf("--order");
  return i !== -1 ? args[i + 1] : null;
})();

const INSECTA_NCBI_ORDERS = [
  { order: "Lepidoptera", ncbiTaxId: 7088 },
  { order: "Coleoptera",  ncbiTaxId: 7041 },
  { order: "Hymenoptera", ncbiTaxId: 7399 },
  { order: "Diptera",     ncbiTaxId: 7147 },
  { order: "Odonata",     ncbiTaxId: 7969 },
  { order: "Hemiptera",   ncbiTaxId: 7524 },
  { order: "Orthoptera",  ncbiTaxId: 6993 },
  { order: "Mantodea",    ncbiTaxId: 7504 },
];

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function computeGcPercent(seq) {
  if (!seq) return null;
  const clean = seq.toUpperCase().replace(/[^ATGC]/g, "");
  if (!clean.length) return null;
  let gc = 0;
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === "G" || clean[i] === "C") gc++;
  }
  return Number(((gc / clean.length) * 100).toFixed(2));
}

const taxaByName = new Map();
const specimenBySpecies = new Map();

async function loadCaches() {
  log("📋 Đang nạp cache Taxa & Specimens Việt Nam...");
  const taxaRows = await knex("taxa").select("taxon_id", "scientific_name", "taxon_rank");
  const rankPriority = { Species: 4, Subspecies: 4, Genus: 3, Family: 2, Order: 1 };

  for (const r of taxaRows) {
    const key = r.scientific_name.trim().toLowerCase();
    const existing = taxaByName.get(key);
    if (!existing || (rankPriority[r.taxon_rank] || 0) > (rankPriority[existing.rank] || 0)) {
      taxaByName.set(key, { id: Number(r.taxon_id), rank: r.taxon_rank });
    }
  }

  const specRows = await knex("specimens")
    .whereNotNull("gbif_scientific_name")
    .whereNull("deleted_at")
    .select("gbif_scientific_name")
    .min("specimen_id as specimen_id")
    .groupBy("gbif_scientific_name");

  for (const s of specRows) {
    const binomial = s.gbif_scientific_name.trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase();
    if (binomial && !specimenBySpecies.has(binomial)) {
      specimenBySpecies.set(binomial, Number(s.specimen_id));
    }
  }

  log(`   → Đã nạp ${taxaByName.size.toLocaleString()} Taxon và ${specimenBySpecies.size.toLocaleString()} loài Mẫu vật.`);
}

function resolveTaxonId(scientificName, lineage = [], fallbackOrder = null) {
  if (scientificName) {
    const clean = scientificName.trim();
    if (taxaByName.has(clean.toLowerCase())) return taxaByName.get(clean.toLowerCase()).id;

    const words = clean.split(/\s+/);
    if (words.length >= 2) {
      const bin = `${words[0]} ${words[1]}`.toLowerCase();
      if (taxaByName.has(bin)) return taxaByName.get(bin).id;
    }
    const genus = words[0].toLowerCase().replace(/[^a-z]/g, "");
    if (genus && taxaByName.has(genus)) return taxaByName.get(genus).id;
  }

  for (let i = lineage.length - 1; i >= 0; i--) {
    const t = String(lineage[i] || "").trim().toLowerCase();
    if (taxaByName.has(t)) return taxaByName.get(t).id;
  }

  if (fallbackOrder && taxaByName.has(fallbackOrder.toLowerCase())) {
    return taxaByName.get(fallbackOrder.toLowerCase()).id;
  }
  return null;
}

function resolveSpecimenId(scientificName) {
  if (!scientificName) return null;
  const binomial = scientificName.trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase();
  return specimenBySpecies.get(binomial) || null;
}

async function upsertDnaRecord(rec) {
  let existing = await knex("dna_sequences")
    .where("genbank_accession", rec.genbankAccession)
    .first();

  if (!existing && rec.boldProcessId) {
    existing = await knex("dna_sequences")
      .where("bold_process_id", rec.boldProcessId)
      .first();
  }

  const payload = {
    specimen_id: rec.specimenId || null,
    taxon_id: rec.taxonId,
    genbank_accession: rec.genbankAccession,
    bold_process_id: rec.boldProcessId || null,
    bin_uri: rec.binUri || null,
    gene_marker: rec.geneMarker,
    sequence_length_bp: rec.sequenceLengthBp,
    fasta_sequence: rec.fastaSequence,
    gc_content_pct: computeGcPercent(rec.fastaSequence),
    primers_info: rec.primersInfo || null,
    submission_date: rec.submissionDate || null,
    author_name: rec.authorName || null,
    scientific_name_verbatim: rec.scientificNameVerbatim || null,
    source_db: rec.sourceDb,
    notes: rec.notes ? String(rec.notes).slice(0, 1000) : null,
    is_public: true,
    is_orphaned: !rec.specimenId,
    updated_at: knex.fn.now(),
  };

  if (existing) {
    await knex("dna_sequences").where("dna_id", existing.dna_id).update(payload);
    return "updated";
  }

  await knex("dna_sequences").insert(payload);
  return "inserted";
}

async function main() {
  log("🧬 VietInsect DNA Barcode Sync Pipeline (INSDC GenBank + BOLD Cross-Ref)");
  log(`   Mode: ${DRY_RUN ? "DRY-RUN" : "PRODUCTION"} | Target Max: ${MAX_RECORDS}`);

  await loadCaches();

  const orders = ORDER_FILTER
    ? INSECTA_NCBI_ORDERS.filter((o) => o.order.toLowerCase() === ORDER_FILTER.toLowerCase())
    : INSECTA_NCBI_ORDERS;

  const perOrder = Math.max(20, Math.ceil(MAX_RECORDS / orders.length));
  let inserted = 0;
  let updated = 0;
  let linkedCount = 0;

  for (const { order, ncbiTaxId } of orders) {
    if (inserted + updated >= MAX_RECORDS) break;

    log(`\n🔬 [${order}] Truy vấn GenBank/INSDC cho côn trùng tại Việt Nam (tối đa ${perOrder})...`);
    let metaList = [];
    try {
      const { data } = await axios.get("https://www.ebi.ac.uk/ena/portal/api/search", {
        params: {
          result: "sequence",
          query: `tax_tree(${ncbiTaxId}) AND country="Viet Nam" AND base_count>=300 AND base_count<=2200`,
          fields: "accession,scientific_name",
          format: "json",
          limit: perOrder,
        },
        timeout: 20000,
        signal: AbortSignal.timeout(20000),
      });
      metaList = Array.isArray(data) ? data : [];
    } catch (err) {
      log(`   ⚠️ Lỗi truy vấn danh sách cho ${order}: ${err.message}`);
      continue;
    }

    if (metaList.length === 0) {
      log(`   ⏭️ Không có bản ghi phù hợp cho ${order}`);
      continue;
    }

    const accessions = metaList.map((m) => m.accession).filter(Boolean);
    log(`   📡 Nhận ${accessions.length} mã Accession → tải GenBank Flatfile tốc độ cao...`);

    for (let i = 0; i < accessions.length; i += 20) {
      const chunkIds = accessions.slice(i, i + 20);
      let entries = [];
      try {
        entries = await fetchGenBankBatch(chunkIds);
      } catch (err) {
        log(`   ⚠️ Lỗi tải batch DDBJ (${order}): ${err.message}`);
        continue;
      }

      for (const entry of entries) {
        if (!entry.fastaSequence || entry.fastaSequence.length < 150) continue;

        const taxonId = resolveTaxonId(entry.scientificNameVerbatim, entry.lineage, order);
        if (!taxonId) continue;

        const specimenId = resolveSpecimenId(entry.scientificNameVerbatim);
        if (specimenId) linkedCount++;

        if (DRY_RUN) {
          inserted++;
          continue;
        }

        const res = await upsertDnaRecord({
          ...entry,
          taxonId,
          specimenId,
        });
        if (res === "inserted") inserted++;
        else if (res === "updated") updated++;
      }

      await sleep(250);
    }

    log(`   ✅ [${order}] Xong · Tổng lũy kế: +${inserted} mới, ${updated} cập nhật (${linkedCount} khớp mẫu vật VN)`);
  }

  const [{ cnt }] = await knex("dna_sequences").count("* as cnt");
  log(`\n${"═".repeat(62)}`);
  log(`🎉 HOÀN TẤT ĐỒNG BỘ DNA: +${inserted} chuỗi mới, ${updated} cập nhật`);
  log(`🔗 Liên kết tự động với mẫu vật GBIF Việt Nam: ${linkedCount} chuỗi`);
  log(`📊 Tổng số chuỗi FASTA trong bảng dna_sequences: ${Number(cnt).toLocaleString()}`);
  log(`${"═".repeat(62)}`);

  await knex.destroy();
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  knex.destroy().finally(() => process.exit(1));
});
