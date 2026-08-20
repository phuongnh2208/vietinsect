import http from "../../services/http";

async function getTree() {
  const { data } = await http.get("/taxonomy/tree");
  return data.data;
}

async function getSpeciesBySlug(slug) {
  const { data } = await http.get(`/taxonomy/species/${slug}`);
  return data.data;
}

async function saveTaxon(payload) {
  const { data } = await http.post("/taxonomy/taxa", payload);
  return data.data;
}

const taxonomyService = { getTree, getSpeciesBySlug, saveTaxon };

export default taxonomyService;
