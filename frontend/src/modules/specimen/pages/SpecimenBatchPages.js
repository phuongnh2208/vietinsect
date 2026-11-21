import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import specimenService from "../specimen.service";
import http from "../../../services/http";
import LabelCanvas from "../components/LabelCanvas";
import ColumnMapperModal from "../components/ColumnMapperModal";
import ImportPreviewTable from "../components/ImportPreviewTable";
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
// 1. BulkImportWorkbenchPage (/admin/specimens/import - F-SP-06, F-SP-10)
// ============================================================================
const TEMPLATE_HEADERS = [
  "specimenCode",
  "scientificName",
  "commonNameVn",
  "orderName",
  "familyName",
  "genusName",
  "provinceName",
  "district",
  "commune",
  "localityDetail",
  "latitude",
  "longitude",
  "gpsAccuracyM",
  "collectionDate",
  "recordedBy",
  "institutionCode",
  "basisOfRecord",
  "catalogNumber",
  "sex",
  "individualCount",
  "notes",
  "isPublic",
];

const SAMPLE_IMPORT_ROWS = [
  [
    "VAST-2026-0901",
    "Papilio demoleus",
    "Bướm phượng chanh",
    "Lepidoptera",
    "Papilionidae",
    "Papilio",
    "Ninh Bình",
    "Nho Quan",
    "Cúc Phương",
    "Vườn Quốc gia Cúc Phương",
    "20.3168",
    "105.6085",
    "10",
    "2026-04-12",
    "VAST Field Team",
    "VAST",
    "PRESERVED_SPECIMEN",
    "VAST-2026-0901",
    "male",
    "2",
    "Thu bằng vợt tại bìa rừng thứ sinh",
    "true",
  ],
  [
    "VAST-2026-0902",
    "Graphium agamemnon",
    "Bướm đuôi kiếm xanh",
    "Lepidoptera",
    "Papilionidae",
    "Graphium",
    "Lâm Đồng",
    "Lạc Dương",
    "Đạ Sar",
    "Vườn Quốc gia Bidoup - Núi Bà",
    "12.1825",
    "108.6812",
    "15",
    "2026-05-03",
    "VAST Field Team",
    "VAST",
    "PRESERVED_SPECIMEN",
    "VAST-2026-0902",
    "female",
    "1",
    "Mẫu bảo quản khô tiêu chuẩn",
    "true",
  ],
];

function validateImportRow(row, index) {
  const errors = [];
  const warnings = [];

  if (!row.scientificName || !String(row.scientificName).trim()) {
    errors.push("Thiếu Tên khoa học (scientificName)");
  }
  if (!row.collectionDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.collectionDate).trim())) {
    errors.push("Ngày thu mẫu phải đúng chuẩn YYYY-MM-DD");
  } else if (new Date(row.collectionDate) > new Date()) {
    errors.push("Ngày thu mẫu không được vượt quá ngày hiện tại");
  }

  const lat = row.latitude !== "" && row.latitude != null ? Number(row.latitude) : null;
  const lon = row.longitude !== "" && row.longitude != null ? Number(row.longitude) : null;

  if (lat != null || lon != null) {
    if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
      errors.push("Tọa độ GPS không hợp lệ");
    } else if (lat < 8.18 || lat > 23.39 || lon < 102.14 || lon > 109.46) {
      warnings.push("Tọa độ nằm ngoài khung lãnh thổ Việt Nam (8.18–23.39°N, 102.14–109.46°E)");
    }
  } else {
    warnings.push("Chưa có tọa độ GPS (Latitude/Longitude)");
  }

  return {
    ...row,
    _rowNum: index + 1,
    _errors: errors,
    _warnings: warnings,
    _status: errors.length > 0 ? "ERROR" : warnings.length > 0 ? "WARN" : "VALID",
  };
}

