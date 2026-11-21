import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import specimenService from "../../specimen/specimen.service";
import useAuthStore from "../../../stores/auth.store";
import Icon from "../../../components/ui/Icon";

function fmtNum(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// 1. ReportsChecklistPage (/reports & /admin/reports - F-RP-01, F-RP-02, F-RP-05, F-RP-06)
// ============================================================================
export function ReportsChecklistPage() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const canManage = isAdminRoute && isAuthenticated;

  const [lookups, setLookups] = useState({ orders: [], provinces: [] });
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState({
    order: "",
    provinceId: "",
    q: "",
    limit: 200,
  });
  const [loading, setLoading] = useState(true);
  const [exportingFormat, setExportingFormat] = useState(null);

  useEffect(() => {
    Promise.all([specimenService.getLookups(), specimenService.getStats()])
      .then(([lk, st]) => {
        setLookups(lk || { orders: [], provinces: [] });
        setStats(st);
      })
      .catch(() => {});
  }, []);

  const loadChecklist = useCallback(async () => {
    setLoading(true);
    try {
      const data = await specimenService.getAnalytics(filters);
      setAnalytics(data);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadChecklist();
  }, [loadChecklist]);

  const handleExport = async (format) => {
    setExportingFormat(format);
    try {
      const blob = await specimenService.exportSpecimens({
        order: filters.order,
        provinceId: filters.provinceId,
        q: filters.q,
        format,
        limit: format === "dwca" ? 25000 : 10000,
      });
      const extMap = { dwca: "zip", xlsx: "xlsx", geojson: "geojson" };
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `vietinsect-report-${stamp}.${extMap[format] || "dat"}`);
    } catch (_) {
    } finally {
      setExportingFormat(null);
    }
  };

  const handleExportChecklistCsv = () => {
    const rows = analytics?.speciesChecklist || [];
    const headers = [
      "STT",
      "Ten_Khoa_Hoc",
      "Tac_Gia_Nam",
      "Ten_Tieng_Viet",
      "Bo_Order",
      "Ho_Family",
      "Giong_Genus",
      "IUCN_Status",
      "So_Mau_Vat",
      "So_Tinh_Ghi_Nhan",
    ];
    const csvLines = [
      headers.join(","),
      ...rows.map((r, idx) =>
        [
          idx + 1,
          `"${(r.scientific_name || "").replace(/"/g, '""')}"`,
          `"${(r.author_year || "").replace(/"/g, '""')}"`,
          `"${(r.vernacular_name_vn || "").replace(/"/g, '""')}"`,
          `"${r.order_name || ""}"`,
          `"${r.family_name || ""}"`,
          `"${r.genus_name || ""}"`,
          `"${r.iucn_status || "NE"}"`,
          r.specimen_count || 0,
          r.province_count || 0,
        ].join(",")
      ),
    ];
    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `vietinsect-species-checklist-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const checklist = analytics?.speciesChecklist || [];
  const selectedProvName =
    lookups.provinces?.find((p) => String(p.id) === String(filters.provinceId))?.nameVn ||
    "Toàn quốc (34 Tỉnh/Thành phố)";

  return (
    <section className="page-container">
      {/* Official VAST Header for Print / PDF (F-RP-05) */}
      <div
        className="card"
        style={{
          padding: "20px 24px",
          marginBottom: 20,
          border: "2px solid #0F3820",
          background: "#FAFDFB",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            borderBottom: "1px solid #0F3820",
            paddingBottom: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0F3820", textTransform: "uppercase" }}>
              VIỆN HÀN LÂM KHOA HỌC VÀ CÔNG NGHỆ VIỆT NAM
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#111111", textTransform: "uppercase" }}>
              VIỆN CÔNG NGHỆ THÔNG TIN · HỆ THỐNG CSDL CÔN TRÙNG VIỆT NAM (VIETINSECT)
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#111111" }}>
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#111111" }}>
              Độc lập - Tự do - Hạnh phúc
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span className="eyebrow">
              <Icon name="report" size={14} /> BÁO CÁO KHOA HỌC & DANH MỤC LOÀI CHUẨN HÓA (CHECKLIST)
            </span>
            <h1 style={{ fontSize: 24, margin: "4px 0" }}>
              Danh mục Đa dạng Loài Côn trùng — {selectedProvName}
            </h1>
            <p className="subtitle" style={{ margin: 0 }}>
              Phạm vi: {filters.order ? `Bộ ${filters.order}` : "Toàn bộ 16 Bộ Côn trùng"} · Tổng mẫu cơ sở dữ liệu:{" "}
              <strong>{fmtNum(stats?.totalSpecimens)}</strong> mẫu · Tổng danh pháp bậc Loài:{" "}
              <strong>{fmtNum(stats?.taxa?.species)}</strong> loài.
            </p>
          </div>
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <button type="button" className="button button-primary" onClick={() => window.print()}>
              <Icon name="printer" size={14} /> In / Xuất PDF Đóng dấu VAST
            </button>
            <button type="button" className="button button-secondary" onClick={handleExportChecklistCsv}>
              <Icon name="download" size={14} /> Xuất Danh mục Loài (.CSV)
            </button>
            <button
              type="button"
              className="button button-ghost"
              disabled={Boolean(exportingFormat)}
              onClick={() => handleExport("xlsx")}
            >
              <Icon name="download" size={14} /> Excel Mẫu vật (.XLSX)
            </button>
            <button
              type="button"
              className="button button-ghost"
              disabled={Boolean(exportingFormat)}
              onClick={() => handleExport("dwca")}
            >
              <Icon name="globe" size={14} /> Gói GBIF DwC-A (.ZIP)
            </button>
            {canManage && (
              <>
                <Link to="/admin/reports/kpi" className="button button-ghost">
                  <Icon name="chart" size={14} /> Báo cáo KPI Số hóa
                </Link>
                <Link to="/admin/reports/custom" className="button button-ghost">
                  <Icon name="filter" size={14} /> Tùy chỉnh Báo cáo
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div className="form-field" style={{ margin: 0 }}>
            <label>BỘ CÔN TRÙNG (ORDER)</label>
            <select
              value={filters.order}
              onChange={(e) => setFilters((p) => ({ ...p, order: e.target.value }))}
            >
              <option value="">Tất cả 16 Bộ Côn trùng</option>
              {(lookups.orders || []).map((o) => (
                <option key={o.id} value={o.scientificName}>
                  {o.scientificName} {o.vernacularNameVn ? `(${o.vernacularNameVn})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label>TỈNH / THÀNH PHỐ (34 TỈNH/THÀNH NQ 202)</label>
            <select
              value={filters.provinceId}
              onChange={(e) => setFilters((p) => ({ ...p, provinceId: e.target.value }))}
            >
              <option value="">Toàn quốc (34 Tỉnh/Thành)</option>
              {(lookups.provinces || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameVn}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label>TỪ KHÓA TÊN KHOA HỌC / TÊN VIỆT NAM</label>
            <input
              type="text"
              placeholder="VD: Papilio, Graphium, Danaus..."
              value={filters.q}
              onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
            />
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label>SỐ LOÀI HIỂN THỊ TỐI ĐA</label>
            <select
              value={filters.limit}
              onChange={(e) => setFilters((p) => ({ ...p, limit: Number(e.target.value) }))}
            >
              <option value={100}>Top 100 loài phổ biến</option>
              <option value={200}>Top 200 loài phổ biến</option>
              <option value={500}>Top 500 loài phổ biến</option>
            </select>
          </div>
        </div>
      </div>

      {/* Checklist Table */}
      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #111111",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <strong>
            DANH MỤC LOÀI CHUẨN HÓA ({fmtNum(checklist.length)} loài hiển thị / {fmtNum(stats?.taxa?.species)} loài trong CSDL)
          </strong>
          <span className="mono" style={{ fontSize: 12, color: "#525252" }}>
            Ngày trích xuất: {new Date().toLocaleDateString("vi-VN")} · Chuẩn ICZN & Darwin Core
          </span>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>DANH PHÁP KHOA HỌC (LOÀI)</th>
                <th>TÁC GIẢ / NĂM</th>
                <th>BỘ (ORDER)</th>
                <th>HỌ (FAMILY)</th>
                <th>GIỐNG (GENUS)</th>
                <th>IUCN</th>
                <th>SỐ MẪU VẬT</th>
                <th>SỐ TỈNH</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 36 }}>
                    Đang tổng hợp danh mục loài khoa học...
                  </td>
                </tr>
              ) : checklist.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 36 }}>
                    Không tìm thấy loài khớp điều kiện lọc.
                  </td>
                </tr>
              ) : (
                checklist.map((sp, idx) => (
                  <tr key={sp.taxon_id}>
                    <td className="mono">{idx + 1}</td>
                    <td>
                      <Link
                        to={canManage ? `/admin/species/${sp.slug}` : `/species/${sp.slug}`}
                        style={{ color: "#0F3820", fontWeight: 700, textDecoration: "none" }}
                      >
                        <em>{sp.scientific_name}</em>
                      </Link>
                      {sp.vernacular_name_vn && (
                        <div style={{ fontSize: 11, color: "#525252" }}>{sp.vernacular_name_vn}</div>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>{sp.author_year || "—"}</td>
                    <td>
                      <span className="badge badge-order">{sp.order_name || "Insecta"}</span>
                    </td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{sp.family_name || "—"}</td>
                    <td style={{ fontSize: 12 }}>
                      <em>{sp.genus_name || "—"}</em>
                    </td>
                    <td>
                      <span className="badge">{sp.iucn_status || "NE"}</span>
                    </td>
                    <td className="mono" style={{ fontWeight: 800, color: "#15803D" }}>
                      {fmtNum(sp.specimen_count)}
                    </td>
                    <td className="mono">{fmtNum(sp.province_count)} / 34</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// 2. DigitizationKpiPage (/admin/reports/kpi - F-RP-03)
// ============================================================================
export function DigitizationKpiPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([specimenService.getStats(), specimenService.getAnalytics({ limit: 50 })])
      .then(([st, an]) => {
        setStats(st);
        setAnalytics(an);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const kpiTargets = useMemo(() => {
    const totalSpecimens = stats?.totalSpecimens || 0;
    const totalSpecies = stats?.taxa?.species || 0;
    const withGps = stats?.withCoordinates || 0;
    const totalDna = stats?.dnaCount || 0;

    return [
      {
        code: "KPI-01",
        metric: "Tổng Mẫu vật Số hóa Chuẩn Darwin Core",
        target: 90000,
        actual: totalSpecimens,
        unit: "mẫu vật",
      },
      {
        code: "KPI-02",
        metric: "Số Danh pháp Bậc Loài (Species) Chuẩn hóa ICZN",
        target: 3500,
        actual: totalSpecies,
        unit: "loài",
      },
      {
        code: "KPI-03",
        metric: "Mẫu vật Định vị Không gian PostGIS & Ánh xạ 34 Tỉnh/Thành",
        target: 90000,
        actual: withGps,
        unit: "điểm tọa độ",
      },
      {
        code: "KPI-04",
        metric: "Trình tự Mã vạch Phân tử DNA (COI / GenBank & BOLD)",
        target: 100,
        actual: totalDna,
        unit: "trình tự FASTA",
      },
    ];
  }, [stats]);

  const byOrderChart = useMemo(() => {
    return (stats?.byOrder || []).slice(0, 12).map((r) => ({
      order: r.order_name,
      count: Number(r.count || 0),
    }));
  }, [stats]);

  return (
    <section className="page-container">
      <div style={{ marginBottom: 12 }}>
        <button type="button" className="button button-ghost" onClick={() => navigate("/admin/reports")}>
          <Icon name="arrowLeft" size={14} /> Quay lại
        </button>
      </div>

      <div className="page-header">
        <div>
          <span className="eyebrow">
            <Icon name="chart" size={14} /> ĐÁNH GIÁ HIỆU SUẤT SỐ HÓA (KPI REPORT)
          </span>
          <h1>Báo cáo Chỉ số Hiệu suất Số hóa Mẫu vật & Phân tử</h1>
          <p className="subtitle">
            Theo dõi mức độ hoàn thành chỉ tiêu số hóa mẫu vật bảo tàng, danh lục loài, tọa độ GIS và mã vạch DNA theo
            kế hoạch đề tài Viện Hàn lâm KH&CN Việt Nam (VAST).
          </p>
        </div>
        <div className="hero-actions" style={{ marginTop: 0 }}>
          <button type="button" className="button button-primary" onClick={() => window.print()}>
            <Icon name="printer" size={14} /> In Báo cáo KPI Nghiệm thu
          </button>
        </div>
      </div>

      {/* KPI Attainment Table */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 14px" }}>
          Bảng Đối chiếu Chỉ tiêu Kế hoạch & Kết quả Thực hiện Thực tế
        </h2>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>MÃ KPI</th>
                <th>HẠNG MỤC NGHIỆM THU KHOA HỌC</th>
                <th>CHỈ TIÊU KẾ HOẠCH</th>
                <th>THỰC ĐẠT TRONG CSDL</th>
                <th>TỶ LỆ HOÀN THÀNH</th>
                <th>ĐÁNH GIÁ</th>
              </tr>
            </thead>
            <tbody>
              {kpiTargets.map((k) => {
                const pct = k.target ? Math.round((k.actual / k.target) * 100) : 100;
                return (
                  <tr key={k.code}>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {k.code}
                    </td>
                    <td style={{ fontWeight: 700 }}>{k.metric}</td>
                    <td className="mono">
                      {fmtNum(k.target)} {k.unit}
                    </td>
                    <td className="mono" style={{ fontWeight: 800, color: "#0F3820" }}>
                      {fmtNum(k.actual)} {k.unit}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            flex: 1,
                            height: 10,
                            background: "#E5E5E5",
                            border: "1px solid #111111",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, pct)}%`,
                              height: "100%",
                              background: "#15803D",
                            }}
                          />
                        </div>
                        <span className="mono" style={{ fontWeight: 800 }}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: "#F0FDF4", color: "#15803D", borderColor: "#15803D" }}
                      >
                        VƯỢT CHỈ TIÊU
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakdown by Order */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 14px" }}>
          Sản lượng Số hóa theo 16 Bộ Côn trùng (Taxonomic Orders)
        </h2>
        <div style={{ width: "100%", height: 320 }}>
          {!loading && byOrderChart.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byOrderChart} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="order" tick={{ fontSize: 11, fill: "#111111" }} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: "#111111" }} />
                <Tooltip formatter={(v) => [`${fmtNum(v)} mẫu vật`, "Sản lượng"]} />
                <Legend />
                <Bar dataKey="count" name="Số mẫu đã số hóa" fill="#0F3820" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: 48, textAlign: "center" }}>Đang tải biểu đồ KPI...</div>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// 3. CustomReportBuilderPage (/admin/reports/custom - F-RP-04)
// ============================================================================
const DWC_AVAILABLE_COLUMNS = [
  { key: "specimenCode", label: "Mã Mẫu vật (catalogNumber)", defaultOn: true },
  { key: "scientificName", label: "Tên Khoa học (scientificName)", defaultOn: true },
  { key: "taxonRank", label: "Bậc Phân loại (taxonRank)", defaultOn: true },
  { key: "orderName", label: "Bộ (order)", defaultOn: true },
  { key: "familyName", label: "Họ (family)", defaultOn: true },
  { key: "genusName", label: "Giống (genus)", defaultOn: true },
  { key: "provinceNameVn", label: "Tỉnh/Thành phố (stateProvince)", defaultOn: true },
  { key: "district", label: "Quận/Huyện (county)", defaultOn: false },
  { key: "localityDetail", label: "Địa điểm chi tiết (locality)", defaultOn: true },
  { key: "latitude", label: "Vĩ độ (decimalLatitude)", defaultOn: true },
  { key: "longitude", label: "Kinh độ (decimalLongitude)", defaultOn: true },
  { key: "collectionDate", label: "Ngày thu mẫu (eventDate)", defaultOn: true },
  { key: "recordedBy", label: "Người thu mẫu (recordedBy)", defaultOn: true },
  { key: "institutionCode", label: "Cơ quan lưu trữ (institutionCode)", defaultOn: false },
  { key: "basisOfRecord", label: "Cơ sở bản ghi (basisOfRecord)", defaultOn: true },
  { key: "sex", label: "Giới tính (sex)", defaultOn: false },
  { key: "individualCount", label: "Số cá thể (individualCount)", defaultOn: false },
  { key: "habitatLabelVn", label: "Sinh cảnh (habitat)", defaultOn: false },
  { key: "lifeStageLabelVn", label: "Giai đoạn sống (lifeStage)", defaultOn: false },
  { key: "isPublic", label: "Trạng thái chia sẻ (isPublic)", defaultOn: true },
];

export function CustomReportBuilderPage() {
  const navigate = useNavigate();
  const [lookups, setLookups] = useState({ orders: [], provinces: [] });
  const [selectedCols, setSelectedCols] = useState(
    DWC_AVAILABLE_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key)
  );
  const [filters, setFilters] = useState({
    order: "",
    provinceId: "",
    basisOfRecord: "",
    dateFrom: "",
    dateTo: "",
    limit: 50,
  });
  const [rows, setRows] = useState([]);
  const [totalMatching, setTotalMatching] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    specimenService.getLookups().then((lk) => setLookups(lk || { orders: [], provinces: [] })).catch(() => {});
  }, []);

  const runPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await specimenService.getSpecimens({
        order: filters.order,
        provinceId: filters.provinceId,
        basisOfRecord: filters.basisOfRecord,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        limit: filters.limit,
        page: 1,
      });
      setRows(res.items || []);
      setTotalMatching(res.pagination?.total || 0);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    runPreview();
  }, [runPreview]);

  const toggleColumn = (key) => {
    setSelectedCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const activeColDefs = DWC_AVAILABLE_COLUMNS.filter((c) => selectedCols.includes(c.key));

  const handleDownloadCustomCsv = () => {
    const headerLine = activeColDefs.map((c) => `"${c.label}"`).join(",");
    const dataLines = rows.map((r) =>
      activeColDefs
        .map((c) => {
          const val = r[c.key] != null ? String(r[c.key]) : "";
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const blob = new Blob(["\uFEFF" + [headerLine, ...dataLines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    downloadBlob(blob, `vietinsect-custom-report-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleDownloadExcelFull = async () => {
    try {
      const blob = await specimenService.exportSpecimens({
        ...filters,
        format: "xlsx",
        limit: 10000,
      });
      downloadBlob(blob, `vietinsect-custom-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (_) {}
  };

  return (
    <section className="page-container">
      <div style={{ marginBottom: 12 }}>
        <button type="button" className="button button-ghost" onClick={() => navigate("/admin/reports")}>
          <Icon name="arrowLeft" size={14} /> Quay lại
        </button>
      </div>

      <div className="page-header">
        <div>
          <span className="eyebrow">
            <Icon name="filter" size={14} /> TRÌNH TẠO BÁO CÁO ĐỘNG DARWIN CORE
          </span>
          <h1>Tùy chỉnh Cấu trúc Cột & Bộ lọc Báo cáo</h1>
          <p className="subtitle">
            Lựa chọn trực quan các trường chuẩn Darwin Core muốn trích xuất, kết hợp điều kiện lọc theo Bộ, Tỉnh/Thành,
            Khoảng ngày thu mẫu và kết xuất CSV / Excel (.XLSX).
          </p>
        </div>
        <div className="hero-actions" style={{ marginTop: 0 }}>
          <button type="button" className="button button-secondary" onClick={handleDownloadCustomCsv}>
            <Icon name="download" size={14} /> Xuất các cột đã chọn (.CSV)
          </button>
          <button type="button" className="button button-primary" onClick={handleDownloadExcelFull}>
            <Icon name="download" size={14} /> Xuất Toàn bộ Khớp lọc (.XLSX)
          </button>
        </div>
      </div>

      {/* Step 1: Select Darwin Core Columns */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <strong>1. CHỌN CÁC TRƯỜNG DỮ LIỆU ĐẦU RA ({selectedCols.length} / {DWC_AVAILABLE_COLUMNS.length} cột)</strong>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="button button-ghost"
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => setSelectedCols(DWC_AVAILABLE_COLUMNS.map((c) => c.key))}
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              className="button button-ghost"
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => setSelectedCols(DWC_AVAILABLE_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key))}
            >
              Mặc định
            </button>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
            gap: 8,
          }}
        >
          {DWC_AVAILABLE_COLUMNS.map((col) => {
            const checked = selectedCols.includes(col.key);
            return (
              <label
                key={col.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  border: checked ? "1px solid #0F3820" : "1px solid #D4D4D4",
                  background: checked ? "#F0FDF4" : "#FFFFFF",
                  fontSize: 12,
                  fontWeight: checked ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleColumn(col.key)}
                />
                <span>{col.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Step 2: Filter Criteria */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <strong style={{ display: "block", marginBottom: 12 }}>2. ĐIỀU KIỆN TRÍCH LỌC DỮ LIỆU</strong>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div className="form-field" style={{ margin: 0 }}>
            <label>BỘ CÔN TRÙNG</label>
            <select
              value={filters.order}
              onChange={(e) => setFilters((p) => ({ ...p, order: e.target.value }))}
            >
              <option value="">Tất cả 16 Bộ</option>
              {(lookups.orders || []).map((o) => (
                <option key={o.id} value={o.scientificName}>
                  {o.scientificName}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ margin: 0 }}>
            <label>TỈNH / THÀNH PHỐ</label>
            <select
              value={filters.provinceId}
              onChange={(e) => setFilters((p) => ({ ...p, provinceId: e.target.value }))}
            >
              <option value="">Tất cả 34 Tỉnh/Thành</option>
              {(lookups.provinces || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameVn}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ margin: 0 }}>
            <label>TỪ NGÀY THU MẪU</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
            />
          </div>
          <div className="form-field" style={{ margin: 0 }}>
            <label>ĐẾN NGÀY THU MẪU</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
            />
          </div>
          <div className="form-field" style={{ margin: 0 }}>
            <label>SỐ DÒNG XEM TRƯỚC</label>
            <select
              value={filters.limit}
              onChange={(e) => setFilters((p) => ({ ...p, limit: Number(e.target.value) }))}
            >
              <option value={25}>25 dòng</option>
              <option value={50}>50 dòng</option>
              <option value={100}>100 dòng</option>
            </select>
          </div>
        </div>
      </div>

      {/* Step 3: Live Preview Table */}
      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #111111",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <strong>
            3. BẢNG XEM TRƯỚC BÁO CÁO ĐỘNG ({fmtNum(rows.length)} dòng xem trước / {fmtNum(totalMatching)} bản ghi khớp)
          </strong>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                {activeColDefs.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={activeColDefs.length || 1} style={{ textAlign: "center", padding: 32 }}>
                    Đang tải bản xem trước...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={activeColDefs.length || 1} style={{ textAlign: "center", padding: 32 }}>
                    Không có bản ghi khớp điều kiện.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    {activeColDefs.map((c) => (
                      <td key={c.key}>
                        {c.key === "scientificName" ? (
                          <em>{r[c.key] || "—"}</em>
                        ) : c.key === "isPublic" ? (
                          r.isPublic ? "Công khai" : "Nội bộ"
                        ) : (
                          String(r[c.key] ?? "—")
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default ReportsChecklistPage;
