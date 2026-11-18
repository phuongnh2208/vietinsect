import http from "../../services/http";

async function getTree() {
  const { data } = await http.get("/taxonomy/tree");
  return data.data;
}

async function getChildren(parentId) {
  const { data } = await http.get(`/taxonomy/${parentId}/children`);
  return data.data;
}

async function searchTaxa(query) {
  const { data } = await http.get("/taxonomy/search", { params: { q: query } });
  return data.data;
}

async function getTaxonById(taxonId) {
  const { data } = await http.get(`/taxonomy/${taxonId}`);
  return data.data;
}

async function getSpeciesProfile(identifier) {
  const { data } = await http.get(`/taxonomy/species/${identifier}`);
  return data.data;
}

async function createTaxon(payload) {
  const { data } = await http.post("/taxonomy", payload);
  return data; // { data: taxon, colSuggestions }
}

async function updateTaxon(taxonId, payload) {
  const { data } = await http.put(`/taxonomy/${taxonId}`, payload);
  return data.data;
}

async function deleteTaxon(taxonId) {
  await http.delete(`/taxonomy/${taxonId}`);
}

async function setSynonym(taxonId, acceptedTaxonId) {
  const { data } = await http.patch(`/taxonomy/${taxonId}/synonym`, { acceptedTaxonId });
  return data.data;
}

async function clearSynonym(taxonId) {
  const { data } = await http.patch(`/taxonomy/${taxonId}/clear-synonym`);
  return data.data;
}

async function upsertSpeciesProfile(taxonId, payload) {
  const { data } = await http.put(`/taxonomy/species/${taxonId}/profile`, payload);
  return data.data;
}

async function addBioactivity(taxonId, payload) {
  const { data } = await http.post(`/taxonomy/species/${taxonId}/bioactivity`, payload);
  return data.data;
}

async function removeBioactivity(bioactivityId) {
  await http.delete(`/taxonomy/bioactivity/${bioactivityId}`);
}

async function importChecklist(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await http.post("/taxonomy/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
}

const taxonomyService = {
  getTree,
  getChildren,
  searchTaxa,
  getTaxonById,
  getSpeciesProfile,
  createTaxon,
  updateTaxon,
  deleteTaxon,
  setSynonym,
  clearSynonym,
  upsertSpeciesProfile,
  addBioactivity,
  removeBioactivity,
  importChecklist,
};

export default taxonomyService;
