/**
 * specimen.repository.js — 100% dùng Knex query builder (SRS §6.5).
 * Hỗ trợ phân vùng specimens theo năm, truy vấn không gian PostGIS (ST_DWithin, BBox, Grid),
 * phân quyền dữ liệu công khai / nội bộ và ghi lịch sử thay đổi (specimen_change_history).
 */
const knex = require("../../config/knex");

function escapeLike(raw) {
  return String(raw || "").slice(0, 120).replace(/[%_\\]/g, "\\$&");
}

/**
 * Áp dụng tập điều kiện lọc chung cho cả findMany, count, và bản đồ GIS.
 */
function applyFilters(qb, filters, { includePrivate = false, needRegistryJoin = false } = {}) {
  qb.whereNull("s.deleted_at");

  if (!includePrivate) {
    qb.where("s.is_public", true);
  } else if (typeof filters.isPublic === "boolean") {
    qb.where("s.is_public", filters.isPublic);
  }

  if (filters.provinceId) {
    qb.where("s.province_id", filters.provinceId);
  }
  if (filters.habitatId) {
    qb.where("s.habitat_id", filters.habitatId);
  }
  if (filters.lifeStageId) {
    qb.where("s.life_stage_id", filters.lifeStageId);
  }
  if (filters.statusId) {
    qb.where("s.status_id", filters.statusId);
  }
  if (filters.sex) {
    qb.where("s.sex", filters.sex);
  }
  if (filters.dateFrom) {
    qb.where("s.collection_date", ">=", filters.dateFrom);
  }
  if (filters.dateTo) {
    qb.where("s.collection_date", "<=", filters.dateTo);
  }
  if (filters.hasCoordinates === true) {
    qb.whereNotNull("s.collection_point");
  } else if (filters.hasCoordinates === false) {
    qb.whereNull("s.collection_point");
  }

  if (filters.basisOfRecord && needRegistryJoin) {
    qb.where("sr.basis_of_record", filters.basisOfRecord);
  }

  // Lọc theo taxonId (bao gồm toàn bộ nhánh con bằng CTE đệ quy)
  if (filters.taxonId) {
    qb.whereRaw(
      `s.taxon_id IN (
        WITH RECURSIVE sub_taxa AS (
          SELECT taxon_id FROM taxa WHERE taxon_id = ?
          UNION ALL
          SELECT c.taxon_id FROM taxa c JOIN sub_taxa st ON c.parent_id = st.taxon_id
        )
        SELECT taxon_id FROM sub_taxa
      )`,
      [filters.taxonId],
    );
  } else if (filters.order) {
    qb.whereRaw(
      `s.taxon_id IN (
        WITH RECURSIVE sub_taxa AS (
          SELECT taxon_id FROM taxa WHERE lower(scientific_name) = lower(?) AND taxon_rank = 'Order'
          UNION ALL
          SELECT c.taxon_id FROM taxa c JOIN sub_taxa st ON c.parent_id = st.taxon_id
        )
        SELECT taxon_id FROM sub_taxa
      )`,
      [filters.order],
    );
  }

  // Tìm kiếm từ khóa đa trường
  if (filters.q && filters.q.trim()) {
    const safe = `%${escapeLike(filters.q.trim())}%`;
    qb.andWhere((sub) => {
      sub
        .whereRaw("s.gbif_scientific_name ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("s.common_name_vn ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("s.common_name_en ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("s.locality_detail ILIKE ? ESCAPE '\\'", [safe]);
      if (needRegistryJoin) {
        sub
          .orWhereRaw("sr.specimen_code ILIKE ? ESCAPE '\\'", [safe])
          .orWhereRaw("sr.recorded_by ILIKE ? ESCAPE '\\'", [safe])
          .orWhereRaw("sr.catalog_number ILIKE ? ESCAPE '\\'", [safe]);
      }
    });
  }

  // Truy vấn bán kính PostGIS (ST_DWithin dùng đơn vị mét trên kiểu GEOGRAPHY)
  if (filters.lat != null && filters.lon != null && filters.radiusKm != null) {
    const radiusMeters = Number(filters.radiusKm) * 1000;
    qb.whereNotNull("s.collection_point").whereRaw(
      "ST_DWithin(s.collection_point, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)",
      [filters.lon, filters.lat, radiusMeters],
    );
  }

  // Bounding box cho bản đồ
  if (
    filters.minLat != null &&
    filters.maxLat != null &&
    filters.minLon != null &&
    filters.maxLon != null
  ) {
    qb.whereNotNull("s.collection_point").whereRaw(
      "s.collection_point::geometry && ST_MakeEnvelope(?, ?, ?, ?, 4326)",
      [filters.minLon, filters.minLat, filters.maxLon, filters.maxLat],
    );
  }

  return qb;
}

const SORT_COLUMN_MAP = {
  collectionDate: "s.collection_date",
  createdAt: "s.created_at",
  specimenId: "s.specimen_id",
  scientificName: "s.gbif_scientific_name",
  individualCount: "s.individual_count",
};

async function findMany(filters, { includePrivate = false } = {}) {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 25;
  const offset = (page - 1) * limit;
  const needRegistryJoin = Boolean(filters.basisOfRecord || (filters.q && filters.q.trim()));

  // 1. Đếm tổng bản ghi khớp điều kiện (tối ưu: chỉ join specimen_registry khi thực sự lọc theo cột của nó)
  const countQb = knex({ s: "specimens" });
  if (needRegistryJoin) {
    countQb.join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id");
  }
  applyFilters(countQb, filters, { includePrivate, needRegistryJoin });
  const [{ total }] = await countQb.count("* as total");
  const totalInt = parseInt(total, 10);

  if (totalInt === 0) {
    return { items: [], total: 0, page, limit, totalPages: 0 };
  }

  // 2. Truy vấn dữ liệu trang hiện tại kèm phân cấp Taxon + Tỉnh + Tọa độ PostGIS
  const dataQb = knex({ s: "specimens" })
    .join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id")
    .join({ t1: "taxa" }, "s.taxon_id", "t1.taxon_id")
    .leftJoin({ t2: "taxa" }, "t1.parent_id", "t2.taxon_id")
    .leftJoin({ t3: "taxa" }, "t2.parent_id", "t3.taxon_id")
    .leftJoin({ t4: "taxa" }, "t3.parent_id", "t4.taxon_id")
    .leftJoin({ p: "provinces" }, "s.province_id", "p.province_id")
    .leftJoin({ h: "habitat_types" }, "s.habitat_id", "h.habitat_id")
    .leftJoin({ ls: "life_stages" }, "s.life_stage_id", "ls.stage_id")
    .leftJoin({ st: "specimen_status_types" }, "s.status_id", "st.status_id")
    .select(
      "s.specimen_id",
      "sr.specimen_code",
      "sr.gbif_occurrence_id",
      "sr.basis_of_record",
      "sr.catalog_number",
      "sr.institution_code",
      "sr.recorded_by",
      "s.taxon_id",
      "t1.scientific_name as taxon_name",
      "t1.taxon_rank as taxon_rank",
      "t1.slug as taxon_slug",
      "s.gbif_scientific_name",
      "s.common_name_vn",
      "s.common_name_en",
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
      knex.raw(`COALESCE(
        CASE WHEN t1.taxon_rank = 'Genus' THEN t1.scientific_name END,
        CASE WHEN t2.taxon_rank = 'Genus' THEN t2.scientific_name END
      ) AS genus_name`),
      "s.province_id",
      "p.province_name_vn",
      "p.province_name_en",
      "s.district",
      "s.commune",
      "s.locality_detail",
      knex.raw("ST_Y(s.collection_point::geometry) AS latitude"),
      knex.raw("ST_X(s.collection_point::geometry) AS longitude"),
      "s.collection_date",
      "s.sex",
      "s.individual_count",
      "s.is_public",
      "h.label_vn as habitat_label_vn",
      "ls.label_vn as life_stage_label_vn",
      "st.label_vn as status_label_vn",
      "s.created_at",
      "s.updated_at",
    );

  if (filters.lat != null && filters.lon != null && filters.radiusKm != null) {
    dataQb.select(
      knex.raw(
        "ROUND((ST_Distance(s.collection_point, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography) / 1000.0)::numeric, 2) AS distance_km",
        [filters.lon, filters.lat],
      ),
    );
  }

  applyFilters(dataQb, filters, { includePrivate, needRegistryJoin: true });

  const sortCol = SORT_COLUMN_MAP[filters.sortBy] || "s.collection_date";
  const sortDir = filters.sortOrder === "asc" ? "asc" : "desc";
  dataQb.orderBy(sortCol, sortDir).orderBy("s.specimen_id", "desc").limit(limit).offset(offset);

  const rows = await dataQb;

  return {
    items: rows,
    total: totalInt,
    page,
    limit,
    totalPages: Math.ceil(totalInt / limit),
  };
}

/**
 * Truy vấn dữ liệu chuyên dụng cho Bản đồ phân bố GIS (SCR-18):
 * 1. points: danh sách tọa độ chi tiết (giới hạn limit để render mượt trên Canvas)
 * 2. provinceClusters: mật độ tổng hợp trên TOÀN BỘ tập kết quả khớp lọc theo tỉnh/thành
 * 3. heatGrid: lưới mật độ không gian (0.25 độ ~ 25km) trên toàn bộ tập kết quả khớp lọc
 */
async function findMapData(filters, { includePrivate = false } = {}) {
  const limit = Number(filters.limit) || 3000;
  const needRegistryJoin = Boolean(filters.basisOfRecord || (filters.q && filters.q.trim()));

  // 1. Đếm tổng & gom cụm theo Tỉnh/thành
  const clusterQb = knex({ s: "specimens" }).leftJoin({ p: "provinces" }, "s.province_id", "p.province_id");
  if (needRegistryJoin) {
    clusterQb.join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id");
  }
  clusterQb.whereNotNull("s.collection_point");
  applyFilters(clusterQb, filters, { includePrivate, needRegistryJoin });

  const clusterPromise = clusterQb
    .clone()
    .groupBy("p.province_id", "p.province_name_vn", "p.province_name_en")
    .select(
      "p.province_id",
      knex.raw("COALESCE(p.province_name_vn, 'Chưa rõ tỉnh/thành') AS province_name_vn"),
      "p.province_name_en",
      knex.raw("COUNT(*)::int AS count"),
      knex.raw("ROUND(AVG(ST_Y(s.collection_point::geometry))::numeric, 5)::float AS lat"),
      knex.raw("ROUND(AVG(ST_X(s.collection_point::geometry))::numeric, 5)::float AS lon"),
    )
    .orderBy("count", "desc");

  // 2. Lưới mật độ không gian (Grid 0.25 độ) để vẽ Heatmap chuẩn xác cho cả 100k+ điểm
  const gridQb = knex({ s: "specimens" });
  if (needRegistryJoin) {
    gridQb.join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id");
  }
  gridQb.whereNotNull("s.collection_point");
  applyFilters(gridQb, filters, { includePrivate, needRegistryJoin });

  const gridPromise = gridQb
    .select(
      knex.raw("ROUND((FLOOR(ST_Y(s.collection_point::geometry) * 4) / 4.0 + 0.125)::numeric, 4)::float AS lat"),
      knex.raw("ROUND((FLOOR(ST_X(s.collection_point::geometry) * 4) / 4.0 + 0.125)::numeric, 4)::float AS lon"),
      knex.raw("COUNT(*)::int AS count"),
    )
    .groupByRaw("1, 2")
    .orderBy("count", "desc")
    .limit(600);

  // 3. Điểm mẫu vật chi tiết
  const pointsQb = knex({ s: "specimens" })
    .join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id")
    .join({ t1: "taxa" }, "s.taxon_id", "t1.taxon_id")
    .leftJoin({ t2: "taxa" }, "t1.parent_id", "t2.taxon_id")
    .leftJoin({ t3: "taxa" }, "t2.parent_id", "t3.taxon_id")
    .leftJoin({ p: "provinces" }, "s.province_id", "p.province_id")
    .whereNotNull("s.collection_point")
    .select(
      "s.specimen_id",
      "sr.specimen_code",
      "sr.basis_of_record",
      "s.gbif_scientific_name",
      "t1.scientific_name as taxon_name",
      knex.raw(`COALESCE(
        CASE WHEN t1.taxon_rank = 'Order' THEN t1.scientific_name END,
        CASE WHEN t2.taxon_rank = 'Order' THEN t2.scientific_name END,
        CASE WHEN t3.taxon_rank = 'Order' THEN t3.scientific_name END
      ) AS order_name`),
      "p.province_name_vn",
      "s.collection_date",
      "s.individual_count",
      knex.raw("ROUND(ST_Y(s.collection_point::geometry)::numeric, 5)::float AS lat"),
      knex.raw("ROUND(ST_X(s.collection_point::geometry)::numeric, 5)::float AS lon"),
    );

  applyFilters(pointsQb, filters, { includePrivate, needRegistryJoin: true });
  pointsQb.orderBy("s.collection_date", "desc").limit(limit);

  const [provinceClusters, heatGrid, points] = await Promise.all([
    clusterPromise,
    gridPromise,
    pointsQb,
  ]);

  const totalMatching = provinceClusters.reduce((acc, row) => acc + Number(row.count || 0), 0);

  return {
    totalMatching,
    returnedPoints: points.length,
    points,
    provinceClusters,
    heatGrid,
  };
}

async function findById(specimenId, { includePrivate = false } = {}) {
  const qb = knex({ s: "specimens" })
    .join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id")
    .join({ t1: "taxa" }, "s.taxon_id", "t1.taxon_id")
    .leftJoin({ t2: "taxa" }, "t1.parent_id", "t2.taxon_id")
    .leftJoin({ t3: "taxa" }, "t2.parent_id", "t3.taxon_id")
    .leftJoin({ t4: "taxa" }, "t3.parent_id", "t4.taxon_id")
    .leftJoin({ p: "provinces" }, "s.province_id", "p.province_id")
    .leftJoin({ h: "habitat_types" }, "s.habitat_id", "h.habitat_id")
    .leftJoin({ ls: "life_stages" }, "s.life_stage_id", "ls.stage_id")
    .leftJoin({ st: "specimen_status_types" }, "s.status_id", "st.status_id")
    .where("s.specimen_id", specimenId)
    .whereNull("s.deleted_at")
    .select(
      "s.*",
      "sr.specimen_code",
      "sr.gbif_occurrence_id",
      "sr.gbif_dataset_key",
      "sr.basis_of_record",
      "sr.catalog_number",
      "sr.institution_code",
      "sr.recorded_by",
      "sr.occurrence_remarks",
      "t1.scientific_name as taxon_name",
      "t1.taxon_rank as taxon_rank",
      "t1.slug as taxon_slug",
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
      knex.raw(`COALESCE(
        CASE WHEN t1.taxon_rank = 'Genus' THEN t1.scientific_name END,
        CASE WHEN t2.taxon_rank = 'Genus' THEN t2.scientific_name END
      ) AS genus_name`),
      "p.province_name_vn",
      "p.province_name_en",
      "h.label_vn as habitat_label_vn",
      "ls.label_vn as life_stage_label_vn",
      "st.label_vn as status_label_vn",
      knex.raw("ST_Y(s.collection_point::geometry) AS latitude"),
      knex.raw("ST_X(s.collection_point::geometry) AS longitude"),
    );

  if (!includePrivate) {
    qb.where("s.is_public", true);
  }

  const row = await qb.first();
  if (!row) return null;

  const [images, dnaSequences, changeHistory] = await Promise.all([
    knex("specimen_images")
      .where("specimen_id", specimenId)
      .modify((q) => {
        if (!includePrivate) q.where("is_public", true);
      })
      .orderBy("uploaded_at", "desc"),
    knex("dna_sequences")
      .where("specimen_id", specimenId)
      .modify((q) => {
        if (!includePrivate) q.where("is_public", true);
      })
      .orderBy("created_at", "desc"),
    includePrivate
      ? knex({ ch: "specimen_change_history" })
          .leftJoin({ a: "admin_users" }, "ch.changed_by", "a.admin_id")
          .where("ch.specimen_id", specimenId)
          .select("ch.*", "a.username as changed_by_username")
          .orderBy("ch.changed_at", "desc")
          .limit(30)
      : Promise.resolve([]),
  ]);

  return { ...row, images, dnaSequences, changeHistory };
}

async function findRegistryByCode(specimenCode) {
  return knex("specimen_registry").where("specimen_code", specimenCode).first();
}

async function taxonExists(taxonId) {
  const row = await knex("taxa").select("taxon_id").where("taxon_id", taxonId).first();
  return Boolean(row);
}

async function provinceExists(provinceId) {
  const row = await knex("provinces").select("province_id").where("province_id", provinceId).first();
  return Boolean(row);
}

async function create(data, adminId) {
  return knex.transaction(async (trx) => {
    const code =
      data.specimenCode ||
      `VN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const [reg] = await trx("specimen_registry")
      .insert({
        specimen_code: code,
        basis_of_record: data.basisOfRecord || "PRESERVED_SPECIMEN",
        catalog_number: data.catalogNumber || null,
        institution_code: data.institutionCode || null,
        recorded_by: data.recordedBy || null,
        occurrence_remarks: data.occurrenceRemarks || null,
      })
      .returning(["specimen_id", "specimen_code"]);

    const pointExpr =
      data.latitude != null && data.longitude != null
        ? trx.raw("ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography", [data.longitude, data.latitude])
        : null;

    await trx("specimens").insert({
      specimen_id: reg.specimen_id,
      taxon_id: data.taxonId,
      province_id: data.provinceId || null,
      habitat_id: data.habitatId || null,
      life_stage_id: data.lifeStageId || null,
      status_id: data.statusId || null,
      created_by: adminId || null,
      updated_by: adminId || null,
      common_name_vn: data.commonNameVn || null,
      common_name_en: data.commonNameEn || null,
      gbif_scientific_name: data.gbifScientificName || null,
      district: data.district || null,
      commune: data.commune || null,
      locality_detail: data.localityDetail || null,
      collection_point: pointExpr,
      gps_accuracy_m: data.gpsAccuracyM ?? null,
      collection_date: data.collectionDate,
      sex: data.sex || null,
      individual_count: data.individualCount || 1,
      storage_number: data.storageNumber || null,
      notes: data.notes || null,
      is_public: data.isPublic ?? true,
    });

    return reg.specimen_id;
  });
}

const REGISTRY_UPDATE_MAP = [
  { key: "specimenCode", col: "specimen_code" },
  { key: "basisOfRecord", col: "basis_of_record" },
  { key: "catalogNumber", col: "catalog_number" },
  { key: "institutionCode", col: "institution_code" },
  { key: "recordedBy", col: "recorded_by" },
  { key: "occurrenceRemarks", col: "occurrence_remarks" },
];

const SPECIMEN_UPDATE_MAP = [
  { key: "taxonId", col: "taxon_id" },
  { key: "provinceId", col: "province_id" },
  { key: "habitatId", col: "habitat_id" },
  { key: "lifeStageId", col: "life_stage_id" },
  { key: "statusId", col: "status_id" },
  { key: "commonNameVn", col: "common_name_vn" },
  { key: "commonNameEn", col: "common_name_en" },
  { key: "gbifScientificName", col: "gbif_scientific_name" },
  { key: "district", col: "district" },
  { key: "commune", col: "commune" },
  { key: "localityDetail", col: "locality_detail" },
  { key: "gpsAccuracyM", col: "gps_accuracy_m" },
  { key: "collectionDate", col: "collection_date" },
  { key: "sex", col: "sex" },
  { key: "individualCount", col: "individual_count" },
  { key: "storageNumber", col: "storage_number" },
  { key: "notes", col: "notes" },
  { key: "isPublic", col: "is_public" },
];

async function update(specimenId, current, data, adminId) {
  return knex.transaction(async (trx) => {
    const regUpdate = {};
    const specUpdate = {};
    const historyRows = [];

    for (const { key, col } of REGISTRY_UPDATE_MAP) {
      if (key in data) {
        const nextVal = data[key] === "" ? null : data[key];
        const prevVal = current[col];
        if (String(prevVal ?? "") !== String(nextVal ?? "")) {
          regUpdate[col] = nextVal;
          historyRows.push({
            specimen_id: specimenId,
            changed_by: adminId || null,
            field_name: col,
            old_value: prevVal != null ? String(prevVal) : null,
            new_value: nextVal != null ? String(nextVal) : null,
          });
        }
      }
    }

    for (const { key, col } of SPECIMEN_UPDATE_MAP) {
      if (key in data) {
        const nextVal = data[key] === "" ? null : data[key];
        let prevVal = current[col];
        if (col === "collection_date" && prevVal instanceof Date) {
          prevVal = prevVal.toISOString().slice(0, 10);
        }
        if (String(prevVal ?? "") !== String(nextVal ?? "")) {
          specUpdate[col] = nextVal;
          historyRows.push({
            specimen_id: specimenId,
            changed_by: adminId || null,
            field_name: col,
            old_value: prevVal != null ? String(prevVal) : null,
            new_value: nextVal != null ? String(nextVal) : null,
          });
        }
      }
    }

    if ("latitude" in data || "longitude" in data) {
      if (data.latitude == null && data.longitude == null) {
        specUpdate.collection_point = null;
      } else if (data.latitude != null && data.longitude != null) {
        specUpdate.collection_point = trx.raw(
          "ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography",
          [data.longitude, data.latitude],
        );
      }
      historyRows.push({
        specimen_id: specimenId,
        changed_by: adminId || null,
        field_name: "collection_point",
        old_value:
          current.latitude != null ? `${current.latitude},${current.longitude}` : null,
        new_value:
          data.latitude != null ? `${data.latitude},${data.longitude}` : null,
      });
    }

    if (Object.keys(regUpdate).length > 0) {
      await trx("specimen_registry").where("specimen_id", specimenId).update(regUpdate);
    }

    if (Object.keys(specUpdate).length > 0) {
      specUpdate.updated_by = adminId || null;
      specUpdate.updated_at = trx.fn.now();
      await trx("specimens")
        .where("specimen_id", specimenId)
        .whereNull("deleted_at")
        .update(specUpdate);
    }

    if (historyRows.length > 0) {
      await trx("specimen_change_history").insert(historyRows);
    }
  });
}

async function batchUpdatePublic(specimenIds, isPublic, adminId) {
  return knex("specimens")
    .whereIn("specimen_id", specimenIds)
    .whereNull("deleted_at")
    .update({
      is_public: isPublic,
      updated_by: adminId || null,
      updated_at: knex.fn.now(),
    });
}

async function softDelete(specimenId, adminId) {
  return knex("specimens")
    .where("specimen_id", specimenId)
    .whereNull("deleted_at")
    .update({
      deleted_at: knex.fn.now(),
      updated_by: adminId || null,
      updated_at: knex.fn.now(),
    });
}

async function findLookups() {
  const [orders, provinces, habitats, lifeStages, statuses] = await Promise.all([
    knex("taxa")
      .select("taxon_id as id", "scientific_name as scientificName", "vernacular_name_vn as vernacularNameVn")
      .where("taxon_rank", "Order")
      .orderBy("scientific_name", "asc"),
    knex("provinces")
      .select(
        "province_id as id",
        "province_code as code",
        "province_name_vn as nameVn",
        "province_name_en as nameEn",
        "region",
      )
      .orderBy("province_name_vn", "asc"),
    knex("habitat_types")
      .select("habitat_id as id", "code", "label_vn as labelVn", "label_en as labelEn")
      .where("is_active", true)
      .orderBy("sort_order", "asc"),
    knex("life_stages")
      .select("stage_id as id", "code", "label_vn as labelVn", "label_en as labelEn")
      .where("is_active", true)
      .orderBy("sort_order", "asc"),
    knex("specimen_status_types")
      .select("status_id as id", "code", "label_vn as labelVn", "label_en as labelEn")
      .where("is_active", true)
      .orderBy("sort_order", "asc"),
  ]);

  return { orders, provinces, habitats, lifeStages, statuses };
}

async function getStats({ includePrivate = false } = {}) {
  const visibilitySql = includePrivate ? "" : "AND s.is_public = true";

  const [summaryRes, byOrderRes, byProvinceRes, taxaSummaryRes, dnaCountRes, imageCountRes] =
    await Promise.all([
      knex.raw(`
        SELECT
          COUNT(*)::int AS total_specimens,
          COUNT(*) FILTER (WHERE s.is_public = true)::int AS public_specimens,
          COUNT(*) FILTER (WHERE s.collection_point IS NOT NULL)::int AS with_coordinates,
          COUNT(DISTINCT s.province_id) FILTER (WHERE s.province_id IS NOT NULL)::int AS provinces_covered,
          COUNT(DISTINCT s.gbif_scientific_name) FILTER (WHERE s.gbif_scientific_name IS NOT NULL)::int AS distinct_scientific_names,
          COUNT(DISTINCT regexp_replace(s.gbif_scientific_name, '^([A-Z][a-z]+\\s+[a-z-]+).*$', '\\1'))
            FILTER (WHERE s.gbif_scientific_name ~ '^[A-Z][a-z]+\\s+[a-z-]+')::int AS distinct_binomial_species
        FROM specimens s
        WHERE s.deleted_at IS NULL ${visibilitySql}
      `),
      knex.raw(`
        SELECT
          COALESCE(
            CASE WHEN t1.taxon_rank = 'Order' THEN t1.scientific_name END,
            CASE WHEN t2.taxon_rank = 'Order' THEN t2.scientific_name END,
            CASE WHEN t3.taxon_rank = 'Order' THEN t3.scientific_name END,
            t1.scientific_name
          ) AS order_name,
          COUNT(*)::int AS count
        FROM specimens s
        JOIN taxa t1 ON s.taxon_id = t1.taxon_id
        LEFT JOIN taxa t2 ON t1.parent_id = t2.taxon_id
        LEFT JOIN taxa t3 ON t2.parent_id = t3.taxon_id
        WHERE s.deleted_at IS NULL ${visibilitySql}
        GROUP BY 1
        ORDER BY count DESC
      `),
      knex.raw(`
        SELECT
          p.province_id,
          p.province_name_vn,
          COUNT(*)::int AS count,
          ROUND(AVG(ST_Y(s.collection_point::geometry))::numeric, 4)::float AS lat,
          ROUND(AVG(ST_X(s.collection_point::geometry))::numeric, 4)::float AS lon
        FROM specimens s
        JOIN provinces p ON s.province_id = p.province_id
        WHERE s.deleted_at IS NULL ${visibilitySql}
        GROUP BY p.province_id, p.province_name_vn
        ORDER BY count DESC
        LIMIT 15
      `),
      knex.raw(`
        SELECT
          COUNT(*)::int AS total_taxa,
          COUNT(*) FILTER (WHERE taxon_rank = 'Family')::int AS family_count,
          COUNT(*) FILTER (WHERE taxon_rank = 'Genus')::int AS genus_count,
          COUNT(*) FILTER (WHERE taxon_rank = 'Species')::int AS species_count,
          COUNT(*) FILTER (WHERE taxon_rank = 'Order')::int AS order_count
        FROM taxa
      `),
      knex("dna_sequences")
        .modify((q) => {
          if (!includePrivate) q.where("is_public", true);
        })
        .count("* as cnt")
        .first(),
      knex({ img: "specimen_images" })
        .join({ s: "specimens" }, "img.specimen_id", "s.specimen_id")
        .whereNull("s.deleted_at")
        .modify((q) => {
          if (!includePrivate) q.where("img.is_public", true).where("s.is_public", true);
        })
        .count("* as cnt")
        .first(),
    ]);

  const sRow = summaryRes.rows[0] || {};
  const tRow = taxaSummaryRes.rows[0] || {};

  return {
    totalSpecimens: sRow.total_specimens || 0,
    publicSpecimens: sRow.public_specimens || 0,
    withCoordinates: sRow.with_coordinates || 0,
    provincesCovered: sRow.provinces_covered || 0,
    distinctScientificNames: sRow.distinct_scientific_names || 0,
    distinctBinomialSpecies: sRow.distinct_binomial_species || 0,
    taxa: {
      total: tRow.total_taxa || 0,
      orders: tRow.order_count || 0,
      families: tRow.family_count || 0,
      genera: tRow.genus_count || 0,
      species: tRow.species_count || 0,
    },
    dnaCount: parseInt(dnaCountRes?.cnt || 0, 10),
    imageCount: parseInt(imageCountRes?.cnt || 0, 10),
    byOrder: byOrderRes.rows,
    topProvinces: byProvinceRes.rows,
  };
}

module.exports = {
  knex,
  applyFilters,
  findMany,
  findMapData,
  findById,
  findRegistryByCode,
  taxonExists,
  provinceExists,
  create,
  update,
  batchUpdatePublic,
  softDelete,
  findLookups,
  getStats,
};
