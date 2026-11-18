const dnaRepository = require("./dna.repository");
const ncbiService = require("./ncbi.service");
const DnaError = require("./dna.errors");
const AppError = require("../../utils/appError");
const logger = require("../../config/logger");

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

/**
 * Chuẩn hóa chuỗi FASTA đầu vào:
 * - Bỏ dòng header ">..." nếu người dùng paste nguyên file FASTA
 * - Loại bỏ khoảng trắng/số thứ tự dòng
 * - Kiểm tra ký tự nucleotide chuẩn IUPAC
 */
function sanitizeSequence(raw) {
  if (!raw) return null;
  const lines = String(raw)
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(">"));
  const cleaned = lines.join("").replace(/[\s0-9-]/g, "").toUpperCase();
  if (!cleaned) return null;
  if (!/^[ATGCNRYKMSWBDHVU]+$/.test(cleaned)) {
    throw new AppError(DnaError.INVALID_FASTA_SEQUENCE);
  }
  return cleaned;
}

function analyzeSequenceComposition(seq) {
  if (!seq) {
    return {
      lengthBp: 0,
      gcContentPct: null,
      atContentPct: null,
      counts: { A: 0, T: 0, G: 0, C: 0, other: 0 },
      percentages: { A: 0, T: 0, G: 0, C: 0 },
    };
  }

  let A = 0;
  let T = 0;
  let G = 0;
  let C = 0;
  let other = 0;

  for (let i = 0; i < seq.length; i++) {
    const ch = seq[i];
    if (ch === "A") A++;
    else if (ch === "T" || ch === "U") T++;
    else if (ch === "G") G++;
    else if (ch === "C") C++;
    else other++;
  }

  const atgcTotal = A + T + G + C;
  const pct = (n) => (atgcTotal > 0 ? Number(((n / atgcTotal) * 100).toFixed(2)) : 0);
  const gcPct = atgcTotal > 0 ? Number((((G + C) / atgcTotal) * 100).toFixed(2)) : null;
  const atPct = gcPct != null ? Number((100 - gcPct).toFixed(2)) : null;

  return {
    lengthBp: seq.length,
    gcContentPct: gcPct,
    atContentPct: atPct,
    counts: { A, T, G, C, other },
    percentages: {
      A: pct(A),
      T: pct(T),
      G: pct(G),
      C: pct(C),
    },
  };
}

function buildFastaText(row) {
  const code = row.genbank_accession || row.bold_process_id || `VIETINSECT-DNA-${row.dna_id}`;
  const sciName = row.scientific_name_verbatim || row.taxon_name || "Insecta sp.";
  const marker = row.gene_marker || "COI";
  const len = row.sequence_length_bp || (row.fasta_sequence ? row.fasta_sequence.length : 0);
  const specPart = row.specimen_code ? ` | voucher=${row.specimen_code}` : "";
  const header = `>${code} | ${sciName} | ${marker} marker | ${len} bp${specPart}`;

  const seq = row.fasta_sequence || "";
  if (!seq) return `${header}\n`;

  const lines = [];
  for (let i = 0; i < seq.length; i += 70) {
    lines.push(seq.slice(i, i + 70));
  }
  return `${header}\n${lines.join("\n")}\n`;
}

function buildExternalLinks(row) {
  const links = {};
  if (row.genbank_accession) {
    links.ncbi = `https://www.ncbi.nlm.nih.gov/nuccore/${encodeURIComponent(row.genbank_accession)}`;
  }
  if (row.bold_process_id) {
    links.bold = `https://portal.boldsystems.org/record/${encodeURIComponent(row.bold_process_id)}`;
  }
  if (row.bin_uri) {
    const binClean = String(row.bin_uri).replace(/^BOLD:/i, "");
    links.boldBin = `https://portal.boldsystems.org/bin/BOLD:${encodeURIComponent(binClean)}`;
  }
  return links;
}

