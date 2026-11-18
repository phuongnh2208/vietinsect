export const ORDER_COLORS = {
  Lepidoptera: "#2E7D32",
  Coleoptera: "#0F3820",
  Hymenoptera: "#9C7A1F",
  Diptera: "#1D4ED8",
  Odonata: "#0284C7",
  Hemiptera: "#B0241A",
  Orthoptera: "#65A30D",
  Blattodea: "#78350F",
  Mantodea: "#15803D",
  Neuroptera: "#6D28D9",
  Trichoptera: "#0E7490",
  Phasmida: "#4D7C0F",
  Default: "#334155",
};

export function getOrderColor(orderName) {
  if (!orderName) return ORDER_COLORS.Default;
  return ORDER_COLORS[orderName] || ORDER_COLORS.Default;
}

export const BASIS_OF_RECORD_LABELS = {
  PRESERVED_SPECIMEN: "Mẫu vật bảo tàng",
  HUMAN_OBSERVATION: "Quan sát tự nhiên",
  MATERIAL_SAMPLE: "Mẫu vật liệu / DNA",
  MACHINE_OBSERVATION: "Cảm biến / Bẫy ảnh",
  LIVING_SPECIMEN: "Mẫu sống",
  OBSERVATION: "Ghi nhận quan sát",
  OCCURRENCE: "Hiện diện sinh học",
};

export function formatBasisOfRecord(code) {
  if (!code) return "Chưa phân loại";
  return BASIS_OF_RECORD_LABELS[code] || code;
}

export const SEX_LABELS = {
  male: "Đực (♂)",
  female: "Cái (♀)",
  unknown: "Không rõ",
};

export const SPATIAL_PRESETS = [
  { label: "VQG Cúc Phương", lat: 20.3167, lon: 105.6083, radiusKm: 25 },
  { label: "VQG Ba Vì / Hà Nội", lat: 21.0811, lon: 105.3667, radiusKm: 35 },
  { label: "Đà Lạt / Bidoup", lat: 12.18, lon: 108.68, radiusKm: 40 },
  { label: "VQG Cát Tiên", lat: 11.423, lon: 107.428, radiusKm: 30 },
];
