import React from "react";
import { useTranslation } from "react-i18next";
import { VALID_VIEWS } from "../useSearchQueryParams";

export default function ViewSwitcher({ activeView, onChange }) {
  const { t } = useTranslation();

  const labels = {
    list: t("search.views.list", "Danh sách"),
    label: t("search.views.label", "Nhãn mẫu (Specify 7)"),
    gallery: t("search.views.gallery", "Thư viện ảnh"),
    map: t("search.views.map", "Bản đồ GIS"),
    treemap: t("search.views.treemap", "Biểu đồ Treemap"),
  };

  return (
    <div role="tablist" aria-label="View mode" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {VALID_VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={activeView === v}
          aria-label={labels[v]}
          className={`button button-sm ${activeView === v ? "button-primary" : "button-ghost"}`}
          onClick={() => onChange(v)}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}
