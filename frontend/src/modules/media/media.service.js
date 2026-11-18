import http from "../../services/http";

export const ALLOWED_MEDIA_LICENSES = [
  { code: "cc0", label: "CC0 1.0 (Public Domain — Xuất được GBIF)" },
  { code: "cc-by", label: "CC BY 4.0 (Ghi công — Xuất được GBIF)" },
  { code: "cc-by-sa", label: "CC BY-SA 4.0 (Chia sẻ tương tự)" },
  { code: "cc-by-nc", label: "CC BY-NC 4.0 (Phi thương mại — Lọc khỏi DwC-A)" },
  { code: "cc-by-nc-sa", label: "CC BY-NC-SA 4.0 (Phi thương mại · SA — Lọc khỏi DwC-A)" },
];

async function getMediaList(params = {}) {
  const clean = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== false) {
      clean[k] = v;
    }
  });
  const { data } = await http.get("/media", { params: clean });
  return {
    items: data.data || [],
    pagination: data.pagination || { total: 0, page: 1, limit: 24, totalPages: 0 },
  };
}

async function getMediaStats() {
  const { data } = await http.get("/media/stats");
  return data.data;
}

async function uploadMedia({ file, specimenId, licenseCode, attribution, shotType, isPublic = true }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("specimenId", specimenId);
  formData.append("licenseCode", licenseCode);
  if (attribution) formData.append("attribution", attribution);
  if (shotType) formData.append("shotType", shotType);
  formData.append("isPublic", String(isPublic));

  const { data } = await http.post("/media/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
}

async function deleteMedia(id) {
  await http.delete(`/media/${id}`);
}

const mediaService = {
  getMediaList,
  getMediaStats,
  uploadMedia,
  deleteMedia,
};

export default mediaService;
