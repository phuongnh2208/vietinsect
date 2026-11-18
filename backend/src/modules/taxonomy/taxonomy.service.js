const ExcelJS = require("exceljs");
const taxonomyRepository = require("./taxonomy.repository");
const catalogueOfLifeService = require("./catalogueOfLife.service");
const TaxonomyError = require("./taxonomy.errors");
const AppError = require("../../utils/appError");
const logger = require("../../config/logger");
const { SPECIES_PROFILE_RANKS, TAXON_RANKS } = require("./taxonomy.constants");

function slugify(scientificName) {
  return scientificName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function toExternalLinks(taxon) {
  // F-TX-06: liên kết CSDL quốc tế. BOLD TaxID gắn ở cấp mẫu vật/DNA (module dna), không có ở taxa.
  const links = {};
  if (taxon.gbif_taxon_key) links.gbif = `https://www.gbif.org/species/${taxon.gbif_taxon_key}`;
  if (taxon.itis_tsn) links.itis = `https://www.itis.gov/servlet/SingleRpt/SingleRpt?search_topic=TSN&search_value=${taxon.itis_tsn}`;
  if (taxon.col_id) links.catalogueOfLife = `https://www.catalogueoflife.org/data/taxon/${taxon.col_id}`;
  if (taxon.iucn_status) links.iucnRedList = `https://www.iucnredlist.org/search?query=${encodeURIComponent(taxon.scientific_name)}`;
  return links;
}

function toTaxonDto(taxon, specimenCount = 0) {
  return {
    id: taxon.taxon_id,
    parentId: taxon.parent_id,
    acceptedTaxonId: taxon.accepted_taxon_id,
    rank: taxon.taxon_rank,
    scientificName: taxon.scientific_name,
    scientificNameAuthorship: taxon.scientific_name_authorship,
    yearDescribed: taxon.year_described,
    vernacularNameVn: taxon.vernacular_name_vn,
    vernacularNameEn: taxon.vernacular_name_en,
    taxonomicStatus: taxon.taxonomic_status,
    iucnStatus: taxon.iucn_status,
    isVerified: taxon.is_verified,
    notes: taxon.taxon_notes,
    slug: taxon.slug || slugify(taxon.scientific_name),
    specimenCount,
    externalLinks: toExternalLinks(taxon),
  };
}

// F-TX-01: cây phân cấp Kingdom → Subspecies. Số taxa hiện tại ở quy mô danh lục (hàng nghìn
// bản ghi), nên build cây trong bộ nhớ là đủ nhanh; khi CSDL lớn hơn nhiều có thể chuyển sang
// CTE đệ quy phía PostgreSQL.
async function getTree() {
  const [taxa, specimenCounts] = await Promise.all([
    taxonomyRepository.findAll(),
    taxonomyRepository.countSpecimensByTaxon(),
  ]);

  const countByTaxonId = new Map(specimenCounts.map((row) => [row.taxon_id, row.count]));
  const nodeById = new Map(taxa.map((taxon) => [taxon.taxon_id, { ...toTaxonDto(taxon, countByTaxonId.get(taxon.taxon_id) || 0), children: [] }]));

  const roots = [];
  nodeById.forEach((node) => {
    if (node.parentId && nodeById.has(node.parentId)) {
      nodeById.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Cộng dồn specimenCount lên taxon cha (bao gồm số mẫu của toàn bộ nhánh con).
  function rollUp(node) {
    let total = node.specimenCount;
    node.children.forEach((child) => {
      total += rollUp(child);
    });
    node.specimenCount = total;
    return total;
  }
  roots.forEach(rollUp);

  return roots;
}

async function searchTaxa(query) {
  if (!query || query.trim().length < 2) return [];
  const taxa = await taxonomyRepository.search(query.trim(), 10);
  return taxa.map((taxon) => toTaxonDto(taxon));
}

async function getTaxonById(taxonId) {
  const taxon = await taxonomyRepository.findById(taxonId);
  if (!taxon) throw new AppError(TaxonomyError.TAXON_NOT_FOUND);
  const specimenCount = await taxonomyRepository.countSpecimens(taxonId);
  return toTaxonDto(taxon, specimenCount);
}

async function createTaxon(payload, adminId) {
  if (payload.parentId) {
    const parent = await taxonomyRepository.findById(payload.parentId);
    if (!parent) throw new AppError(TaxonomyError.PARENT_NOT_FOUND);
  }

  const existing = await taxonomyRepository.findByScientificName(payload.scientificName);
  if (existing) throw new AppError(TaxonomyError.DUPLICATE_SCIENTIFIC_NAME);

  const colResult = await catalogueOfLifeService.verifyScientificName(payload.scientificName);
  payload.slug = slugify(payload.scientificName);
  const taxon = await taxonomyRepository.create(payload, adminId);

  if (colResult.exactMatch) {
    await taxonomyRepository.markVerified(taxon.taxon_id, true);
    taxon.is_verified = true;
  }

  logger.info(`Admin ${adminId} tạo taxon mới: ${payload.scientificName} (#${taxon.taxon_id})`);

  return { taxon: toTaxonDto(taxon, 0), colSuggestions: colResult.candidates };
}

async function updateTaxon(taxonId, payload) {
  const current = await taxonomyRepository.findById(taxonId);
  if (!current) throw new AppError(TaxonomyError.TAXON_NOT_FOUND);

  if (payload.parentId) {
    const parent = await taxonomyRepository.findById(payload.parentId);
    if (!parent) throw new AppError(TaxonomyError.PARENT_NOT_FOUND);
  }

  if (payload.scientificName && payload.scientificName.toLowerCase() !== current.scientific_name.toLowerCase()) {
    const existing = await taxonomyRepository.findByScientificName(payload.scientificName);
    if (existing) throw new AppError(TaxonomyError.DUPLICATE_SCIENTIFIC_NAME);
  }

  if (payload.scientificName) {
    payload.slug = slugify(payload.scientificName);
  }

  const updated = await taxonomyRepository.update(taxonId, payload);
  const specimenCount = await taxonomyRepository.countSpecimens(taxonId);
  return toTaxonDto(updated, specimenCount);
}

async function deleteTaxon(taxonId) {
  const taxon = await taxonomyRepository.findById(taxonId);
  if (!taxon) throw new AppError(TaxonomyError.TAXON_NOT_FOUND);

  const [childCount, specimenCount] = await Promise.all([
    taxonomyRepository.countChildren(taxonId),
    taxonomyRepository.countSpecimens(taxonId),
  ]);

  if (childCount > 0) throw new AppError(TaxonomyError.TAXON_HAS_CHILDREN);
  if (specimenCount > 0) throw new AppError(TaxonomyError.TAXON_HAS_SPECIMENS);

  await taxonomyRepository.remove(taxonId);
}

// F-TX-03: quản lý đồng danh pháp — gắn synonym → accepted name.
async function setSynonym(taxonId, acceptedTaxonId) {
  if (taxonId === acceptedTaxonId) throw new AppError(TaxonomyError.SYNONYM_SELF_REFERENCE);

  const [taxon, accepted] = await Promise.all([
    taxonomyRepository.findById(taxonId),
    taxonomyRepository.findById(acceptedTaxonId),
  ]);

  if (!taxon) throw new AppError(TaxonomyError.TAXON_NOT_FOUND);
  if (!accepted) throw new AppError(TaxonomyError.ACCEPTED_TAXON_NOT_FOUND);
  if (accepted.taxonomic_status !== "accepted") throw new AppError(TaxonomyError.ACCEPTED_TAXON_MUST_BE_ACCEPTED);

  const updated = await taxonomyRepository.setSynonym(taxonId, acceptedTaxonId);
  return toTaxonDto(updated, 0);
}

async function clearSynonym(taxonId) {
  const taxon = await taxonomyRepository.findById(taxonId);
  if (!taxon) throw new AppError(TaxonomyError.TAXON_NOT_FOUND);
  const updated = await taxonomyRepository.clearSynonym(taxonId);
  return toTaxonDto(updated, 0);
}

// F-TX-05 + F-TX-06 + F-TX-07: hồ sơ loài đầy đủ — thông tin taxon, mô tả hình thái/sinh thái,
// liên kết CSDL quốc tế và danh sách hoạt tính sinh/hóa học.
async function getSpeciesProfile(identifier) {
  const isNumericId = /^\d+$/.test(identifier);
  const taxon = isNumericId
    ? await taxonomyRepository.findById(Number(identifier))
    : await findBySlug(identifier);

  if (!taxon) throw new AppError(TaxonomyError.TAXON_NOT_FOUND);

  const [profile, bioactivity, specimenCount] = await Promise.all([
    taxonomyRepository.findProfile(taxon.taxon_id),
    taxonomyRepository.listBioactivity(taxon.taxon_id),
    taxonomyRepository.countSpecimens(taxon.taxon_id),
  ]);

  return {
    ...toTaxonDto(taxon, specimenCount),
    morphologyDescription: profile?.morphology_description || null,
    ecologyDescription: profile?.ecology_description || null,
    distributionSummary: profile?.distribution_summary || null,
    economicValueDescription: profile?.economic_value_description || null,
    bioactivity: bioactivity.map((row) => ({
      id: row.bioactivity_id,
      activityType: row.activity_type,
      activityLevel: row.activity_level,
      testCondition: row.test_condition,
      description: row.description,
      referenceDoi: row.reference_doi,
      referenceTitle: row.reference_title,
      imageObjectKey: row.image_object_key,
      createdAt: row.created_at,
    })),
  };
}

async function findBySlug(slug) {
  return taxonomyRepository.findBySlug(slug);
}

async function upsertSpeciesProfile(taxonId, payload) {
  const taxon = await taxonomyRepository.findById(taxonId);
  if (!taxon) throw new AppError(TaxonomyError.TAXON_NOT_FOUND);
  if (!SPECIES_PROFILE_RANKS.includes(taxon.taxon_rank)) {
    throw new AppError(TaxonomyError.SPECIES_PROFILE_TAXON_NOT_SPECIES);
  }

  const profile = await taxonomyRepository.upsertProfile(taxonId, payload);
  return {
    morphologyDescription: profile.morphology_description,
    ecologyDescription: profile.ecology_description,
    distributionSummary: profile.distribution_summary,
    economicValueDescription: profile.economic_value_description,
    updatedAt: profile.updated_at,
  };
}

async function addBioactivity(taxonId, payload, adminId) {
  const taxon = await taxonomyRepository.findById(taxonId);
  if (!taxon) throw new AppError(TaxonomyError.TAXON_NOT_FOUND);
  const record = await taxonomyRepository.createBioactivity(taxonId, payload, adminId);
  return {
    id: record.bioactivity_id,
    activityType: record.activity_type,
    activityLevel: record.activity_level,
    testCondition: record.test_condition,
    description: record.description,
    referenceDoi: record.reference_doi,
    referenceTitle: record.reference_title,
    imageObjectKey: record.image_object_key,
    createdAt: record.created_at,
  };
}

async function removeBioactivity(bioactivityId) {
  await taxonomyRepository.removeBioactivity(bioactivityId);
}

// F-TX-04: import danh lục Excel/CSV — cột chuẩn: tên khoa học, bậc phân loại, taxon cha.
// Chấp nhận header song ngữ VI/EN, đúng quy ước F-SP-10 đã áp dụng cho template mẫu vật.
const HEADER_ALIASES = {
  scientificname: "scientificName",
  tenkhoahoc: "scientificName",
  taxonrank: "taxonRank",
  bacphanloai: "taxonRank",
  parentname: "parentName",
  taxoncha: "parentName",
};

function normalizeHeader(raw) {
  const key = String(raw || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  return HEADER_ALIASES[key] || null;
}

async function parseImportWorkbook(fileBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError(TaxonomyError.IMPORT_FILE_EMPTY);

  const headerRow = sheet.getRow(1);
  const columnMap = {};
  headerRow.eachCell((cell, colNumber) => {
    const field = normalizeHeader(cell.text);
    if (field) columnMap[field] = colNumber;
  });

  if (!columnMap.scientificName || !columnMap.taxonRank) {
    throw new AppError(TaxonomyError.IMPORT_FILE_EMPTY);
  }

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const scientificName = String(row.getCell(columnMap.scientificName).text || "").trim();
    const taxonRank = String(row.getCell(columnMap.taxonRank).text || "").trim();
    const parentName = columnMap.parentName ? String(row.getCell(columnMap.parentName).text || "").trim() : "";
    if (scientificName && taxonRank) rows.push({ scientificName, taxonRank, parentName, rowNumber });
  });

  return rows;
}

async function importChecklist(fileBuffer, adminId) {
  const rows = await parseImportWorkbook(fileBuffer);
  if (rows.length === 0) throw new AppError(TaxonomyError.IMPORT_FILE_EMPTY);

  const existingTaxa = await taxonomyRepository.findAll();
  const idByName = new Map(existingTaxa.map((taxon) => [taxon.scientific_name.toLowerCase(), taxon.taxon_id]));

  const result = { inserted: 0, skipped: 0, conflicts: [] };

  // Insert theo nhiều lượt để taxon cha khai báo sau trong file vẫn được liên kết đúng
  // (tối đa bằng số bậc phân loại — đủ để xử lý thứ tự bất kỳ trong file nguồn).
  let pendingRows = rows;
  for (let pass = 0; pass < TAXON_RANKS.length && pendingRows.length > 0; pass += 1) {
    const stillPending = [];

    for (const row of pendingRows) {
      if (!TAXON_RANKS.includes(row.taxonRank)) {
        result.conflicts.push({ row: row.rowNumber, reason: `Bậc phân loại không hợp lệ: "${row.taxonRank}"` });
        continue;
      }

      if (idByName.has(row.scientificName.toLowerCase())) {
        result.skipped += 1;
        continue;
      }

      let parentId = null;
      if (row.parentName) {
        parentId = idByName.get(row.parentName.toLowerCase());
        if (!parentId) {
          stillPending.push(row);
          continue;
        }
      }

      const created = await taxonomyRepository.create(
        { taxonRank: row.taxonRank, scientificName: row.scientificName, parentId, slug: slugify(row.scientificName) },
        adminId,
      );
      idByName.set(row.scientificName.toLowerCase(), created.taxon_id);
      result.inserted += 1;
    }

    pendingRows = stillPending;
  }

  pendingRows.forEach((row) => {
    result.conflicts.push({ row: row.rowNumber, reason: `Không tìm thấy taxon cha "${row.parentName}"` });
  });

  logger.info(`Admin ${adminId} import danh lục: +${result.inserted} taxon, ${result.skipped} trùng, ${result.conflicts.length} lỗi`);

  return result;
}

module.exports = {
  getTree,
  searchTaxa,
  getTaxonById,
  createTaxon,
  updateTaxon,
  deleteTaxon,
  setSynonym,
  clearSynonym,
  getSpeciesProfile,
  upsertSpeciesProfile,
  addBioactivity,
  removeBioactivity,
  importChecklist,
};
