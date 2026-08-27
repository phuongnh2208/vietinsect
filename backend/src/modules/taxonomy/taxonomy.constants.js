// F-TX-01: cây phân cấp 8 bậc Kingdom → Subspecies (SRS §4.4).
const TAXON_RANKS = [
  "Kingdom",
  "Phylum",
  "Class",
  "Order",
  "Family",
  "Genus",
  "Species",
  "Subspecies",
];

const SPECIES_PROFILE_RANKS = ["Species", "Subspecies"];

const TAXONOMIC_STATUSES = ["accepted", "synonym"];

const IUCN_STATUSES = ["LC", "NT", "VU", "EN", "CR", "EW", "EX", "DD", "NE"];

module.exports = { TAXON_RANKS, SPECIES_PROFILE_RANKS, TAXONOMIC_STATUSES, IUCN_STATUSES };
