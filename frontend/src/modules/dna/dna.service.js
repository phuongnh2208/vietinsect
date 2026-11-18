import http from "../../services/http";

// Đồng bộ chính xác với SRS F-DN-02 & backend GENBANK_ACCESSION_REGEX (\d{5,8})
export const GENBANK_ACCESSION_REGEX = /^[A-Z]{1,2}_?\d{5,8}(\.\d+)?$/i;

export const GENE_MARKERS = [
  "COI",
  "COI-5P",
  "16S",
  "18S",
  "28S",
  "ITS2",
  "CytB",
  "EF-1a",
];

async function getDnaList(params = {}) {
  const clean = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") clean[k] = v;
  });
  const { data } = await http.get("/dna", { params: clean });
  return {
    items: data.data || [],
    pagination: data.pagination || { total: 0, page: 1, limit: 25, totalPages: 0 },
  };
}

async function getDnaById(id) {
  const { data } = await http.get(`/dna/${id}`);
  return data.data;
}

async function getDnaStats() {
  const { data } = await http.get("/dna/stats");
  return data.data;
}

async function fetchGenBankMetadata(accession) {
  const { data } = await http.get(`/dna/fetch-genbank/${encodeURIComponent(accession.trim())}`);
  return data.data;
}

async function createDna(payload) {
  const { data } = await http.post("/dna", payload);
  return data.data;
}

async function updateDna(id, payload) {
  const { data } = await http.put(`/dna/${id}`, payload);
  return data.data;
}

async function togglePublic(id, isPublic) {
  const { data } = await http.patch(`/dna/${id}/public`, { isPublic });
  return data.data;
}

async function deleteDna(id) {
  await http.delete(`/dna/${id}`);
}

const dnaService = {
  getDnaList,
  getDnaById,
  getDnaStats,
  fetchGenBankMetadata,
  createDna,
  updateDna,
  togglePublic,
  deleteDna,
};

export default dnaService;
