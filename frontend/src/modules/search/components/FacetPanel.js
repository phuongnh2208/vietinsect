import React from "react";
import { useTranslation } from "react-i18next";

export default function FacetPanel({ facets, state, onChange }) {
  const { t } = useTranslation();
  const f = facets || {};
  const activeMedia = state.mediaType ? state.mediaType.split(",").filter(Boolean) : [];

  const toggleMedia = (type) => {
    const next = activeMedia.includes(type)
      ? activeMedia.filter((m) => m !== type)
      : [...activeMedia, type];
    onChange({ mediaType: next.join(",") });
  };

  return (
    <aside
      className="card facet-panel"
      aria-label={t("search.facets.title", "Bộ lọc (8 chiều)")}
      style={{ padding: 14, display: "grid", gap: 14, alignContent: "start" }}
    >
      <h3 style={{ margin: 0, fontSize: 14 }}>{t("search.facets.title", "Bộ lọc (8 chiều)")}</h3>

      {/* 1. Taxon cascade: Order -> Family -> Genus -> Species */}
      <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
        <legend style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
          {t("search.facets.taxon", "Phân loại học (Bộ → Họ → Giống → Loài)")}
        </legend>
        <select
          aria-label={t("search.facets.order", "Bộ (Order)")}
          value={state.order}
          onChange={(e) => onChange({ order: e.target.value, family: "", genus: "", species: "" })}
        >
          <option value="">{t("search.facets.order", "Bộ (Order)")}</option>
          {(f.taxon?.orders || []).map((b) => (
            <option key={b.key} value={b.key}>
              {b.key} ({b.count})
            </option>
          ))}
        </select>

        <select
          aria-label={t("search.facets.family", "Họ (Family)")}
          value={state.family}
          onChange={(e) => onChange({ family: e.target.value, genus: "", species: "" })}
        >
          <option value="">{t("search.facets.family", "Họ (Family)")}</option>
          {(f.taxon?.families || []).map((b) => (
            <option key={b.key} value={b.key}>
              {b.key} ({b.count})
            </option>
          ))}
        </select>

        <select
          aria-label={t("search.facets.genus", "Giống (Genus)")}
          value={state.genus}
          onChange={(e) => onChange({ genus: e.target.value, species: "" })}
        >
          <option value="">{t("search.facets.genus", "Giống (Genus)")}</option>
          {(f.taxon?.genera || []).map((b) => (
            <option key={b.key} value={b.key}>
              {b.key} ({b.count})
            </option>
          ))}
        </select>

        <select
          aria-label={t("search.facets.species", "Loài (Species)")}
          value={state.species}
          onChange={(e) => onChange({ species: e.target.value })}
        >
          <option value="">{t("search.facets.species", "Loài (Species)")}</option>
          {(f.taxon?.species || []).map((b) => (
            <option key={b.key} value={b.key}>
              {b.key} ({b.count})
            </option>
          ))}
        </select>
      </fieldset>

      {/* 2. Province */}
      <div>
        <label style={{ fontWeight: 700, fontSize: 12, display: "block", marginBottom: 4 }}>
          {t("search.facets.province", "Tỉnh / Thành phố")}
        </label>
        <select
          aria-label={t("search.facets.province", "Tỉnh / Thành phố")}
          value={state.province}
          onChange={(e) => onChange({ province: e.target.value })}
          style={{ width: "100%" }}
        >
          <option value="">—</option>
          {(f.provinces || []).map((b) => (
            <option key={b.key} value={b.key}>
              {b.key} ({b.count})
            </option>
          ))}
        </select>
      </div>

      {/* 3. Year range */}
      <div>
        <span style={{ fontWeight: 700, fontSize: 12, display: "block", marginBottom: 4 }}>
          {t("search.facets.year", "Năm thu mẫu")}
        </span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <input
            type="number"
            aria-label={t("search.facets.yearFrom", "Từ năm")}
            placeholder={t("search.facets.yearFrom", "Từ năm")}
            value={state.yearFrom}
            onChange={(e) => onChange({ yearFrom: e.target.value })}
          />
          <input
            type="number"
            aria-label={t("search.facets.yearTo", "Đến năm")}
            placeholder={t("search.facets.yearTo", "Đến năm")}
            value={state.yearTo}
            onChange={(e) => onChange({ yearTo: e.target.value })}
          />
        </div>
      </div>

      {/* 4. Media type */}
      <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
        <legend style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
          {t("search.facets.media", "Loại tư liệu (Media)")}
        </legend>
        {[
          { key: "image", label: t("search.facets.mediaImage", "Có ảnh"), count: f.media?.image || 0 },
          { key: "dna", label: t("search.facets.mediaDna", "Có DNA"), count: f.media?.dna || 0 },
          {
            key: "bioactivity",
            label: t("search.facets.mediaBioactivity", "Có hoạt tính sinh học"),
            count: f.media?.bioactivity || 0,
          },
        ].map((m) => (
          <label key={m.key} style={{ display: "flex", gap: 6, fontSize: 12.5, alignItems: "center" }}>
            <input
              type="checkbox"
              aria-label={m.label}
              checked={activeMedia.includes(m.key)}
              onChange={() => toggleMedia(m.key)}
            />
            <span>
              {m.label} ({m.count})
            </span>
          </label>
        ))}
      </fieldset>

      {/* 5. IUCN */}
      <div>
        <label style={{ fontWeight: 700, fontSize: 12, display: "block", marginBottom: 4 }}>
          {t("search.facets.iucn", "Tình trạng IUCN")}
        </label>
        <select
          aria-label={t("search.facets.iucn", "Tình trạng IUCN")}
          value={state.iucnStatus}
          onChange={(e) => onChange({ iucnStatus: e.target.value })}
          style={{ width: "100%" }}
        >
          <option value="">—</option>
          {(f.iucn || []).map((b) => (
            <option key={b.key} value={b.key}>
              {b.key} ({b.count})
            </option>
          ))}
        </select>
      </div>

      {/* 6. Elevation range */}
      <div>
        <span style={{ fontWeight: 700, fontSize: 12, display: "block", marginBottom: 4 }}>
          {t("search.facets.elevation", "Độ cao thu mẫu (m)")}
        </span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <input
            type="number"
            aria-label={t("search.facets.elevationMin", "Từ (m)")}
            placeholder={t("search.facets.elevationMin", "Từ (m)")}
            value={state.elevationMin}
            onChange={(e) => onChange({ elevationMin: e.target.value })}
          />
          <input
            type="number"
            aria-label={t("search.facets.elevationMax", "Đến (m)")}
            placeholder={t("search.facets.elevationMax", "Đến (m)")}
            value={state.elevationMax}
            onChange={(e) => onChange({ elevationMax: e.target.value })}
          />
        </div>
      </div>

      {/* 7. Recorded by */}
      <div>
        <label style={{ fontWeight: 700, fontSize: 12, display: "block", marginBottom: 4 }}>
          {t("search.facets.recordedBy", "Người thu mẫu")}
        </label>
        <select
          aria-label={t("search.facets.recordedBy", "Người thu mẫu")}
          value={state.recordedBy}
          onChange={(e) => onChange({ recordedBy: e.target.value })}
          style={{ width: "100%" }}
        >
          <option value="">—</option>
          {(f.recordedBy || []).map((b) => (
            <option key={b.key} value={b.key}>
              {b.key} ({b.count})
            </option>
          ))}
        </select>
      </div>

      {/* 8. Has GPS */}
      <label style={{ display: "flex", gap: 6, fontSize: 12.5, alignItems: "center", fontWeight: 600 }}>
        <input
          type="checkbox"
          aria-label={t("search.facets.hasGpsOnly", "Chỉ mẫu có GPS")}
          checked={state.hasGps === true}
          onChange={(e) => onChange({ hasGps: e.target.checked ? "true" : "" })}
        />
        <span>{t("search.facets.hasGpsOnly", "Chỉ mẫu có GPS")}</span>
      </label>
    </aside>
  );
}
