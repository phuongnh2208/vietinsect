"use strict";

const fs = require("fs");
const path = require("path");
const knex = require("../../config/knex");
const logger = require("../../config/logger");
const AppError = require("../../utils/appError");
const { esClient, getIndexName } = require("../../config/elasticsearch");

const MAPPINGS_DIR = path.resolve(__dirname, "../../../../infra/elasticsearch/mappings");

const ES_UNAVAILABLE_ERROR = {
  code: "SEARCH.ES_UNAVAILABLE",
  message: "Dịch vụ tìm kiếm toàn văn (Elasticsearch) tạm thời không khả dụng, vui lòng thử lại sau.",
  statusCode: 503,
};

// Hàng đợi retry ưu tiên cho các thao tác nhạy cảm (is_public, soft-delete, restore)
const priorityRetryQueue = new Set();
let needsReindex = false;

function getSyncState() {
  return {
    needsReindex,
    priorityQueueSize: priorityRetryQueue.size,
  };
}

function loadMapping(filename) {
  const fullPath = path.join(MAPPINGS_DIR, filename);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

async function ensureIndices() {
  const specsIdx = getIndexName("specimens");
  const taxaIdx = getIndexName("taxa");

  const [specExists, taxaExists] = await Promise.all([
    esClient.indices.exists({ index: specsIdx }),
    esClient.indices.exists({ index: taxaIdx }),
  ]);

  if (!specExists) {
    const specMapping = loadMapping("specimens.json");
    await esClient.indices.create({ index: specsIdx, ...specMapping });
  }
  if (!taxaExists) {
    const taxaMapping = loadMapping("taxa.json");
    await esClient.indices.create({ index: taxaIdx, ...taxaMapping });
  }
}

function toSpecimenDoc(row) {
  const colDate =
    row.collection_date instanceof Date
      ? row.collection_date.toISOString().slice(0, 10)
      : row.collection_date
        ? String(row.collection_date).slice(0, 10)
        : null;
  const yearCollected = colDate ? Number(colDate.slice(0, 4)) : null;
  const hasGps = row.latitude != null && row.longitude != null;

  return {
    specimen_id: Number(row.specimen_id),
    specimen_code: row.specimen_code || null,
    taxon_id: Number(row.taxon_id),
    scientific_name: row.gbif_scientific_name || row.taxon_name || null,
    vernacular_vi: row.common_name_vn || row.taxon_vernacular_vn || null,
    vernacular_en: row.common_name_en || row.taxon_vernacular_en || null,
    taxon_path: [row.order_name, row.family_name, row.genus_name, row.taxon_name]
      .filter(Boolean)
      .join(" > "),
    order_name: row.order_name || null,
    family_name: row.family_name || null,
    genus_name: row.genus_name || null,
    province_id: row.province_id != null ? Number(row.province_id) : null,
    province: row.province_name_vn || row.province_name_en || null,
    locality: [row.locality_detail, row.commune, row.district].filter(Boolean).join(", ") || null,
    notes: [row.notes, row.occurrence_remarks].filter(Boolean).join(" | ") || null,
    recorded_by: row.recorded_by || null,
    basis_of_record: row.basis_of_record || null,
    is_public: Boolean(row.is_public),
    deleted_at: row.deleted_at || null,
    has_gps: hasGps,
    location: hasGps ? { lat: Number(row.latitude), lon: Number(row.longitude) } : null,
    year_collected: Number.isFinite(yearCollected) ? yearCollected : null,
    collection_date: colDate,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function fetchSpecimenRowsForIndex(specimenIds = null) {
  const qb = knex({ s: "specimens" })
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
      "sr.recorded_by",
      "sr.occurrence_remarks",
      "s.taxon_id",
      "t1.scientific_name as taxon_name",
      "t1.vernacular_name_vn as taxon_vernacular_vn",
      "t1.vernacular_name_en as taxon_vernacular_en",
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
      "s.notes",
      "s.is_public",
      "s.deleted_at",
      "s.collection_date",
      "s.created_at",
      "s.updated_at",
      knex.raw("ST_Y(s.collection_point::geometry) AS latitude"),
      knex.raw("ST_X(s.collection_point::geometry) AS longitude"),
    );

  if (Array.isArray(specimenIds) && specimenIds.length > 0) {
    qb.whereIn("s.specimen_id", specimenIds);
  }
  return qb;
}

async function indexSpecimenNow(specimenId, { refresh = false } = {}) {
  const rows = await fetchSpecimenRowsForIndex([specimenId]);
  if (!rows.length) return false;
  const doc = toSpecimenDoc(rows[0]);
  await esClient.index({
    index: getIndexName("specimens"),
    id: String(doc.specimen_id),
    document: doc,
    refresh: refresh ? "wait_for" : false,
  });
  return true;
}

async function syncSpecimenWithRetry(specimenId, { priority = false, refresh = false } = {}) {
  const delays = [150, 400];
  let lastErr = null;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      await indexSpecimenNow(specimenId, { refresh });
      priorityRetryQueue.delete(specimenId);
      return true;
    } catch (err) {
      lastErr = err;
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
  }

  needsReindex = true;
  if (priority) {
    priorityRetryQueue.add(specimenId);
    logger.error(
      `[ES PRIORITY SYNC FAILED] specimen_id=${specimenId} đưa vào hàng đợi retry ưu tiên: ${lastErr?.message}`,
    );
  } else {
    logger.warn(`[ES SYNC FAILED] specimen_id=${specimenId} (đánh dấu needsReindex): ${lastErr?.message}`);
  }
  return false;
}

async function bulkIndexSpecimens(specimenIds, { refresh = false } = {}) {
  if (!Array.isArray(specimenIds) || specimenIds.length === 0) return { indexed: 0 };
  const rows = await fetchSpecimenRowsForIndex(specimenIds);
  if (!rows.length) return { indexed: 0 };

  const indexName = getIndexName("specimens");
  const operations = rows.flatMap((r) => {
    const doc = toSpecimenDoc(r);
    return [{ index: { _index: indexName, _id: String(doc.specimen_id) } }, doc];
  });

  const res = await esClient.bulk({
    operations,
    refresh: refresh ? "wait_for" : false,
  });

  if (res.errors) {
    needsReindex = true;
    logger.error(`[ES BULK SYNC] Có lỗi khi bulk index ${rows.length} bản ghi mẫu vật`);
  }
  return { indexed: rows.length, errors: Boolean(res.errors) };
}

async function reindexAll({ batchSize = 1000, refresh = true } = {}) {
  await ensureIndices();
  const specsIdx = getIndexName("specimens");
  const taxaIdx = getIndexName("taxa");

  // 1. Reindex taxa (idempotent: _id = taxon_id)
  const taxaRows = await knex("taxa").select(
    "taxon_id",
    "parent_id",
    "accepted_taxon_id",
    "taxon_rank",
    "taxonomic_status",
    "scientific_name",
    "vernacular_name_vn",
    "vernacular_name_en",
    "iucn_status",
    "slug",
  );
  let taxaIndexed = 0;
  for (let i = 0; i < taxaRows.length; i += batchSize) {
    const chunk = taxaRows.slice(i, i + batchSize);
    const ops = chunk.flatMap((t) => [
      { index: { _index: taxaIdx, _id: String(t.taxon_id) } },
      {
        taxon_id: Number(t.taxon_id),
        parent_id: t.parent_id != null ? Number(t.parent_id) : null,
        accepted_taxon_id: t.accepted_taxon_id != null ? Number(t.accepted_taxon_id) : null,
        taxon_rank: t.taxon_rank,
        taxonomic_status: t.taxonomic_status || "accepted",
        scientific_name: t.scientific_name,
        vernacular_vi: t.vernacular_name_vn || null,
        vernacular_en: t.vernacular_name_en || null,
        iucn_status: t.iucn_status || null,
        slug: t.slug || null,
      },
    ]);
    if (ops.length) {
      await esClient.bulk({ operations: ops, refresh: false });
      taxaIndexed += chunk.length;
    }
  }

  // 2. Reindex specimens (idempotent: _id = specimen_id)
  const allIdsRows = await knex("specimens").select("specimen_id").orderBy("specimen_id", "asc");
  const allIds = allIdsRows.map((r) => Number(r.specimen_id));
  let specimensIndexed = 0;
  for (let i = 0; i < allIds.length; i += batchSize) {
    const slice = allIds.slice(i, i + batchSize);
    const res = await bulkIndexSpecimens(slice, { refresh: false });
    specimensIndexed += res.indexed;
  }

  if (refresh) {
    await Promise.all([
      esClient.indices.refresh({ index: specsIdx }),
      esClient.indices.refresh({ index: taxaIdx }),
    ]);
  }
  needsReindex = false;
  priorityRetryQueue.clear();
  return { taxaIndexed, specimensIndexed };
}

const SORT_FIELDS = {
  relevance: "_score",
  collectionDate: "collection_date",
  createdAt: "created_at",
  specimenId: "specimen_id",
  scientificName: "scientific_name.keyword",
};

async function resolveSynonym(q) {
  if (!q || !q.trim()) return null;
  const term = q.trim();
  const synRow = await knex({ s: "taxa" })
    .join({ a: "taxa" }, "s.accepted_taxon_id", "a.taxon_id")
    .where("s.taxonomic_status", "synonym")
    .whereRaw("lower(s.scientific_name) = lower(?)", [term])
    .select(
      "s.scientific_name as synonym_name",
      "a.taxon_id as accepted_taxon_id",
      "a.scientific_name as accepted_name",
    )
    .first();
  if (!synRow) return null;
  return {
    synonymName: synRow.synonym_name,
    acceptedTaxonId: Number(synRow.accepted_taxon_id),
    acceptedName: synRow.accepted_name,
    message: `Tên đồng danh "${synRow.synonym_name}" đã được ánh xạ sang tên hợp lệ "${synRow.accepted_name}" (F-TX-03).`,
  };
}

async function searchSpecimens(filters = {}, { isAdmin = false } = {}) {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25));
  const from = (page - 1) * limit;
  const q = String(filters.q || "").trim();

  // Kiểm tra synonym (F-TX-03)
  const synonymNotice = q ? await resolveSynonym(q) : null;
  const effectiveQuery = synonymNotice ? synonymNotice.acceptedName : q;

  const must = [];
  if (effectiveQuery) {
    must.push({
      multi_match: {
        query: effectiveQuery,
        fields: [
          "specimen_code^5",
          "scientific_name^4",
          "scientific_name.autocomplete^2",
          "vernacular_vi^3",
          "vernacular_vi.autocomplete^1.5",
          "vernacular_en^2",
          "locality^2",
          "province^2",
          "notes",
          "order_name",
          "family_name",
          "genus_name",
          "taxon_path",
          "recorded_by",
        ],
        type: "best_fields",
        operator: "and",
      },
    });
  } else {
    must.push({ match_all: {} });
  }

  // Bảo mật dữ liệu: User LUÔN bị ép lọc is_public=true AND deleted_at IS NULL ở tầng ES query
  const filter = [];
  if (!isAdmin) {
    filter.push({ term: { is_public: true } });
    filter.push({ bool: { must_not: { exists: { field: "deleted_at" } } } });
  } else {
    if (typeof filters.isPublic === "boolean") {
      filter.push({ term: { is_public: filters.isPublic } });
    }
    if (!filters.includeDeleted) {
      filter.push({ bool: { must_not: { exists: { field: "deleted_at" } } } });
    }
  }

  const sortField = SORT_FIELDS[filters.sortBy] || (effectiveQuery ? "_score" : "collection_date");
  const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";
  const sort = sortField === "_score" ? ["_score", { specimen_id: "desc" }] : [{ [sortField]: { order: sortOrder, missing: "_last" } }];

  try {
    const result = await esClient.search({
      index: getIndexName("specimens"),
      from,
      size: limit,
      query: {
        bool: {
          must,
          filter,
        },
      },
      sort,
    });

    const total =
      typeof result.hits.total === "number" ? result.hits.total : result.hits.total?.value || 0;
    const items = result.hits.hits.map((h) => ({
      id: Number(h._source.specimen_id),
      score: h._score,
      ...h._source,
    }));

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      synonymNotice,
      tookMs: result.took,
    };
  } catch (err) {
    logger.error(`[ES SEARCH ERROR] ${err?.message}`);
    throw new AppError(ES_UNAVAILABLE_ERROR);
  }
}

module.exports = {
  ensureIndices,
  toSpecimenDoc,
  indexSpecimenNow,
  syncSpecimenWithRetry,
  bulkIndexSpecimens,
  reindexAll,
  searchSpecimens,
  getSyncState,
};