function toDnaSummaryDto(row) {
  const scientificName = row.scientific_name_verbatim || row.taxon_name || "Insecta sp.";
  return {
    id: Number(row.dna_id),
    specimenId: row.specimen_id != null ? Number(row.specimen_id) : null,
    specimenCode: row.specimen_code || null,
    taxonId: Number(row.taxon_id),
    taxonName: row.taxon_name,
    taxonRank: row.taxon_rank,
    taxonSlug: row.taxon_slug || null,
    scientificName,
    scientificNameVerbatim: row.scientific_name_verbatim || null,
    orderName: row.order_name || null,
    familyName: row.family_name || null,
    genbankAccession: row.genbank_accession || null,
    boldProcessId: row.bold_process_id || null,
    binUri: row.bin_uri || null,
    geneMarker: row.gene_marker || "COI",
    sequenceLengthBp: row.sequence_length_bp != null ? Number(row.sequence_length_bp) : null,
    gcContentPct: row.gc_content_pct != null ? Number(row.gc_content_pct) : null,
    submissionDate: formatDateOnly(row.submission_date),
    authorName: row.author_name || null,
    sourceDb: row.source_db || "NCBI",
    isPublic: Boolean(row.is_public),
    isOrphaned: Boolean(row.is_orphaned),
    hasFasta: row.has_fasta !== undefined ? Boolean(row.has_fasta) : Boolean(row.fasta_sequence),
    externalLinks: buildExternalLinks(row),
    retrievedAt: row.retrieved_at || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDnaDetailDto(row) {
  const composition = analyzeSequenceComposition(row.fasta_sequence);
  return {
    ...toDnaSummaryDto(row),
    genusName: row.genus_name || null,
    primersInfo: row.primers_info || null,
    pcrConditions: row.pcr_conditions || null,
    notes: row.notes || null,
    fastaSequence: row.fasta_sequence || null,
    fastaFormatted: buildFastaText(row),
    composition,
  };
}

async function listDna(filters, { isAdmin = false } = {}) {
  const res = await dnaRepository.findMany(filters, { includePrivate: isAdmin });
  return {
    items: res.items.map(toDnaSummaryDto),
    pagination: {
      total: res.total,
      page: res.page,
      limit: res.limit,
      totalPages: res.totalPages,
    },
  };
}

async function getDnaById(dnaId, { isAdmin = false } = {}) {
  const row = await dnaRepository.findById(dnaId, { includePrivate: isAdmin });
  if (!row) throw new AppError(DnaError.DNA_NOT_FOUND);
  return toDnaDetailDto(row);
}

async function createDna(payload, adminId) {
  const hasTaxon = await dnaRepository.taxonExists(payload.taxonId);
  if (!hasTaxon) throw new AppError(DnaError.TAXON_NOT_FOUND);

  if (payload.specimenId) {
    const hasSpec = await dnaRepository.specimenExists(payload.specimenId);
    if (!hasSpec) throw new AppError(DnaError.SPECIMEN_NOT_FOUND);
  }

  if (payload.genbankAccession) {
    const existing = await dnaRepository.findByAccession(payload.genbankAccession);
    if (existing) throw new AppError(DnaError.DUPLICATE_ACCESSION);
  }

  if (payload.boldProcessId) {
    const existingBold = await dnaRepository.findByBoldId(payload.boldProcessId);
    if (existingBold) throw new AppError(DnaError.DUPLICATE_BOLD_ID);
  }

  const cleanSeq = sanitizeSequence(payload.fastaSequence);
  const comp = analyzeSequenceComposition(cleanSeq);

  const newId = await dnaRepository.create({
    ...payload,
    fastaSequence: cleanSeq,
    sequenceLengthBp: cleanSeq ? comp.lengthBp : payload.sequenceLengthBp || null,
    gcContentPct: cleanSeq ? comp.gcContentPct : null,
  });

  logger.info(`Admin ${adminId} thêm chuỗi DNA mới #${newId} (${payload.genbankAccession || payload.geneMarker})`);
  return getDnaById(newId, { isAdmin: true });
}

async function updateDna(dnaId, payload, adminId) {
  const current = await dnaRepository.findById(dnaId, { includePrivate: true });
  if (!current) throw new AppError(DnaError.DNA_NOT_FOUND);

  if (payload.taxonId) {
    const hasTaxon = await dnaRepository.taxonExists(payload.taxonId);
    if (!hasTaxon) throw new AppError(DnaError.TAXON_NOT_FOUND);
  }

  if (payload.specimenId) {
    const hasSpec = await dnaRepository.specimenExists(payload.specimenId);
    if (!hasSpec) throw new AppError(DnaError.SPECIMEN_NOT_FOUND);
  }

  if (payload.genbankAccession && payload.genbankAccession !== current.genbank_accession) {
    const existing = await dnaRepository.findByAccession(payload.genbankAccession);
    if (existing) throw new AppError(DnaError.DUPLICATE_ACCESSION);
  }

  if (payload.boldProcessId && payload.boldProcessId !== current.bold_process_id) {
    const existingBold = await dnaRepository.findByBoldId(payload.boldProcessId);
    if (existingBold) throw new AppError(DnaError.DUPLICATE_BOLD_ID);
  }

  const updatePayload = { ...payload };
  if ("fastaSequence" in payload) {
    const cleanSeq = sanitizeSequence(payload.fastaSequence);
    const comp = analyzeSequenceComposition(cleanSeq);
    updatePayload.fastaSequence = cleanSeq;
    updatePayload.sequenceLengthBp = cleanSeq ? comp.lengthBp : payload.sequenceLengthBp || null;
    updatePayload.gcContentPct = cleanSeq ? comp.gcContentPct : null;
  }

  await dnaRepository.update(dnaId, updatePayload);
  logger.info(`Admin ${adminId} cập nhật chuỗi DNA #${dnaId}`);
  return getDnaById(dnaId, { isAdmin: true });
}

async function togglePublic(dnaId, isPublic, adminId) {
  return updateDna(dnaId, { isPublic }, adminId);
}

async function deleteDna(dnaId, adminId) {
  const current = await dnaRepository.findById(dnaId, { includePrivate: true });
  if (!current) throw new AppError(DnaError.DNA_NOT_FOUND);

  await dnaRepository.remove(dnaId);
  logger.info(`Admin ${adminId} xóa chuỗi DNA #${dnaId}`);
}

async function getStats({ isAdmin = false } = {}) {
  return dnaRepository.getStats({ includePrivate: isAdmin });
}

async function lookupGenBankAccession(accession) {
  let metadata;
  try {
    metadata = await ncbiService.fetchGenBankByAccession(accession);
  } catch (err) {
    logger.warn(`NCBI lookup failed for ${accession}: ${err.message}`);
    throw new AppError(DnaError.NCBI_LOOKUP_FAILED);
  }

  if (!metadata) {
    throw new AppError(DnaError.NCBI_LOOKUP_FAILED);
  }

  const matchedTaxon = await dnaRepository.findMatchingTaxonByLineage(
    metadata.scientificNameVerbatim,
    metadata.lineage,
  );
  const comp = analyzeSequenceComposition(metadata.fastaSequence);

  return {
    ...metadata,
    gcContentPct: comp.gcContentPct,
    matchedTaxon: matchedTaxon
      ? {
          id: Number(matchedTaxon.taxon_id),
          scientificName: matchedTaxon.scientific_name,
          rank: matchedTaxon.taxon_rank,
        }
      : null,
  };
}

module.exports = {
  listDna,
  getDnaById,
  createDna,
  updateDna,
  togglePublic,
  deleteDna,
  getStats,
  lookupGenBankAccession,
};
