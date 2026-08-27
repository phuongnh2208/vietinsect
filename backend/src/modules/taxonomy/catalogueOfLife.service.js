const axios = require("axios");
const logger = require("../../config/logger");

// F-TX-02: xác thực tên khoa học qua Catalogue of Life API v1 trước khi lưu (SRS §3.3, §4.4).
// Đây là tích hợp best-effort: COL là dịch vụ ngoài, không được chặn luồng lưu taxon nội bộ
// nếu mạng lỗi hoặc COL không phản hồi kịp — chỉ đính kèm gợi ý so khớp khi thành công.
const COL_API_BASE = process.env.COL_API_URL || "https://api.checklistbank.org";
const COL_DATASET_ID = process.env.COL_DATASET_ID || "3LR"; // Catalogue of Life – dataset mới nhất
const REQUEST_TIMEOUT_MS = 4000;

async function verifyScientificName(scientificName) {
  try {
    const { data } = await axios.get(`${COL_API_BASE}/dataset/${COL_DATASET_ID}/nameusage/search`, {
      params: { q: scientificName, limit: 5, content: "SCIENTIFIC_NAME" },
      timeout: REQUEST_TIMEOUT_MS,
    });

    const candidates = (data?.result || []).map((item) => ({
      colId: item.id,
      scientificName: item.usage?.name?.scientificName || item.usage?.label,
      rank: item.usage?.name?.rank,
      status: item.usage?.status,
    }));

    return { available: true, exactMatch: candidates.some((c) => c.scientificName?.toLowerCase() === scientificName.toLowerCase()), candidates };
  } catch (err) {
    logger.warn(`Catalogue of Life không phản hồi cho "${scientificName}": ${err.message}`);
    return { available: false, exactMatch: false, candidates: [] };
  }
}

module.exports = { verifyScientificName };
