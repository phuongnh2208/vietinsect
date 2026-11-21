import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Icon from "../../../components/ui/Icon";
import specimenService from "../../specimen/specimen.service";

const ESRI_STREET_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const ESRI_SATELLITE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function getDensityColor(count) {
  if (count >= 5000) return "#B0241A";
  if (count >= 1500) return "#9C7A1F";
  return "#2E7D32";
}

function getMarkerRadius(count, mode) {
  if (mode === "points") return 7;
  if (count >= 8000) return 16;
  if (count >= 3000) return 13;
  if (count >= 1000) return 10;
  return 7;
}

export default function HomeMapHero({ stats = null }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("density");
  const [basemap, setBasemap] = useState("street");
  const [query, setQuery] = useState("");
  const [fetchedProvinces, setFetchedProvinces] = useState([]);

  useEffect(() => {
    if (stats?.topProvinces) return;
    specimenService
      .getStats()
      .then((res) => {
        if (res?.topProvinces) setFetchedProvinces(res.topProvinces);
      })
      .catch(() => {});
  }, [stats?.topProvinces]);

  const provinces = stats?.topProvinces || fetchedProvinces;

  const visibleProvinces = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    if (!normalized) return provinces;
    return provinces.filter((p) =>
      String(p.province_name_vn || "")
        .toLocaleLowerCase("vi")
        .includes(normalized)
    );
  }, [provinces, query]);

  return (
    <section className="home-map-section" aria-labelledby="home-map-title">
      <div className="home-map-heading">
        <div>
          <span className="eyebrow">
            <Icon name="map" size={14} />
            Dữ liệu theo không gian PostGIS
          </span>
          <h2 id="home-map-title">Khám phá đa dạng sinh học Việt Nam</h2>
          <p>
            Phân bố điểm ghi nhận thực tế theo 34 tỉnh/thành phố chuẩn hóa (Nghị quyết
            202/2025/QH15).
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div className="map-mode-toggle" role="group" aria-label="Chế độ bản đồ">
            <button
              type="button"
              className={mode === "points" ? "active" : ""}
              onClick={() => setMode("points")}
            >
              Điểm
            </button>
            <button
              type="button"
              className={mode === "density" ? "active" : ""}
              onClick={() => setMode("density")}
            >
              Mật độ
            </button>
          </div>
          <div className="map-mode-toggle" role="group" aria-label="Lớp nền bản đồ">
            <button
              type="button"
              className={basemap === "street" ? "active" : ""}
              onClick={() => setBasemap("street")}
            >
              Khoa học
            </button>
            <button
              type="button"
              className={basemap === "satellite" ? "active" : ""}
              onClick={() => setBasemap("satellite")}
            >
              Vệ tinh
            </button>
          </div>
          <button
            type="button"
            className="button button-sm button-primary"
            onClick={() => navigate("/map")}
          >
            Mở Bản đồ GIS đầy đủ →
          </button>
        </div>
      </div>

      <div className="home-map-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: "1px solid #111111",
            background: "#F8FAF9",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#FFFFFF",
              border: "1px solid #111111",
              padding: "6px 12px",
              minWidth: 260,
            }}
          >
            <Icon name="search" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Lọc nhanh tỉnh/thành (VD: Lâm Đồng, Đà Nẵng, Lào Cai)..."
              aria-label="Tìm trên bản đồ"
              style={{
                border: 0,
                outline: 0,
                width: "100%",
                fontSize: 13,
                color: "#111111",
                background: "transparent",
              }}
            />
            {query && (
              <button
                type="button"
                className="icon-button"
                onClick={() => setQuery("")}
                aria-label="Xóa tìm kiếm"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>

          <div className="map-legend" style={{ margin: 0 }}>
            <span>
              <i className="legend-dot legend-low" /> &lt; 1.500 mẫu
            </span>
            <span>
              <i className="legend-dot legend-mid" /> 1.500 – 5.000 mẫu
            </span>
            <span>
              <i className="legend-dot legend-high" /> &gt; 5.000 mẫu (Điểm nóng)
            </span>
          </div>
        </div>

        <div style={{ height: 460, width: "100%" }}>
          <MapContainer
            center={[16.2, 106.5]}
            zoom={6}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              key={basemap}
              attribution="Tiles &copy; Esri"
              url={basemap === "satellite" ? ESRI_SATELLITE_URL : ESRI_STREET_URL}
            />
            {visibleProvinces.map((prov) =>
              prov.lat != null && prov.lon != null ? (
                <CircleMarker
                  key={prov.province_id}
                  center={[prov.lat, prov.lon]}
                  radius={getMarkerRadius(Number(prov.count), mode)}
                  pathOptions={{
                    color: "#111111",
                    weight: 1.5,
                    fillColor: getDensityColor(Number(prov.count)),
                    fillOpacity: 0.85,
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: 12.5, color: "#111111" }}>
                      <strong>{prov.province_name_vn}</strong>
                      <div>
                        Số mẫu vật ghi nhận:{" "}
                        <strong>{Number(prov.count).toLocaleString("vi-VN")}</strong>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <Link to={`/specimens/search?provinceId=${prov.province_id}`}>
                          Tra cứu mẫu vật tại {prov.province_name_vn} →
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ) : null
            )}
          </MapContainer>
        </div>
      </div>
    </section>
  );
}
