#!/usr/bin/env node
/**
 * backend/scripts/backfill-species-taxa.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Trích xuất toàn bộ loài nhị danh (binomial species) có thực từ bảng specimens
 * (và dna_sequences), bổ sung các Giống (Genus) còn thiếu, nạp các bản ghi
 * bậc Loài (taxon_rank = 'Species') vào bảng taxa, gắn parent_id chính xác
 * tới Genus tương ứng.
 *
 * Cách dùng:
 *   node scripts/backfill-species-taxa.js              # chạy thật (production)
 *   node scripts/backfill-species-taxa.js --dry-run    # kiểm tra trước, không ghi DB
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

require("dotenv").config();
const knex = require("../src/config/knex");

const DRY_RUN = process.argv.slice(2).includes("--dry-run");
const BATCH_SIZE = 500;

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

// Tập từ viết tắt không phải tên loài nhị danh thực sự
const EXCLUDED_EPITHETS = new Set([
  "sp",
  "sp.",
  "spp",
  "spp.",
  "cf",
  "cf.",
  "aff",
  "aff.",
  "indet",
  "indet.",
  "nr",
  "nr.",
  "gen",
  "gen.",
  "complex",
  "group",
  "hybrid",
]);

// Bản đồ Họ chuẩn cho các Giống côn trùng Việt Nam chưa có trong đợt sync Genus đầu tiên
const KNOWN_GENUS_FAMILY = {
  moduza: "Nymphalidae",
  telchinia: "Nymphalidae",
  bassarona: "Nymphalidae",
  kaniska: "Nymphalidae",
  sumalia: "Nymphalidae",
  mimathyma: "Nymphalidae",
  parasarpa: "Nymphalidae",
  telinga: "Nymphalidae",
  dophla: "Nymphalidae",
  auzakia: "Nymphalidae",
  tacola: "Nymphalidae",
  godonela: "Geometridae",
  epobeidia: "Geometridae",
  hipoepa: "Erebidae",
  dichromia: "Erebidae",
  neobalbis: "Drepanidae",
  leucodrepana: "Drepanidae",
  cochlischnogaster: "Vespidae",
};

function parseBinomial(rawName) {
  if (!rawName || typeof rawName !== "string") return null;
  const trimmed = rawName.trim();
  const match = trimmed.match(/^([A-Z][a-z]+)\s+([a-z][a-z0-9-]{1,})\b(.*)$/);
  if (!match) return null;

  const genusName = match[1];
  const epithet = match[2];
  const rest = (match[3] || "").trim();

  if (EXCLUDED_EPITHETS.has(epithet.toLowerCase())) return null;

  let authorship = null;
  let yearDescribed = null;
  if (rest) {
    // Bỏ subspecific epithet nếu có để giữ authorship hoặc lấy phần tác giả
    const yearMatch = rest.match(/\b(1[7-9]\d{2}|20\d{2})\b/);
    if (yearMatch) {
      yearDescribed = parseInt(yearMatch[1], 10);
    }
    if (/^[A-Z(]/.test(rest)) {
      authorship = rest.slice(0, 120);
    }
  }

  return {
    binomial: `${genusName} ${epithet}`,
    genusName,
    epithet,
    authorship,
    yearDescribed,
  };
}

async function main() {
  log("🦋 VietInsect Species Taxa Backfill Pipeline");
  log(`   Mode: ${DRY_RUN ? "🔵 DRY-RUN" : "🔴 PRODUCTION"}`);

  await knex.raw("SELECT 1");
  log("✅ Kết nối PostgreSQL thành công");

  // 1. Nạp danh mục taxa hiện có
  const allTaxa = await knex("taxa").select(
    "taxon_id",
    "parent_id",
    "taxon_rank",
    "scientific_name",
    "slug",
    "gbif_taxon_key"
  );

  const existingSlugs = new Set();
  const existingGbifKeys = new Set();
  const familyByName = new Map();
  const genusByName = new Map();
  const speciesByName = new Map();

  for (const t of allTaxa) {
    if (t.slug) existingSlugs.add(t.slug);
    if (t.gbif_taxon_key) existingGbifKeys.add(String(t.gbif_taxon_key));
    const lowerName = t.scientific_name.trim().toLowerCase();
    if (t.taxon_rank === "Family" && !familyByName.has(lowerName)) {
      familyByName.set(lowerName, Number(t.taxon_id));
    } else if (t.taxon_rank === "Genus" && !genusByName.has(lowerName)) {
      genusByName.set(lowerName, Number(t.taxon_id));
    } else if (t.taxon_rank === "Species" && !speciesByName.has(lowerName)) {
      speciesByName.set(lowerName, Number(t.taxon_id));
    }
  }

  log(
    `📋 Taxa hiện có: ${allTaxa.length.toLocaleString()} dòng (Family=${familyByName.size}, Genus=${genusByName.size}, Species=${speciesByName.size})`
  );

  // 2. Quét toàn bộ mẫu vật hoạt động có gbif_scientific_name
  const specimenRows = await knex("specimens as s")
    .join("taxa as t", "s.taxon_id", "t.taxon_id")
    .whereNull("s.deleted_at")
    .whereNotNull("s.gbif_scientific_name")
    .select(
      "s.gbif_scientific_name",
      "s.gbif_taxon_key",
      "s.common_name_vn",
      "s.common_name_en",
      "s.taxon_id",
      "t.scientific_name as current_taxon_name",
      "t.taxon_rank as current_rank"
    );

  const missingGeneraMap = new Map();
  const candidateSpeciesMap = new Map();

  for (const row of specimenRows) {
    const parsed = parseBinomial(row.gbif_scientific_name);
    if (!parsed) continue;

    const genusLower = parsed.genusName.toLowerCase();
    const speciesLower = parsed.binomial.toLowerCase();

    if (!genusByName.has(genusLower) && !missingGeneraMap.has(genusLower)) {
      const knownFamilyName = KNOWN_GENUS_FAMILY[genusLower];
      const mappedFamilyId = knownFamilyName
        ? familyByName.get(knownFamilyName.toLowerCase())
        : null;

      missingGeneraMap.set(genusLower, {
        genusName: parsed.genusName,
        parentId: mappedFamilyId || Number(row.taxon_id),
      });
    }

    if (!speciesByName.has(speciesLower)) {
      const existingCandidate = candidateSpeciesMap.get(speciesLower);
      if (!existingCandidate) {
        // Nếu mẫu đang gắn trực tiếp vào Genus trùng tên thì ưu tiên lấy đúng taxon_id đó
        const directGenusId =
          row.current_rank === "Genus" &&
          row.current_taxon_name.trim().toLowerCase() === genusLower
            ? Number(row.taxon_id)
            : null;

        candidateSpeciesMap.set(speciesLower, {
          binomial: parsed.binomial,
          genusLower,
          epithet: parsed.epithet,
          authorship: parsed.authorship,
          yearDescribed: parsed.yearDescribed,
          gbifTaxonKey: row.gbif_taxon_key ? String(row.gbif_taxon_key) : null,
          commonNameVn: row.common_name_vn || null,
          commonNameEn: row.common_name_en || null,
          directGenusId,
          fallbackParentId: Number(row.taxon_id),
        });
      } else {
        if (!existingCandidate.authorship && parsed.authorship) {
          existingCandidate.authorship = parsed.authorship;
        }
        if (!existingCandidate.yearDescribed && parsed.yearDescribed) {
          existingCandidate.yearDescribed = parsed.yearDescribed;
        }
        if (!existingCandidate.commonNameVn && row.common_name_vn) {
          existingCandidate.commonNameVn = row.common_name_vn;
        }
        if (!existingCandidate.commonNameEn && row.common_name_en) {
          existingCandidate.commonNameEn = row.common_name_en;
        }
        if (!existingCandidate.gbifTaxonKey && row.gbif_taxon_key) {
          existingCandidate.gbifTaxonKey = String(row.gbif_taxon_key);
        }
      }
    }
  }

  // 3. Bổ sung các Giống (Genus) còn thiếu trước khi chèn Species
  let insertedGenera = 0;
  if (missingGeneraMap.size > 0) {
    log(`🧩 Phát hiện ${missingGeneraMap.size} Giống (Genus) cần bổ sung vào bảng taxa...`);
    for (const [genusLower, gInfo] of missingGeneraMap.entries()) {
      let slug = slugify(gInfo.genusName);
      if (existingSlugs.has(slug)) {
        slug = `${slug}-genus-${Date.now().toString(36)}`;
      }
      existingSlugs.add(slug);

      if (!DRY_RUN) {
        const [inserted] = await knex("taxa")
          .insert({
            parent_id: gInfo.parentId,
            taxon_rank: "Genus",
            scientific_name: gInfo.genusName,
            slug,
            taxonomic_status: "accepted",
            nomenclatural_code: "ICZN",
            is_verified: true,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning("taxon_id");
        const newGenusId = Number(inserted.taxon_id ?? inserted);
        genusByName.set(genusLower, newGenusId);
      } else {
        genusByName.set(genusLower, -1);
      }
      insertedGenera++;
    }
    log(`   ✅ Đã bổ sung ${insertedGenera} Giống (Genus)`);
  }

  // 4. Chuẩn bị danh sách bản ghi Species cần chèn
  const speciesToInsert = [];
  let suffixCounter = 1;

  for (const [, sp] of candidateSpeciesMap.entries()) {
    const parentId =
      sp.directGenusId || genusByName.get(sp.genusLower) || sp.fallbackParentId;

    let slug = slugify(sp.binomial);
    if (existingSlugs.has(slug)) {
      slug = sp.gbifTaxonKey && !existingSlugs.has(`${slug}-${sp.gbifTaxonKey}`)
        ? `${slug}-${sp.gbifTaxonKey}`
        : `${slug}-sp-${suffixCounter++}`;
    }
    existingSlugs.add(slug);

    // Chỉ gán gbif_taxon_key nếu key đó chưa gắn cho bậc Genus/Family
    let gbifKeyToAssign = null;
    if (sp.gbifTaxonKey && !existingGbifKeys.has(sp.gbifTaxonKey)) {
      gbifKeyToAssign = sp.gbifTaxonKey;
      existingGbifKeys.add(sp.gbifTaxonKey);
    }

    speciesToInsert.push({
      parent_id: parentId,
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

  log(`🚀 Số loài nhị danh mới cần nạp vào taxa: ${speciesToInsert.length.toLocaleString()}`);

  let insertedSpecies = 0;
  if (!DRY_RUN && speciesToInsert.length > 0) {
    for (let i = 0; i < speciesToInsert.length; i += BATCH_SIZE) {
      const batch = speciesToInsert.slice(i, i + BATCH_SIZE);
      const returned = await knex("taxa")
        .insert(batch)
        .returning(["taxon_id", "scientific_name"]);

      for (const r of returned) {
        speciesByName.set(r.scientific_name.trim().toLowerCase(), Number(r.taxon_id));
      }
      insertedSpecies += batch.length;
      log(
        `   Tiến độ chèn Species: ${insertedSpecies}/${speciesToInsert.length} (${Math.round(
          (insertedSpecies / speciesToInsert.length) * 100
        )}%)`
      );
    }
  } else {
    insertedSpecies = speciesToInsert.length;
  }

  // 5. Cập nhật taxon_id cho dna_sequences nếu khớp tên loài nhị danh
  let updatedDna = 0;
  if (!DRY_RUN) {
    const dnaRows = await knex("dna_sequences")
      .whereNotNull("scientific_name_verbatim")
      .select("dna_id", "taxon_id", "scientific_name_verbatim");

    for (const d of dnaRows) {
      const parsed = parseBinomial(d.scientific_name_verbatim);
      if (!parsed) continue;
      let spTaxonId = speciesByName.get(parsed.binomial.toLowerCase());
      if (!spTaxonId) {
        const genusId = genusByName.get(parsed.genusName.toLowerCase()) || Number(d.taxon_id);
        let slug = slugify(parsed.binomial);
        if (existingSlugs.has(slug)) slug = `${slug}-dna-${d.dna_id}`;
        existingSlugs.add(slug);
        const [ins] = await knex("taxa")
          .insert({
            parent_id: genusId,
            taxon_rank: "Species",
            scientific_name: parsed.binomial,
            slug,
            specific_epithet: parsed.epithet,
            taxonomic_status: "accepted",
            nomenclatural_code: "ICZN",
            is_verified: true,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning("taxon_id");
        spTaxonId = Number(ins.taxon_id ?? ins);
        speciesByName.set(parsed.binomial.toLowerCase(), spTaxonId);
        insertedSpecies++;
      }
      if (spTaxonId && Number(d.taxon_id) !== Number(spTaxonId)) {
        await knex("dna_sequences")
          .where("dna_id", d.dna_id)
          .update({ taxon_id: spTaxonId, updated_at: new Date() });
        updatedDna++;
      }
    }
  }

  log(`\n${"═".repeat(60)}`);
  log("📊 KẾT QUẢ BACKFILL SPECIES TAXA");
  log(`${"═".repeat(60)}`);
  log(`   Giống (Genus) mới bổ sung : ${insertedGenera.toLocaleString()}`);
  log(`   Loài (Species) mới nạp    : ${insertedSpecies.toLocaleString()}`);
  log(`   Tổng số Species trong DB  : ${speciesByName.size.toLocaleString()}`);
  log(`   Chuỗi DNA cập nhật loài   : ${updatedDna.toLocaleString()}`);
  if (DRY_RUN) log("   [DRY-RUN] Không có dữ liệu nào bị thay đổi.");
  log(`${"═".repeat(60)}\n`);

  await knex.destroy();
}

main().catch((err) => {
  console.error("💥 Lỗi backfill-species-taxa:", err);
  knex.destroy().finally(() => process.exit(1));
});
