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
    <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
      <table className="w-full text-sm text-left" data-testid="view-list">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3">{t("search.columns.catalogNumber", "Mã mẫu")}</th>
            <th className="px-4 py-3">{t("search.columns.scientificName", "Tên khoa học")}</th>
            <th className="px-4 py-3">{t("search.columns.taxon", "Bộ / Họ")}</th>
            <th className="px-4 py-3">{t("search.columns.province", "Tỉnh")}</th>
            <th className="px-4 py-3">{t("search.columns.year", "Năm")}</th>
            <th className="px-4 py-3">{t("search.columns.elevation", "Độ cao (m)")}</th>
            <th className="px-4 py-3">{t("search.columns.iucn", "IUCN")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 font-mono text-xs">
                <Link
                  to={`${detailBase}/${item.id}`}
                  className="text-emerald-700 hover:underline font-medium"
                >
                  {item.catalog_number || item.catalogNumber || item.id}
                </Link>
              </td>
              <td className="px-4 py-2.5 italic font-medium text-slate-900">
                {item.scientific_name || item.scientificName || "—"}
              </td>
              <td className="px-4 py-2.5 text-slate-600">
                {[item.order_name || item.orderName, item.family_name || item.familyName]
                  .filter(Boolean)
                  .join(" / ") || "—"}
              </td>
              <td className="px-4 py-2.5 text-slate-600">
                {item.province_name || item.provinceName || "—"}
              </td>
              <td className="px-4 py-2.5 text-slate-600">
                {item.collection_year || item.collectionYear || "—"}
              </td>
              <td className="px-4 py-2.5 text-slate-600">
                {item.elevation_m != null ? `${item.elevation_m} m` : "—"}
              </td>
              <td className="px-4 py-2.5">
                {item.iucn_status ? (
                  <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800">
                    {item.iucn_status}
                  </span>
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
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      data-testid="view-label"
    >
      {items.map((item) => (
        <article
          key={item.id}
          className="bg-amber-50/40 border-2 border-slate-800 rounded-md p-4 font-serif shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between border-b border-slate-400 pb-1.5 mb-2">
              <span className="text-[11px] uppercase tracking-wider font-sans font-bold text-slate-700">
                VIETINSECT COLLECTION
              </span>
              <Link
                to={`${detailBase}/${item.id}`}
                className="font-mono text-xs font-bold text-emerald-800 hover:underline"
              >
                {item.catalog_number || item.catalogNumber}
              </Link>
            </div>
            <h3 className="text-base italic font-bold text-slate-900">
              {item.scientific_name || item.scientificName}
            </h3>
            <p className="text-xs text-slate-600 font-sans mt-0.5">
              {[item.order_name, item.family_name, item.genus_name].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-3 text-xs text-slate-800 space-y-1 font-sans">
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
            <div className="mt-2 pt-1.5 border-t border-slate-300 text-[11px] font-sans text-amber-900 font-semibold">
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
      <div
        className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm"
        data-testid="view-gallery-empty"
      >
        {t(
          "search.gallery.empty",
          "Không có mẫu công khai kèm ảnh nào trong trang kết quả hiện tại."
        )}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      data-testid="view-gallery"
    >
      {publicImages.map((item) => (
        <Link
          key={item.id}
          to={`${detailBase}/${item.id}`}
          className="group bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition"
        >
          <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden">
            {item.thumbnail_url ? (
              <img
                src={item.thumbnail_url}
                alt={item.scientific_name || item.catalog_number}
                className="w-full h-full object-cover group-hover:scale-105 transition"
                loading="lazy"
              />
            ) : (
              <span className="text-xs text-slate-400 font-mono">
                {item.catalog_number}
              </span>
            )}
          </div>
          <div className="p-3">
            <div className="text-sm italic font-semibold text-slate-900 truncate">
              {item.scientific_name}
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5">
              {item.catalog_number} · {item.province_name || "—"}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function MapView({ items, detailBase }) {
  const { t } = useTranslation();
  const geoItems = items.filter(
    (item) =>
      item.decimal_latitude != null &&
      item.decimal_longitude != null &&
      !Number.isNaN(Number(item.decimal_latitude)) &&
      !Number.isNaN(Number(item.decimal_longitude))
  );

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
      data-testid="view-map"
    >
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
        {t("search.map.showingCount", {
          count: geoItems.length,
          defaultValue: `Hiển thị ${geoItems.length} mẫu có tọa độ GPS trong trang hiện tại`,
        })}
      </div>
      <div className="h-[480px] w-full">
        <MapContainer
          center={[16.0471, 108.2068]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoItems.map((item) => (
            <CircleMarker
              key={item.id}
              center={[Number(item.decimal_latitude), Number(item.decimal_longitude)]}
              radius={6}
              pathOptions={{ color: "#15803d", fillColor: "#22c55e", fillOpacity: 0.7 }}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-bold italic">{item.scientific_name}</div>
                  <div className="font-mono">{item.catalog_number}</div>
                  <div>{item.province_name || item.locality || ""}</div>
                  <Link
                    to={`${detailBase}/${item.id}`}
                    className="text-emerald-700 underline mt-1 inline-block"
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
      <div
        className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm"
        data-testid="view-treemap-empty"
      >
        {t("search.treemap.empty", "Không có dữ liệu phân bố Bộ để hiển thị Treemap.")}
      </div>
    );
  }

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
      data-testid="view-treemap"
    >
      <p className="text-xs text-slate-500 mb-3">
        {t(
          "search.treemap.hint",
          "Nhấp vào một Bộ để lọc nhanh kết quả theo Bộ đó."
        )}
      </p>
      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            nameKey="name"
            stroke="#fff"
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
