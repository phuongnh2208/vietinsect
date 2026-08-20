import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";

const points = [
  { x: 47, y: 17, value: 86, label: "Hà Giang" },
  { x: 50, y: 25, value: 65, label: "Lào Cai" },
  { x: 56, y: 31, value: 91, label: "Hà Nội" },
  { x: 61, y: 39, value: 76, label: "Ninh Bình" },
  { x: 66, y: 48, value: 55, label: "Quảng Bình" },
  { x: 72, y: 58, value: 83, label: "Đà Nẵng" },
  { x: 74, y: 67, value: 68, label: "Đắk Lắk" },
  { x: 70, y: 77, value: 94, label: "Lâm Đồng" },
  { x: 62, y: 87, value: 72, label: "Đồng Nai" },
  { x: 53, y: 93, value: 88, label: "Cà Mau" },
];

function densityColor(value) {
  if (value >= 85) return "#B0241A";
  if (value >= 70) return "#9C7A1F";
  return "#2E7D32";
}

export default function HomeMapHero() {
  const { t } = useTranslation();
  const [mode, setMode] = useState("density");
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const visiblePoints = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    if (!normalized) return points;
    return points.filter((point) => point.label.toLocaleLowerCase("vi").includes(normalized));
  }, [query]);

  return (
    <section className="home-map-section" aria-labelledby="home-map-title">
      <div className="home-map-heading">
        <div><span className="eyebrow"><Icon name="map" size={14} />Dữ liệu theo không gian</span><h2 id="home-map-title">Khám phá đa dạng sinh học Việt Nam</h2><p>Phân bố điểm ghi nhận theo 34 tỉnh/thành đã chuẩn hóa trong hệ thống.</p></div>
        <div className="map-mode-toggle" role="group" aria-label="Chế độ bản đồ"><button className={mode === "points" ? "active" : ""} onClick={() => setMode("points")}>Điểm</button><button className={mode === "density" ? "active" : ""} onClick={() => setMode("density")}>Mật độ</button></div>
      </div>
      <div className="home-map-card">
        <div className="map-search-glass"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tỉnh/thành hoặc loài..." aria-label="Tìm trên bản đồ" />{query && <button className="icon-button" onClick={() => setQuery("")} aria-label="Xóa tìm kiếm"><Icon name="close" size={15} /></button>}</div>
        <div className="map-zoom-control"><button onClick={() => setZoom((value) => Math.min(1.35, Number((value + .1).toFixed(2))))} aria-label="Phóng to"><Icon name="plus" size={17} /></button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.max(.8, Number((value - .1).toFixed(2))))} aria-label="Thu nhỏ"><Icon name="minus" size={17} /></button></div>
        <div className="vietnam-map-stage">
          <div className="vietnam-map-scale" style={{ transform: `scale(${zoom})` }}>
            <svg className="vietnam-silhouette" viewBox="0 0 280 530" role="img" aria-label="Bản đồ silhouette Việt Nam">
              <path d="M91 18c16-8 37 2 44 17 6 14-3 26 12 38 14 11 25 22 23 39-2 16-15 25-11 40 4 14 18 19 22 34 5 20-12 28-7 45 5 16 22 27 22 46 0 17-14 26-19 39-6 17-2 32-9 44-8 15-22 16-31 30-8 12-7 28-18 36-12 9-22 1-31 10-12 12-13 35-25 44-12 9-32 3-40-8-8-12-3-29-13-40-11-12-31-15-34-33-2-16 16-28 14-45-2-18-22-28-22-44 0-18 21-26 20-43-1-16-17-26-18-42-2-18 13-29 12-45-1-16-16-25-16-40 0-16 14-26 17-41 2-12-11-22-5-34 5-12 17-14 26-20Z" />
            </svg>
            <div className="map-point-layer">{visiblePoints.map((point) => <button key={point.label} className={`map-cluster ${mode === "density" ? "is-density" : "is-point"} ${selected === point.label ? "is-selected" : ""}`} style={{ left: `${point.x}%`, top: `${point.y}%`, background: densityColor(point.value), "--cluster-size": `${mode === "density" ? 14 + point.value / 7 : 14}px` }} onClick={() => setSelected(point.label)} aria-label={`${point.label}: ${point.value} điểm ghi nhận`}><span>{mode === "density" ? point.value : ""}</span></button>)}</div>
          </div>
          {selected && <div className="map-tooltip"><button className="icon-button" onClick={() => setSelected(null)} aria-label={t("common.close")}><Icon name="close" size={14} /></button><strong>{selected}</strong><span>Điểm ghi nhận đang hiển thị</span></div>}
        </div>
        <div className="map-legend"><span><i className="legend-dot legend-low" />Ít dữ liệu</span><span><i className="legend-dot legend-mid" />Trung bình</span><span><i className="legend-dot legend-high" />Mật độ cao</span></div>
      </div>
    </section>
  );
}
