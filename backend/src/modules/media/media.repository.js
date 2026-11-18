const knex = require("../../config/knex");
const { DWCA_EXPORTABLE_LICENSES } = require("./media.constants");

function applyFilters(qb, filters, { includePrivate = false } = {}) {
  qb.whereNull("s.deleted_at");

  if (!includePrivate) {
    qb.where("img.is_public", true).where("s.is_public", true);
  } else if (typeof filters.isPublic === "boolean") {
    qb.where("img.is_public", filters.isPublic);
  }

  if (filters.licenseCode && filters.licenseCode.trim()) {
    qb.where("img.license_code", filters.licenseCode.trim().toLowerCase());
  }

  if (filters.dwcaOnly === true || filters.dwcaOnly === "true") {
    qb.whereIn("img.license_code", DWCA_EXPORTABLE_LICENSES);
  }

  if (filters.voucheredOnly === true || filters.voucheredOnly === "true") {
    qb.where("sr.basis_of_record", "PRESERVED_SPECIMEN");
  }

  if (filters.shotType && filters.shotType.trim()) {
    qb.where("img.shot_type", filters.shotType.trim());
  }

  if (filters.provinceId) {
    qb.where("s.province_id", Number(filters.provinceId));
  }

  if (filters.year) {
    const y = Number(filters.year);
    if (Number.isInteger(y) && y >= 1800 && y <= 2050) {
      qb.whereBetween("s.collection_date", [`${y}-01-01`, `${y}-12-31`]);
    }
  }

  if (filters.order && filters.order.trim()) {
    qb.whereRaw(
      `s.taxon_id IN (
        WITH RECURSIVE sub_taxa AS (
          SELECT taxon_id FROM taxa WHERE lower(scientific_name) = lower(?) AND taxon_rank = 'Order'
          UNION ALL
          SELECT c.taxon_id FROM taxa c JOIN sub_taxa st ON c.parent_id = st.taxon_id
        )
        SELECT taxon_id FROM sub_taxa
      )`,
      [filters.order.trim()],
    );
  }

  if (filters.q && filters.q.trim()) {
    const safe = `%${String(filters.q.trim()).slice(0, 120).replace(/[%_\\]/g, "\\$&")}%`;
    qb.andWhere((sub) => {
      sub
        .whereRaw("s.gbif_scientific_name ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("t1.scientific_name ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("sr.specimen_code ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("img.attribution ILIKE ? ESCAPE '\\'", [safe]);
    });
  }

  return qb;
}

async function findMany(filters = {}, { includePrivate = false } = {}) {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(60, Math.max(1, Number(filters.limit) || 24));
  const offset = (page - 1) * limit;

  const baseQb = knex({ img: "specimen_images" })
    .join({ s: "specimens" }, "img.specimen_id", "s.specimen_id")
    .join({ sr: "specimen_registry" }, "img.specimen_id", "sr.specimen_id")
    .join({ t1: "taxa" }, "s.taxon_id", "t1.taxon_id");

  applyFilters(baseQb, filters, { includePrivate });

  const [{ total }] = await baseQb.clone().count("* as total");
  const totalInt = parseInt(total, 10);

  if (totalInt === 0) {
    return { items: [], total: 0, page, limit, totalPages: 0 };
  }

  const rows = await baseQb
    .clone()
    .leftJoin({ t2: "taxa" }, "t1.parent_id", "t2.taxon_id")
    .leftJoin({ t3: "taxa" }, "t2.parent_id", "t3.taxon_id")
    .leftJoin({ t4: "taxa" }, "t3.parent_id", "t4.taxon_id")
    .leftJoin({ p: "provinces" }, "s.province_id", "p.province_id")
    .select(
      "img.*",
      "sr.specimen_code",
      "sr.basis_of_record",
      "s.gbif_scientific_name",
      "s.collection_date",
      "s.is_public as specimen_is_public",
      "t1.scientific_name as taxon_name",
      "t1.taxon_rank as taxon_rank",
      knex.raw(`COALESCE(
        CASE WHEN t1.taxon_rank = 'Order' THEN t1.scientific_name END,
        CASE WHEN t2.taxon_rank = 'Order' THEN t2.scientific_name END,
        CASE WHEN t3.taxon_rank = 'Order' THEN t3.scientific_name END,
        CASE WHEN t4.taxon_rank = 'Order' THEN t4.scientific_name END
      ) AS order_name`),
      knex.raw(`COALESCE(
        CASE WHEN t1.taxon_rank = 'Family' THEN t1.scientific_name END,
        CASE WHEN t2.taxon_rank = 'Family' THEN t2.scientific_name END,
        CASE WHEN t3.taxon_rank = 'Family' THEN t3.scientific_name END
      ) AS family_name`),
      "p.province_name_vn",
    )
    .orderBy("img.uploaded_at", "desc")
    .orderBy("img.image_id", "desc")
    .limit(limit)
    .offset(offset);

  return {
    items: rows,
    total: totalInt,
    page,
    limit,
    totalPages: Math.ceil(totalInt / limit),
  };
}

async function findById(imageId) {
  return knex("specimen_images").where("image_id", imageId).first();
}

async function findByIdWithSpecimen(imageId) {
  return knex({ img: "specimen_images" })
    .join({ s: "specimens" }, "img.specimen_id", "s.specimen_id")
    .where("img.image_id", imageId)
    .whereNull("s.deleted_at")
    .select(
      "img.image_id",
      "img.object_key",
      "img.thumbnail_key",
      "img.is_public as img_is_public",
      "s.is_public as specimen_is_public",
      "img.license_code",
      "img.file_size_bytes",
    )
    .first();
}

async function create(data) {
  const [row] = await knex("specimen_images")
    .insert({
      specimen_id: data.specimenId,
      uploaded_by: data.uploadedBy || null,
      object_key: data.objectKey,
      thumbnail_key: data.thumbnailKey || data.objectKey,
      shot_type: data.shotType || "field",
      file_size_bytes: data.fileSizeBytes || null,
      width_px: data.widthPx || null,
      height_px: data.heightPx || null,
      license_code: data.licenseCode,
      attribution: data.attribution || null,
      source_url: data.sourceUrl || null,
      external_photo_id: data.externalPhotoId || null,
      source_provider: data.sourceProvider || "MINIO",
      is_public: data.isPublic ?? true,
    })
    .returning("*");
  return row;
}

async function remove(imageId) {
  await knex("specimen_images").where("image_id", imageId).delete();
}

async function getStats({ includePrivate = false } = {}) {
  const visSql = includePrivate ? "" : "AND img.is_public = true AND s.is_public = true";
  const [summaryRes, byLicenseRes] = await Promise.all([
    knex.raw(`
      SELECT
        COUNT(*)::int AS total_images,
        COUNT(*) FILTER (WHERE img.license_code IN ('cc0', 'cc-by'))::int AS dwca_exportable,
        COUNT(*) FILTER (WHERE img.license_code IN ('cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa'))::int AS restricted_nc_sa,
        COUNT(DISTINCT img.specimen_id)::int AS specimens_with_media
      FROM specimen_images img
      JOIN specimens s ON img.specimen_id = s.specimen_id
      WHERE s.deleted_at IS NULL ${visSql}
    `),
    knex.raw(`
      SELECT COALESCE(img.license_code, 'unknown') AS license_code, COUNT(*)::int AS count
      FROM specimen_images img
      JOIN specimens s ON img.specimen_id = s.specimen_id
      WHERE s.deleted_at IS NULL ${visSql}
      GROUP BY 1
      ORDER BY count DESC
    `),
  ]);

  const s = summaryRes.rows[0] || {};
  return {
    totalImages: s.total_images || 0,
    dwcaExportable: s.dwca_exportable || 0,
    restrictedNcSa: s.restricted_nc_sa || 0,
    specimensWithMedia: s.specimens_with_media || 0,
    byLicense: byLicenseRes.rows,
  };
}

module.exports = {
  findMany,
  findById,
  findByIdWithSpecimen,
  create,
  remove,
  getStats,
};
