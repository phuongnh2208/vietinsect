import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import specimenService from "../../specimen/specimen.service";
import Icon from "../../../components/ui/Icon";

function fmtNum(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

const MONTH_NAMES = [
  "T1", "T2", "T3", "T4", "T5", "T6",
  "T7", "T8", "T9", "T10", "T11", "T12",
];

export default function AnalyticsDashboardPage() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [regionFilter, setRegionFilter] = useState("ALL");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        specimenService.getStats(),
        specimenService.getAnalytics({ limit: 150 }),
      ]);
      setStats(statsRes);
      setAnalytics(analyticsRes);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Không thể tải dữ liệu phân tích đa chiều.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalSpecimens = stats?.totalSpecimens || 0;
  const withCoords = stats?.withCoordinates || 0;
  const withProv = stats?.withProvince || 0;
  const atSpecies = stats?.specimensAtSpeciesRank || 0;
  const publicCnt = stats?.publicSpecimens || 0;
  const dq = stats?.dataQuality || {};

  const completenessData = useMemo(() => {
    if (!totalSpecimens) return [];
    return [
      {
        name: "Định danh bậc Loài (Species)",
        value: atSpecies,
        pct: ((atSpecies / totalSpecimens) * 100).toFixed(1),
        color: "#0F3820",
      },
      {
        name: "Định danh Giống/Họ/Bộ",
        value: Math.max(0, totalSpecimens - atSpecies),
        pct: (((totalSpecimens - atSpecies) / totalSpecimens) * 100).toFixed(1),
        color: "#86EFAC",
      },
    ];
  }, [totalSpecimens, atSpecies]);

  const byYearChart = useMemo(() => {
    const rows = analytics?.byYear || [];
    return rows.slice(-25).map((r) => ({
      year: String(r.year),
      specimens: Number(r.specimen_count || 0),
      species: Number(r.species_count || 0),
    }));
  }, [analytics]);

  const byMonthChart = useMemo(() => {
    const map = new Map((analytics?.byMonth || []).map((r) => [Number(r.month), Number(r.specimen_count || 0)]));
    return MONTH_NAMES.map((label, idx) => ({
      month: label,
      specimens: map.get(idx + 1) || 0,
    }));
  }, [analytics]);

  const filteredProvinces = useMemo(() => {
    const rows = analytics?.speciesRichnessByProvince || [];
    if (regionFilter === "ALL") return rows;
    return rows.filter((r) => r.region === regionFilter);
  }, [analytics, regionFilter]);

  const topRichnessChart = useMemo(() => {
    return filteredProvinces.slice(0, 15).map((r) => ({
      name: r.province_name_vn,
      speciesCount: Number(r.species_count || 0),
      specimenCount: Number(r.specimen_count || 0),
    }));
  }, [filteredProvinces]);

  const qualityAuditRows = useMemo(
    () => [
      {
        id: "QA-01",
        rule: "Toàn vẹn Tọa độ Lãnh thổ Việt Nam (8.18–23.39°N, 102.14–109.46°E)",
        affected: dq.outOfVnBounds || 0,
        severity: (dq.outOfVnBounds || 0) === 0 ? "PASS" : "WARN",
        actionLabel: "Kiểm tra Bản đồ GIS",
        actionTo: "/admin/map",
      },
      {
        id: "QA-02",
        rule: "Ánh xạ Tỉnh/Thành phố Hành chính (34 tỉnh/thành NQ 202/2025/QH15)",
        affected: dq.missingProvince || 0,
        severity: (dq.missingProvince || 0) === 0 ? "PASS" : "WARN",
        actionLabel: "Chỉnh sửa Hàng loạt",
        actionTo: "/admin/specimens/batch-edit",
      },
      {
        id: "QA-03",
        rule: "Kiểm tra Ngày thu mẫu Hợp lệ (collection_date <= CURRENT_DATE)",
        affected: dq.futureDates || 0,
        severity: (dq.futureDates || 0) === 0 ? "PASS" : "ERROR",
        actionLabel: "Rà soát Kho mẫu",
        actionTo: "/admin/specimens",
      },
      {
        id: "QA-04",
        rule: "Trình tự DNA COI chưa gắn khóa ngoại Mẫu vật (specimen_id IS NULL)",
        affected: dq.orphanedDna || 0,
        severity: (dq.orphanedDna || 0) === 0 ? "PASS" : "INFO",
        actionLabel: "Quản lý Kho DNA",
        actionTo: "/admin/dna",
      },
      {
        id: "QA-05",
        rule: "Mẫu vật mới định danh tới bậc Giống / Họ / Bộ (chưa tới Species)",
        affected: dq.higherRankOnly || 0,
        severity: "INFO",
        actionLabel: "Biên tập Cây Phân loại",
        actionTo: "/admin/taxonomy/editor",
      },
    ],
    [dq]
  );

  return (
    <section className="page-container">
      <div className="page-header">
        <div>
          <span className="eyebrow">
            <Icon name="chart" size={14} /> PHÂN TÍCH ĐA CHIỀU & KIỂM ĐỊNH DỮ LIỆU
          </span>
          <h1>Phân tích Đa dạng Sinh học & Chất lượng Dữ liệu</h1>
          <p className="subtitle">
            Phân tích xu hướng số hóa theo thời gian, chỉ số độ giàu loài (Species Richness) trên 34 tỉnh/thành phố và
            kiểm định tự động độ hoàn thiện chuẩn Darwin Core.
          </p>
        </div>
        <div className="hero-actions" style={{ marginTop: 0 }}>
          <button type="button" className="button button-ghost" onClick={loadData} disabled={loading}>
            <Icon name="refresh" size={14} /> Làm mới phân tích
          </button>
          <Link to="/admin/reports" className="button button-secondary">
            <Icon name="report" size={14} /> Xuất Báo cáo Danh mục
          </Link>
          <Link to="/admin/ai/sdm" className="button button-primary">
            <Icon name="spark" size={14} /> Mô hình Phân bố SDM
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          <span>{error}</span>
          <button type="button" className="button button-secondary" onClick={loadData}>
            Thử lại
          </button>
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <article className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">ĐỘ HOÀN THIỆN TỌA ĐỘ GPS</span>
            <span className="stat-icon-box">
              <Icon name="pin" size={16} />
            </span>
          </div>
          <strong className="stat-value">
            {totalSpecimens ? `${((withCoords / totalSpecimens) * 100).toFixed(1)}%` : "—"}
          </strong>
          <span className="stat-sub" style={{ color: "#15803D", fontWeight: 700 }}>
            {fmtNum(withCoords)} / {fmtNum(totalSpecimens)} mẫu có PostGIS Point
          </span>
        </article>

        <article className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">ĐỊNH DANH BẬC LOÀI (SPECIES)</span>
            <span className="stat-icon-box">
              <Icon name="leaf" size={16} />
            </span>
          </div>
          <strong className="stat-value">{fmtNum(stats?.taxa?.species)}</strong>
          <span className="stat-sub">
            {fmtNum(atSpecies)} mẫu gắn trực tiếp bậc Loài ({totalSpecimens ? ((atSpecies / totalSpecimens) * 100).toFixed(1) : 0}%)
          </span>
        </article>

        <article className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">ĐỘ PHỦ HÀNH CHÍNH</span>
            <span className="stat-icon-box">
              <Icon name="map" size={16} />
            </span>
          </div>
          <strong className="stat-value">{fmtNum(stats?.provincesCovered)} / 34</strong>
          <span className="stat-sub" style={{ color: "#15803D", fontWeight: 700 }}>
            {fmtNum(withProv)} mẫu đã chuẩn hóa Tỉnh/Thành
          </span>
        </article>

        <article className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">TỶ LỆ DỮ LIỆU MỞ (OPEN DATA)</span>
            <span className="stat-icon-box">
              <Icon name="globe" size={16} />
            </span>
          </div>
          <strong className="stat-value">
            {totalSpecimens ? `${((publicCnt / totalSpecimens) * 100).toFixed(1)}%` : "—"}
          </strong>
          <span className="stat-sub">
            {fmtNum(publicCnt)} mẫu công khai · {fmtNum(stats?.dnaCount)} mã vạch DNA COI
          </span>
        </article>
      </div>

      {/* Row 1: Collection & Species Trend by Year + Seasonality by Month */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <span className="eyebrow">BIỂU ĐỒ XU HƯỚNG THU MẪU & ĐA DẠNG LOÀI THEO NĂM</span>
            <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>
              Diễn biến Số lượng Mẫu vật & Số Loài Ghi nhận
            </h2>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            {byYearChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={byYearChart} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#111111" }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#111111" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#1D4ED8" }} />
                  <Tooltip
                    formatter={(val, name) => [
                      `${fmtNum(val)}`,
                      name === "specimens" ? "Mẫu vật thu thập" : "Số loài ghi nhận",
                    ]}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="specimens"
                    name="Mẫu vật thu thập"
                    stroke="#0F3820"
                    fill="#DCFCE7"
                    strokeWidth={2}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="species"
                    name="Số loài ghi nhận"
                    stroke="#1D4ED8"
                    fill="#DBEAFE"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: 48, textAlign: "center", color: "#525252" }}>Đang tải biểu đồ năm...</div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <span className="eyebrow">PHÂN BỐ MÙA VỤ THU MẪU (PHENOLOGY) & CẤU TRÚC ĐỊNH DANH</span>
            <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>
              Cường độ Thu thập theo 12 Tháng & Tỷ lệ Bậc Phân loại
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12, alignItems: "center" }}>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonthChart} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#111111" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#111111" }} />
                  <Tooltip formatter={(v) => [`${fmtNum(v)} mẫu vật`, "Số mẫu"]} />
                  <Bar dataKey="specimens" fill="#15803D" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={completenessData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={78}
                    paddingAngle={2}
                  >
                    {completenessData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${fmtNum(v)} mẫu`, "Số lượng"]} />
                  <Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Species Richness by Province (F-GI-06) */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <span className="eyebrow">CHỈ SỐ ĐA DẠNG SINH HỌC KHÔNG GIAN</span>
            <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>
              Độ giàu Loài (Species Richness) & Mật độ Mẫu vật theo 34 Tỉnh / Thành phố
            </h2>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { id: "ALL", label: "Toàn quốc (34)" },
              { id: "Miền Bắc", label: "Miền Bắc" },
              { id: "Miền Trung", label: "Miền Trung" },
              { id: "Miền Nam", label: "Miền Nam" },
            ].map((reg) => (
              <button
                key={reg.id}
                type="button"
                className={`button ${regionFilter === reg.id ? "button-primary" : "button-ghost"}`}
                style={{ padding: "5px 10px", fontSize: 11 }}
                onClick={() => setRegionFilter(reg.id)}
              >
                {reg.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topRichnessChart}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#111111" }} />
                <YAxis type="category" dataKey="name" width={125} tick={{ fontSize: 11, fill: "#111111", fontWeight: 600 }} />
                <Tooltip
                  formatter={(v, name) => [
                    `${fmtNum(v)}`,
                    name === "speciesCount" ? "Số loài ghi nhận (Richness)" : "Tổng mẫu vật",
                  ]}
                />
                <Legend />
                <Bar dataKey="speciesCount" name="Số loài (Species Richness)" fill="#0F3820" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="table-responsive" style={{ maxHeight: 360, overflowY: "auto", border: "1px solid #D1D5DB" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>TỈNH / THÀNH PHỐ</th>
                  <th>VÙNG</th>
                  <th>SỐ LOÀI</th>
                  <th>SỐ MẪU VẬT</th>
                </tr>
              </thead>
              <tbody>
                {filteredProvinces.map((p, idx) => (
                  <tr key={p.province_id}>
                    <td className="mono">{idx + 1}</td>
                    <td>
                      <Link
                        to={`/admin/specimens?provinceId=${p.province_id}`}
                        style={{ fontWeight: 700, color: "#0F3820", textDecoration: "none" }}
                      >
                        {p.province_name_vn}
                      </Link>
                    </td>
                    <td style={{ fontSize: 12 }}>{p.region || "—"}</td>
                    <td className="mono" style={{ fontWeight: 800, color: "#15803D" }}>
                      {fmtNum(p.species_count)}
                    </td>
                    <td className="mono">{fmtNum(p.specimen_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: Automated Data Quality Audit Table (F-AI-04) */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <span className="eyebrow">KIỂM ĐỊNH CHẤT LƯỢNG DỮ LIỆU TỰ ĐỘNG</span>
          <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>
            Bảng Kiểm tra Ràng buộc Toàn vẹn Darwin Core & Không gian PostGIS
          </h2>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>MÃ QUY TẮC</th>
                <th>TIÊU CHÍ KIỂM ĐỊNH CHẤT LƯỢNG</th>
                <th>TRẠNG THÁI</th>
                <th>BẢN GHI CẦN LƯU Ý</th>
                <th>THAO TÁC XỬ LÝ</th>
              </tr>
            </thead>
            <tbody>
              {qualityAuditRows.map((row) => (
                <tr key={row.id}>
                  <td className="mono" style={{ fontWeight: 700 }}>
                    {row.id}
                  </td>
                  <td style={{ fontWeight: 600 }}>{row.rule}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background:
                          row.severity === "PASS"
                            ? "#F0FDF4"
                            : row.severity === "INFO"
                            ? "#EFF6FF"
                            : "#FEF2F2",
                        color:
                          row.severity === "PASS"
                            ? "#15803D"
                            : row.severity === "INFO"
                            ? "#1D4ED8"
                            : "#B91C1C",
                        borderColor:
                          row.severity === "PASS"
                            ? "#15803D"
                            : row.severity === "INFO"
                            ? "#1D4ED8"
                            : "#B91C1C",
                      }}
                    >
                      {row.severity === "PASS" ? "ĐẠT CHUẨN 100%" : row.severity}
                    </span>
                  </td>
                  <td className="mono" style={{ fontWeight: 700 }}>
                    {fmtNum(row.affected)} bản ghi
                  </td>
                  <td>
                    <Link to={row.actionTo} className="button button-ghost" style={{ padding: "4px 10px", fontSize: 12 }}>
                      {row.actionLabel} →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
