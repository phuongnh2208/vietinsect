import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Icon from "../../../components/ui/Icon";
import { useToast } from "../../../components/ui/ToastProvider";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import specimenService from "../../specimen/specimen.service";
import {
  BASIS_OF_RECORD_LABELS,
  formatBasisOfRecord,
  getOrderColor,
  ORDER_COLORS,
  SPATIAL_PRESETS,
} from "../../specimen/specimen.constants";

const VIETNAM_CENTER = [16.2, 106.2];
const VIETNAM_ZOOM = 6;

const BASEMAPS = {
  light: {
    label: "Bản đồ Khoa học",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
  },
  satellite: {
    label: "Ảnh Vệ tinh",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
  },
};

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function heatColor(count, maxCount) {
  const ratio = maxCount > 0 ? Math.log1p(count) / Math.log1p(maxCount) : 0;
  if (ratio >= 0.78) return "#B0241A";
  if (ratio >= 0.52) return "#D97706";
  if (ratio >= 0.28) return "#9C7A1F";
  return "#2E7D32";
}

export default function OccurrenceMapPage() {
  const isAdmin = useIsAdminContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const initialLat = searchParams.get("lat");
  const initialLon = searchParams.get("lon");

  const [viewMode, setViewMode] = useState(initialLat && initialLon ? "radius" : "points"); // points | heatmap | radius
  const [basemap, setBasemap] = useState("light");
  const [qInput, setQInput] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    order: searchParams.get("order") || "",
    provinceId: "",
    basisOfRecord: "",
    dateFrom: "",
    dateTo: "",
    limit: 3000,
  });

  const [radiusPin, setRadiusPin] = useState(() =>
    initialLat && initialLon
      ? { lat: Number(initialLat), lon: Number(initialLon), radiusKm: 30 }
      : { lat: 20.3167, lon: 105.6083, radiusKm: 30 },
  );

  const [lookups, setLookups] = useState({ orders: [], provinces: [] });
  const [mapData, setMapData] = useState({
    totalMatching: 0,
    returnedPoints: 0,
    points: [],
    provinceClusters: [],
    heatGrid: [],
  });
  const [loading, setLoading] = useState(true);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const dataLayerGroupRef = useRef(null);
  const canvasRendererRef = useRef(null);
  const debounceRef = useRef(null);
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  useEffect(() => {
    specimenService.getLookups().then(setLookups).catch(() => {});
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => (prev.q === qInput.trim() ? prev : { ...prev, q: qInput.trim() }));
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [qInput]);

  // Khởi tạo Leaflet Map 1 lần với Canvas Renderer hiệu năng cao
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;

    const canvasRenderer = L.canvas({ padding: 0.5 });
    canvasRendererRef.current = canvasRenderer;

    const startCenter =
      initialLat && initialLon ? [Number(initialLat), Number(initialLon)] : VIETNAM_CENTER;
    const startZoom = initialLat && initialLon ? 9 : VIETNAM_ZOOM;

    const map = L.map(mapContainerRef.current, {
      center: startCenter,
      zoom: startZoom,
      zoomControl: false,
      preferCanvas: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const tile = L.tileLayer(BASEMAPS.light.url, {
      attribution: BASEMAPS.light.attribution,
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);

    // Cho phép click trực tiếp lên bản đồ khi đang ở chế độ Truy vấn bán kính PostGIS
    map.on("click", (e) => {
      if (viewModeRef.current === "radius") {
        setRadiusPin((prev) => ({
          ...prev,
          lat: Number(e.latlng.lat.toFixed(5)),
          lon: Number(e.latlng.lng.toFixed(5)),
        }));
      }
    });

    // Bắt sự kiện click link chi tiết trong Popup
    map.getContainer().addEventListener("click", (evt) => {
      const btn = evt.target.closest("[data-specimen-id]");
      if (btn) {
        const spId = btn.getAttribute("data-specimen-id");
        if (spId) {
          navigate(isAdmin ? `/admin/specimens/${spId}` : `/specimens/${spId}`);
        }
      }
    });

    mapRef.current = map;
    tileLayerRef.current = tile;
    dataLayerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initialLat, initialLon, isAdmin, navigate]);

  // Chuyển lớp nền Bản đồ Khoa học / Vệ tinh
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    const cfg = BASEMAPS[basemap] || BASEMAPS.light;
    tileLayerRef.current.setUrl(cfg.url);
  }, [basemap]);

  // Gọi API lấy tọa độ & mật độ
  const fetchOccurrences = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        lat: viewMode === "radius" ? radiusPin.lat : undefined,
        lon: viewMode === "radius" ? radiusPin.lon : undefined,
        radiusKm: viewMode === "radius" ? radiusPin.radiusKm : undefined,
      };
      const data = await specimenService.getMapOccurrences(params);
      setMapData(data);
    } catch (err) {
      toast(err.response?.data?.message || "Không thể tải dữ liệu bản đồ GIS", "error");
    } finally {
      setLoading(false);
    }
  }, [filters, viewMode, radiusPin, toast]);

  useEffect(() => {
    fetchOccurrences();
  }, [fetchOccurrences]);

  // Vẽ các lớp điểm / lưới nhiệt / vòng tròn bán kính PostGIS lên Leaflet
  useEffect(() => {
    const layerGroup = dataLayerGroupRef.current;
    const renderer = canvasRendererRef.current;
    if (!layerGroup || !mapRef.current) return;

    layerGroup.clearLayers();

    if (viewMode === "radius" && radiusPin.lat != null && radiusPin.lon != null) {
      // Vẽ vòng tròn bán kính PostGIS thực tế (m)
      L.circle([radiusPin.lat, radiusPin.lon], {
        radius: Number(radiusPin.radiusKm) * 1000,
        color: "#0F3820",
        weight: 2,
        dashArray: "6 4",
        fillColor: "#2E7D32",
        fillOpacity: 0.12,
      }).addTo(layerGroup);

      L.circleMarker([radiusPin.lat, radiusPin.lon], {
        renderer,
        radius: 8,
        fillColor: "#B0241A",
        color: "#FFFFFF",
        weight: 2,
        fillOpacity: 1,
      })
        .bindPopup(
          `<strong>Tâm truy vấn PostGIS</strong><br/>Bán kính: ${radiusPin.radiusKm} km<br/>Tìm thấy: ${mapData.totalMatching.toLocaleString()} mẫu vật`,
        )
        .addTo(layerGroup);
    }

    if (viewMode === "heatmap") {
      const maxGrid = mapData.heatGrid.reduce((m, g) => Math.max(m, g.count), 1);
      // 1. Lưới nhiệt không gian 0.25 độ
      mapData.heatGrid.forEach((cell) => {
        const color = heatColor(cell.count, maxGrid);
        const radiusPx = 8 + Math.min(24, Math.sqrt(cell.count) * 0.45);
        L.circleMarker([cell.lat, cell.lon], {
          renderer,
          radius: radiusPx,
          fillColor: color,
          color: color,
          weight: 0,
          fillOpacity: 0.36,
        })
          .bindPopup(
            `<strong>Ô lưới không gian (${cell.lat}°, ${cell.lon}°)</strong><br/>Mật độ: <strong>${cell.count.toLocaleString()}</strong> mẫu vật`,
          )
          .addTo(layerGroup);
      });

      // 2. Tâm cụm Tỉnh / Thành phố
      const maxProv = mapData.provinceClusters.reduce((m, c) => Math.max(m, c.count), 1);
      mapData.provinceClusters.forEach((cluster) => {
        if (cluster.lat == null || cluster.lon == null) return;
        const color = heatColor(cluster.count, maxProv);
        const size = Math.round(28 + (Math.log1p(cluster.count) / Math.log1p(maxProv)) * 24);
        const icon = L.divIcon({
          className: "vi-leaflet-cluster-icon",
          html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid #111111;color:#fff;display:grid;place-items:center;font:800 11px Manrope,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.22);">${
            cluster.count >= 1000 ? `${(cluster.count / 1000).toFixed(1)}k` : cluster.count
          }</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        L.marker([cluster.lat, cluster.lon], { icon })
          .bindPopup(
            `<div style="font-family:Inter,sans-serif;">
              <strong style="font-size:14px;">${escapeHtml(cluster.provinceNameVn)}</strong><br/>
              <span>Tổng ghi nhận: <strong>${cluster.count.toLocaleString()}</strong> mẫu vật</span>
            </div>`,
          )
          .addTo(layerGroup);
      });
    } else {
      // Chế độ Điểm thu mẫu (points) hoặc Bán kính (radius)
      mapData.points.forEach((pt) => {
        const color = getOrderColor(pt.orderName);
        L.circleMarker([pt.lat, pt.lon], {
          renderer,
          radius: 5.5,
          fillColor: color,
          color: "#111111",
          weight: 1,
          opacity: 0.9,
          fillOpacity: 0.85,
        })
          .bindPopup(
            `<div style="min-width:210px;font-family:Inter,sans-serif;line-height:1.5;">
              <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:${color};letter-spacing:0.06em;">
                ${escapeHtml(pt.orderName || "Insecta")} · ${escapeHtml(pt.code)}
              </div>
              <div style="font-style:italic;font-weight:800;font-size:14px;color:#111;margin:2px 0 4px;">
                ${escapeHtml(pt.scientificName)}
              </div>
              <div style="font-size:12px;color:#444;">
                📍 ${escapeHtml(pt.provinceNameVn || "Việt Nam")} (${pt.lat.toFixed(4)}, ${pt.lon.toFixed(4)})<br/>
                📅 Ngày thu: <strong>${escapeHtml(pt.collectionDate || "—")}</strong><br/>
                🔬 Nguồn: ${escapeHtml(formatBasisOfRecord(pt.basisOfRecord))}
              </div>
              <button
                type="button"
                data-specimen-id="${pt.id}"
                style="margin-top:8px;width:100%;padding:6px 10px;background:#111111;color:#ffffff;border:1px solid #111111;font-weight:700;font-size:11px;cursor:pointer;"
              >
                Xem hồ sơ mẫu vật →
              </button>
            </div>`,
          )
          .addTo(layerGroup);
      });
    }
  }, [mapData, viewMode, radiusPin]);

  const handleFlyToProvince = (cluster) => {
    if (!mapRef.current || cluster.lat == null || cluster.lon == null) return;
    mapRef.current.flyTo([cluster.lat, cluster.lon], 9, { duration: 0.9 });
  };

  const handleExportGeoJson = () => {
    if (mapData.points.length === 0) {
      toast("Không có điểm tọa độ để xuất GeoJSON", "warning");
      return;
    }
    const geojson = {
      type: "FeatureCollection",
      features: mapData.points.map((pt) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [pt.lon, pt.lat] },
        properties: {
          id: pt.id,
          code: pt.code,
          scientificName: pt.scientificName,
          order: pt.orderName,
          province: pt.provinceNameVn,
          collectionDate: pt.collectionDate,
          basisOfRecord: pt.basisOfRecord,
        },
      })),
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vietinsect-occurrences.geojson";
    link.click();
    URL.revokeObjectURL(url);
    toast(`Đã xuất ${mapData.points.length} điểm ra chuẩn GeoJSON`, "success");
  };

  const legendOrders = useMemo(
    () => ["Lepidoptera", "Coleoptera", "Hymenoptera", "Diptera", "Odonata"],
    [],
  );

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name="map" size={14} />
            SCR-18 · Hệ thống Thông tin Địa lý (PostGIS)
          </div>
          <h1>Bản đồ phân bố sinh thái côn trùng</h1>
          <p className="page-description">
            Trực quan hóa <strong>{mapData.totalMatching.toLocaleString()}</strong> điểm ghi nhận thực địa tại Việt Nam:
            chế độ điểm phân loại, lưới mật độ không gian và truy vấn bán kính PostGIS trực tiếp trên bản đồ.
          </p>
        </div>

        <div className="hero-actions" style={{ marginTop: 0 }}>
          <div className="vi-segmented-group" role="group" aria-label="Chế độ bản đồ">
            <button
              type="button"
              className={viewMode === "points" ? "active" : ""}
              onClick={() => setViewMode("points")}
            >
              Điểm thu mẫu
            </button>
            <button
              type="button"
              className={viewMode === "heatmap" ? "active" : ""}
              onClick={() => setViewMode("heatmap")}
            >
              Mật độ & Cụm tỉnh
            </button>
            <button
              type="button"
              className={viewMode === "radius" ? "active" : ""}
              onClick={() => setViewMode("radius")}
            >
              Bán kính PostGIS
            </button>
          </div>

          <button type="button" className="button button-ghost" onClick={handleExportGeoJson}>
            <Icon name="file" size={16} />
            Xuất GeoJSON
          </button>
        </div>
      </div>

      {/* Bố cục GIS Workbench: Sidebar lọc bên trái + Bản đồ tương tác bên phải */}
      <div className="vi-gis-workbench">
        <aside className="card panel vi-gis-sidebar">
          <div className="panel-title" style={{ marginBottom: 14 }}>
            <h2>Bộ lọc không gian</h2>
            <span>{loading ? "Đang tải..." : `${mapData.totalMatching.toLocaleString()} mẫu`}</span>
          </div>

          <div className="form-field" style={{ marginBottom: 12 }}>
            <label>Tìm loài / Địa danh</label>
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="VD: Papilio, Apis, Cúc Phương..."
            />
          </div>

          <div className="form-field" style={{ marginBottom: 12 }}>
            <label>Bộ côn trùng (Order)</label>
            <select
              value={filters.order}
              onChange={(e) => setFilters((p) => ({ ...p, order: e.target.value }))}
            >
              <option value="">Tất cả các Bộ</option>
              {lookups.orders.map((o) => (
                <option key={o.id} value={o.scientificName}>
                  {o.scientificName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ marginBottom: 12 }}>
            <label>Tỉnh / Thành phố</label>
            <select
              value={filters.provinceId}
              onChange={(e) => setFilters((p) => ({ ...p, provinceId: e.target.value }))}
            >
              <option value="">Toàn quốc (34 tỉnh/thành)</option>
              {lookups.provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameVn}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ marginBottom: 12 }}>
            <label>Nguồn dữ liệu (DwC)</label>
            <select
              value={filters.basisOfRecord}
              onChange={(e) => setFilters((p) => ({ ...p, basisOfRecord: e.target.value }))}
            >
              <option value="">Tất cả nguồn</option>
              {Object.entries(BASIS_OF_RECORD_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="vi-form-grid-2" style={{ marginBottom: 12 }}>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label>Từ ngày</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              />
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label>Đến ngày</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
              />
            </div>
          </div>

          {viewMode !== "heatmap" ? (
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label>Số điểm hiển thị tối đa (Canvas)</label>
              <select
                value={filters.limit}
                onChange={(e) => setFilters((p) => ({ ...p, limit: Number(e.target.value) }))}
              >
                <option value={1500}>1,500 điểm gần nhất</option>
                <option value={3000}>3,000 điểm (Khuyên dùng)</option>
                <option value={6000}>6,000 điểm (Mật độ cao)</option>
              </select>
            </div>
          ) : null}

          {viewMode === "radius" ? (
            <div className="vi-spatial-box" style={{ marginTop: 8, marginBottom: 12 }}>
              <strong style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
                Nhấp lên bản đồ để dời tâm bán kính:
              </strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {SPATIAL_PRESETS.map((pr) => (
                  <button
                    key={pr.label}
                    type="button"
                    className="button button-sm button-ghost"
                    style={{ fontSize: 11, minHeight: 26, padding: "0 8px" }}
                    onClick={() => {
                      setRadiusPin({ lat: pr.lat, lon: pr.lon, radiusKm: pr.radiusKm });
                      if (mapRef.current) mapRef.current.flyTo([pr.lat, pr.lon], 9);
                    }}
                  >
                    {pr.label}
                  </button>
                ))}
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label>Bán kính: {radiusPin.radiusKm} km</label>
                <input
                  type="range"
                  min="5"
                  max="150"
                  step="5"
                  value={radiusPin.radiusKm}
                  onChange={(e) =>
                    setRadiusPin((prev) => ({ ...prev, radiusKm: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="button button-sm button-ghost"
            style={{ width: "100%", marginBottom: 16 }}
            onClick={() => {
              setQInput("");
              setFilters({
                q: "",
                order: "",
                provinceId: "",
                basisOfRecord: "",
                dateFrom: "",
                dateTo: "",
                limit: 3000,
              });
              if (mapRef.current) mapRef.current.flyTo(VIETNAM_CENTER, VIETNAM_ZOOM);
            }}
          >
            Đặt lại toàn cảnh Việt Nam
          </button>

          {/* Top khu vực mật độ cao */}
          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 12 }}>
            <strong style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Vùng tập trung mẫu vật (nhấp để phóng tới)
            </strong>
            <div className="vi-province-rank-list">
              {mapData.provinceClusters.slice(0, 7).map((c) => (
                <button
                  key={c.provinceNameVn}
                  type="button"
                  className="vi-province-rank-item"
                  onClick={() => handleFlyToProvince(c)}
                >
                  <span>{c.provinceNameVn}</span>
                  <strong>{c.count.toLocaleString()}</strong>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Vùng bản đồ chính */}
        <section className="card vi-gis-stage">
          {/* Nút đổi lớp bản đồ nền */}
          <div className="vi-map-overlay-top">
            <div className="vi-segmented-group">
              <button
                type="button"
                className={basemap === "light" ? "active" : ""}
                onClick={() => setBasemap("light")}
              >
                Nền Khoa học
              </button>
              <button
                type="button"
                className={basemap === "satellite" ? "active" : ""}
                onClick={() => setBasemap("satellite")}
              >
                Vệ tinh
              </button>
            </div>

            <div className="vi-map-counter-chip">
              {loading
                ? "Đang đồng bộ PostGIS..."
                : viewMode === "heatmap"
                  ? `Đang tổng hợp 100% (${mapData.totalMatching.toLocaleString()} mẫu vật)`
                  : `Hiển thị ${mapData.returnedPoints.toLocaleString()} / ${mapData.totalMatching.toLocaleString()} mẫu vật`}
            </div>
          </div>

          <div ref={mapContainerRef} className="vi-leaflet-canvas" />

          {/* Chú giải màu phân loại (Legend) */}
          <div className="vi-map-legend-bar">
            {viewMode === "heatmap" ? (
              <>
                <strong>Thang mật độ sinh học:</strong>
                <span>
                  <i style={{ background: "#2E7D32" }} /> Thấp (&lt;100)
                </span>
                <span>
                  <i style={{ background: "#9C7A1F" }} /> Trung bình
                </span>
                <span>
                  <i style={{ background: "#D97706" }} /> Cao
                </span>
                <span>
                  <i style={{ background: "#B0241A" }} /> Điểm nóng (&gt;2,000)
                </span>
              </>
            ) : (
              <>
                <strong>Chú giải Bộ (Order):</strong>
                {legendOrders.map((ord) => (
                  <span key={ord}>
                    <i style={{ background: ORDER_COLORS[ord] }} /> {ord}
                  </span>
                ))}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
