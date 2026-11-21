const specimenRepository = require("./specimen.repository");
const { buildMediaProxyUrl } = require("../media/mediaUrl.util");
const SpecimenError = require("./specimen.errors");
const AppError = require("../../utils/appError");
const logger = require("../../config/logger");
const esService = require("../search/elasticsearch.service");

function formatDateOnly(val) {
  if (!val) return null;
  if (val instanceof Date) {
    // PostgreSQL DATE có thể trả về local Date ở 00:00 — lấy YYYY-MM-DD an toàn
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

function toSpecimenSummaryDto(row) {
  const scientificName = row.gbif_scientific_name || row.taxon_name || "Insecta sp.";
  return {
    id: Number(row.specimen_id),
    specimenCode: row.specimen_code,
    gbifOccurrenceId: row.gbif_occurrence_id || null,
    basisOfRecord: row.basis_of_record || null,
    catalogNumber: row.catalog_number || null,
    institutionCode: row.institution_code || null,
    recordedBy: row.recorded_by || null,
    taxonId: Number(row.taxon_id),
    taxonName: row.taxon_name,
    taxonRank: row.taxon_rank,
    taxonSlug: row.taxon_slug || null,
    scientificName,
    gbifScientificName: row.gbif_scientific_name || null,
    commonNameVn: row.common_name_vn || null,
    commonNameEn: row.common_name_en || null,
    orderName: row.order_name || null,
    familyName: row.family_name || null,
    genusName: row.genus_name || null,
    provinceId: row.province_id != null ? Number(row.province_id) : null,
    provinceNameVn: row.province_name_vn || null,
    provinceNameEn: row.province_name_en || null,
    district: row.district || null,
    commune: row.commune || null,
    localityDetail: row.locality_detail || null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    distanceKm: row.distance_km != null ? Number(row.distance_km) : undefined,
    collectionDate: formatDateOnly(row.collection_date),
    sex: row.sex || null,
    individualCount: Number(row.individual_count || 1),
    habitatLabelVn: row.habitat_label_vn || null,
    lifeStageLabelVn: row.life_stage_label_vn || null,
    statusLabelVn: row.status_label_vn || null,
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSpecimenDetailDto(row, { isAdmin = false } = {}) {
  const specimenIsPublic = Boolean(row.is_public);
  return {
    ...toSpecimenSummaryDto(row),
    gbifDatasetKey: row.gbif_dataset_key || null,
    occurrenceRemarks: row.occurrence_remarks || null,
    habitatId: row.habitat_id != null ? Number(row.habitat_id) : null,
    lifeStageId: row.life_stage_id != null ? Number(row.life_stage_id) : null,
    statusId: row.status_id != null ? Number(row.status_id) : null,
    gpsAccuracyM: row.gps_accuracy_m != null ? Number(row.gps_accuracy_m) : null,
    storageNumber: row.storage_number || null,
    notes: row.notes || null,
    gbifLink:
      row.gbif_occurrence_id && /^\d+$/.test(String(row.gbif_occurrence_id).replace(/^gbif:/, ""))
        ? `https://www.gbif.org/occurrence/${String(row.gbif_occurrence_id).replace(/^gbif:/, "")}`
        : null,
    images: (row.images || []).map((img) => {
      const imgPublic = img.is_public !== false;
      const proxyUrl = buildMediaProxyUrl(img.image_id, {
        isAdmin,
        isEffectivelyPublic: imgPublic && specimenIsPublic,
      });
      return {
        id: Number(img.image_id),
        objectKey: img.object_key,
        thumbnailKey: img.thumbnail_key,
        url: proxyUrl,
        thumbnailUrl: proxyUrl,
        shotType: img.shot_type,
        licenseCode: img.license_code || null,
        attribution: img.attribution || null,
        sourceUrl: img.source_url || null,
        isPublic: imgPublic,
        widthPx: img.width_px,
        heightPx: img.height_px,
        uploadedAt: img.uploaded_at,
        isSpeciesReference: false,
      };
    }),
    speciesImages: (row.speciesImages || []).map((img) => {
      const imgPublic = img.is_public !== false;
      const proxyUrl = buildMediaProxyUrl(img.image_id, {
        isAdmin,
        isEffectivelyPublic: imgPublic && specimenIsPublic,
      });
      return {
        id: Number(img.image_id),
        objectKey: img.object_key,
        thumbnailKey: img.thumbnail_key,
        url: proxyUrl,
        thumbnailUrl: proxyUrl,
        shotType: img.shot_type,
        licenseCode: img.license_code || null,
        attribution: img.attribution || null,
        sourceUrl: img.source_url || null,
        isPublic: imgPublic,
        widthPx: img.width_px,
        heightPx: img.height_px,
        uploadedAt: img.uploaded_at,
        referenceScientificName: img.reference_scientific_name || null,
        referenceMatchRank: img.reference_match_rank || "Species",
        referenceTaxonName: img.reference_taxon_name || null,
        isSpeciesReference: true,
      };
    }),
    dnaSequences: (row.dnaSequences || []).map((dna) => ({
      id: Number(dna.dna_id),
      genbankAccession: dna.genbank_accession,
      boldProcessId: dna.bold_process_id || null,
      binUri: dna.bin_uri || null,
      geneMarker: dna.gene_marker || "COI",
      sequenceLengthBp: dna.sequence_length_bp != null ? Number(dna.sequence_length_bp) : null,
      gcContentPct: dna.gc_content_pct != null ? Number(dna.gc_content_pct) : null,
      fastaSequence: dna.fasta_sequence || null,
      sourceDb: dna.source_db || "GENBANK",
      submissionDate: formatDateOnly(dna.submission_date),
      authorName: dna.author_name || null,
      scientificName: dna.scientific_name_verbatim || row.gbif_scientific_name || row.taxon_name || null,
      isSpeciesReference: false,
    })),
    speciesDnaSequences: (row.speciesDnaSequences || []).map((dna) => ({
      id: Number(dna.dna_id),
      genbankAccession: dna.genbank_accession,
      boldProcessId: dna.bold_process_id || null,
      binUri: dna.bin_uri || null,
      geneMarker: dna.gene_marker || "COI",
      sequenceLengthBp: dna.sequence_length_bp != null ? Number(dna.sequence_length_bp) : null,
      gcContentPct: dna.gc_content_pct != null ? Number(dna.gc_content_pct) : null,
      fastaSequence: dna.fasta_sequence || null,
      sourceDb: dna.source_db || "GENBANK",
      submissionDate: formatDateOnly(dna.submission_date),
      authorName: dna.author_name || null,
      scientificName: dna.scientific_name_verbatim || null,
      referenceMatchRank: dna.reference_match_rank || "Species",
      referenceTaxonName: dna.reference_taxon_name || null,
      isSpeciesReference: true,
    })),
    changeHistory: (row.changeHistory || []).map((ch) => ({
      id: Number(ch.change_id),
      fieldName: ch.field_name,
      oldValue: ch.old_value,
      newValue: ch.new_value,
      changedAt: ch.changed_at,
      changedByUsername: ch.changed_by_username || "admin",
    })),
  };
}

async function listSpecimens(filters, { isAdmin = false } = {}) {
  const result = await specimenRepository.findMany(filters, { includePrivate: isAdmin });
  return {
    items: result.items.map(toSpecimenSummaryDto),
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    },
  };
}

async function getMapOccurrences(filters, { isAdmin = false } = {}) {
  const result = await specimenRepository.findMapData(filters, { includePrivate: isAdmin });
  const provinceClusters = result.provinceClusters.map((c) => ({
    provinceId: c.province_id != null ? Number(c.province_id) : null,
    provinceNameVn: c.province_name_vn,
    provinceNameEn: c.province_name_en || null,
    region: c.region || null,
    count: Number(c.count),
    speciesCount: Number(c.species_count || 0),
    lat: Number(c.lat),
    lon: Number(c.lon),
  }));

  // Tổng hợp theo Vùng sinh thái / Địa lý tự nhiên (Ecological Regions) từ cụm tỉnh PostGIS
  const regionMap = new Map();
  provinceClusters.forEach((c) => {
    const regName = c.region || "Vùng khác";
    if (c.lat == null || c.lon == null || Number.isNaN(c.lat) || Number.isNaN(c.lon)) return;
    const prev = regionMap.get(regName) || {
      region: regName,
      count: 0,
      speciesCount: 0,
      provinceCount: 0,
      latWeightSum: 0,
      lonWeightSum: 0,
    };
    const w = Math.max(1, c.count);
    prev.count += c.count;
    prev.speciesCount += c.speciesCount;
    prev.provinceCount += 1;
    prev.latWeightSum += c.lat * w;
    prev.lonWeightSum += c.lon * w;
    regionMap.set(regName, prev);
  });

  const regionClusters = Array.from(regionMap.values()).map((r) => ({
    region: r.region,
    count: r.count,
    speciesCount: r.speciesCount,
    provinceCount: r.provinceCount,
    lat: Number((r.latWeightSum / Math.max(1, r.count)).toFixed(4)),
    lon: Number((r.lonWeightSum / Math.max(1, r.count)).toFixed(4)),
  }));

  return {
    totalMatching: result.totalMatching,
    returnedPoints: result.returnedPoints,
    summary: result.summary || {
      totalOccurrences: result.totalMatching,
      distinctSpeciesCount: 0,
      provincesCount: provinceClusters.length,
    },
    points: result.points.map((pt) => ({
      id: Number(pt.specimen_id),
      code: pt.specimen_code,
      scientificName: pt.gbif_scientific_name || pt.taxon_name || "Insecta sp.",
      taxonRank: pt.taxon_rank || "Species",
      taxonSlug: pt.taxon_slug || null,
      orderName: pt.order_name || null,
      familyName: pt.family_name || null,
      genusName: pt.genus_name || null,
      provinceNameVn: pt.province_name_vn || null,
      region: pt.region || null,
      district: pt.district || null,
      localityDetail: pt.locality_detail || null,
      elevationM: pt.elevation_m != null ? Number(pt.elevation_m) : null,
      basisOfRecord: pt.basis_of_record || null,
      institutionCode: pt.institution_code || null,
      recordedBy: pt.recorded_by || null,
      collectionDate: formatDateOnly(pt.collection_date),
      individualCount: Number(pt.individual_count || 1),
      distanceKm: pt.distance_km != null ? Number(pt.distance_km) : undefined,
      lat: Number(pt.lat),
      lon: Number(pt.lon),
    })),
    provinceClusters,
    regionClusters,
    heatGrid: result.heatGrid.map((g) => ({
      lat: Number(g.lat),
      lon: Number(g.lon),
      count: Number(g.count),
    })),
  };
}

async function getSpecimenById(specimenId, { isAdmin = false } = {}) {
  const row = await specimenRepository.findById(specimenId, { includePrivate: isAdmin });
  if (!row) throw new AppError(SpecimenError.SPECIMEN_NOT_FOUND);
  return toSpecimenDetailDto(row, { isAdmin });
}

function validateCoordinatePair(payload) {
  const hasLat = payload.latitude !== undefined && payload.latitude !== null;
  const hasLon = payload.longitude !== undefined && payload.longitude !== null;
  if (hasLat !== hasLon) {
    throw new AppError(SpecimenError.COORDINATES_INCOMPLETE);
  }
}

async function createSpecimen(payload, adminId) {
  validateCoordinatePair(payload);

  const hasTaxon = await specimenRepository.taxonExists(payload.taxonId);
  if (!hasTaxon) throw new AppError(SpecimenError.TAXON_NOT_FOUND);

  if (payload.provinceId) {
    const hasProv = await specimenRepository.provinceExists(payload.provinceId);
    if (!hasProv) throw new AppError(SpecimenError.PROVINCE_NOT_FOUND);
  }

  if (payload.specimenCode) {
    const existing = await specimenRepository.findRegistryByCode(payload.specimenCode);
    if (existing) throw new AppError(SpecimenError.DUPLICATE_SPECIMEN_CODE);
  }

  const newId = await specimenRepository.create(payload, adminId);
  logger.info(`Admin ${adminId} tạo mẫu vật mới #${newId}`);
  return getSpecimenById(newId, { isAdmin: true });
}

async function updateSpecimen(specimenId, payload, adminId) {
  const current = await specimenRepository.findById(specimenId, { includePrivate: true });
  if (!current) throw new AppError(SpecimenError.SPECIMEN_NOT_FOUND);

  if ("latitude" in payload || "longitude" in payload) {
    validateCoordinatePair(payload);
  }

  if (payload.taxonId) {
    const hasTaxon = await specimenRepository.taxonExists(payload.taxonId);
    if (!hasTaxon) throw new AppError(SpecimenError.TAXON_NOT_FOUND);
  }

  if (payload.provinceId) {
    const hasProv = await specimenRepository.provinceExists(payload.provinceId);
    if (!hasProv) throw new AppError(SpecimenError.PROVINCE_NOT_FOUND);
  }

  if (payload.specimenCode && payload.specimenCode !== current.specimen_code) {
    const existing = await specimenRepository.findRegistryByCode(payload.specimenCode);
    if (existing) throw new AppError(SpecimenError.DUPLICATE_SPECIMEN_CODE);
  }

  await specimenRepository.update(specimenId, current, payload, adminId);
  logger.info(`Admin ${adminId} cập nhật mẫu vật #${specimenId}`);
  const isPriority = "isPublic" in payload;
  if (isPriority) {
    await esService.syncSpecimenWithRetry(specimenId, { priority: true });
  } else {
    esService.syncSpecimenWithRetry(specimenId, { priority: false }).catch(() => {});
  }
  return getSpecimenById(specimenId, { isAdmin: true });
}

async function togglePublic(specimenId, isPublic, adminId) {
  return updateSpecimen(specimenId, { isPublic }, adminId);
}

async function batchTogglePublic(specimenIds, isPublic, adminId) {
  const updatedCount = await specimenRepository.batchUpdatePublic(specimenIds, isPublic, adminId);
  logger.info(`Admin ${adminId} cập nhật trạng thái công khai (${isPublic}) cho ${updatedCount} mẫu vật`);
  esService.bulkIndexSpecimens(specimenIds).catch((err) => {
    logger.error(`[ES PRIORITY BATCH PUBLIC SYNC FAILED] ${err?.message}`);
  });
  return { updatedCount, isPublic };
}

async function deleteSpecimen(specimenId, adminId) {
  const current = await specimenRepository.findById(specimenId, { includePrivate: true });
  if (!current) throw new AppError(SpecimenError.SPECIMEN_NOT_FOUND);

  const { orphanedDnaCount } = await specimenRepository.softDelete(specimenId, adminId);
  logger.info(
    `Admin ${adminId} xóa mềm mẫu vật #${specimenId} (orphanedDnaCount=${orphanedDnaCount})`,
  );
  await esService.syncSpecimenWithRetry(specimenId, { priority: true });

  const warning =
    orphanedDnaCount > 0
      ? `Cảnh báo: ${orphanedDnaCount} chuỗi DNA liên kết đã được chuyển sang trạng thái mồ côi (orphan) và được giữ lại trong CSDL.`
      : null;

  return {
    id: specimenId,
    deleted: true,
    orphanedDnaCount,
    warning,
  };
}

async function restoreSpecimen(specimenId, adminId) {
  const { restoredCount, unorphanedDnaCount } = await specimenRepository.restore(
    specimenId,
    adminId,
  );
  if (!restoredCount) throw new AppError(SpecimenError.SPECIMEN_NOT_FOUND);

  logger.info(
    `Admin ${adminId} khôi phục mẫu vật #${specimenId} (unorphanedDnaCount=${unorphanedDnaCount})`,
  );
  await esService.syncSpecimenWithRetry(specimenId, { priority: true });
  return {
    id: specimenId,
    restored: true,
    unorphanedDnaCount,
  };
}

async function getLookups() {
  return specimenRepository.findLookups();
}

async function getStats({ isAdmin = false } = {}) {
  return specimenRepository.getStats({ includePrivate: isAdmin });
}

async function getAnalytics(filters = {}, { isAdmin = false } = {}) {
  return specimenRepository.getAnalytics(filters, { includePrivate: isAdmin });
}

async function batchUpdateSpecimens(specimenIds, updates, adminId) {
  if (!Array.isArray(specimenIds) || specimenIds.length === 0) {
    return { updatedCount: 0 };
  }
  const cleanIds = specimenIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
  const updatedCount = await specimenRepository.batchUpdateFields(cleanIds, updates || {}, adminId);
  logger.info(`Admin ${adminId} chỉnh sửa hàng loạt ${updatedCount} mẫu vật`);
  return { updatedCount, specimenIds: cleanIds };
}

async function bulkImportSpecimens(rows, adminId) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { insertedCount: 0, errors: [] };
  }
  if (rows.length > 5000) {
    throw new AppError({
      code: "SPECIMEN.IMPORT_LIMIT_EXCEEDED",
      message: "Tệp nhập liệu vượt quá giới hạn tối đa 5.000 dòng",
      statusCode: 400,
    });
  }
  const result = await specimenRepository.bulkImportRows(rows, adminId);
  logger.info(`Admin ${adminId} nhập hàng loạt ${result.insertedCount} mẫu vật (${result.errors.length} lỗi)`);
  return result;
}

module.exports = {
  listSpecimens,
  getMapOccurrences,
  getSpecimenById,
  createSpecimen,
  updateSpecimen,
  togglePublic,
  batchTogglePublic,
  batchUpdateSpecimens,
  bulkImportSpecimens,
  deleteSpecimen,
  restoreSpecimen,
  getLookups,
  getStats,
  getAnalytics,
};
