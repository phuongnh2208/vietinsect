import http from "../../services/http";

async function searchSpecimens(params = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      clean[k] = v;
    }
  }
  const { data } = await http.get("/search/specimens", { params: clean });
  return data;
}

const searchService = { searchSpecimens };
export default searchService;
