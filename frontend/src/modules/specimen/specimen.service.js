import http from "../../services/http";

let _lookupsCache = null;

async function getSpecimens(params = {}) {
  const cleanParams = {};
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      cleanParams[key] = val;
    }
  });
  const { data } = await http.get("/specimens", { params: cleanParams });
  return { items: data.data || [], pagination: data.pagination || { total: 0, page: 1, limit: 25, totalPages: 0 } };
}

async function getSpecimenById(id) {
  const { data } = await http.get(`/specimens/${id}`);
  return data.data;
}

async function getLookups({ force = false } = {}) {
  if (_lookupsCache && !force) return _lookupsCache;
  const { data } = await http.get("/specimens/lookups");
  _lookupsCache = data.data;
  return _lookupsCache;
}

async function getStats() {
  const { data } = await http.get("/specimens/stats");
  return data.data;
}

async function getAnalytics(params = {}) {
  const cleanParams = {};
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      cleanParams[key] = val;
    }
  });
  const { data } = await http.get("/specimens/analytics", { params: cleanParams });
  return data.data;
}

async function getMapOccurrences(params = {}, options = {}) {
  const cleanParams = {};
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      cleanParams[key] = val;
    }
  });
  const { data } = await http.get("/specimens/map", {
    params: cleanParams,
    signal: options.signal,
  });
  return data.data;
}

async function createSpecimen(payload) {
  const { data } = await http.post("/specimens", payload);
  return data.data;
}

async function updateSpecimen(id, payload) {
  const { data } = await http.put(`/specimens/${id}`, payload);
  return data.data;
}

async function togglePublic(id, isPublic) {
  const { data } = await http.patch(`/specimens/${id}/public`, { isPublic });
  return data.data;
}

async function batchTogglePublic(specimenIds, isPublic) {
  const { data } = await http.patch("/specimens/batch-public", { specimenIds, isPublic });
  return data.data;
}

async function batchUpdateSpecimens(specimenIds, updates) {
  const { data } = await http.patch("/specimens/batch-update", { specimenIds, updates });
  return data.data;
}

async function bulkImportSpecimens(rows) {
  const { data } = await http.post("/specimens/bulk-import", { rows });
  return data.data;
}

async function deleteSpecimen(id) {
  await http.delete(`/specimens/${id}`);
}

async function exportSpecimens(params = {}) {
  const cleanParams = {};
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      cleanParams[key] = val;
    }
  });
  const res = await http.get("/specimens/export", {
    params: cleanParams,
    responseType: "blob",
    timeout: 60000,
  });
  return res.data;
}

const specimenService = {
  getSpecimens,
  getSpecimenById,
  getLookups,
  getStats,
  getAnalytics,
  getMapOccurrences,
  exportSpecimens,
  createSpecimen,
  updateSpecimen,
  togglePublic,
  batchTogglePublic,
  batchUpdateSpecimens,
  bulkImportSpecimens,
  deleteSpecimen,
};

export default specimenService;
