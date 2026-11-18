const crypto = require("crypto");
const mediaRepository = require("./media.repository");
const specimenRepository = require("../specimen/specimen.repository");
const {
  putObjectToMinio,
  deleteObjectFromMinio,
  getObjectFromMinio,
  MINIO_BUCKET,
} = require("../../config/minio");
const {
  ALLOWED_MEDIA_LICENSES,
  DWCA_EXPORTABLE_LICENSES,
  LICENSE_LABELS,
} = require("./media.constants");
const { buildMediaProxyUrl, verifyMediaAccess } = require("./mediaUrl.util");
const AppError = require("../../utils/appError");

const MediaError = {
  NOT_FOUND: {
    code: "MEDIA.NOT_FOUND",
    message: "Không tìm thấy tệp hình ảnh mẫu vật",
    statusCode: 404,
  },
  FORBIDDEN: {
    code: "MEDIA.FORBIDDEN",
    message: "Hình ảnh thuộc dữ liệu chưa công khai",
    statusCode: 403,
  },
  INVALID_LICENSE: {
    code: "MEDIA.INVALID_LICENSE",
    message:
      "Giấy phép ảnh không hợp lệ hoặc thuộc nhóm cấm tạo phái sinh (No-Derivatives / All Rights Reserved). Chỉ chấp nhận: cc0, cc-by, cc-by-sa, cc-by-nc, cc-by-nc-sa.",
    statusCode: 400,
  },
  SPECIMEN_NOT_FOUND: {
    code: "MEDIA.SPECIMEN_NOT_FOUND",
    message: "Mẫu vật liên kết không tồn tại",
    statusCode: 400,
  },
};

