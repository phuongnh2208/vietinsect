import React from "react";
import { useTranslation } from "react-i18next";

export default function ActiveFilters({ state, onRemove, onReset }) {
  const { t } = useTranslation();

  const chips = [
    state.q && { key: "q", label: `q: ${state.q}` },
    state.order && { key: "order", label: `${t("search.facets.order", "Bộ")}: ${state.order}` },
    state.family && { key: "family", label: `${t("search.facets.family", "Họ")}: ${state.family}` },
    state.genus && { key: "genus", label: `${t("search.facets.genus", "Giống")}: ${state.genus}` },
    state.species && { key: "species", label: `${t("search.facets.species", "Loài")}: ${state.species}` },
    state.province && { key: "province", label: `${t("search.facets.province", "Tỉnh")}: ${state.province}` },
    state.yearFrom && { key: "yearFrom", label: `${t("search.facets.yearFrom", "Từ năm")}: ${state.yearFrom}` },
    state.yearTo && { key: "yearTo", label: `${t("search.facets.yearTo", "Đến năm")}: ${state.yearTo}` },
    state.mediaType && { key: "mediaType", label: `${t("search.facets.media", "Media")}: ${state.mediaType}` },
    state.iucnStatus && { key: "iucnStatus", label: `IUCN: ${state.iucnStatus}` },
    state.elevationMin !== "" && {
      key: "elevationMin",
      label: `${t("search.facets.elevationMin", "Từ (m)")}: ${state.elevationMin}m`,
    },
    state.elevationMax !== "" && {
      key: "elevationMax",
      label: `${t("search.facets.elevationMax", "Đến (m)")}: ${state.elevationMax}m`,
    },
    state.recordedBy && {
      key: "recordedBy",
      label: `${t("search.facets.recordedBy", "Người thu")}: ${state.recordedBy}`,
    },
    state.hasGps === true && { key: "hasGps", label: t("search.facets.hasGpsOnly", "Chỉ mẫu có GPS") },
  ].filter(Boolean);

  if (chips.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10 }}>
      {chips.map((c) => (
        <span
          key={c.key}
          className="status-badge status-public"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <span>{c.label}</span>
          <button
            type="button"
            aria-label={`${t("search.removeFilter", "Xóa bộ lọc")} ${c.label}`}
            onClick={() => onRemove(c.key)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontWeight: 700,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      ))}
      <button type="button" className="button button-sm button-ghost" onClick={onReset}>
        {t("search.resetAll", "Xóa tất cả bộ lọc")}
      </button>
    </div>
  );
}
