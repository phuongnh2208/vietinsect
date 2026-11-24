import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";

const TREEMAP_COLORS = [
  "#15803d",
  "#0f766e",
  "#1d4ed8",
  "#7c3aed",
  "#b45309",
  "#be123c",
  "#0369a1",
  "#4d7c0f",
];

function ListView({ items, detailBase }) {
  const { t } = useTranslation();
  return (
    <div className="srv-card srv-table-wrap">
      <table className="srv-table" data-testid="view-list">
        <thead>
          <tr>
            <th>{t("search.columns.catalogNumber", "Mã mẫu")}</th>
            <th>{t("search.columns.scientificName", "Tên khoa học")}</th>
            <th>{t("search.columns.taxon", "Bộ / Họ")}</th>
            <th>{t("search.columns.province", "Tỉnh")}</th>
            <th>{t("search.columns.year", "Năm")}</th>
            <th>{t("search.columns.elevation", "Độ cao (m)")}</th>
            <th>{t("search.columns.iucn", "IUCN")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <Link to={`${detailBase}/${item.id}`} className="srv-code-link">
                  {item.catalog_number || item.catalogNumber || item.id}
                </Link>
              </td>
              <td style={{ fontStyle: "italic", fontWeight: 600, color: "#111111" }}>
                {item.scientific_name || item.scientificName || "—"}
              </td>
              <td style={{ color: "#444444" }}>
                {[item.order_name || item.orderName, item.family_name || item.familyName]
                  .filter(Boolean)
                  .join(" / ") || "—"}
              </td>
              <td style={{ color: "#444444" }}>
                {item.province_name || item.provinceName || "—"}
              </td>
              <td style={{ color: "#444444" }}>
                {item.collection_year || item.collectionYear || "—"}
              </td>
              <td style={{ color: "#444444" }}>
                {item.elevation_m != null ? `${item.elevation_m} m` : "—"}
              </td>
              <td>
                {item.iucn_status ? (
                  <span className="srv-iucn-badge">{item.iucn_status}</span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LabelView({ items, detailBase }) {
  return (
    <div className="srv-label-grid" data-testid="view-label">
      {items.map((item) => (
        <article key={item.id} className="srv-label-card">
          <div>
            <div className="srv-label-head">
              <span>VIETINSECT COLLECTION</span>
              <Link to={`${detailBase}/${item.id}`} className="srv-code-link">
                {item.catalog_number || item.catalogNumber}
              </Link>
            </div>
            <h3 style={{ margin: 0, fontSize: 15, fontStyle: "italic", fontWeight: 700 }}>
              {item.scientific_name || item.scientificName}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555555" }}>
              {[item.order_name, item.family_name, item.genus_name].filter(Boolean).join(" · ")}
            </p>
            <div style={{ marginTop: 10, fontSize: 12, color: "#222222", display: "grid", gap: 4 }}>
              <div>
                <strong>Loc.:</strong> {item.locality || item.province_name || "—"}
                {item.elevation_m != null ? `, ${item.elevation_m} m` : ""}
              </div>
              {item.decimal_latitude != null && item.decimal_longitude != null && (
                <div>
                  <strong>GPS:</strong> {Number(item.decimal_latitude).toFixed(4)},{" "}
                  {Number(item.decimal_longitude).toFixed(4)}
                </div>
              )}
              <div>
                <strong>Leg.:</strong> {item.recorded_by || "—"} ·{" "}
                {item.collection_year || item.event_date || "—"}
              </div>
            </div>
          </div>
          {item.iucn_status && (
            <div
              style={{
                paddingTop: 6,
                borderTop: "1px solid #cbd5e1",
                fontSize: 11,
                fontWeight: 700,
                color: "#92400e",
              }}
            >
              IUCN: {item.iucn_status}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function GalleryView({ items, detailBase }) {
  const { t } = useTranslation();
  const publicImages = items.filter((item) => item.has_image && item.is_public);

  if (publicImages.length === 0) {
    return (
      <div className="adv-search-empty" data-testid="view-gallery-empty">
        {t(
          "search.gallery.empty",
          "Không có mẫu công khai kèm ảnh nào trong trang kết quả hiện tại."
        )}
      </div>
    );
  }

  return (
    <div className="srv-gallery-grid" data-testid="view-gallery">
      {publicImages.map((item) => (
        <Link key={item.id} to={`${detailBase}/${item.id}`} className="srv-gallery-card">
          <div className="srv-gallery-thumb">
            {item.thumbnail_url ? (
              <img
                src={item.thumbnail_url}
                alt={item.scientific_name || item.catalog_number}
                loading="lazy"
              />
            ) : (
              <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
                {item.catalog_number}
              </span>
            )}
          </div>
          <div className="srv-gallery-body">
            <div
              style={{
                fontSize: 13.5,
                fontStyle: "italic",
                fontWeight: 700,
                color: "#111111",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.scientific_name}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#555555",
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.catalog_number} · {item.province_name || "—"}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function getItemCoords(item) {
  const lat = item?.decimal_latitude ?? item?.latitude ?? item?.location?.lat;
  const lon = item?.decimal_longitude ?? item?.longitude ?? item?.location?.lon;
  if (lat == null || lon == null) return null;
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (Number.isNaN(latNum) || Number.isNaN(lonNum)) return null;
  return { lat: latNum, lon: lonNum };
}

function MapView({ items, detailBase }) {
  const { t } = useTranslation();
  const geoItems = items
    .map((item) => ({ item, coords: getItemCoords(item) }))
    .filter((entry) => entry.coords !== null);

  return (
    <div className="srv-card" data-testid="view-map">
      <div className="srv-map-bar">
        {t("search.map.showingCount", {
          count: geoItems.length,
          defaultValue: `Hiển thị ${geoItems.length} mẫu có tọa độ GPS trong trang hiện tại`,
        })}
      </div>
      <div style={{ height: 480, width: "100%" }}>
        <MapContainer
          center={[15.8, 109.5]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; Google Maps"
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=vi&gl=VN"
          />
          {geoItems.map(({ item, coords }) => (
            <CircleMarker
              key={item.id || item.specimen_id}
              center={[coords.lat, coords.lon]}
              radius={6}
              pathOptions={{ color: "#15803d", fillColor: "#22c55e", fillOpacity: 0.7 }}
            >
              <Popup>
                <div style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 700, fontStyle: "italic" }}>
                    {item.scientific_name || item.scientificName}
                  </div>
                  <div style={{ fontFamily: "monospace" }}>
                    {item.catalog_number || item.specimen_code || item.catalogNumber}
                  </div>
                  <div>{item.province_name || item.province_name_vn || item.locality || ""}</div>
                  <Link
                    to={`${detailBase}/${item.id || item.specimen_id}`}
                    style={{ color: "#0f3820", textDecoration: "underline", marginTop: 4, display: "inline-block" }}
                  >
                    {t("search.map.viewDetail", "Xem chi tiết")}
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

function TreemapCell(props) {
  const { x, y, width, height, index, name, size, onSelectOrder } = props;
  if (width < 4 || height < 4) return null;
  const fill = TREEMAP_COLORS[index % TREEMAP_COLORS.length];
  return (
    <g
      onClick={() => name && onSelectOrder && onSelectOrder(name)}
      style={{ cursor: "pointer" }}
      role="button"
      tabIndex={0}
      aria-label={`${name}: ${size}`}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && name && onSelectOrder) {
          e.preventDefault();
          onSelectOrder(name);
        }
      }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill, stroke: "#ffffff", strokeWidth: 2 }}
      />
      {width > 60 && height > 28 && (
        <text x={x + 8} y={y + 20} fill="#ffffff" fontSize={12} fontWeight={600}>
          {name} ({size})
        </text>
      )}
    </g>
  );
}

function TreemapView({ facets, onSelectOrder }) {
  const { t } = useTranslation();
  const orderBuckets = facets?.taxon?.orders || facets?.orders || [];
  const data = orderBuckets.map((b) => ({
    name: b.key,
    size: b.count,
  }));

  if (data.length === 0) {
    return (
      <div className="adv-search-empty" data-testid="view-treemap-empty">
        {t("search.treemap.empty", "Không có dữ liệu phân bố Bộ để hiển thị Treemap.")}
      </div>
    );
  }

  return (
    <div className="srv-treemap-wrap" data-testid="view-treemap">
      <p className="srv-treemap-hint">
        {t(
          "search.treemap.hint",
          "Nhấp vào một Bộ để lọc nhanh kết quả theo Bộ đó."
        )}
      </p>
      <div style={{ height: 420, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            nameKey="name"
            stroke="#fff"
            isAnimationActive={false}
            content={<TreemapCell onSelectOrder={onSelectOrder} />}
          >
            <Tooltip />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function SearchResultViews({
  view,
  items,
  facets,
  detailBase = "/specimens",
  onSelectOrder,
}) {
  if (view === "treemap") {
    return <TreemapView facets={facets} onSelectOrder={onSelectOrder} />;
  }
  if (view === "map") {
    return <MapView items={items} detailBase={detailBase} />;
  }
  if (view === "gallery") {
    return <GalleryView items={items} detailBase={detailBase} />;
  }
  if (view === "label") {
    return <LabelView items={items} detailBase={detailBase} />;
  }
  return <ListView items={items} detailBase={detailBase} />;
}
