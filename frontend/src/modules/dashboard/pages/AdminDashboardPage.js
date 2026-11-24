import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  Treemap,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
} from "recharts";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import specimenService from "../../specimen/specimen.service";
import { getOrderColor } from "../../specimen/specimen.constants";
import { formatNumber, getIntlLocale } from "../../../utils/formatters";

const ESRI_STREET_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

// F-DB-03: Gradient màu từ xanh lá nhạt đến xanh rừng đậm theo mật độ mẫu vật tỉnh/thành
function getProvinceGradientColor(count) {
  if (count >= 5000) return "#0F3820";
  if (count >= 1500) return "#1F4E2D";
  if (count >= 400) return "#2E7D32";
  return "#66BB6A";
}

function getProvinceRadius(count) {
  if (count >= 8000) return 15;
  if (count >= 3000) return 12;
  if (count >= 1000) return 9;
  if (count >= 200) return 7;
  return 5;
}

// Custom Cell Renderer cho Recharts Treemap 2D tương tác (F-DB-02)
function OrderTreemapCell(props) {
  const { x, y, width, height, name, count, pct, onSelectOrder } = props;
  if (!width || !height || width < 18 || height < 18) return null;
  const fill = getOrderColor(name);

  return (
    <g
      onClick={() => onSelectOrder && name && onSelectOrder(name)}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill,
          stroke: "#FFFFFF",
          strokeWidth: 2,
        }}
      />
      {width > 68 && height > 34 && (
        <>
          <text
            x={x + 8}
            y={y + 18}
            fill="#FFFFFF"
            fontSize={width > 120 ? 13 : 11}
            fontWeight={800}
            fontFamily="Manrope, Inter, sans-serif"
          >
            {name}
          </text>
          <text
            x={x + 8}
            y={y + 34}
            fill="rgba(255,255,255,0.88)"
            fontSize={11}
            fontFamily="JetBrains Mono, Consolas, monospace"
          >
            {Number(count || 0).toLocaleString("vi-VN")} ({pct}%)
          </text>
        </>
      )}
    </g>
  );
}

