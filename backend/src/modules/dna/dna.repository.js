/**
 * dna.repository.js — 100% dùng Knex query builder (SRS §6.5).
 * Quản lý truy vấn trình tự DNA (FASTA, GenBank Accession, BOLD Process ID, tỷ lệ G-C)
 * kèm liên kết Taxon phân cấp (Order → Family → Genus → Species) và Mẫu vật (Specimen).
 */
const knex = require("../../config/knex");

function escapeLike(raw) {
  return String(raw || "").slice(0, 120).replace(/[%_\\]/g, "\\$&");
}

function applyFilters(qb, filters, { includePrivate = false } = {}) {
  if (!includePrivate) {
    qb.where("d.is_public", true);
  } else if (typeof filters.isPublic === "boolean") {
    qb.where("d.is_public", filters.isPublic);
  }

  if (typeof filters.isOrphaned === "boolean") {
    qb.where("d.is_orphaned", filters.isOrphaned);
  }

  if (filters.marker && filters.marker.trim()) {
    qb.whereRaw("lower(d.gene_marker) = lower(?)", [filters.marker.trim()]);
  }

  if (filters.sourceDb && filters.sourceDb.trim()) {
    qb.where("d.source_db", filters.sourceDb.trim().toUpperCase());
  }

  if (filters.specimenId) {
    qb.where("d.specimen_id", filters.specimenId);
  }

  if (filters.minLength != null) {
    qb.where("d.sequence_length_bp", ">=", filters.minLength);
  }
  if (filters.maxLength != null) {
    qb.where("d.sequence_length_bp", "<=", filters.maxLength);
  }

  if (filters.taxonId) {
    qb.whereRaw(
      `d.taxon_id IN (
        WITH RECURSIVE sub_taxa AS (
          SELECT taxon_id FROM taxa WHERE taxon_id = ?
          UNION ALL
          SELECT c.taxon_id FROM taxa c JOIN sub_taxa st ON c.parent_id = st.taxon_id
        )
        SELECT taxon_id FROM sub_taxa
      )`,
      [filters.taxonId],
    );
  } else if (filters.order && filters.order.trim()) {
    qb.whereRaw(
      `d.taxon_id IN (
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
    const safe = `%${escapeLike(filters.q.trim())}%`;
    qb.andWhere((sub) => {
      sub
        .whereRaw("d.genbank_accession ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("d.bold_process_id ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("d.bin_uri ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("d.scientific_name_verbatim ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("t1.scientific_name ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("d.author_name ILIKE ? ESCAPE '\\'", [safe])
        .orWhereRaw("sr.specimen_code ILIKE ? ESCAPE '\\'", [safe]);
    });
  }

  return qb;
}

const SORT_COLUMN_MAP = {
  createdAt: "d.created_at",
  submissionDate: "d.submission_date",
  sequenceLengthBp: "d.sequence_length_bp",
  gcContentPct: "d.gc_content_pct",
  scientificName: "d.scientific_name_verbatim",
  dnaId: "d.dna_id",
};

async function findMany(filters, { includePrivate = false } = {}) {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 25;
  const offset = (page - 1) * limit;

  const baseQb = knex({ d: "dna_sequences" })
    .join({ t1: "taxa" }, "d.taxon_id", "t1.taxon_id")
    .leftJoin({ sr: "specimen_registry" }, "d.specimen_id", "sr.specimen_id");

  applyFilters(baseQb, filters, { includePrivate });

  const [{ total }] = await baseQb.clone().count("* as total");
  const totalInt = parseInt(total, 10);

  if (totalInt === 0) {
    return { items: [], total: 0, page, limit, totalPages: 0 };
  }

  const dataQb = baseQb
    .clone()
    .leftJoin({ t2: "taxa" }, "t1.parent_id", "t2.taxon_id")
    .leftJoin({ t3: "taxa" }, "t2.parent_id", "t3.taxon_id")
    .leftJoin({ t4: "taxa" }, "t3.parent_id", "t4.taxon_id")
    .select(
      "d.dna_id",
      "d.specimen_id",
      "sr.specimen_code",
      "d.taxon_id",
      "t1.scientific_name as taxon_name",
      "t1.taxon_rank as taxon_rank",
      "t1.slug as taxon_slug",
      "d.scientific_name_verbatim",
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
      "d.genbank_accession",
      "d.bold_process_id",
      "d.bin_uri",
      "d.gene_marker",
      "d.sequence_length_bp",
      "d.gc_content_pct",
      "d.submission_date",
      "d.author_name",
      "d.source_db",
      "d.is_public",
      "d.is_orphaned",
      knex.raw("d.fasta_sequence IS NOT NULL AND length(d.fasta_sequence) > 0 AS has_fasta"),
      "d.created_at",
      "d.updated_at",
    );

  const sortCol = SORT_COLUMN_MAP[filters.sortBy] || "d.created_at";
  const sortDir = filters.sortOrder === "asc" ? "asc" : "desc";
  dataQb.orderByRaw(`${sortCol} ${sortDir} NULLS LAST`).orderBy("d.dna_id", "desc").limit(limit).offset(offset);

  const rows = await dataQb;
  return {
    items: rows,
    total: totalInt,
    page,
    limit,
    totalPages: Math.ceil(totalInt / limit),
  };
}

async function findById(dnaId, { includePrivate = false } = {}) {
  const qb = knex({ d: "dna_sequences" })
    .join({ t1: "taxa" }, "d.taxon_id", "t1.taxon_id")
    .leftJoin({ t2: "taxa" }, "t1.parent_id", "t2.taxon_id")
    .leftJoin({ t3: "taxa" }, "t2.parent_id", "t3.taxon_id")
    .leftJoin({ t4: "taxa" }, "t3.parent_id", "t4.taxon_id")
    .leftJoin({ sr: "specimen_registry" }, "d.specimen_id", "sr.specimen_id")
    .where("d.dna_id", dnaId)
    .select(
      "d.*",
      "sr.specimen_code",
      "sr.basis_of_record",
      "sr.recorded_by",
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
    );

  if (!includePrivate) {
    qb.where("d.is_public", true);
  }

  const row = await qb.first();
  return row || null;
}

async function findByAccession(accession) {
  if (!accession) return null;
  return knex("dna_sequences").where("genbank_accession", accession).first();
}

async function findByBoldId(boldProcessId) {
  if (!boldProcessId) return null;
  return knex("dna_sequences").where("bold_process_id", boldProcessId).first();
}

async function taxonExists(taxonId) {
  const row = await knex("taxa").select("taxon_id").where("taxon_id", taxonId).first();
  return Boolean(row);
}

async function specimenExists(specimenId) {
  const row = await knex("specimen_registry").select("specimen_id").where("specimen_id", specimenId).first();
  return Boolean(row);
}

async function findMatchingTaxonByLineage(organismName, lineage = []) {
  if (organismName) {
    const clean = organismName.trim();
    const exact = await knex("taxa")
      .select("taxon_id", "scientific_name", "taxon_rank")
      .whereRaw("lower(scientific_name) = lower(?)", [clean])
      .first();
    if (exact) return exact;

    const words = clean.split(/\s+/);
    if (words.length >= 2) {
      const bin = `${words[0]} ${words[1]}`;
      const binMatch = await knex("taxa")
        .select("taxon_id", "scientific_name", "taxon_rank")
        .whereRaw("lower(scientific_name) = lower(?)", [bin])
        .first();
      if (binMatch) return binMatch;
    }
    const genus = words[0].replace(/[^a-zA-Z]/g, "");
    if (genus) {
      const gMatch = await knex("taxa")
        .select("taxon_id", "scientific_name", "taxon_rank")
        .whereRaw("lower(scientific_name) = lower(?)", [genus])
        .first();
      if (gMatch) return gMatch;
    }
  }

  for (let i = lineage.length - 1; i >= 0; i--) {
    const tName = lineage[i];
    if (!tName) continue;
    const match = await knex("taxa")
      .select("taxon_id", "scientific_name", "taxon_rank")
      .whereRaw("lower(scientific_name) = lower(?)", [tName])
      .first();
    if (match) return match;
  }

  return null;
}

async function create(data) {
  const [row] = await knex("dna_sequences")
    .insert({
      specimen_id: data.specimenId || null,
      taxon_id: data.taxonId,
      genbank_accession: data.genbankAccession || null,
      bold_process_id: data.boldProcessId || null,
      bin_uri: data.binUri || null,
      gene_marker: data.geneMarker || "COI",
      scientific_name_verbatim: data.scientificNameVerbatim || null,
      fasta_sequence: data.fastaSequence || null,
      sequence_length_bp: data.sequenceLengthBp || null,
      gc_content_pct: data.gcContentPct ?? null,
      primers_info: data.primersInfo || null,
      pcr_conditions: data.pcrConditions || null,
      submission_date: data.submissionDate || null,
      author_name: data.authorName || null,
      source_db: data.sourceDb || "INTERNAL",
      notes: data.notes || null,
      is_public: data.isPublic ?? true,
      is_orphaned: !data.specimenId,
    })
    .returning("dna_id");

  return Number(row.dna_id);
}

const UPDATE_MAP = [
  { key: "specimenId", col: "specimen_id" },
  { key: "taxonId", col: "taxon_id" },
  { key: "genbankAccession", col: "genbank_accession" },
  { key: "boldProcessId", col: "bold_process_id" },
  { key: "binUri", col: "bin_uri" },
  { key: "geneMarker", col: "gene_marker" },
  { key: "scientificNameVerbatim", col: "scientific_name_verbatim" },
  { key: "fastaSequence", col: "fasta_sequence" },
  { key: "sequenceLengthBp", col: "sequence_length_bp" },
  { key: "gcContentPct", col: "gc_content_pct" },
  { key: "primersInfo", col: "primers_info" },
  { key: "pcrConditions", col: "pcr_conditions" },
  { key: "submissionDate", col: "submission_date" },
  { key: "authorName", col: "author_name" },
  { key: "sourceDb", col: "source_db" },
  { key: "notes", col: "notes" },
  { key: "isPublic", col: "is_public" },
];

async function update(dnaId, data) {
  const payload = {};
  for (const { key, col } of UPDATE_MAP) {
    if (key in data) {
      payload[col] = data[key] === "" ? null : data[key];
    }
  }
  if ("specimenId" in data) {
    payload.is_orphaned = !data.specimenId;
  }
  if (Object.keys(payload).length === 0) return;

  payload.updated_at = knex.fn.now();
  await knex("dna_sequences").where("dna_id", dnaId).update(payload);
}

async function remove(dnaId) {
  await knex("dna_sequences").where("dna_id", dnaId).delete();
}

async function getStats({ includePrivate = false } = {}) {
  const visSql = includePrivate ? "" : "WHERE d.is_public = true";
  const [summaryRes, markerRes, sourceRes] = await Promise.all([
    knex.raw(`
      SELECT
        COUNT(*)::int AS total_sequences,
        COUNT(*) FILTER (WHERE d.is_public = true)::int AS public_sequences,
        COUNT(*) FILTER (WHERE d.specimen_id IS NOT NULL)::int AS linked_specimens,
        COUNT(DISTINCT COALESCE(d.scientific_name_verbatim, d.taxon_id::text))::int AS distinct_taxa,
        ROUND(AVG(d.sequence_length_bp))::int AS avg_length_bp,
        ROUND(AVG(d.gc_content_pct)::numeric, 1)::float AS avg_gc_pct
      FROM dna_sequences d
      ${visSql}
    `),
    knex.raw(`
      SELECT d.gene_marker AS marker, COUNT(*)::int AS count
      FROM dna_sequences d
      ${visSql}
      GROUP BY d.gene_marker
      ORDER BY count DESC
      LIMIT 10
    `),
    knex.raw(`
      SELECT d.source_db AS source, COUNT(*)::int AS count
      FROM dna_sequences d
      ${visSql}
      GROUP BY d.source_db
      ORDER BY count DESC
    `),
  ]);

  const s = summaryRes.rows[0] || {};
  return {
    totalSequences: s.total_sequences || 0,
    publicSequences: s.public_sequences || 0,
    linkedSpecimens: s.linked_specimens || 0,
    distinctTaxa: s.distinct_taxa || 0,
    avgLengthBp: s.avg_length_bp || 0,
    avgGcPct: s.avg_gc_pct || 0,
    byMarker: markerRes.rows,
    bySource: sourceRes.rows,
  };
}

module.exports = {
  findMany,
  findById,
  findByAccession,
  findByBoldId,
  taxonExists,
  specimenExists,
  findMatchingTaxonByLineage,
  create,
  update,
  remove,
  getStats,
};
