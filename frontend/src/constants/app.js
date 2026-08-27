export const PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const DEBOUNCE_MS = 300;
export const DATE_FORMAT = "DD/MM/YYYY";
export const DATETIME_FORMAT = "DD/MM/YYYY HH:mm:ss";
export const MAX_UPLOAD_SIZE_MB = 10;

export const APP_CONFIG = {
  NAME: "VietInsect",
  SUBTITLE: "Hệ thống dữ liệu côn trùng Việt Nam",
  PAGE_SIZE,
  MAX_PAGE_SIZE,
  DEBOUNCE_MS,
  DATE_FORMAT,
  DATETIME_FORMAT,
  MAX_UPLOAD_SIZE_MB,
  SUPPORTED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
  VN_BOUNDS: {
    LAT_MIN: 8.0,
    LAT_MAX: 24.0,
    LNG_MIN: 101.0,
    LNG_MAX: 118.0,
  },
  STORAGE_KEYS: {
    TOKEN: "vietinsect_token",
    LANGUAGE: "vietinsect_language",
    THEME: "vietinsect_theme",
  },
};

export default APP_CONFIG;