export default function AdminDashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState("treemap"); // treemap | bar
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadStats = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await specimenService.getStats();
      setStats(data);
      setLastUpdated(new Date());
    } catch {
      // preserve previous stats on polling failure
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // SRS §4.2 F-DB-01: Tự động cập nhật số liệu realtime (polling 30 giây)
  useEffect(() => {
    loadStats(false);
    const timer = setInterval(() => {
      loadStats(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [loadStats]);

  const totalSpecimens = stats?.totalSpecimens || 0;
  const publicSpecimens = stats?.publicSpecimens || 0;
  const withCoordinates = stats?.withCoordinates || 0;
  const withProvince = stats?.withProvince || 0;
  const speciesCount = stats?.taxa?.species || stats?.distinctBinomialSpecies || 0;
  const specimensAtSpeciesRank = stats?.specimensAtSpeciesRank || 0;

  // Chuẩn bị dữ liệu cho Recharts Treemap & BarChart (F-DB-02)
  const orderChartData = useMemo(() => {
    const raw = stats?.byOrder || [];
    const total = raw.reduce((acc, r) => acc + Number(r.count || 0), 0) || 1;
    return raw.map((r) => ({
      name: r.order_name || "Khác",
      size: Number(r.count || 0),
      count: Number(r.count || 0),
      pct: ((Number(r.count || 0) / total) * 100).toFixed(1),
    }));
  }, [stats?.byOrder]);

  // 4 chỉ số tổng quan bắt buộc theo SRS §4.2 F-DB-01
  const metrics = [
    {
      key: "specimen",
      label: t("dashboard.specimen"),
      value: formatNumber(totalSpecimens, i18n.language),
      foot: `${formatNumber(publicSpecimens, i18n.language)} ${t("common.public")} · ${formatNumber(
        Math.max(0, totalSpecimens - publicSpecimens),
        i18n.language
      )} ${t("common.private")}`,
      icon: "bug",
      onClick: () => navigate("/admin/specimens"),
    },
    {
      key: "species",
      label: t("dashboard.species"),
      value: formatNumber(speciesCount, i18n.language),
      foot: `${formatNumber(stats?.taxa?.families || 0, i18n.language)} ${t("specimen.family")} · ${formatNumber(
        stats?.taxa?.genera || 0,
        i18n.language
      )} ${t("specimen.genus")}`,
      icon: "leaf",
      onClick: () => navigate("/admin/taxonomy"),
    },
    {
      key: "media",
      label: t("dashboard.media"),
      value: formatNumber(stats?.imageCount ?? 0, i18n.language),
      foot: `${stats?.provincesCovered ?? 0} / ${stats?.totalProvinces ?? 0} ${t("specimen.province")}`,
      icon: "image",
      onClick: () => navigate("/admin/media"),
    },
    {
      key: "dna",
      label: t("dashboard.dna"),
      value: formatNumber(stats?.dnaCount || 0, i18n.language),
      foot: "COI Barcode · NCBI & BOLD",
      icon: "dna",
      onClick: () => navigate("/admin/dna"),
    },
  ];

  const pctGps = totalSpecimens > 0 ? ((withCoordinates / totalSpecimens) * 100).toFixed(1) : "0.0";
  const pctProv = totalSpecimens > 0 ? ((withProvince / totalSpecimens) * 100).toFixed(1) : "0.0";
  const pctPublic =
    totalSpecimens > 0 ? ((publicSpecimens / totalSpecimens) * 100).toFixed(1) : "0.0";
  const pctSpecies =
    totalSpecimens > 0 ? ((specimensAtSpeciesRank / totalSpecimens) * 100).toFixed(1) : "0.0";

  const dq = stats?.dataQuality || {
    outOfVnBounds: 0,
    missingProvince: 0,
    futureDates: 0,
    orphanedDna: 0,
    higherRankOnly: 0,
  };

  if (loading && !stats) {
    return (
      <div className="page-container page-content vi-page-enter">
        <div className="card panel" style={{ padding: "48px 24px" }}>
          <LoadingState label="Đang tải số liệu tổng quan hệ thống từ PostgreSQL / PostGIS..." />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-content vi-page-enter">
      {/* 1. Page Header */}
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name="dashboard" size={14} />
            {t("dashboard.eyebrow", "Hệ thống Quản trị Dữ liệu Đa dạng Sinh học")}
          </div>
          <h1>{t("dashboard.title", "Tổng quan Hệ thống VietInsect")}</h1>
          <p className="page-description">
            {t(
              "dashboard.description",
              "Giám sát thời gian thực kho mẫu vật Darwin Core, cây danh pháp, phân bố địa lý PostGIS và chất lượng dữ liệu."
            )}
            {lastUpdated && (
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: "#2E7D32" }}>
                · {lastUpdated.toLocaleTimeString(getIntlLocale(i18n.language))}
              </span>
            )}
          </p>
        </div>
        <div className="hero-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => loadStats(false)}
            title={t("common.refresh")}
          >
            <Icon name="refresh" size={16} />
            {t("common.refresh")}
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => navigate("/admin/map")}
          >
            <Icon name="map" size={16} />
            {t("navigation.gisMap")}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => navigate("/admin/specimens")}
          >
            <Icon name="database" size={16} />
            {t("specimen.title")}
          </button>
        </div>
      </div>

      {/* 2. 4 Realtime KPI Cards (SRS §4.2 F-DB-01) */}
      <div className="metric-grid">
        {metrics.map((metric) => (
          <article
            key={metric.key}
            className="card metric-card vi-hover-lift"
            onClick={metric.onClick}
            style={{ cursor: "pointer" }}
          >
            <div className="metric-head">
              <span>{metric.label}</span>
              <span className="metric-icon">
                <Icon name={metric.icon} size={18} />
              </span>
            </div>
            <div className="metric-value">{metric.value}</div>
            <div className="metric-foot">
              <Icon name="arrow-up-right" size={13} />
              {metric.foot}
            </div>
          </article>
        ))}
      </div>

      {/* 3. Main Dashboard Grid: Recharts Treemap (F-DB-02) + Leaflet Minimap (F-DB-03) */}
      <div className="dashboard-grid" style={{ alignItems: "stretch" }}>
        {/* F-DB-02: Biểu đồ Treemap 2D tương tác phân loại theo Bộ côn trùng */}
        <section className="card panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="panel-title">
            <div>
              <h2>Phân bố mẫu vật theo Bộ côn trùng</h2>
              <span style={{ fontSize: 12, color: "#555555" }}>
                Nhấp vào từng ô để lọc danh sách mẫu vật theo Bộ ({orderChartData.length} Bộ)
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className={`button button-sm ${
                  chartMode === "treemap" ? "button-primary" : "button-ghost"
                }`}
                onClick={() => setChartMode("treemap")}
              >
                Treemap 2D
              </button>
              <button
                type="button"
                className={`button button-sm ${
                  chartMode === "bar" ? "button-primary" : "button-ghost"
                }`}
                onClick={() => setChartMode("bar")}
              >
                Biểu đồ Cột
              </button>
            </div>
          </div>

          <div style={{ width: "100%", height: 310, marginTop: 8 }}>
            {orderChartData.length > 0 ? (
              chartMode === "treemap" ? (
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={orderChartData}
                    dataKey="size"
                    nameKey="name"
                    isAnimationActive={false}
                    content={
                      <OrderTreemapCell
                        onSelectOrder={(orderName) =>
                          navigate(`/admin/specimens?order=${encodeURIComponent(orderName)}`)
                        }
                      />
                    }
                  >
                    <RechartsTooltip
                      formatter={(val, _name, item) => [
                        `${Number(val).toLocaleString("vi-VN")} mẫu (${item?.payload?.pct || 0}%)`,
                        "Số lượng mẫu vật",
                      ]}
                    />
                  </Treemap>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={orderChartData.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#111111" }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={96}
                      tick={{ fontSize: 11, fontWeight: 700, fill: "#111111" }}
                    />
                    <RechartsTooltip
                      formatter={(val) => [
                        `${Number(val).toLocaleString("vi-VN")} mẫu vật`,
                        "Số lượng",
                      ]}
                    />
                    <Bar
                      dataKey="count"
                      onClick={(entry) =>
                        entry?.name &&
                        navigate(`/admin/specimens?order=${encodeURIComponent(entry.name)}`)
                      }
                      style={{ cursor: "pointer" }}
                    >
                      {orderChartData.slice(0, 8).map((entry) => (
                        <Cell key={entry.name} fill={getOrderColor(entry.name)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              <LoadingState label="Đang dựng biểu đồ phân loại..." />
            )}
          </div>
        </section>

        {/* F-DB-03: Bản đồ Mini Phân bố Leaflet theo 34 Tỉnh/Thành */}
        <section className="card panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="panel-title">
            <div>
              <h2>Bản đồ mini phân bố (34 Tỉnh/Thành)</h2>
              <span style={{ fontSize: 12, color: "#555555" }}>
                Mật độ mẫu vật theo tọa độ PostGIS (WGS84)
              </span>
            </div>
            <button
              type="button"
              className="button button-sm button-ghost"
              onClick={() => navigate("/admin/map")}
            >
              <Icon name="map" size={14} />
              Mở Bản đồ đầy đủ →
            </button>
          </div>

          <div
            style={{
              width: "100%",
              height: 275,
              marginTop: 8,
              border: "1px solid #D1D5DB",
              position: "relative",
            }}
          >
            <MapContainer
              center={[16.2, 106.5]}
              zoom={5}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={false}
            >
              <TileLayer attribution="Tiles &copy; Esri" url={ESRI_STREET_URL} />
              {(stats?.topProvinces || []).map((prov) =>
                prov.lat != null && prov.lon != null ? (
                  <CircleMarker
                    key={prov.province_id}
                    center={[prov.lat, prov.lon]}
                    radius={getProvinceRadius(Number(prov.count))}
                    pathOptions={{
                      color: "#111111",
                      weight: 1.2,
                      fillColor: getProvinceGradientColor(Number(prov.count)),
                      fillOpacity: 0.88,
                    }}
                  >
                    <Popup>
                      <div style={{ fontSize: 12, color: "#111111" }}>
                        <strong>{prov.province_name_vn}</strong>
                        <div>
                          Số mẫu vật: <strong>{Number(prov.count).toLocaleString("vi-VN")}</strong>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <Link to={`/admin/specimens?provinceId=${prov.province_id}`}>
                            Xem mẫu vật tại tỉnh này →
                          </Link>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ) : null
              )}
            </MapContainer>
          </div>

          {/* Chú giải Gradient màu theo SRS F-DB-03 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 10,
              fontSize: 11,
              color: "#555555",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <i
                  style={{
                    width: 10,
                    height: 10,
                    background: "#66BB6A",
                    display: "inline-block",
                    border: "1px solid #D1D5DB",
                  }}
                />{" "}
                &lt; 400 mẫu
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <i
                  style={{
                    width: 10,
                    height: 10,
                    background: "#2E7D32",
                    display: "inline-block",
                    border: "1px solid #D1D5DB",
                  }}
                />{" "}
                400 – 1.500
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <i
                  style={{
                    width: 10,
                    height: 10,
                    background: "#1F4E2D",
                    display: "inline-block",
                    border: "1px solid #D1D5DB",
                  }}
                />{" "}
                1.500 – 5.000
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <i
                  style={{
                    width: 10,
                    height: 10,
                    background: "#0F3820",
                    display: "inline-block",
                    border: "1px solid #D1D5DB",
                  }}
                />{" "}
                &gt; 5.000 mẫu
              </span>
            </div>
            <strong>Top 1: {stats?.topProvinces?.[0]?.province_name_vn || "Lâm Đồng"}</strong>
          </div>
        </section>

        {/* Tiến độ Số hóa & Độ phủ Chuẩn hóa Dữ liệu */}
        <section className="card panel">
          <div className="panel-title">
            <h2>{t("dashboard.digitization", "Tiến độ Số hóa & Chuẩn hóa")}</h2>
            <span>Chỉ số thực tế CSDL</span>
          </div>

          <div style={{ display: "grid", gap: 14, marginTop: 8 }}>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 5,
                }}
              >
                <span>Độ phủ tọa độ không gian PostGIS (WGS84)</span>
                <strong>
                  {pctGps}% ({withCoordinates.toLocaleString("vi-VN")} mẫu)
                </strong>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${Math.min(100, pctGps)}%` }} />
              </div>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 5,
                }}
              >
                <span>Chuẩn hóa địa giới 34 Tỉnh/Thành (NQ 202/2025/QH15)</span>
                <strong>
                  {pctProv}% ({withProvince.toLocaleString("vi-VN")} mẫu)
                </strong>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${Math.min(100, pctProv)}%` }} />
              </div>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 5,
                }}
              >
                <span>Tỷ lệ dữ liệu mở Công khai (Public Open Data)</span>
                <strong>
                  {pctPublic}% ({publicSpecimens.toLocaleString("vi-VN")} mẫu)
                </strong>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${Math.min(100, pctPublic)}%` }} />
              </div>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 5,
                }}
              >
                <span>Định danh chi tiết xuống bậc Loài nhị danh (Species)</span>
                <strong>
                  {pctSpecies}% ({specimensAtSpeciesRank.toLocaleString("vi-VN")} mẫu)
                </strong>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${Math.min(100, pctSpecies)}%` }} />
              </div>
            </div>
          </div>
        </section>

        {/* F-AI-04: Cảnh báo Chất lượng Dữ liệu Bất thường Tự động */}
        <section className="card panel">
          <div className="panel-title">
            <h2>{t("dashboard.alerts", "Kiểm toán & Cảnh báo Chất lượng Dữ liệu")}</h2>
            <span>Quét tự động (F-AI-04)</span>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            <div
              className="placeholder-row"
              style={{ cursor: "pointer", padding: "10px 12px" }}
              onClick={() => navigate("/admin/map")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon
                  name={dq.outOfVnBounds > 0 ? "alert" : "check"}
                  size={18}
                  style={{ color: dq.outOfVnBounds > 0 ? "#B0241A" : "#2E7D32", flexShrink: 0 }}
                />
                <div>
                  <strong>Tọa độ GPS ngoài biên giới Việt Nam (8.18°–23.39°N)</strong>
                  <span style={{ display: "block", fontSize: 12, color: "#555555" }}>
                    {dq.outOfVnBounds > 0
                      ? `Phát hiện ${dq.outOfVnBounds.toLocaleString("vi-VN")} điểm tọa độ ở vùng biên / đảo xa cần rà soát`
                      : "100% tọa độ nằm trong khung lãnh thổ Việt Nam"}
                  </span>
                </div>
              </div>
              <span
                className={`status-badge ${
                  dq.outOfVnBounds > 0 ? "status-warning" : "status-public"
                }`}
              >
                {dq.outOfVnBounds.toLocaleString("vi-VN")} mẫu
              </span>
            </div>

            <div
              className="placeholder-row"
              style={{ cursor: "pointer", padding: "10px 12px" }}
              onClick={() => navigate("/admin/specimens")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon
                  name={dq.missingProvince > 0 ? "info" : "check"}
                  size={18}
                  style={{ color: dq.missingProvince > 0 ? "#9C7A1F" : "#2E7D32", flexShrink: 0 }}
                />
                <div>
                  <strong>Mẫu vật chưa gán Tỉnh/Thành phố</strong>
                  <span style={{ display: "block", fontSize: 12, color: "#555555" }}>
                    Các mẫu lịch sử chưa có tọa độ GPS và chưa khai báo tỉnh thu mẫu
                  </span>
                </div>
              </div>
              <span className="status-badge">
                {dq.missingProvince.toLocaleString("vi-VN")} mẫu
              </span>
            </div>

            <div
              className="placeholder-row"
              style={{ cursor: "pointer", padding: "10px 12px" }}
              onClick={() => navigate("/admin/taxonomy")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="leaf" size={18} style={{ color: "#2E7D32", flexShrink: 0 }} />
                <div>
                  <strong>Mẫu vật định danh ở bậc Giống / Họ / Bộ</strong>
                  <span style={{ display: "block", fontSize: 12, color: "#555555" }}>
                    Đã chuẩn hóa {speciesCount.toLocaleString("vi-VN")} loài · còn{" "}
                    {dq.higherRankOnly.toLocaleString("vi-VN")} mẫu chờ giám định loài
                  </span>
                </div>
              </div>
              <span className="status-badge">
                {dq.higherRankOnly.toLocaleString("vi-VN")} mẫu
              </span>
            </div>

            <div
              className="placeholder-row"
              style={{ cursor: "pointer", padding: "10px 12px" }}
              onClick={() => navigate("/admin/dna")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="dna" size={18} style={{ color: "#1D4ED8", flexShrink: 0 }} />
                <div>
                  <strong>Chuỗi DNA tham chiếu loài & Ngày thu hợp lệ</strong>
                  <span style={{ display: "block", fontSize: 12, color: "#555555" }}>
                    {dq.orphanedDna} trình tự tham chiếu cấp loài · {dq.futureDates} lỗi ngày tương
                    lai
                  </span>
                </div>
              </div>
              <span className="status-badge status-public">HỢP LỆ</span>
            </div>
          </div>
        </section>
      </div>

      {/* 4. Bottom 2-Column Live Feeds: Mẫu vật mới cập nhật & Nhật ký Hệ thống (Audit Log) */}
      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <section className="card panel">
          <div className="panel-title">
            <h2>Mẫu vật mới ghi nhận trong CSDL</h2>
            <button
              type="button"
              className="button button-ghost button-sm"
              onClick={() => navigate("/admin/specimens")}
            >
              {t("common.viewAll", "Xem tất cả")} →
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="vi-data-table">
              <thead>
                <tr>
                  <th>Mã mẫu vật</th>
                  <th>Tên khoa học</th>
                  <th>Tỉnh / Thành</th>
                  <th>Ngày thu</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recentSpecimens || []).map((sp) => (
                  <tr key={sp.id}>
                    <td>
                      <Link to={`/admin/specimens/${sp.id}`} className="vi-code-link">
                        {sp.specimenCode}
                      </Link>
                    </td>
                    <td>
                      <Link
                        to={`/admin/specimens/${sp.id}`}
                        className="taxonomy-name"
                        style={{ fontSize: 13 }}
                      >
                        <em>{sp.scientificName}</em>
                      </Link>
                    </td>
                    <td>{sp.provinceNameVn || "—"}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                      {sp.collectionDate || "—"}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          sp.isPublic ? "status-public" : "status-private"
                        }`}
                      >
                        {sp.isPublic ? "PUBLIC" : "PRIVATE"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card panel">
          <div className="panel-title">
            <h2>{t("dashboard.recent", "Nhật ký Kiểm toán Quản trị gần đây")}</h2>
            <button
              type="button"
              className="button button-ghost button-sm"
              onClick={() => navigate("/admin/system")}
            >
              Nhật ký đầy đủ →
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="vi-data-table">
              <thead>
                <tr>
                  <th>Thao tác</th>
                  <th>Bảng / Đối tượng</th>
                  <th>Tài khoản</th>
                  <th>Địa chỉ IP</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recentAuditLogs || []).map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="status-badge status-public">{log.actionType}</span>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                      {log.targetTable}
                      {log.targetId ? ` (#${log.targetId})` : ""}
                    </td>
                    <td>
                      <strong>{log.adminUsername}</strong>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{log.ipAddress}</td>
                    <td style={{ fontSize: 12 }}>
                      {log.timestamp
                        ? new Date(log.timestamp).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
