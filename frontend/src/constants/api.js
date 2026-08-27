export const API = {
  // Auth
  AUTH_LOGIN: "/auth/login",
  AUTH_ME: "/auth/me",
  AUTH_CHANGE_PASSWORD: "/auth/change-password",

  // Taxonomy
  TAXONOMY_TREE: "/taxonomy/tree",
  TAXONOMY_SEARCH: "/taxonomy/search",
  TAXONOMY_BY_ID: (id) => `/taxonomy/${id}`,
  TAXONOMY_SPECIES_PROFILE: (identifier) => `/taxonomy/species/${identifier}`,
  TAXONOMY_CREATE: "/taxonomy",
  TAXONOMY_UPDATE: (id) => `/taxonomy/${id}`,
  TAXONOMY_DELETE: (id) => `/taxonomy/${id}`,
  TAXONOMY_SYNONYM: (id) => `/taxonomy/${id}/synonym`,
  TAXONOMY_CLEAR_SYNONYM: (id) => `/taxonomy/${id}/clear-synonym`,
  TAXONOMY_UPSERT_PROFILE: (id) => `/taxonomy/species/${id}/profile`,
  TAXONOMY_BIOACTIVITY: (id) => `/taxonomy/species/${id}/bioactivity`,
  TAXONOMY_DELETE_BIOACTIVITY: (id) => `/taxonomy/bioactivity/${id}`,
  TAXONOMY_IMPORT: "/taxonomy/import",

  // Specimen
  SPECIMENS: "/specimens",
  SPECIMEN_BY_ID: (id) => `/specimens/${id}`,
  SPECIMEN_TOGGLE_PUBLIC: (id) => `/specimens/${id}/public`,
  SPECIMEN_IMPORT: "/specimens/import",
  SPECIMEN_IMAGES: (id) => `/specimens/${id}/images`,
  SPECIMEN_LABELS: "/specimens/labels",
  SPECIMEN_BATCH: "/specimens/batch",

  // Search
  SEARCH: "/search",
  SEARCH_ADVANCED: "/search/advanced",
  SEARCH_MEDIA: "/search/media",
  EXPORT_DWCA: "/export/dwca",
  EXPORT_EXCEL: "/export/excel",
  EXPORT_GEOJSON: "/export/geojson",

  // GIS
  GIS_OCCURRENCES: "/gis/occurrences",
  GIS_HEATMAP: "/gis/heatmap",
  GIS_RICHNESS: "/gis/richness",
  GIS_LAYERS: "/gis/layers",
  GIS_LAYER_BY_ID: (id) => `/gis/layers/${id}`,
  GIS_LAYER_STYLE: (id) => `/gis/layers/${id}/style`,

  // DNA
  DNA: "/dna",
  DNA_BY_ID: (id) => `/dna/${id}`,
  DNA_FASTA: (id) => `/dna/${id}/fasta`,

  // Reports
  REPORTS_SPECIES_CHECKLIST: "/reports/species-checklist",
  REPORTS_KPI: "/reports/kpi",
  REPORTS_CUSTOM: "/reports/custom",

  // Admin
  ADMIN_STATS: "/admin/stats",
  ADMIN_SPECIMENS_BATCH_PUBLIC: "/admin/specimens/batch-public",
  ADMIN_AUDIT_LOGS: "/admin/audit-logs",
  ADMIN_CONFIG: "/admin/config",
  ADMIN_CONFIG_KEY: (key) => `/admin/config/${key}`,

  // AI
  AI_IDENTIFY: "/ai/identify",
  AI_SDM_PREDICT: "/ai/sdm/predict",
};

export const API_ENDPOINTS = API;

export default API;
