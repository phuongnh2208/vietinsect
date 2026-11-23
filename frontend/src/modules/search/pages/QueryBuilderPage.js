import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import http from "../../../services/http";
import useAuthStore from "../../../stores/auth.store";
import "./QueryBuilderPage.css";

const FIELD_GROUPS = [
  {
    group: "Phân loại học (Taxonomy — Darwin Core)",
    fields: [
      { value: "scientificName", label: "Tên khoa học (scientificName)", type: "text", placeholder: "VD: Papilio demoleus" },
      { value: "commonNameVn", label: "Tên tiếng Việt (commonNameVn)", type: "text", placeholder: "VD: Bướm phượng" },
      { value: "order", label: "Bộ (Order)", type: "text", placeholder: "VD: Lepidoptera" },
      { value: "family", label: "Họ (Family)", type: "text", placeholder: "VD: Papilionidae" },
      { value: "genus", label: "Giống (Genus)", type: "text", placeholder: "VD: Papilio" },
    ],
  },
  {
    group: "Địa lý & Sinh thái (Location & Ecology)",
    fields: [
      { value: "province", label: "Tỉnh / Thành phố", type: "text", placeholder: "VD: Lâm Đồng" },
      { value: "elevationM", label: "Độ cao (m)", type: "number", placeholder: "VD: 1000" },
      { value: "iucnStatus", label: "Trạng thái IUCN", type: "iucn", placeholder: "VD: CR, EN, VU, LC..." },
    ],
  },
  {
    group: "Thu mẫu & Lưu trữ (Record & Event)",
    fields: [
      { value: "specimenCode", label: "Mã mẫu vật (specimenCode)", type: "text", placeholder: "VD: VAST-2026-001" },
      { value: "collectionDate", label: "Ngày thu mẫu (YYYY-MM-DD)", type: "date", placeholder: "YYYY-MM-DD" },
      { value: "bodyLengthMm", label: "Kích thước cơ thể (mm)", type: "number", placeholder: "VD: 25" },
      { value: "recordedBy", label: "Người thu mẫu", type: "text", placeholder: "VD: VAST Field Team" },
      { value: "notes", label: "Ghi chú", type: "text", placeholder: "Từ khóa ghi chú..." },
    ],
  },
];

const ALL_FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);
const FIELD_MAP = Object.fromEntries(ALL_FIELDS.map((f) => [f.value, f]));

const OPERATORS = [
  { value: "contains", label: "Chứa (CONTAINS)", symbol: "~" },
  { value: "eq", label: "Bằng (=)", symbol: "=" },
  { value: "neq", label: "Khác (≠)", symbol: "≠" },
  { value: "between", label: "Trong khoảng (Từ ... Đến ...)", symbol: "BETWEEN" },
  { value: "gte", label: "Lớn hơn hoặc bằng (≥)", symbol: "≥" },
  { value: "lte", label: "Nhỏ hơn hoặc bằng (≤)", symbol: "≤" },
];
const OPERATOR_MAP = Object.fromEntries(OPERATORS.map((o) => [o.value, o]));

const QUICK_TEMPLATES = [
  {
    id: "tpl-high-elevation",
    title: "Mẫu vùng núi cao (≥ 1000m)",
    desc: "Độ cao ≥ 1000m, lọc theo sinh thái núi cao",
    rules: [{ id: 101, logic: "AND", field: "elevationM", operator: "gte", value: "1000", valueTo: "" }],
  },
  {
    id: "tpl-iucn-threatened",
    title: "Loài bị đe dọa (CR hoặc EN)",
    desc: "Kết hợp nhánh OR giữa các mức IUCN nguy cấp",
    rules: [
      { id: 201, logic: "AND", field: "iucnStatus", operator: "eq", value: "CR", valueTo: "" },
      { id: 202, logic: "OR", field: "iucnStatus", operator: "eq", value: "EN", valueTo: "" },
    ],
  },
  {
    id: "tpl-exclude-family",
    title: "Bộ Cánh vẩy, loại trừ họ Papilionidae",
    desc: "Minh họa kết hợp AND + NOT trên phân loại học",
    rules: [
      { id: 301, logic: "AND", field: "order", operator: "eq", value: "Lepidoptera", valueTo: "" },
      { id: 302, logic: "NOT", field: "family", operator: "eq", value: "Papilionidae", valueTo: "" },
    ],
  },
  {
    id: "tpl-date-range",
    title: "Thu mẫu giai đoạn 2024 – 2026",
    desc: "Lọc khoảng thời gian thu thập (BETWEEN)",
    rules: [
      { id: 401, logic: "AND", field: "collectionDate", operator: "between", value: "2024-01-01", valueTo: "2026-12-31" },
    ],
  },
];

