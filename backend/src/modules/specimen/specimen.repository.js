/**
 * specimen.repository.js — 100% dùng Knex query builder (SRS §6.5).
 * Hỗ trợ phân vùng specimens theo năm, truy vấn không gian PostGIS (ST_DWithin, BBox, Grid),
 * phân quyền dữ liệu công khai / nội bộ và ghi lịch sử thay đổi (specimen_change_history).
 */
const knex = require("../../config/knex");
const { enqueueOutbox, enqueueOutboxBatch } = require("../search/esOutbox.service");

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
  if (filters.district && String(filters.district).trim()) {
    const safeDist = `%${escapeLike(String(filters.district).trim())}%`;
    qb.whereRaw("s.district ILIKE ? ESCAPE '\\'", [safeDist]);
  }
  if (filters.region && String(filters.region).trim()) {
    qb.whereIn("s.province_id", function () {
      this.select("province_id").from("provinces").where("region", String(filters.region).trim());
    });
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
  if (filters.minElevation != null && filters.minElevation !== "") {
    qb.where("s.elevation_m", ">=", Number(filters.minElevation));
  }
  if (filters.maxElevation != null && filters.maxElevation !== "") {
    qb.where("s.elevation_m", "<=", Number(filters.maxElevation));
  }
  if (filters.hasCoordinates === true) {
    qb.whereNotNull("s.collection_point");
  } else if (filters.hasCoordinates === false) {
    qb.whereNull("s.collection_point");
  }

  if (filters.basisOfRecord && needRegistryJoin) {
    qb.where("sr.basis_of_record", filters.basisOfRecord);
  }
  if (filters.institutionCode && String(filters.institutionCode).trim() && needRegistryJoin) {
    qb.where("sr.institution_code", String(filters.institutionCode).trim());
  }

  // Lọc theo taxonId hoặc theo bậc phân loại (Species -> Genus -> Family -> Order) bằng CTE đệ quy
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
  } else if (filters.species && String(filters.species).trim()) {
    qb.whereRaw(
      `s.taxon_id IN (
        WITH RECURSIVE sub_taxa AS (
          SELECT taxon_id FROM taxa WHERE lower(scientific_name) = lower(?) AND taxon_rank = 'Species'
          UNION ALL
          SELECT c.taxon_id FROM taxa c JOIN sub_taxa st ON c.parent_id = st.taxon_id
        )
        SELECT taxon_id FROM sub_taxa
      )`,
      [String(filters.species).trim()],
    );
  } else if (filters.genus && String(filters.genus).trim()) {
    qb.whereRaw(
      `s.taxon_id IN (
        WITH RECURSIVE sub_taxa AS (
          SELECT taxon_id FROM taxa WHERE lower(scientific_name) = lower(?) AND taxon_rank = 'Genus'
          UNION ALL
          SELECT c.taxon_id FROM taxa c JOIN sub_taxa st ON c.parent_id = st.taxon_id
        )
        SELECT taxon_id FROM sub_taxa
      )`,
      [String(filters.genus).trim()],
    );
  } else if (filters.family && String(filters.family).trim()) {
    qb.whereRaw(
      `s.taxon_id IN (
        WITH RECURSIVE sub_taxa AS (
          SELECT taxon_id FROM taxa WHERE lower(scientific_name) = lower(?) AND taxon_rank = 'Family'
          UNION ALL
          SELECT c.taxon_id FROM taxa c JOIN sub_taxa st ON c.parent_id = st.taxon_id
        )
        SELECT taxon_id FROM sub_taxa
      )`,
      [String(filters.family).trim()],
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
/**
 * Xác định độ phân giải ô lưới không gian PostGIS (độ kinh/vĩ) tương ứng với mức thu phóng (zoom) của bản đồ.
 */
function resolveGridSizeDeg(filters = {}) {
  if (filters.gridSizeDeg && Number(filters.gridSizeDeg) >= 0.005 && Number(filters.gridSizeDeg) <= 2) {
    return Number(filters.gridSizeDeg);
  }
  const zoom = Number(filters.zoom) || 6;
  if (zoom >= 13) return 0.01;  // ~1.1 km
  if (zoom >= 11) return 0.025; // ~2.8 km
  if (zoom >= 9) return 0.05;   // ~5.5 km
  if (zoom >= 7) return 0.125;  // ~13.8 km
  return 0.25;                  // ~27.8 km ở tỷ lệ toàn quốc (zoom <= 6) giúp các ô lưới tách bạch rõ ràng
}

/**
 * Điều kiện kiểm tra tọa độ địa lý WGS84 hợp lệ trên PostGIS (loại trừ NULL, NaN, ngoài dải [-90..90, -180..180], hoặc (0,0)).
 */
function applyValidCoordinatesConstraint(qb) {
  qb.whereNotNull("s.collection_point").whereRaw(
    `ST_Y(s.collection_point::geometry) BETWEEN -90 AND 90
     AND ST_X(s.collection_point::geometry) BETWEEN -180 AND 180
     AND NOT (ST_Y(s.collection_point::geometry) = 0 AND ST_X(s.collection_point::geometry) = 0)`,
  );
  return qb;
}

async function findMapData(filters, { includePrivate = false } = {}) {
  const limit = Number(filters.limit) || 3000;
  const gridSizeDeg = resolveGridSizeDeg(filters);
  const invGrid = Number((1 / gridSizeDeg).toFixed(6));
  const halfGrid = Number((gridSizeDeg / 2).toFixed(6));
  const needRegistryJoin = Boolean(
    filters.basisOfRecord ||
      (filters.institutionCode && String(filters.institutionCode).trim()) ||
      (filters.q && filters.q.trim()),
  );

  // 1. Đếm tổng & gom cụm theo Tỉnh/thành (loại trừ tọa độ không hợp lệ & bản ghi trùng specimen_id)
  const clusterQb = knex({ s: "specimens" })
    .leftJoin({ p: "provinces" }, "s.province_id", "p.province_id")
    .leftJoin({ t1: "taxa" }, "s.taxon_id", "t1.taxon_id");
  if (needRegistryJoin) {
    clusterQb.join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id");
  }
  applyValidCoordinatesConstraint(clusterQb);
  applyFilters(clusterQb, filters, { includePrivate, needRegistryJoin });

  const clusterPromise = clusterQb
    .clone()
    .groupBy("p.province_id", "p.province_name_vn", "p.province_name_en", "p.region")
    .select(
      "p.province_id",
      knex.raw("COALESCE(p.province_name_vn, 'Chưa rõ tỉnh/thành') AS province_name_vn"),
      "p.province_name_en",
      "p.region",
      knex.raw("COUNT(DISTINCT s.specimen_id)::int AS count"),
      knex.raw("COUNT(DISTINCT s.taxon_id) FILTER (WHERE t1.taxon_rank = 'Species')::int AS species_count"),
      knex.raw("ROUND(AVG(ST_Y(s.collection_point::geometry))::numeric, 5)::float AS lat"),
      knex.raw("ROUND(AVG(ST_X(s.collection_point::geometry))::numeric, 5)::float AS lon"),
    )
    .orderBy("count", "desc");

  // 1b. Tổng hợp thống kê không gian toàn tập lọc từ PostGIS
  const summaryQb = knex({ s: "specimens" }).leftJoin({ t1: "taxa" }, "s.taxon_id", "t1.taxon_id");
  if (needRegistryJoin) {
    summaryQb.join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id");
  }
  applyValidCoordinatesConstraint(summaryQb);
  applyFilters(summaryQb, filters, { includePrivate, needRegistryJoin });
  const summaryPromise = summaryQb
    .select(
      knex.raw("COUNT(DISTINCT s.specimen_id)::int AS total_occurrences"),
      knex.raw("COUNT(DISTINCT s.taxon_id) FILTER (WHERE t1.taxon_rank = 'Species')::int AS distinct_species_count"),
      knex.raw("COUNT(DISTINCT s.province_id) FILTER (WHERE s.province_id IS NOT NULL)::int AS provinces_count"),
    )
    .first();

  // 2. Lưới mật độ không gian PostGIS thích ứng theo tỷ lệ thu phóng (Adaptive Spatial Grid Aggregation)
  // Trả về trọng tâm tọa độ thực của các điểm trong ô lưới (lat, lon), tâm ô lưới (cell_lat, cell_lon), và số bản ghi duy nhất (count)
  const gridQb = knex({ s: "specimens" });
  if (needRegistryJoin) {
    gridQb.join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id");
  }
  applyValidCoordinatesConstraint(gridQb);
  applyFilters(gridQb, filters, { includePrivate, needRegistryJoin });

  const gridPromise = gridQb
    .select(
      knex.raw(
        "ROUND((FLOOR(ST_Y(s.collection_point::geometry) * ?) / ? + ?)::numeric, 5)::float AS cell_lat",
        [invGrid, invGrid, halfGrid],
      ),
      knex.raw(
        "ROUND((FLOOR(ST_X(s.collection_point::geometry) * ?) / ? + ?)::numeric, 5)::float AS cell_lon",
        [invGrid, invGrid, halfGrid],
      ),
      knex.raw("ROUND(AVG(ST_Y(s.collection_point::geometry))::numeric, 5)::float AS lat"),
      knex.raw("ROUND(AVG(ST_X(s.collection_point::geometry))::numeric, 5)::float AS lon"),
      knex.raw("COUNT(DISTINCT s.specimen_id)::int AS count"),
    )
    .groupByRaw("1, 2")
    .orderBy("count", "desc")
    .limit(1200);

  // 3. Điểm mẫu vật chi tiết
  const pointsQb = knex({ s: "specimens" })
    .join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id")
    .join({ t1: "taxa" }, "s.taxon_id", "t1.taxon_id")
    .leftJoin({ t2: "taxa" }, "t1.parent_id", "t2.taxon_id")
    .leftJoin({ t3: "taxa" }, "t2.parent_id", "t3.taxon_id")
    .leftJoin({ t4: "taxa" }, "t3.parent_id", "t4.taxon_id")
    .leftJoin({ p: "provinces" }, "s.province_id", "p.province_id")
    .select(
      "s.specimen_id",
      "sr.specimen_code",
      "sr.basis_of_record",
      "sr.institution_code",
      "sr.recorded_by",
      "s.gbif_scientific_name",
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
      "p.region",
      "s.district",
      "s.locality_detail",
      "s.elevation_m",
      "s.collection_date",
      "s.individual_count",
      knex.raw("ROUND(ST_Y(s.collection_point::geometry)::numeric, 5)::float AS lat"),
      knex.raw("ROUND(ST_X(s.collection_point::geometry)::numeric, 5)::float AS lon"),
    );

  applyValidCoordinatesConstraint(pointsQb);

  if (filters.lat != null && filters.lon != null && filters.radiusKm != null) {
    pointsQb.select(
      knex.raw(
        "ROUND((ST_Distance(s.collection_point, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography) / 1000.0)::numeric, 2)::float AS distance_km",
        [filters.lon, filters.lat],
      ),
    );
  }

  applyFilters(pointsQb, filters, { includePrivate, needRegistryJoin: true });
  pointsQb.orderBy("s.collection_date", "desc").limit(limit);

  const [provinceClusters, summaryRow, heatGrid, points] = await Promise.all([
    clusterPromise,
    summaryPromise,
    gridPromise,
    pointsQb,
  ]);

  const totalMatching =
    summaryRow?.total_occurrences != null
      ? Number(summaryRow.total_occurrences)
      : provinceClusters.reduce((acc, row) => acc + Number(row.count || 0), 0);

  // Tính phân vị thống kê mật độ thực tế trên các ô lưới có mẫu vật
  const sortedCounts = (heatGrid || [])
    .map((g) => Number(g.count || 0))
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  const cellCount = sortedCounts.length;
  const minCellCount = cellCount > 0 ? sortedCounts[0] : 0;
  const maxCellCount = cellCount > 0 ? sortedCounts[cellCount - 1] : 0;
  const medianCellCount =
    cellCount > 0 ? sortedCounts[Math.floor((cellCount - 1) * 0.5)] : 0;
  const p75CellCount =
    cellCount > 0 ? sortedCounts[Math.floor((cellCount - 1) * 0.75)] : 0;

  return {
    totalMatching,
    returnedPoints: points.length,
    summary: {
      totalOccurrences: totalMatching,
      distinctSpeciesCount: Number(summaryRow?.distinct_species_count || 0),
      provincesCount: Number(
        summaryRow?.provinces_count || provinceClusters.filter((c) => c.province_id != null).length,
      ),
    },
    densityMeta: {
      method: "POSTGIS_ADAPTIVE_SPATIAL_GRID",
      gridSizeDeg,
      gridSizeKm: Number((gridSizeDeg * 111.32).toFixed(1)),
      cellCount,
      minCellCount,
      medianCellCount,
      p75CellCount,
      maxCellCount,
    },
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
      "t2.taxon_id as parent1_id",
      "t2.taxon_rank as parent1_rank",
      "t2.scientific_name as parent1_name",
      "t3.taxon_id as parent2_id",
      "t3.taxon_rank as parent2_rank",
      "t3.scientific_name as parent2_name",
      "t4.taxon_id as parent3_id",
      "t4.taxon_rank as parent3_rank",
      "t4.scientific_name as parent3_name",
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

  // Danh sách bậc phân loại tổ tiên từ hẹp (Species/Genus) tới rộng (Family/Order)
  const ancestorChain = [
    { id: row.taxon_id, rank: row.taxon_rank, name: row.taxon_name },
    { id: row.parent1_id, rank: row.parent1_rank, name: row.parent1_name },
    { id: row.parent2_id, rank: row.parent2_rank, name: row.parent2_name },
    { id: row.parent3_id, rank: row.parent3_rank, name: row.parent3_name },
  ].filter((a) => a.id != null);

  // Fallback ảnh tham chiếu theo hệ thống phân loại (Species → Genus → Family → Order)
  let speciesImages = [];
  if (images.length === 0 && ancestorChain.length > 0) {
    for (const anc of ancestorChain) {
      const foundImgs = await knex({ img: "specimen_images" })
        .join({ s2: "specimens" }, "img.specimen_id", "s2.specimen_id")
        .whereNot("s2.specimen_id", specimenId)
        .whereNull("s2.deleted_at")
        .whereRaw(
          `s2.taxon_id IN (
            WITH RECURSIVE sub_taxa AS (
              SELECT taxon_id FROM taxa WHERE taxon_id = ?
              UNION ALL
              SELECT c.taxon_id FROM taxa c JOIN sub_taxa st ON c.parent_id = st.taxon_id
            )
            SELECT taxon_id FROM sub_taxa
          )`,
          [anc.id]
        )
        .modify((q) => {
          if (!includePrivate) q.where("img.is_public", true).where("s2.is_public", true);
        })
        .select("img.*", "s2.gbif_scientific_name as reference_scientific_name")
        .orderBy("img.uploaded_at", "desc")
        .limit(6);

      if (foundImgs.length > 0) {
        speciesImages = foundImgs.map((img) => ({
          ...img,
          reference_match_rank: anc.rank,
          reference_taxon_name: anc.name,
        }));
        break;
      }
    }
  }

  // Fallback chuỗi mã vạch DNA theo hệ thống phân loại (Species → Genus → Family → Order)
  let speciesDnaSequences = [];
  if (dnaSequences.length === 0) {
    const binomial = (row.gbif_scientific_name || row.taxon_name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join(" ");

    if (binomial && binomial.includes(" ")) {
      const exactSpeciesDna = await knex({ d: "dna_sequences" })
        .leftJoin({ s_dna: "specimens" }, "d.specimen_id", "s_dna.specimen_id")
        .select("d.*")
        .where((q) => {
          if (row.taxon_id) q.where("d.taxon_id", row.taxon_id);
          q.orWhere("d.scientific_name_verbatim", "ilike", `${binomial}%`);
        })
        .where(function () {
          this.whereNull("d.specimen_id").orWhereNot("d.specimen_id", specimenId);
        })
        .modify((q) => {
          if (!includePrivate) {
            q.where("d.is_public", true).andWhere(function () {
              this.whereNull("d.specimen_id").orWhere(function () {
                this.whereNull("s_dna.deleted_at").andWhere("s_dna.is_public", true);
              });
            });
          }
        })
        .orderByRaw("CASE WHEN d.gene_marker = 'COI' THEN 0 ELSE 1 END")
        .orderBy("d.created_at", "desc")
        .limit(5);

      if (exactSpeciesDna.length > 0) {
        speciesDnaSequences = exactSpeciesDna.map((d) => ({
          ...d,
          reference_match_rank: "Species",
          reference_taxon_name: binomial,
        }));
      }
    }

    // Nếu loài này chưa có DNA barcode riêng, tìm trình tự đại diện trong cùng Genus → Family → Order
    if (speciesDnaSequences.length === 0 && ancestorChain.length > 0) {
      for (const anc of ancestorChain) {
        const taxonDna = await knex({ d: "dna_sequences" })
          .leftJoin({ s_dna: "specimens" }, "d.specimen_id", "s_dna.specimen_id")
          .select("d.*")
          .where(function () {
            this.whereNull("d.specimen_id").orWhereNot("d.specimen_id", specimenId);
          })
          .whereRaw(
            `d.taxon_id IN (
              WITH RECURSIVE sub_taxa AS (
                SELECT taxon_id FROM taxa WHERE taxon_id = ?
                UNION ALL
                SELECT c.taxon_id FROM taxa c JOIN sub_taxa st ON c.parent_id = st.taxon_id
              )
              SELECT taxon_id FROM sub_taxa
            )`,
            [anc.id]
          )
          .modify((q) => {
            if (!includePrivate) {
              q.where("d.is_public", true).andWhere(function () {
                this.whereNull("d.specimen_id").orWhere(function () {
                  this.whereNull("s_dna.deleted_at").andWhere("s_dna.is_public", true);
                });
              });
            }
          })
          .orderByRaw("CASE WHEN d.gene_marker = 'COI' THEN 0 ELSE 1 END")
          .orderBy("d.sequence_length_bp", "desc")
          .limit(4);

        if (taxonDna.length > 0) {
          speciesDnaSequences = taxonDna.map((d) => ({
            ...d,
            reference_match_rank: anc.rank,
            reference_taxon_name: anc.name,
          }));
          break;
        }
      }
    }
  }

  return { ...row, images, dnaSequences, changeHistory, speciesImages, speciesDnaSequences };
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
      elevation_m: data.elevationM ?? null,
      collection_date: data.collectionDate,
      sex: data.sex || null,
      individual_count: data.individualCount || 1,
      storage_number: data.storageNumber || null,
      notes: data.notes || null,
      is_public: data.isPublic ?? true,
    });

    await enqueueOutbox(trx, {
      entityType: "specimen",
      entityId: reg.specimen_id,
      op: "upsert",
      priority: 0,
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
  { key: "elevationM", col: "elevation_m" },
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

    const isPublicChanged = "is_public" in specUpdate;
    await enqueueOutbox(trx, {
      entityType: "specimen",
      entityId: specimenId,
      op: isPublicChanged ? "toggle_public" : "upsert",
      priority: isPublicChanged ? 10 : 0,
    });
  });
}

async function batchUpdatePublic(specimenIds, isPublic, adminId) {
  return knex.transaction(async (trx) => {
    const updated = await trx("specimens")
      .whereIn("specimen_id", specimenIds)
      .whereNull("deleted_at")
      .update({
        is_public: isPublic,
        updated_by: adminId || null,
        updated_at: trx.fn.now(),
      });

    if (updated > 0 && Array.isArray(specimenIds) && specimenIds.length > 0) {
      await enqueueOutboxBatch(
        trx,
        specimenIds.map((id) => ({
          entityType: "specimen",
          entityId: id,
          op: "toggle_public",
          priority: 10,
        })),
      );
    }
    return updated;
  });
}

async function softDelete(specimenId, adminId) {
  return knex.transaction(async (trx) => {
    const deletedCount = await trx("specimens")
      .where("specimen_id", specimenId)
      .whereNull("deleted_at")
      .update({
        deleted_at: trx.fn.now(),
        updated_by: adminId || null,
        updated_at: trx.fn.now(),
      });

    let orphanedDnaCount = 0;
    if (deletedCount > 0) {
      orphanedDnaCount = await trx("dna_sequences")
        .where("specimen_id", specimenId)
        .update({
          is_orphaned: true,
          updated_at: trx.fn.now(),
        });

      await enqueueOutbox(trx, {
        entityType: "specimen",
        entityId: specimenId,
        op: "soft_delete",
        priority: 10,
      });
    }

    return { deletedCount, orphanedDnaCount };
  });
}

async function restore(specimenId, adminId) {
  return knex.transaction(async (trx) => {
    const restoredCount = await trx("specimens")
      .where("specimen_id", specimenId)
      .whereNotNull("deleted_at")
      .update({
        deleted_at: null,
        updated_by: adminId || null,
        updated_at: trx.fn.now(),
      });

    let unorphanedDnaCount = 0;
    if (restoredCount > 0) {
      unorphanedDnaCount = await trx("dna_sequences")
        .where("specimen_id", specimenId)
        .where("is_orphaned", true)
        .update({
          is_orphaned: false,
          updated_at: trx.fn.now(),
        });

      await enqueueOutbox(trx, {
        entityType: "specimen",
        entityId: specimenId,
        op: "restore",
        priority: 10,
      });
    }

    return { restoredCount, unorphanedDnaCount };
  });
}

async function findLookups() {
  const [orders, families, provinces, habitats, lifeStages, statuses, institutionsRows] = await Promise.all([
    knex("taxa")
      .select("taxon_id as id", "scientific_name as scientificName", "vernacular_name_vn as vernacularNameVn")
      .where("taxon_rank", "Order")
      .orderBy("scientific_name", "asc"),
    knex({ f: "taxa" })
      .leftJoin({ o: "taxa" }, "f.parent_id", "o.taxon_id")
      .select(
        "f.taxon_id as id",
        "f.scientific_name as scientificName",
        "f.vernacular_name_vn as vernacularNameVn",
        "o.scientific_name as orderName",
      )
      .where("f.taxon_rank", "Family")
      .orderBy("f.scientific_name", "asc"),
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
    knex("specimen_registry")
      .distinct("institution_code")
      .whereNotNull("institution_code")
      .andWhere("institution_code", "<>", "")
      .orderBy("institution_code", "asc")
      .limit(50),
  ]);

  const regions = Array.from(
    new Set((provinces || []).map((p) => p.region).filter(Boolean)),
  ).sort();
  const institutions = (institutionsRows || []).map((r) => r.institution_code).filter(Boolean);

  return { orders, families, provinces, regions, institutions, habitats, lifeStages, statuses };
}

async function getStats({ includePrivate = false } = {}) {
  const visibilitySql = includePrivate ? "" : "AND s.is_public = true";

  const [
    summaryRes,
    byOrderRes,
    byProvinceRes,
    taxaSummaryRes,
    totalProvincesRes,
    dnaCountRes,
    imageCountRes,
    recentSpecimensRes,
    recentAuditRes,
  ] = await Promise.all([
    knex.raw(`
      SELECT
        COUNT(*)::int AS total_specimens,
        COUNT(*) FILTER (WHERE s.is_public = true)::int AS public_specimens,
        COUNT(*) FILTER (WHERE s.collection_point IS NOT NULL)::int AS with_coordinates,
        COUNT(*) FILTER (WHERE s.province_id IS NOT NULL)::int AS with_province,
        COUNT(DISTINCT s.province_id) FILTER (WHERE s.province_id IS NOT NULL)::int AS provinces_covered,
        COUNT(DISTINCT s.gbif_scientific_name) FILTER (WHERE s.gbif_scientific_name IS NOT NULL)::int AS distinct_scientific_names,
        COUNT(DISTINCT regexp_replace(s.gbif_scientific_name, '^([A-Z][a-z]+\\s+[a-z-]+).*$', '\\1'))
          FILTER (WHERE s.gbif_scientific_name ~ '^[A-Z][a-z]+\\s+[a-z-]+')::int AS distinct_binomial_species,
        COUNT(DISTINCT s.taxon_id) FILTER (WHERE t.taxon_rank = 'Species')::int AS distinct_species_taxa,
        COUNT(*) FILTER (WHERE t.taxon_rank = 'Species')::int AS at_species_rank,
        COUNT(*) FILTER (
          WHERE s.collection_point IS NOT NULL
            AND (
              ST_Y(s.collection_point::geometry) NOT BETWEEN 8.18 AND 23.39
              OR ST_X(s.collection_point::geometry) NOT BETWEEN 102.14 AND 109.46
            )
        )::int AS out_of_vn_bounds,
        COUNT(*) FILTER (WHERE s.collection_date > CURRENT_DATE)::int AS future_dates
      FROM specimens s
      JOIN taxa t ON s.taxon_id = t.taxon_id
      WHERE s.deleted_at IS NULL ${visibilitySql}
    `),
    knex.raw(`
      SELECT
        COALESCE(
          CASE WHEN t1.taxon_rank = 'Order' THEN t1.scientific_name END,
          CASE WHEN t2.taxon_rank = 'Order' THEN t2.scientific_name END,
          CASE WHEN t3.taxon_rank = 'Order' THEN t3.scientific_name END,
          CASE WHEN t4.taxon_rank = 'Order' THEN t4.scientific_name END,
          t1.scientific_name
        ) AS order_name,
        COUNT(*)::int AS count
      FROM specimens s
      JOIN taxa t1 ON s.taxon_id = t1.taxon_id
      LEFT JOIN taxa t2 ON t1.parent_id = t2.taxon_id
      LEFT JOIN taxa t3 ON t2.parent_id = t3.taxon_id
      LEFT JOIN taxa t4 ON t3.parent_id = t4.taxon_id
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
      LIMIT 34
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
    knex("provinces").count("* as cnt").first(),
    knex({ d: "dna_sequences" })
      .leftJoin({ s: "specimens" }, "d.specimen_id", "s.specimen_id")
      .modify((q) => {
        if (!includePrivate) {
          q.where("d.is_public", true).andWhere(function () {
            this.whereNull("d.specimen_id").orWhere(function () {
              this.whereNull("s.deleted_at").andWhere("s.is_public", true);
            });
          });
        }
      })
      .select(
        knex.raw("COUNT(*)::int AS cnt"),
        knex.raw("COUNT(*) FILTER (WHERE d.specimen_id IS NULL)::int AS orphaned_cnt")
      )
      .first(),
    knex({ img: "specimen_images" })
      .join({ s: "specimens" }, "img.specimen_id", "s.specimen_id")
      .whereNull("s.deleted_at")
      .modify((q) => {
        if (!includePrivate) q.where("img.is_public", true).where("s.is_public", true);
      })
      .count("* as cnt")
      .first(),
    knex({ s: "specimens" })
      .join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id")
      .join({ t1: "taxa" }, "s.taxon_id", "t1.taxon_id")
      .leftJoin({ p: "provinces" }, "s.province_id", "p.province_id")
      .whereNull("s.deleted_at")
      .modify((q) => {
        if (!includePrivate) q.where("s.is_public", true);
      })
      .select(
        "s.specimen_id",
        "sr.specimen_code",
        "s.gbif_scientific_name",
        "t1.scientific_name as taxon_name",
        "t1.taxon_rank",
        "p.province_name_vn",
        "s.collection_date",
        "s.is_public",
        "s.updated_at"
      )
      .orderBy("s.collection_date", "desc")
      .orderBy("s.specimen_id", "desc")
      .limit(6),
    includePrivate
      ? knex({ al: "audit_logs" })
          .leftJoin({ a: "admin_users" }, "al.admin_id", "a.admin_id")
          .select(
            "al.log_id",
            "al.action_type",
            "al.target_table",
            "al.target_id",
            knex.raw("HOST(al.ip_address) as ip_address"),
            "al.log_timestamp",
            "a.username as admin_username"
          )
          .orderBy("al.log_timestamp", "desc")
          .limit(6)
      : Promise.resolve([]),
  ]);

  const sRow = summaryRes.rows[0] || {};
  const tRow = taxaSummaryRes.rows[0] || {};
  const totalSpecimens = sRow.total_specimens || 0;
  const withProvince = sRow.with_province || 0;

  return {
    totalSpecimens,
    publicSpecimens: sRow.public_specimens || 0,
    withCoordinates: sRow.with_coordinates || 0,
    withProvince,
    provincesCovered: sRow.provinces_covered ?? 0,
    totalProvinces: parseInt(totalProvincesRes?.cnt ?? 0, 10),
    distinctScientificNames: sRow.distinct_scientific_names ?? 0,
    distinctBinomialSpecies: sRow.distinct_binomial_species ?? 0,
    distinctSpeciesTaxa: sRow.distinct_species_taxa ?? 0,
    specimensAtSpeciesRank: sRow.at_species_rank ?? 0,
    taxa: {
      total: tRow.total_taxa || 0,
      orders: tRow.order_count || 0,
      families: tRow.family_count || 0,
      genera: tRow.genus_count || 0,
      species: tRow.species_count || 0,
    },
    dnaCount: parseInt(dnaCountRes?.cnt || 0, 10),
    imageCount: parseInt(imageCountRes?.cnt || 0, 10),
    dataQuality: {
      outOfVnBounds: sRow.out_of_vn_bounds || 0,
      missingProvince: Math.max(0, totalSpecimens - withProvince),
      futureDates: sRow.future_dates || 0,
      orphanedDna: parseInt(dnaCountRes?.orphaned_cnt || 0, 10),
      higherRankOnly: Math.max(0, totalSpecimens - (sRow.at_species_rank || 0)),
    },
    byOrder: byOrderRes.rows,
    topProvinces: byProvinceRes.rows,
    recentSpecimens: (recentSpecimensRes || []).map((r) => ({
      id: Number(r.specimen_id),
      specimenCode: r.specimen_code,
      scientificName: r.gbif_scientific_name || r.taxon_name || "Insecta sp.",
      taxonRank: r.taxon_rank,
      provinceNameVn: r.province_name_vn || null,
      collectionDate:
        r.collection_date instanceof Date
          ? r.collection_date.toISOString().slice(0, 10)
          : r.collection_date
          ? String(r.collection_date).slice(0, 10)
          : null,
      isPublic: Boolean(r.is_public),
      updatedAt: r.updated_at,
    })),
    recentAuditLogs: (recentAuditRes || []).map((l) => ({
      id: Number(l.log_id),
      actionType: l.action_type,
      targetTable: l.target_table,
      targetId: l.target_id,
      ipAddress: l.ip_address || "127.0.0.1",
      timestamp: l.log_timestamp,
      adminUsername: l.admin_username || "admin",
    })),
  };
}

async function getAnalytics(filters = {}, { includePrivate = false } = {}) {
  const visibilitySql = includePrivate ? "" : "AND s.is_public = true";

  // 1. Xu hướng thu mẫu & số loài theo năm
  const byYearPromise = knex.raw(`
    SELECT
      EXTRACT(YEAR FROM s.collection_date)::int AS year,
      COUNT(*)::int AS specimen_count,
      COUNT(DISTINCT s.taxon_id) FILTER (WHERE t.taxon_rank = 'Species')::int AS species_count
    FROM specimens s
    JOIN taxa t ON s.taxon_id = t.taxon_id
    WHERE s.deleted_at IS NULL
      AND s.collection_date IS NOT NULL
      ${visibilitySql}
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  // 2. Độ giàu loài (Species Richness) theo 34 Tỉnh/Thành (F-GI-06)
  const richnessPromise = knex.raw(`
    SELECT
      p.province_id,
      p.province_code,
      p.province_name_vn,
      p.province_name_en,
      p.region,
      COUNT(s.specimen_id)::int AS specimen_count,
      COUNT(DISTINCT s.taxon_id) FILTER (WHERE t.taxon_rank = 'Species')::int AS species_count,
      ROUND(AVG(ST_Y(s.collection_point::geometry))::numeric, 4)::float AS lat,
      ROUND(AVG(ST_X(s.collection_point::geometry))::numeric, 4)::float AS lon
    FROM provinces p
    LEFT JOIN specimens s ON s.province_id = p.province_id AND s.deleted_at IS NULL ${visibilitySql}
    LEFT JOIN taxa t ON s.taxon_id = t.taxon_id
    GROUP BY p.province_id, p.province_code, p.province_name_vn, p.province_name_en, p.region
    ORDER BY species_count DESC, specimen_count DESC
  `);

  // 3. Danh mục Loài chuẩn hóa (Species Checklist - SCR-26 / F-RP-02)
  const limit = Math.min(Number(filters.limit) || 100, 500);
  const checklistBindings = [];
  let filterSql = "";

  if (filters.order) {
    checklistBindings.push(filters.order);
    filterSql += ` AND COALESCE(t4.scientific_name, t3.scientific_name, t2.scientific_name) = ?`;
  }
  if (filters.provinceId) {
    checklistBindings.push(Number(filters.provinceId));
    filterSql += ` AND s.province_id = ?`;
  }
  if (filters.q && String(filters.q).trim()) {
    const kw = `%${String(filters.q).trim()}%`;
    checklistBindings.push(kw, kw, kw);
    filterSql += ` AND (t1.scientific_name ILIKE ? OR COALESCE(t1.vernacular_name_vn, '') ILIKE ? OR COALESCE(t2.scientific_name, '') ILIKE ?)`;
  }
  checklistBindings.push(limit);

  const checklistPromise = knex.raw(
    `
    SELECT
      t1.taxon_id,
      t1.scientific_name,
      t1.slug,
      t1.scientific_name_authorship AS author_year,
      t1.vernacular_name_vn,
      t1.vernacular_name_en,
      t1.iucn_status,
      t2.scientific_name AS genus_name,
      t3.scientific_name AS family_name,
      COALESCE(t4.scientific_name, t3.scientific_name, t2.scientific_name) AS order_name,
      COUNT(s.specimen_id)::int AS specimen_count,
      COUNT(DISTINCT s.province_id)::int AS province_count
    FROM taxa t1
    LEFT JOIN taxa t2 ON t1.parent_id = t2.taxon_id
    LEFT JOIN taxa t3 ON t2.parent_id = t3.taxon_id
    LEFT JOIN taxa t4 ON t3.parent_id = t4.taxon_id
    LEFT JOIN specimens s ON s.taxon_id = t1.taxon_id AND s.deleted_at IS NULL ${visibilitySql}
    WHERE t1.taxon_rank = 'Species'
      ${filterSql}
    GROUP BY t1.taxon_id, t1.scientific_name, t1.slug, t1.scientific_name_authorship,
             t1.vernacular_name_vn, t1.vernacular_name_en, t1.iucn_status,
             t2.scientific_name, t3.scientific_name, t4.scientific_name
    HAVING COUNT(s.specimen_id) > 0 OR ? = 1
    ORDER BY specimen_count DESC, t1.scientific_name ASC
    LIMIT ?
    `,
    [...checklistBindings.slice(0, -1), filters.provinceId ? 0 : 1, limit]
  );

  // 4. Phân bố theo Cơ sở Bản ghi (Basis of Record) & Tháng thu mẫu
  const byMonthPromise = knex.raw(`
    SELECT
      EXTRACT(MONTH FROM s.collection_date)::int AS month,
      COUNT(*)::int AS specimen_count
    FROM specimens s
    WHERE s.deleted_at IS NULL
      AND s.collection_date IS NOT NULL
      ${visibilitySql}
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  const [byYearRes, richnessRes, checklistRes, byMonthRes] = await Promise.all([
    byYearPromise,
    richnessPromise,
    checklistPromise,
    byMonthPromise,
  ]);

  return {
    byYear: byYearRes.rows,
    byMonth: byMonthRes.rows,
    speciesRichnessByProvince: richnessRes.rows,
    speciesChecklist: checklistRes.rows,
  };
}

async function batchUpdateFields(specimenIds, updates, adminId) {
  return knex.transaction(async (trx) => {
    const specUpdate = {};
    const regUpdate = {};

    const allowedSpecMap = {
      provinceId: "province_id",
      habitatId: "habitat_id",
      lifeStageId: "life_stage_id",
      statusId: "status_id",
      sex: "sex",
      isPublic: "is_public",
      district: "district",
      localityDetail: "locality_detail",
    };

    const allowedRegMap = {
      recordedBy: "recorded_by",
      institutionCode: "institution_code",
      basisOfRecord: "basis_of_record",
    };

    for (const [k, col] of Object.entries(allowedSpecMap)) {
      if (updates[k] !== undefined && updates[k] !== "") {
        specUpdate[col] = updates[k];
      }
    }
    for (const [k, col] of Object.entries(allowedRegMap)) {
      if (updates[k] !== undefined && updates[k] !== "") {
        regUpdate[col] = updates[k];
      }
    }

    let updatedCount = 0;

    if (Object.keys(specUpdate).length > 0) {
      specUpdate.updated_by = adminId || null;
      specUpdate.updated_at = trx.fn.now();
      updatedCount = await trx("specimens")
        .whereIn("specimen_id", specimenIds)
        .whereNull("deleted_at")
        .update(specUpdate);
    }

    if (Object.keys(regUpdate).length > 0) {
      const regCount = await trx("specimen_registry")
        .whereIn("specimen_id", specimenIds)
        .update(regUpdate);
      if (!updatedCount) updatedCount = regCount;
    }

    const changedFields = [...Object.keys(specUpdate), ...Object.keys(regUpdate)].filter(
      (f) => f !== "updated_by" && f !== "updated_at"
    );

    if (changedFields.length > 0 && specimenIds.length > 0) {
      const historyRows = specimenIds.slice(0, 200).map((id) => ({
        specimen_id: id,
        changed_by: adminId || null,
        field_name: `BATCH(${changedFields.join(",")})`,
        old_value: "Batch Edit",
        new_value: JSON.stringify(updates).slice(0, 240),
      }));
      await trx("specimen_change_history").insert(historyRows);

      const isPublicChanged = "is_public" in specUpdate;
      await enqueueOutboxBatch(
        trx,
        specimenIds.map((id) => ({
          entityType: "specimen",
          entityId: id,
          op: isPublicChanged ? "toggle_public" : "upsert",
          priority: isPublicChanged ? 10 : 0,
        })),
      );
    }

    return updatedCount;
  });
}

async function bulkImportRows(rows, adminId) {
  return knex.transaction(async (trx) => {
    // Load lookup maps for scientific_name -> taxon_id and province_name -> province_id
    const [taxaRows, provRows] = await Promise.all([
      trx("taxa").select("taxon_id", "scientific_name", "taxon_rank"),
      trx("provinces").select("province_id", "province_name_vn", "province_name_en", "province_code"),
    ]);

    const taxonMap = new Map();
    for (const t of taxaRows) {
      taxonMap.set(String(t.scientific_name).toLowerCase(), t.taxon_id);
    }

    const provMap = new Map();
    for (const p of provRows) {
      provMap.set(String(p.province_name_vn).toLowerCase(), p.province_id);
      if (p.province_name_en) provMap.set(String(p.province_name_en).toLowerCase(), p.province_id);
      if (p.province_code) provMap.set(String(p.province_code).toLowerCase(), p.province_id);
    }

    let insertedCount = 0;
    const insertedIds = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const sciName = String(r.scientificName || r.gbifScientificName || "").trim();
      const colDate = String(r.collectionDate || "").trim();

      if (!sciName || !colDate) {
        errors.push({ row: i + 1, message: "Thiếu Tên khoa học (scientificName) hoặc Ngày thu mẫu (collectionDate)" });
        continue;
      }

      const lat = r.latitude != null && r.latitude !== "" ? Number(r.latitude) : null;
      const lon = r.longitude != null && r.longitude !== "" ? Number(r.longitude) : null;
      if ((lat != null && Number.isNaN(lat)) || (lon != null && Number.isNaN(lon))) {
        errors.push({ row: i + 1, message: "Tọa độ GPS (latitude/longitude) không hợp lệ" });
        continue;
      }

      // Match taxonId by explicit taxonId, exact scientific name, genus prefix, or orderName — NO silent fallback (DEF-034)
      const exactTaxonId =
        (r.taxonId && Number(r.taxonId)) ||
        taxonMap.get(sciName.toLowerCase()) ||
        taxonMap.get(sciName.split(/\s+/)[0].toLowerCase()) ||
        (r.orderName && taxonMap.get(String(r.orderName).toLowerCase())) ||
        null;

      if (!exactTaxonId) {
        errors.push({
          row: i + 1,
          message: `Không tìm thấy Taxon khớp với tên khoa học "${sciName}" trong hệ thống phân loại`,
        });
        continue;
      }

      const matchedProvId =
        (r.provinceId && Number(r.provinceId)) ||
        (r.provinceName && provMap.get(String(r.provinceName).trim().toLowerCase())) ||
        null;

      const code =
        (r.specimenCode && String(r.specimenCode).trim()) ||
        `VAST-IMP-${Date.now().toString(36).toUpperCase()}-${String(i + 1).padStart(4, "0")}`;

      const [reg] = await trx("specimen_registry")
        .insert({
          specimen_code: code,
          basis_of_record: r.basisOfRecord || "PRESERVED_SPECIMEN",
          catalog_number: r.catalogNumber ? String(r.catalogNumber).trim() : null,
          institution_code: r.institutionCode ? String(r.institutionCode).trim() : null,
          recorded_by: r.recordedBy ? String(r.recordedBy).trim() : null,
          occurrence_remarks: r.occurrenceRemarks || null,
        })
        .returning(["specimen_id"]);

      const pointExpr =
        lat != null && lon != null
          ? trx.raw("ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography", [lon, lat])
          : null;

      await trx("specimens").insert({
        specimen_id: reg.specimen_id,
        taxon_id: exactTaxonId,
        province_id: matchedProvId,
        created_by: adminId || null,
        updated_by: adminId || null,
        gbif_scientific_name: sciName,
        common_name_vn: r.commonNameVn || null,
        district: r.district || null,
        commune: r.commune || null,
        locality_detail: r.localityDetail || null,
        collection_point: pointExpr,
        collection_date: colDate,
        sex: r.sex || null,
        individual_count: Number(r.individualCount) || 1,
        notes: r.notes || null,
        is_public: r.isPublic !== false,
      });

      insertedCount++;
      insertedIds.push(reg.specimen_id);
    }

    if (insertedIds.length > 0) {
      await enqueueOutboxBatch(
        trx,
        insertedIds.map((id) => ({
          entityType: "specimen",
          entityId: id,
          op: "upsert",
          priority: 0,
        })),
      );
    }

    return { insertedCount, errors };
  });
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
  batchUpdateFields,
  bulkImportRows,
  softDelete,
  restore,
  findLookups,
  getStats,
  getAnalytics,
};
