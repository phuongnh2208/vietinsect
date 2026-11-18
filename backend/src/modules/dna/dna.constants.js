const GENE_MARKERS = [
  "COI",
  "COI-5P",
  "16S",
  "18S",
  "28S",
  "CytB",
  "ITS2",
  "EF-1a",
  "Wingless",
];

const DNA_SOURCES = ["NCBI", "BOLD", "INTERNAL"];

const SORTABLE_DNA_FIELDS = [
  "createdAt",
  "submissionDate",
  "sequenceLengthBp",
  "gcContentPct",
  "scientificName",
  "dnaId",
];

// SRS F-DN-02: chuẩn định dạng mã GenBank Accession (5–8 chữ số + hỗ trợ RefSeq NC_... và hậu tố phiên bản .1)
const GENBANK_ACCESSION_REGEX = /^[A-Z]{1,2}_?\d{5,8}(\.\d+)?$/i;

const DEFAULT_PAGE_LIMIT = 25;
const MAX_PAGE_LIMIT = 100;

module.exports = {
  GENE_MARKERS,
  DNA_SOURCES,
  SORTABLE_DNA_FIELDS,
  GENBANK_ACCESSION_REGEX,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
};
