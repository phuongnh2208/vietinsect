import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";

export const SUPPORTED_LANGUAGES = ["vi", "en"];
export const DEFAULT_LANGUAGE = "vi";
export const LANGUAGE_STORAGE_KEY = "vietinsect_language";

export function normalizeLanguage(lng) {
  if (typeof lng !== "string") return DEFAULT_LANGUAGE;
  const code = lng.trim().toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.includes(code) ? code : DEFAULT_LANGUAGE;
}

export function getSavedLanguage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_LANGUAGE;
  }
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!raw) return DEFAULT_LANGUAGE;
    const normalized = normalizeLanguage(raw);
    if (normalized !== raw) {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    }
    return normalized;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function setDocumentLanguage(lng) {
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = normalizeLanguage(lng);
  }
}

export function changeAppLanguage(lng) {
  const next = normalizeLanguage(lng);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    }
  } catch {
    // Ignore storage quota/privacy mode errors
  }
  setDocumentLanguage(next);
  return i18n.changeLanguage(next);
}

const initialLanguage = getSavedLanguage();
setDocumentLanguage(initialLanguage);

if (!i18n.isInitialized) {
  i18n
    .use(HttpBackend)
    .use(initReactI18next)
    .init({
      lng: initialLanguage,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: SUPPORTED_LANGUAGES,
      nonExplicitSupportedLngs: true,
      load: "languageOnly",
      backend: {
        loadPath: "/locales/{{lng}}.json",
      },
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });

  i18n.on("languageChanged", (lng) => {
    setDocumentLanguage(lng);
  });
}

export default i18n;