const LOCAL_PRESET_KEY = "vietinsect_scr16_saved_filters";

const createDefaultRule = (id = 1) => ({
  id,
  logic: "AND",
  field: "scientificName",
  operator: "contains",
  value: "",
  valueTo: "",
});

/**
 * QueryBuilderPage — Màn hình SCR-16 Tìm kiếm nâng cao (F-SR-04, C-04):
 * - Mở cho cả Admin và User (/search/advanced & /admin/search/advanced)
 * - Query Builder AND/OR/NOT trực quan kiểu GBIF Predicate Builder, khoảng giá trị số/ngày (between)
 * - Xem trước biểu thức truy vấn trực tiếp & mẫu truy vấn nghiên cứu nhanh
 * - Lưu/tải/xóa bộ lọc (Admin lưu DB qua /api/search/filters; User lưu localStorage)
 * - Chế độ SQL trực tiếp CHỈ hiển thị và cho phép Admin
 */
export default function QueryBuilderPage() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const isAdmin = Boolean(isAuthenticated && (user?.role === "admin" || location.pathname.startsWith("/admin")));
  const detailBase = isAdmin ? "/admin/specimens" : "/specimens";
  const basicSearchPath = isAdmin ? "/admin/specimens" : "/specimens/search";

  const [mode, setMode] = useState("builder"); // "builder" | "sql" (sql only if isAdmin)
  const [rules, setRules] = useState([createDefaultRule(1)]);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Saved filters state
  const [presetName, setPresetName] = useState("");
  const [savedFilters, setSavedFilters] = useState([]);

  // Admin SQL state
  const [sqlText, setSqlText] = useState(
    "SELECT specimen_id, gbif_scientific_name, common_name_vn, elevation_m, collection_date FROM specimens WHERE deleted_at IS NULL LIMIT 25"
  );
  const [sqlResult, setSqlResult] = useState(null);

  const loadPresets = useCallback(async () => {
    if (isAdmin) {
      try {
        const { data } = await http.get("/search/filters");
        setSavedFilters(data?.data || []);
        return;
      } catch (_) {
        // fallback to localStorage if offline
      }
    }
    try {
      const raw = localStorage.getItem(LOCAL_PRESET_KEY);
      setSavedFilters(raw ? JSON.parse(raw) : []);
    } catch (_) {
      setSavedFilters([]);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const addRule = () => {
    setRules((prev) => [...prev, createDefaultRule(Date.now() + prev.length)]);
  };

  const removeRule = (id) => {
    setRules((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const updateRule = (id, patch) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleResetRules = () => {
    setRules([createDefaultRule(Date.now())]);
    setResults([]);
    setTotal(0);
    setPage(1);
    setTotalPages(0);
    setHasSearched(false);
    setError("");
  };

  const executeBuilderQuery = async (targetPage = 1, customRules = rules) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await http.post("/search/advanced", {
        rules: customRules,
        page: targetPage,
        limit: 25,
      });
      const pag = data?.pagination || {};
      setResults(data?.data || []);
      setTotal(pag.total || 0);
      setPage(pag.page || targetPage);
      setTotalPages(pag.totalPages || Math.ceil((pag.total || 0) / 25));
      setHasSearched(true);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Lỗi thực thi truy vấn nâng cao");
    } finally {
      setLoading(false);
    }
  };

  const handleRunBuilder = async (e) => {
    if (e) e.preventDefault();
    await executeBuilderQuery(1, rules);
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    if (isAdmin) {
      try {
        await http.post("/search/filters", { name: presetName.trim(), filterJson: { rules } });
        setPresetName("");
        await loadPresets();
        return;
      } catch (_) {
        // fallback
      }
    }
    const next = [
      { id: Date.now(), name: presetName.trim(), filterJson: { rules } },
      ...savedFilters,
    ].slice(0, 20);
    setSavedFilters(next);
    localStorage.setItem(LOCAL_PRESET_KEY, JSON.stringify(next));
    setPresetName("");
  };

  const handleDeletePreset = async (presetId) => {
    if (isAdmin) {
      try {
        await http.delete(`/search/filters/${presetId}`);
        await loadPresets();
        return;
      } catch (_) {
        // fallback
      }
    }
    const next = savedFilters.filter((p) => p.id !== presetId);
    setSavedFilters(next);
    localStorage.setItem(LOCAL_PRESET_KEY, JSON.stringify(next));
  };

  const handleApplyPreset = (preset) => {
    const parsed =
      typeof preset.filterJson === "string" ? JSON.parse(preset.filterJson) : preset.filterJson;
    if (Array.isArray(parsed?.rules) && parsed.rules.length > 0) {
      setRules(parsed.rules);
    }
  };

  const handleApplyTemplate = (tpl) => {
    setMode("builder");
    setRules(tpl.rules.map((r, i) => ({ ...r, id: Date.now() + i })));
  };

  const handleRunSql = async (e) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await http.post("/search/sql", { sql: sqlText });
      setSqlResult(data?.data || { columns: [], rows: [], rowCount: 0 });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Câu lệnh SQL bị từ chối");
    } finally {
      setLoading(false);
    }
  };

  const activeRules = useMemo(
    () => rules.filter((r) => String(r.value || "").trim() !== ""),
    [rules]
  );

  return (
    <section className="page-container qb-page" data-testid="scr16-query-builder-page">
      {/* Header */}
      <div className="qb-header">
        <div className="qb-header-title-group">
          <span className="eyebrow">SCR-16 · TÌM KIẾM NÂNG CAO & TRÌNH XÂY DỰNG TRUY VẤN (F-SR-04)</span>
          <h1>Trình xây dựng truy vấn nâng cao (AND / OR / NOT)</h1>
          <p className="qb-header-subtitle">
            Xây dựng mệnh đề lọc logic phức tạp (AND / OR / NOT) theo chuẩn Darwin Core / GBIF, so sánh khoảng độ cao,
            kích thước, ngày thu mẫu và lưu cấu hình bộ lọc nghiên cứu.
          </p>
        </div>

        <div className="qb-header-actions">
          <Link to={basicSearchPath} className="qb-switch-link">
            ← Tìm kiếm thường (Tra cứu mẫu vật)
          </Link>

          {isAdmin && (
            <div className="qb-mode-tabs" data-testid="admin-mode-tabs">
              <button
                type="button"
                className={`qb-mode-tab ${mode === "builder" ? "active" : ""}`}
                onClick={() => setMode("builder")}
              >
                Visual Query Builder
              </button>
              <button
                type="button"
                data-testid="tab-sql-mode"
                className={`qb-mode-tab ${mode === "sql" ? "active" : ""}`}
                onClick={() => setMode("sql")}
              >
                Chế độ SQL trực tiếp (Admin)
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="qb-alert-error">
          {error}
        </div>
      )}

      {/* Datalist gợi ý mã IUCN */}
      <datalist id="qb-iucn-options">
        <option value="CR">CR — Cực kỳ nguy cấp</option>
        <option value="EN">EN — Nguy cấp</option>
        <option value="VU">VU — Sắp nguy cấp</option>
        <option value="NT">NT — Sắp bị đe dọa</option>
        <option value="LC">LC — Ít quan tâm</option>
        <option value="DD">DD — Thiếu dữ liệu</option>
        <option value="NE">NE — Chưa đánh giá</option>
      </datalist>

      {mode === "builder" || !isAdmin ? (
        <div className="qb-workspace">
          {/* Cột chính: Query Builder + Results */}
          <div>
            <form onSubmit={handleRunBuilder} className="qb-panel">
              <div className="qb-panel-head">
                <h2 className="qb-panel-title">Mệnh đề truy vấn (Predicate Builder)</h2>
                <span className="qb-badge">{rules.length} điều kiện</span>
              </div>

              <div className="qb-panel-body">
                <div className="qb-rules-list">
                  {rules.map((r, idx) => {
                    const fieldMeta = FIELD_MAP[r.field] || { type: "text", placeholder: "Nhập giá trị..." };
                    const inputType =
                      fieldMeta.type === "date"
                        ? "date"
                        : fieldMeta.type === "number"
                          ? "number"
                          : "text";

                    return (
                      <div
                        key={r.id}
                        data-testid={`qb-rule-${idx}`}
                        className={`qb-rule-row ${r.operator === "between" ? "is-between" : ""}`}
                      >
                        <span className="qb-rule-index">#{idx + 1}</span>

                        <select
                          className={`qb-control qb-logic-select qb-logic-${r.logic}`}
                          aria-label={`Toán tử logic dòng ${idx + 1}`}
                          value={r.logic}
                          onChange={(e) => updateRule(r.id, { logic: e.target.value })}
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                          <option value="NOT">NOT</option>
                        </select>

                        <select
                          className="qb-control"
                          aria-label={`Trường dữ liệu dòng ${idx + 1}`}
                          value={r.field}
                          onChange={(e) => updateRule(r.id, { field: e.target.value })}
                        >
                          {FIELD_GROUPS.map((grp) => (
                            <optgroup key={grp.group} label={grp.group}>
                              {grp.fields.map((f) => (
                                <option key={f.value} value={f.value}>
                                  {f.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>

                        <select
                          className="qb-control"
                          aria-label={`Điều kiện so sánh dòng ${idx + 1}`}
                          value={r.operator}
                          onChange={(e) => updateRule(r.id, { operator: e.target.value })}
                        >
                          {OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>

                        <div className="qb-value-group">
                          <input
                            type={inputType}
                            list={fieldMeta.type === "iucn" ? "qb-iucn-options" : undefined}
                            className="qb-control"
                            aria-label={`Giá trị dòng ${idx + 1}`}
                            placeholder={r.operator === "between" ? "Từ..." : fieldMeta.placeholder}
                            value={r.value}
                            onChange={(e) => updateRule(r.id, { value: e.target.value })}
                          />
                          {r.operator === "between" && (
                            <>
                              <span className="qb-range-sep">→</span>
                              <input
                                type={inputType}
                                className="qb-control"
                                aria-label={`Giá trị đến dòng ${idx + 1}`}
                                placeholder="Đến..."
                                value={r.valueTo || ""}
                                onChange={(e) => updateRule(r.id, { valueTo: e.target.value })}
                              />
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          className="qb-remove-btn"
                          disabled={rules.length <= 1}
                          onClick={() => removeRule(r.id)}
                          aria-label={`Xóa điều kiện dòng ${idx + 1}`}
                          title="Xóa dòng điều kiện này"
                        >
                          Xóa
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="qb-actions-bar">
                  <div className="qb-actions-left">
                    <button type="button" className="qb-btn qb-btn-secondary" onClick={addRule}>
                      + Thêm điều kiện
                    </button>
                    <button type="submit" className="qb-btn qb-btn-primary" disabled={loading}>
                      {loading ? "Đang truy vấn..." : "Thực thi truy vấn"}
                    </button>
                  </div>

                  <button type="button" className="qb-btn qb-btn-ghost" onClick={handleResetRules}>
                    Đặt lại
                  </button>
                </div>
              </div>
            </form>

            {/* Results Table */}
            <div className="qb-panel qb-results-panel">
              <div className="qb-panel-head">
                <h2 className="qb-panel-title">
                  Kết quả tìm kiếm nâng cao: {total.toLocaleString("vi-VN")} mẫu vật
                </h2>
                {totalPages > 1 && (
                  <span className="qb-badge">
                    Trang {page} / {totalPages}
                  </span>
                )}
              </div>

              {results.length === 0 ? (
                <div className="qb-empty-state">
                  <strong>
                    {hasSearched ? "Không tìm thấy mẫu vật phù hợp" : "Sẵn sàng thực thi truy vấn"}
                  </strong>
                  {hasSearched
                    ? "Thử nới lỏng điều kiện logic (chuyển AND sang OR) hoặc thay đổi giá trị lọc."
                    : 'Nhập điều kiện hoặc chọn một mẫu truy vấn gợi ý ở cột bên phải, sau đó nhấn "Thực thi truy vấn".'}
                </div>
              ) : (
                <>
                  <div className="qb-table-wrap">
                    <table className="qb-table">
                      <thead>
                        <tr>
                          <th>Mã mẫu</th>
                          <th>Tên khoa học</th>
                          <th>Tên tiếng Việt</th>
                          <th>Tỉnh / Thành phố</th>
                          <th>Độ cao (m)</th>
                          <th>Ngày thu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <Link to={`${detailBase}/${item.id}`} className="qb-code-link">
                                {item.specimenCode}
                              </Link>
                            </td>
                            <td>
                              <em>{item.scientificName}</em>
                            </td>
                            <td>{item.commonNameVn || "—"}</td>
                            <td>{item.provinceNameVn || "—"}</td>
                            <td>{item.elevationM != null ? `${item.elevationM} m` : "—"}</td>
                            <td>{item.collectionDate ? String(item.collectionDate).slice(0, 10) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="qb-pagination">
                      <span>
                        Hiển thị trang <strong>{page}</strong> / {totalPages} ({total.toLocaleString("vi-VN")} kết quả)
                      </span>
                      <div className="qb-pagination-controls">
                        <button
                          type="button"
                          className="qb-btn qb-btn-ghost"
                          disabled={page <= 1 || loading}
                          onClick={() => executeBuilderQuery(page - 1)}
                        >
                          ← Trang trước
                        </button>
                        <button
                          type="button"
                          className="qb-btn qb-btn-ghost"
                          disabled={page >= totalPages || loading}
                          onClick={() => executeBuilderQuery(page + 1)}
                        >
                          Trang sau →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Cột phụ bên phải: Query Preview + Quick Templates + Saved Filters */}
          <aside className="qb-sidebar">
            {/* Live Predicate Preview */}
            <div className="qb-panel">
              <div className="qb-panel-head">
                <h2 className="qb-panel-title">Biểu thức truy vấn</h2>
              </div>
              <div className="qb-panel-body">
                <div className="qb-preview-box">
                  {activeRules.length === 0 ? (
                    <span style={{ color: "#64748b" }}>
                      Chưa nhập giá trị lọc. Khi thực thi sẽ trả về toàn bộ mẫu vật khả dụng.
                    </span>
                  ) : (
                    activeRules.map((r, i) => {
                      const fLabel = FIELD_MAP[r.field]?.label?.split(" (")[0] || r.field;
                      const opSym = OPERATOR_MAP[r.operator]?.symbol || r.operator;
                      const valStr =
                        r.operator === "between"
                          ? `[${r.value || "..."} .. ${r.valueTo || "..."}]`
                          : `"${r.value}"`;
                      return (
                        <div key={r.id} style={{ marginBottom: i < activeRules.length - 1 ? 4 : 0 }}>
                          {(i > 0 || r.logic === "NOT") && (
                            <span className={`qb-preview-pill qb-logic-${r.logic}`}>{r.logic}</span>
                          )}
                          <span>
                            ({fLabel} {opSym} {valStr})
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="qb-panel">
              <div className="qb-panel-head">
                <h2 className="qb-panel-title">Mẫu truy vấn nhanh</h2>
              </div>
              <div className="qb-panel-body">
                <div className="qb-template-list">
                  {QUICK_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      className="qb-template-btn"
                      onClick={() => handleApplyTemplate(tpl)}
                    >
                      <strong>{tpl.title}</strong>
                      <span>{tpl.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Saved Filters */}
            <div className="qb-panel">
              <div className="qb-panel-head">
                <h2 className="qb-panel-title">Bộ lọc đã lưu</h2>
                <span className="qb-badge">{savedFilters.length}</span>
              </div>
              <div className="qb-panel-body">
                <div className="qb-save-row">
                  <input
                    type="text"
                    className="qb-control"
                    aria-label="Tên bộ lọc cần lưu"
                    placeholder="Tên bộ lọc..."
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="qb-btn qb-btn-secondary"
                    style={{ height: 38, whiteSpace: "nowrap" }}
                    onClick={handleSavePreset}
                  >
                    Lưu bộ lọc
                  </button>
                </div>

                {savedFilters.length > 0 && (
                  <div className="qb-saved-list">
                    {savedFilters.map((p) => (
                      <div key={p.id} className="qb-saved-item">
                        <button
                          type="button"
                          className="qb-saved-apply"
                          onClick={() => handleApplyPreset(p)}
                        >
                          {p.name}
                        </button>
                        <button
                          type="button"
                          className="qb-saved-del"
                          onClick={() => handleDeletePreset(p.id)}
                          aria-label={`Xóa bộ lọc ${p.name}`}
                          title="Xóa bộ lọc"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : (
        /* Admin SQL Console */
        <form onSubmit={handleRunSql} className="qb-panel" data-testid="sql-console-form">
          <div className="qb-panel-head">
            <h2 className="qb-panel-title">Truy vấn SQL chỉ-đọc (Admin Read-Only Console)</h2>
            <span className="qb-badge">SELECT · LIMIT 500 · TIMEOUT 3s</span>
          </div>
          <div className="qb-panel-body">
            <textarea
              aria-label="Câu lệnh SQL SELECT"
              className="qb-sql-textarea"
              rows={5}
              value={sqlText}
              onChange={(e) => setSqlText(e.target.value)}
            />
            <div className="qb-sql-meta">
              <span className="qb-sql-note">
                Mọi câu lệnh đều được thực thi qua quyền chỉ-đọc (Read-Only) và tự động ghi Audit Log.
              </span>
              <button type="submit" className="qb-btn qb-btn-primary" disabled={loading}>
                {loading ? "Đang chạy SQL..." : "Chạy SQL (Read-Only)"}
              </button>
            </div>

            {sqlResult && (
              <div className="qb-table-wrap" style={{ marginTop: 18 }} data-testid="sql-result-table">
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                  Kết quả SQL: {sqlResult.rowCount} dòng
                </div>
                <table className="qb-table">
                  <thead>
                    <tr>
                      {(sqlResult.columns || []).map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(sqlResult.rows || []).map((row, idx) => (
                      <tr key={idx}>
                        {(sqlResult.columns || []).map((c) => (
                          <td key={c}>{String(row[c] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
