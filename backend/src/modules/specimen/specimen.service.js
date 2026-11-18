const specimenRepository = require("./specimen.repository");
const { buildMediaProxyUrl } = require("../media/mediaUrl.util");
const SpecimenError = require("./specimen.errors");
const AppError = require("../../utils/appError");
const logger = require("../../config/logger");

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
      };
    }),
    dnaSequences: (row.dnaSequences || []).map((dna) => ({
      id: Number(dna.dna_id),
      genbankAccession: dna.genbank_accession,
      geneMarker: dna.gene_marker,
      sequenceLengthBp: dna.sequence_length_bp,
      boldProcessId: dna.bold_process_id,
      submissionDate: formatDateOnly(dna.submission_date),
      authorName: dna.author_name,
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
  return {
    totalMatching: result.totalMatching,
    returnedPoints: result.returnedPoints,
    points: result.points.map((pt) => ({
      id: Number(pt.specimen_id),
      code: pt.specimen_code,
      scientificName: pt.gbif_scientific_name || pt.taxon_name || "Insecta sp.",
      orderName: pt.order_name || null,
      provinceNameVn: pt.province_name_vn || null,
      basisOfRecord: pt.basis_of_record || null,
      collectionDate: formatDateOnly(pt.collection_date),
      individualCount: Number(pt.individual_count || 1),
      lat: Number(pt.lat),
      lon: Number(pt.lon),
    })),
    provinceClusters: result.provinceClusters.map((c) => ({
      provinceId: c.province_id != null ? Number(c.province_id) : null,
      provinceNameVn: c.province_name_vn,
      provinceNameEn: c.province_name_en || null,
      count: Number(c.count),
      lat: Number(c.lat),
      lon: Number(c.lon),
    })),
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
  return getSpecimenById(specimenId, { isAdmin: true });
}

async function togglePublic(specimenId, isPublic, adminId) {
  return updateSpecimen(specimenId, { isPublic }, adminId);
}

async function batchTogglePublic(specimenIds, isPublic, adminId) {
  const updatedCount = await specimenRepository.batchUpdatePublic(specimenIds, isPublic, adminId);
  logger.info(`Admin ${adminId} cập nhật trạng thái công khai (${isPublic}) cho ${updatedCount} mẫu vật`);
  return { updatedCount, isPublic };
}

async function deleteSpecimen(specimenId, adminId) {
  const current = await specimenRepository.findById(specimenId, { includePrivate: true });
  if (!current) throw new AppError(SpecimenError.SPECIMEN_NOT_FOUND);

  await specimenRepository.softDelete(specimenId, adminId);
  logger.info(`Admin ${adminId} xóa mềm mẫu vật #${specimenId}`);
}

async function getLookups() {
  return specimenRepository.findLookups();
}

async function getStats({ isAdmin = false } = {}) {
  return specimenRepository.getStats({ includePrivate: isAdmin });
}

module.exports = {
  listSpecimens,
  getMapOccurrences,
  getSpecimenById,
  createSpecimen,
  updateSpecimen,
  togglePublic,
  batchTogglePublic,
  deleteSpecimen,
  getLookups,
  getStats,
};
