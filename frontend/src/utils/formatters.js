import i18n from "../i18n";

export function getIntlLocale(lang) {
  const current = (lang || i18n.language || "vi").toLowerCase();
  return current.startsWith("en") ? "en-US" : "vi-VN";
}

export function formatNumber(value, lang, options) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat(getIntlLocale(lang), options).format(num);
}

export function formatDate(value, lang, options) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(
    getIntlLocale(lang),
    options || { year: "numeric", month: "2-digit", day: "2-digit" }
  ).format(date);
}

export function formatDateTime(value, lang, options) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(
    getIntlLocale(lang),
    options || {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}
