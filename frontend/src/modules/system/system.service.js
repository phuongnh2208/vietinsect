import http from "../../services/http";

async function getAuditLogs(params = {}) {
  const clean = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") clean[k] = v;
  });
  const { data } = await http.get("/system/audit-logs", { params: clean });
  return {
    items: data.data || [],
    pagination: data.pagination || { total: 0, page: 1, limit: 25, totalPages: 0 },
  };
}

async function getConfigs() {
  const { data } = await http.get("/system/configs");
  return data.data || [];
}

async function updateConfig(key, payload) {
  const { data } = await http.put(`/system/configs/${encodeURIComponent(key)}`, payload);
  return data.data;
}

async function changePassword(currentPassword, newPassword) {
  const { data } = await http.post("/auth/change-password", { currentPassword, newPassword });
  return data;
}

const systemService = {
  getAuditLogs,
  getConfigs,
  updateConfig,
  changePassword,
};

export default systemService;