function formatDateOnly(val) {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

function toMediaDto(row, { isAdmin = false } = {}) {
  const licenseCode = row.license_code ? row.license_code.toLowerCase() : "cc-by";
  const imgPublic = Boolean(row.is_public);
  const specPublic = row.specimen_is_public !== undefined ? Boolean(row.specimen_is_public) : true;
  const isEffectivelyPublic = imgPublic && specPublic;
  const proxyUrl = buildMediaProxyUrl(row.image_id, { isAdmin, isEffectivelyPublic });

  return {
    id: Number(row.image_id),
    specimenId: Number(row.specimen_id),
    specimenCode: row.specimen_code || null,
    basisOfRecord: row.basis_of_record || null,
    scientificName: row.gbif_scientific_name || row.taxon_name || "Insecta sp.",
    orderName: row.order_name || null,
    familyName: row.family_name || null,
    provinceNameVn: row.province_name_vn || null,
    collectionDate: formatDateOnly(row.collection_date),
    objectKey: row.object_key,
    thumbnailKey: row.thumbnail_key || row.object_key,
    url: proxyUrl,
    thumbnailUrl: proxyUrl,
    shotType: row.shot_type || "field",
    fileSizeBytes: row.file_size_bytes || null,
    widthPx: row.width_px || null,
    heightPx: row.height_px || null,
    licenseCode,
    licenseLabel: LICENSE_LABELS[licenseCode] || licenseCode.toUpperCase(),
    isDwcaExportable: DWCA_EXPORTABLE_LICENSES.includes(licenseCode),
    attribution: row.attribution || null,
    sourceUrl: row.source_url || null,
    sourceProvider: row.source_provider || "MINIO",
    storageBucket: MINIO_BUCKET,
    isPublic: imgPublic,
    specimenIsPublic: specPublic,
    uploadedAt: row.uploaded_at,
  };
}

async function listMedia(filters, { isAdmin = false } = {}) {
  const res = await mediaRepository.findMany(filters, { includePrivate: isAdmin });
  return {
    items: res.items.map((r) => toMediaDto(r, { isAdmin })),
    pagination: {
      total: res.total,
      page: res.page,
      limit: res.limit,
      totalPages: res.totalPages,
    },
  };
}

async function getStats({ isAdmin = false } = {}) {
  return mediaRepository.getStats({ includePrivate: isAdmin });
}

async function uploadMedia({ file, body, adminId }) {
  const licenseCode = String(body.licenseCode || "cc-by").trim().toLowerCase();
  if (!ALLOWED_MEDIA_LICENSES.includes(licenseCode)) {
    throw new AppError(MediaError.INVALID_LICENSE);
  }

  const specimenId = Number(body.specimenId);
  const spec = await specimenRepository.findById(specimenId, { includePrivate: true });
  if (!spec) {
    throw new AppError(MediaError.SPECIMEN_NOT_FOUND);
  }

  const ext = (file.originalname?.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const uid = crypto.randomBytes(6).toString("hex");
  const objectKey = `specimens/${specimenId}/${Date.now()}-${uid}.${ext || "jpg"}`;

  await putObjectToMinio(objectKey, file.buffer, file.mimetype || "image/jpeg");

  const created = await mediaRepository.create({
    specimenId,
    uploadedBy: adminId,
    objectKey,
    thumbnailKey: objectKey,
    shotType: body.shotType || "habitus",
    fileSizeBytes: file.size,
    licenseCode,
    attribution: body.attribution || "VietInsect Internal Upload",
    sourceUrl: null,
    sourceProvider: "MINIO",
    isPublic: body.isPublic !== "false" && body.isPublic !== false,
  });

  return toMediaDto(
    {
      ...created,
      specimen_code: spec.specimen_code,
      gbif_scientific_name: spec.gbif_scientific_name,
      taxon_name: spec.taxon_name,
      order_name: spec.order_name,
      family_name: spec.family_name,
      province_name_vn: spec.province_name_vn,
      collection_date: spec.collection_date,
      specimen_is_public: spec.is_public,
    },
    { isAdmin: true },
  );
}

const MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

function guessContentType(objectKey) {
  const ext = (objectKey || "").split(".").pop().toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

async function getMediaFile(imageId, { isAdmin = false, exp = null, sig = null } = {}) {
  if (!Number.isInteger(imageId) || imageId <= 0) {
    throw new AppError(MediaError.NOT_FOUND);
  }

  const img = await mediaRepository.findByIdWithSpecimen(imageId);
  if (!img) throw new AppError(MediaError.NOT_FOUND);

  const isPublic = Boolean(img.img_is_public && img.specimen_is_public);
  if (!isPublic) {
    const hasSignedGrant = verifyMediaAccess(imageId, exp, sig);
    if (!isAdmin && !hasSignedGrant) {
      throw new AppError(MediaError.FORBIDDEN);
    }
  }

  const objectKey = img.object_key;
  if (/^https?:\/\//i.test(objectKey)) {
    return { redirect: objectKey, isPublic };
  }

  const res = await getObjectFromMinio(objectKey);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new AppError({
      code: "MEDIA.STORAGE_ERROR",
      message: `Lỗi đọc tệp từ MinIO (HTTP ${res.statusCode})`,
      statusCode: 502,
    });
  }

  return {
    buffer: res.body,
    contentType: res.headers["content-type"] || guessContentType(objectKey),
    isPublic,
  };
}

async function deleteMedia(imageId) {
  const existing = await mediaRepository.findById(imageId);
  if (!existing) throw new AppError(MediaError.NOT_FOUND);

  if (existing.object_key && !/^https?:\/\//i.test(existing.object_key)) {
    await deleteObjectFromMinio(existing.object_key).catch(() => {});
  }
  if (
    existing.thumbnail_key &&
    existing.thumbnail_key !== existing.object_key &&
    !/^https?:\/\//i.test(existing.thumbnail_key)
  ) {
    await deleteObjectFromMinio(existing.thumbnail_key).catch(() => {});
  }

  await mediaRepository.remove(imageId);
}

module.exports = {
  listMedia,
  getStats,
  uploadMedia,
  deleteMedia,
  getMediaFile,
};