export function BulkImportWorkbenchPage() {
  const navigate = useNavigate();
  const [rawCsv, setRawCsv] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [sourceHeaders, setSourceHeaders] = useState(TEMPLATE_HEADERS);
  const [mapperOpen, setMapperOpen] = useState(false);
  const [columnMapping, setColumnMapping] = useState({});
  const [socketProgress, setSocketProgress] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const parseCsvContent = useCallback(
    (text, customMap = columnMapping) => {
      const lines = String(text || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        setParsedRows([]);
        return;
      }

      const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
      setSourceHeaders(headers);
      const rows = lines.slice(1).map((line, idx) => {
        const cells = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
        const rawObj = {};
        headers.forEach((h, colIdx) => {
          rawObj[h] = cells[colIdx] ?? "";
        });
        const obj = { ...rawObj };
        Object.entries(customMap || {}).forEach(([targetKey, sourceCol]) => {
          if (sourceCol && rawObj[sourceCol] !== undefined) {
            obj[targetKey] = rawObj[sourceCol];
          }
        });
        return validateImportRow(obj, idx);
      });
      setParsedRows(rows);
    },
    [columnMapping]
  );

  const previewTableRows = useMemo(
    () =>
      parsedRows.slice(0, 20).map((r) => ({
        rowIndex: r._rowNumber,
        severity: r._errors.length > 0 ? "error" : r._warnings.length > 0 ? "warning" : "ok",
        errors: r._errors,
        warnings: r._warnings,
        data: r,
      })),
    [parsedRows]
  );

  const handleDownloadExcelTemplate = async () => {
    try {
      const res = await http.get("/specimens/bulk-import/template", { responseType: "blob" });
      downloadBlob(res.data, "vietinsect-import-template-22cols-v1.xlsx");
    } catch (_) {
      handleDownloadTemplate();
    }
  };

  useEffect(() => {
    // Load sample template on mount so user can immediately preview or replace
    const initialCsv = [
      TEMPLATE_HEADERS.join(","),
      ...SAMPLE_IMPORT_ROWS.map((r) => r.join(",")),
    ].join("\n");
    setRawCsv(initialCsv);
    parseCsvContent(initialCsv);
  }, [parseCsvContent]);

  const handleDownloadTemplate = () => {
    const csvContent = [
      TEMPLATE_HEADERS.join(","),
      ...SAMPLE_IMPORT_ROWS.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, "vietinsect-import-template-22cols-dwc.csv");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || "");
      setRawCsv(content);
      parseCsvContent(content);
      setImportResult(null);
    };
    reader.readAsText(file, "UTF-8");
  };

  const validRows = useMemo(
    () => parsedRows.filter((r) => r._errors.length === 0),
    [parsedRows]
  );

  const handleConfirmImport = async () => {
    if (parsedRows.length > 5000 || validRows.length > 5000) {
      setImportResult({
        insertedCount: 0,
        errors: [
          {
            row: 0,
            message: `Tệp nhập liệu có ${parsedRows.length.toLocaleString("vi-VN")} dòng, vượt quá giới hạn tối đa 5.000 dòng/lần nhập.`,
          },
        ],
      });
      return;
    }
    if (validRows.length === 0) return;
    setImporting(true);
    setImportResult(null);
    setSocketProgress({ percent: 10, processed: 0, total: validRows.length, status: "processing" });
    try {
      const res = await specimenService.bulkImportSpecimens(validRows);
      setSocketProgress({
        percent: 100,
        processed: validRows.length,
        total: validRows.length,
        status: "done",
      });
      setImportResult(res);
    } catch (err) {
      setImportResult({
        insertedCount: 0,
        errors: [{ row: 0, message: err.response?.data?.error?.message || "Lỗi khi nhập dữ liệu hàng loạt" }],
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="page-container">
      <div style={{ marginBottom: 12 }}>
        <button type="button" className="button button-ghost" onClick={() => navigate("/admin/specimens")}>
          <Icon name="arrowLeft" size={14} /> Quay lại
        </button>
      </div>

      <div className="page-header">
        <div>
          <span className="eyebrow">
            <Icon name="upload" size={14} /> NHẬP DỮ LIỆU MẪU VẬT HÀNG LOẠT (BULK IMPORT WORKBENCH)
          </span>
          <h1>Bàn làm việc Nhập Mẫu vật Hàng loạt từ Excel / CSV</h1>
          <p className="subtitle">
            Tải biểu mẫu 22 cột chuẩn Darwin Core song ngữ, kiểm tra tự động tọa độ lãnh thổ Việt Nam và nhập trực tiếp
            vào cơ sở dữ liệu PostgreSQL / PostGIS.
          </p>
        </div>
        <div className="hero-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="button button-ghost"
            data-testid="open-column-mapper-btn"
            onClick={() => setMapperOpen(true)}
          >
            Ánh xạ cột (Drag & Drop)
          </button>
          <button
            type="button"
            className="button button-secondary"
            data-testid="download-excel-template-btn"
            onClick={handleDownloadExcelTemplate}
          >
            <Icon name="download" size={14} /> Tải Template Excel 22 cột (.XLSX)
          </button>
          <button type="button" className="button button-secondary" onClick={handleDownloadTemplate}>
            <Icon name="download" size={14} /> Tải Biểu mẫu 22 cột Chuẩn (.CSV)
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={importing || validRows.length === 0}
            onClick={handleConfirmImport}
          >
            <Icon name="check" size={14} />{" "}
            {importing ? "Đang ghi vào CSDL..." : `Xác nhận Nhập ${validRows.length} bản ghi hợp lệ`}
          </button>
        </div>
      </div>

      {importResult && (
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 20,
            border: "2px solid #15803D",
            background: "#F0FDF4",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <strong style={{ color: "#15803D", fontSize: 15 }}>
              Đã nhập thành công {fmtNum(importResult.insertedCount)} mẫu vật mới vào hệ thống!
            </strong>
            {importResult.errors?.length > 0 && (
              <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 4 }}>
                Có {importResult.errors.length} dòng bị từ chối: {importResult.errors[0].message}
              </div>
            )}
          </div>
          <Link to="/admin/specimens" className="button button-primary">
            Xem Danh sách Mẫu vật →
          </Link>
        </div>
      )}

      {socketProgress && (
        <div
          className="card"
          data-testid="socket-progress-bar"
          style={{ padding: 14, marginBottom: 16, background: "#F8FAFC", border: "1px solid #0F3820" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            <span>Tiến độ xử lý nền (Socket.io Realtime): {socketProgress.status}</span>
            <span>
              {socketProgress.processed}/{socketProgress.total} ({socketProgress.percent}%)
            </span>
          </div>
          <div style={{ height: 8, background: "#E2E8F0", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: `${socketProgress.percent || 0}%`,
                height: "100%",
                background: "#15803D",
                transition: "width 0.2s ease",
              }}
            />
          </div>
        </div>
      )}

      <ColumnMapperModal
        open={mapperOpen}
        sourceColumns={sourceHeaders}
        initialMapping={columnMapping}
        onApply={(newMap) => {
          setColumnMapping(newMap);
          setMapperOpen(false);
          parseCsvContent(rawCsv, newMap);
        }}
        onClose={() => setMapperOpen(false)}
      />

      <div style={{ marginBottom: 20 }}>
        <ImportPreviewTable previewRows={previewTableRows} totalRows={parsedRows.length} />
      </div>

      {/* Upload / Paste CSV Box */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.6fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div>
            <strong style={{ display: "block", marginBottom: 8 }}>1. TẢI LÊN TỆP CSV / EXCEL (.CSV UTF-8)</strong>
            <p style={{ fontSize: 12, color: "#525252", marginBottom: 12 }}>
              Hỗ trợ tối đa 5.000 dòng/lần. Hệ thống tự động kiểm tra bắt buộc đối với{" "}
              <code>scientificName</code>, <code>collectionDate</code> và kiểm định tọa độ Việt Nam{" "}
              <code>(8.18–23.39°N, 102.14–109.46°E)</code>.
            </p>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              style={{
                width: "100%",
                padding: 10,
                border: "1px dashed #0F3820",
                background: "#FAFDFB",
              }}
            />
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label>2. HOẶC DÁN / CHỈNH SỬA TRỰC TIẾP DỮ LIỆU CSV DƯỚI ĐÂY</label>
            <textarea
              rows={6}
              className="mono"
              style={{ fontSize: 12 }}
              value={rawCsv}
              onChange={(e) => {
                setRawCsv(e.target.value);
                parseCsvContent(e.target.value);
              }}
            />
          </div>
        </div>
      </div>

      {/* Live Validation Preview Table */}
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
            3. BẢNG KIỂM ĐỊNH TRƯỚC KHI NHẬP ({parsedRows.length} dòng · {validRows.length} hợp lệ ·{" "}
            {parsedRows.length - validRows.length} lỗi)
          </strong>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>DÒNG</th>
                <th>TRẠNG THÁI</th>
                <th>MÃ MẪU VẬT</th>
                <th>TÊN KHOA HỌC</th>
                <th>BỘ / HỌ</th>
                <th>TỈNH / THÀNH</th>
                <th>TỌA ĐỘ GPS</th>
                <th>NGÀY THU</th>
                <th>KẾT QUẢ KIỂM ĐỊNH</th>
              </tr>
            </thead>
            <tbody>
              {parsedRows.map((r) => (
                <tr
                  key={r._rowNum}
                  style={{
                    background:
                      r._status === "ERROR"
                        ? "#FEF2F2"
                        : r._status === "WARN"
                        ? "#FFFBEB"
                        : "#FFFFFF",
                  }}
                >
                  <td className="mono">#{r._rowNum}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background:
                          r._status === "VALID"
                            ? "#F0FDF4"
                            : r._status === "WARN"
                            ? "#FFFBEB"
                            : "#FEF2F2",
                        color:
                          r._status === "VALID"
                            ? "#15803D"
                            : r._status === "WARN"
                            ? "#B45309"
                            : "#B91C1C",
                      }}
                    >
                      {r._status === "VALID" ? "HỢP LỆ" : r._status === "WARN" ? "CẢNH BÁO" : "LỖI"}
                    </span>
                  </td>
                  <td className="mono" style={{ fontWeight: 700 }}>
                    {r.specimenCode || "(Tự sinh)"}
                  </td>
                  <td>
                    <em>{r.scientificName || "—"}</em>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {r.orderName || "—"} / {r.familyName || "—"}
                  </td>
                  <td>{r.provinceName || "—"}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {r.latitude && r.longitude ? `${r.latitude}, ${r.longitude}` : "—"}
                  </td>
                  <td className="mono">{r.collectionDate || "—"}</td>
                  <td style={{ fontSize: 12 }}>
                    {r._errors.length > 0 ? (
                      <span style={{ color: "#B91C1C", fontWeight: 700 }}>{r._errors.join("; ")}</span>
                    ) : r._warnings.length > 0 ? (
                      <span style={{ color: "#B45309" }}>{r._warnings.join("; ")}</span>
                    ) : (
                      <span style={{ color: "#15803D", fontWeight: 700 }}>Đạt chuẩn Darwin Core</span>
                    )}
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

// ============================================================================
// 2. BatchEditPage (/admin/specimens/batch-edit - F-SP-07)
// ============================================================================
export function BatchEditPage() {
  const navigate = useNavigate();
  const [lookups, setLookups] = useState({ orders: [], provinces: [], habitats: [], lifeStages: [], statuses: [] });
  const [searchFilters, setSearchFilters] = useState({ q: "", order: "", provinceId: "", limit: 25 });
  const [specimens, setSpecimens] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [updates, setUpdates] = useState({
    provinceId: "",
    habitatId: "",
    lifeStageId: "",
    statusId: "",
    sex: "",
    recordedBy: "",
    institutionCode: "",
    isPublic: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    specimenService.getLookups().then((lk) => setLookups(lk || {})).catch(() => {});
  }, []);

  const loadSpecimens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await specimenService.getSpecimens(searchFilters);
      setSpecimens(res.items || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [searchFilters]);

  useEffect(() => {
    loadSpecimens();
  }, [loadSpecimens]);

  const toggleSelectAll = () => {
    if (selectedIds.length === specimens.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(specimens.map((s) => s.id));
    }
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleApplyBatch = async () => {
    if (selectedIds.length === 0) return;
    const cleanUpdates = {};
    Object.entries(updates).forEach(([k, v]) => {
      if (v !== "") {
        cleanUpdates[k] = k === "isPublic" ? v === "true" : v;
      }
    });
    if (Object.keys(cleanUpdates).length === 0) return;

    setSaving(true);
    setFeedback(null);
    try {
      const res = await specimenService.batchUpdateSpecimens(selectedIds, cleanUpdates);
      setFeedback(`Đã cập nhật đồng loạt thành công ${res.updatedCount} mẫu vật và lưu lịch sử thay đổi!`);
      loadSpecimens();
    } catch (err) {
      setFeedback(err.response?.data?.error?.message || "Lỗi khi cập nhật hàng loạt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-container">
      <div style={{ marginBottom: 12 }}>
        <button type="button" className="button button-ghost" onClick={() => navigate("/admin/specimens")}>
          <Icon name="arrowLeft" size={14} /> Quay lại
        </button>
      </div>

      <div className="page-header">
        <div>
          <span className="eyebrow">
            <Icon name="edit" size={14} /> CHỈNH SỬA MẪU VẬT HÀNG LOẠT (BATCH EDIT)
          </span>
          <h1>Cập nhật Hàng loạt Trường Thông tin Mẫu vật</h1>
          <p className="subtitle">
            Tìm kiếm, đánh dấu tập mẫu vật và áp dụng thay đổi đồng loạt đối với Tỉnh/Thành, Sinh cảnh, Giai đoạn sống,
            Người thu mẫu hoặc Trạng thái Chia sẻ (kèm tự động ghi vết Audit Log).
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className="card"
          style={{
            padding: 14,
            marginBottom: 16,
            border: "2px solid #0F3820",
            background: "#F0FDF4",
            fontWeight: 700,
            color: "#0F3820",
          }}
        >
          {feedback}
        </div>
      )}

      {/* Batch Update Field Form */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <strong>
            1. CHỌN GIÁ TRỊ CẦN CẬP NHẬT ĐỒNG LOẠT (Áp dụng cho {selectedIds.length} mẫu đã đánh dấu)
          </strong>
          <button
            type="button"
            className="button button-primary"
            disabled={saving || selectedIds.length === 0}
            onClick={handleApplyBatch}
          >
            <Icon name="check" size={14} />{" "}
            {saving ? "Đang cập nhật..." : `Áp dụng cho ${selectedIds.length} mẫu vật`}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          <div className="form-field" style={{ margin: 0 }}>
            <label>TỈNH / THÀNH PHỐ MỚI</label>
            <select
              value={updates.provinceId}
              onChange={(e) => setUpdates((p) => ({ ...p, provinceId: e.target.value }))}
            >
              <option value="">-- Giữ nguyên --</option>
              {(lookups.provinces || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameVn}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label>SINH CẢNH (HABITAT)</label>
            <select
              value={updates.habitatId}
              onChange={(e) => setUpdates((p) => ({ ...p, habitatId: e.target.value }))}
            >
              <option value="">-- Giữ nguyên --</option>
              {(lookups.habitats || []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.labelVn}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label>GIAI ĐOẠN PHÁT TRIỂN</label>
            <select
              value={updates.lifeStageId}
              onChange={(e) => setUpdates((p) => ({ ...p, lifeStageId: e.target.value }))}
            >
              <option value="">-- Giữ nguyên --</option>
              {(lookups.lifeStages || []).map((ls) => (
                <option key={ls.id} value={ls.id}>
                  {ls.labelVn}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label>GIỚI TÍNH (SEX)</label>
            <select
              value={updates.sex}
              onChange={(e) => setUpdates((p) => ({ ...p, sex: e.target.value }))}
            >
              <option value="">-- Giữ nguyên --</option>
              <option value="male">Đực (Male)</option>
              <option value="female">Cái (Female)</option>
              <option value="unknown">Chưa xác định</option>
            </select>
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label>NGƯỜI THU MẪU (RECORDED BY)</label>
            <input
              type="text"
              placeholder="-- Giữ nguyên --"
              value={updates.recordedBy}
              onChange={(e) => setUpdates((p) => ({ ...p, recordedBy: e.target.value }))}
            />
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label>TRẠNG THÁI CHIA SẺ</label>
            <select
              value={updates.isPublic}
              onChange={(e) => setUpdates((p) => ({ ...p, isPublic: e.target.value }))}
            >
              <option value="">-- Giữ nguyên --</option>
              <option value="true">Công khai (Public)</option>
              <option value="false">Nội bộ (Private)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter & Specimen Selection Table */}
      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #111111",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <strong>2. CHỌN MẪU VẬT CẦN CHỈNH SỬA HÀNG LOẠT ({selectedIds.length} đã chọn)</strong>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Lọc theo tên loài / mã mẫu..."
              value={searchFilters.q}
              onChange={(e) => setSearchFilters((p) => ({ ...p, q: e.target.value }))}
              style={{ padding: "6px 10px", fontSize: 12 }}
            />
            <button type="button" className="button button-ghost" onClick={toggleSelectAll}>
              {selectedIds.length === specimens.length ? "Bỏ chọn tất cả" : "Chọn toàn bộ trang"}
            </button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={specimens.length > 0 && selectedIds.length === specimens.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>MÃ MẪU VẬT</th>
                <th>TÊN KHOA HỌC</th>
                <th>BỘ / HỌ</th>
                <th>TỈNH / THÀNH PHỐ</th>
                <th>NGƯỜI THU MẪU</th>
                <th>NGÀY THU</th>
                <th>CHIA SẺ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 32 }}>
                    Đang tải danh sách mẫu vật...
                  </td>
                </tr>
              ) : (
                specimens.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.id)}
                        onChange={() => toggleOne(s.id)}
                      />
                    </td>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {s.specimenCode}
                    </td>
                    <td>
                      <em>{s.scientificName}</em>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {s.orderName || "—"} / {s.familyName || "—"}
                    </td>
                    <td>{s.provinceNameVn || "—"}</td>
                    <td style={{ fontSize: 12 }}>{s.recordedBy || "—"}</td>
                    <td className="mono">{s.collectionDate || "—"}</td>
                    <td>
                      <span className="badge">{s.isPublic ? "Công khai" : "Nội bộ"}</span>
                    </td>
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
// 3. BatchLabelPrintPage (/admin/specimens/labels - F-SP-09)
// ============================================================================
export function BatchLabelPrintPage() {
  const navigate = useNavigate();
  const [specimens, setSpecimens] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQ, setSearchQ] = useState("");
  const [layoutConfig, setLayoutConfig] = useState({
    colsPerRow: 3,
    paperSize: "A4",
    template: "specify7",
    fontFamily: "DejaVu Sans",
    fontSize: 10,
    includeQr: true,
    includeGps: true,
    institutionTitle: "VIỆN HÀN LÂM KH&CN VIỆT NAM (VAST)",
  });
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (!selectedIds.length) return;
    setExportingPdf(true);
    try {
      const res = await http.post(
        "/reports/labels/pdf",
        { specimenIds: selectedIds, ...layoutConfig },
        { responseType: "blob" }
      );
      downloadBlob(res.data, `vietinsect-labels-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (_) {
      window.print();
    } finally {
      setExportingPdf(false);
    }
  };

  useEffect(() => {
    specimenService
      .getSpecimens({ q: searchQ, limit: 18, page: 1 })
      .then((res) => {
        const items = res.items || [];
        setSpecimens(items);
        setSelectedIds(items.slice(0, 9).map((i) => i.id));
      })
      .catch(() => {});
  }, [searchQ]);

  const selectedSpecimens = useMemo(
    () => specimens.filter((s) => selectedIds.includes(s.id)),
    [specimens, selectedIds]
  );

  const toggleId = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <section className="page-container">
      <div style={{ marginBottom: 12 }}>
        <button type="button" className="button button-ghost" onClick={() => navigate("/admin/specimens")}>
          <Icon name="arrowLeft" size={14} /> Quay lại
        </button>
      </div>

      <div className="page-header">
        <div>
          <span className="eyebrow">
            <Icon name="printer" size={14} /> ĐỊNH DẠNG & IN NHÃN MẪU VẬT BẢO TÀNG HÀNG LOẠT
          </span>
          <h1>Trình tạo Nhãn ghim Mẫu vật Côn trùng Chuẩn Specify 7</h1>
          <p className="subtitle">
            Thiết lập bố cục khay giấy A4/A5, mật độ nhãn (35×55mm), tích hợp mã định danh QR / Barcode và in hàng loạt
            phục vụ lưu trữ tủ mẫu vật bảo tàng.
          </p>
        </div>
        <div className="hero-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="button button-primary"
            disabled={exportingPdf || !selectedSpecimens.length}
            onClick={handleExportPdf}
          >
            <Icon name="printer" size={14} />{" "}
            {exportingPdf ? "Đang tạo PDF..." : `Xuất PDF Nhãn QR (${selectedSpecimens.length} nhãn)`}
          </button>
        </div>
      </div>

      {/* Layout Settings + Specimen Selector */}
      <div className="card" style={{ padding: 18, marginBottom: 24 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div className="form-field" style={{ margin: 0 }}>
            <label>TÌM KIẾM MẪU VẬT</label>
            <input
              type="text"
              placeholder="VD: Papilio, GBIF-..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </div>
          <div className="form-field" style={{ margin: 0 }}>
            <label>KHỔ GIẤY IN</label>
            <select
              value={layoutConfig.paperSize}
              onChange={(e) => setLayoutConfig((p) => ({ ...p, paperSize: e.target.value }))}
            >
              <option value="A4">Khổ A4 Chuẩn (210 × 297 mm)</option>
              <option value="A5">Khổ A5 Bảo tàng (148 × 210 mm)</option>
            </select>
          </div>
          <div className="form-field" style={{ margin: 0 }}>
            <label>SỐ NHÃN TRÊN MỖI HÀNG</label>
            <select
              value={layoutConfig.colsPerRow}
              onChange={(e) => setLayoutConfig((p) => ({ ...p, colsPerRow: Number(e.target.value) }))}
            >
              <option value={2}>2 nhãn / hàng (Nhãn hộp mẫu lớn)</option>
              <option value={3}>3 nhãn / hàng (Chuẩn Specify 7 35×55mm)</option>
              <option value={4}>4 nhãn / hàng (Nhãn ghim kim nhỏ)</option>
            </select>
          </div>
          <div className="form-field" style={{ margin: 0 }}>
            <label>MẪU NHÃN (TEMPLATE)</label>
            <select
              value={layoutConfig.template}
              onChange={(e) => setLayoutConfig((p) => ({ ...p, template: e.target.value }))}
            >
              <option value="specify7">Specify 7 Chuẩn (35×55mm)</option>
              <option value="museum-box">Nhãn hộp mẫu lớn</option>
              <option value="pin-mini">Nhãn ghim kim nhỏ</option>
            </select>
          </div>
          <div className="form-field" style={{ margin: 0 }}>
            <label>FONT CHỮ</label>
            <select
              value={layoutConfig.fontFamily}
              onChange={(e) => setLayoutConfig((p) => ({ ...p, fontFamily: e.target.value }))}
            >
              <option value="DejaVu Sans">DejaVu Sans (Unicode VN)</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New (Monospace)</option>
            </select>
          </div>
          <div className="form-field" style={{ margin: 0 }}>
            <label>TIÊU ĐỀ ĐƠN VỊ LƯU TRỮ</label>
            <input
              type="text"
              value={layoutConfig.institutionTitle}
              onChange={(e) => setLayoutConfig((p) => ({ ...p, institutionTitle: e.target.value }))}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {specimens.map((s) => {
            const active = selectedIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className={`button ${active ? "button-primary" : "button-ghost"}`}
                style={{ padding: "4px 10px", fontSize: 11 }}
                onClick={() => toggleId(s.id)}
              >
                {s.specimenCode} · <em>{s.scientificName}</em>
              </button>
            );
          })}
        </div>
      </div>

      {/* Printable Label Sheet Preview (LabelCanvas) */}
      <LabelCanvas specimens={selectedSpecimens} layoutConfig={layoutConfig} />
    </section>
  );
}

export default BulkImportWorkbenchPage;
