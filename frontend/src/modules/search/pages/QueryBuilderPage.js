import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import http from "../../../services/http";
import useAuthStore from "../../../stores/auth.store";

const FIELDS = [
  { value: "scientificName", label: "Tên khoa học (scientificName)", type: "text" },
  { value: "commonNameVn", label: "Tên tiếng Việt (commonNameVn)", type: "text" },
  { value: "specimenCode", label: "Mã mẫu vật (specimenCode)", type: "text" },
  { value: "order", label: "Bộ (Order)", type: "text" },
  { value: "family", label: "Họ (Family)", type: "text" },
  { value: "genus", label: "Giống (Genus)", type: "text" },
  { value: "province", label: "Tỉnh / Thành phố", type: "text" },
  { value: "iucnStatus", label: "Trạng thái IUCN", type: "text" },
  { value: "elevationM", label: "Độ cao (m)", type: "number" },
  { value: "bodyLengthMm", label: "Kích thước cơ thể (mm)", type: "number" },
  { value: "collectionDate", label: "Ngày thu mẫu (YYYY-MM-DD)", type: "date" },
  { value: "recordedBy", label: "Người thu mẫu", type: "text" },
  { value: "notes", label: "Ghi chú", type: "text" },
];

const OPERATORS = [
  { value: "contains", label: "Chứa (CONTAINS)" },
  { value: "eq", label: "Bằng (=)" },
  { value: "neq", label: "Khác (≠)" },
  { value: "between", label: "Trong khoảng (Từ ... Đến ...)" },
  { value: "gte", label: "Lớn hơn hoặc bằng (≥)" },
  { value: "lte", label: "Nhỏ hơn hoặc bằng (≤)" },
];

const LOCAL_PRESET_KEY = "vietinsect_scr16_saved_filters";

/**
 * QueryBuilderPage — Màn hình SCR-16 Tìm kiếm nâng cao (F-SR-04, C-04):
 * - Mở cho cả Admin và User (/search/advanced & /admin/search/advanced)
 * - Query Builder AND/OR/NOT trực quan, khoảng giá trị số/ngày (between)
 * - Lưu/tải bộ lọc (Admin lưu DB qua /api/search/filters; User lưu localStorage)
 * - Chế độ SQL trực tiếp CHỈ hiển thị và cho phép Admin
 */
export default function QueryBuilderPage() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const isAdmin = Boolean(isAuthenticated && (user?.role === "admin" || location.pathname.startsWith("/admin")));
  const detailBase = isAdmin ? "/admin/specimens" : "/specimens";

  const [mode, setMode] = useState("builder"); // "builder" | "sql" (sql only if isAdmin)
  const [rules, setRules] = useState([
    { id: 1, logic: "AND", field: "scientificName", operator: "contains", value: "", valueTo: "" },
  ]);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
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
    setRules((prev) => [
      ...prev,
      { id: Date.now() + prev.length, logic: "AND", field: "scientificName", operator: "contains", value: "", valueTo: "" },
    ]);
  };

  const removeRule = (id) => {
    setRules((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const updateRule = (id, patch) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleRunBuilder = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await http.post("/search/advanced", { rules, page: 1, limit: 25 });
      setResults(data?.data || []);
      setTotal(data?.pagination?.total || 0);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Lỗi thực thi truy vấn nâng cao");
    } finally {
      setLoading(false);
    }
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

  const handleApplyPreset = (preset) => {
    const parsed =
      typeof preset.filterJson === "string" ? JSON.parse(preset.filterJson) : preset.filterJson;
    if (Array.isArray(parsed?.rules) && parsed.rules.length > 0) {
      setRules(parsed.rules);
    }
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

  return (
    <section className="page-container" data-testid="scr16-query-builder-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">SCR-16 · TÌM KIẾM NÂNG CAO & TRÌNH XÂY DỰNG TRUY VẤN (F-SR-04)</span>
          <h1>Trình xây dựng truy vấn nâng cao (AND / OR / NOT)</h1>
          <p className="subtitle">
            Kết hợp nhiều điều kiện logic AND/OR/NOT, lọc khoảng độ cao/kích thước/ngày thu mẫu và lưu cấu hình bộ lọc.
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8 }} data-testid="admin-mode-tabs">
            <button
              type="button"
              className={`button ${mode === "builder" ? "button-primary" : "button-ghost"}`}
              onClick={() => setMode("builder")}
            >
              Visual Query Builder
            </button>
            <button
              type="button"
              data-testid="tab-sql-mode"
              className={`button ${mode === "sql" ? "button-primary" : "button-ghost"}`}
              onClick={() => setMode("sql")}
            >
              Chế độ SQL trực tiếp (Admin)
            </button>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="card" style={{ padding: 12, marginBottom: 16, background: "#FEF2F2", color: "#B91C1C" }}>
          {error}
        </div>
      )}

      {mode === "builder" || !isAdmin ? (
        <form onSubmit={handleRunBuilder} className="card" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: "grid", gap: 10 }}>
            {rules.map((r, idx) => (
              <div
                key={r.id}
                data-testid={`qb-rule-${idx}`}
                style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
              >
                <select
                  aria-label={`Toán tử logic dòng ${idx + 1}`}
                  value={r.logic}
                  onChange={(e) => updateRule(r.id, { logic: e.target.value })}
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                  <option value="NOT">NOT</option>
                </select>

                <select
                  aria-label={`Trường dữ liệu dòng ${idx + 1}`}
                  value={r.field}
                  onChange={(e) => updateRule(r.id, { field: e.target.value })}
                >
                  {FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <select
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

                <input
                  type="text"
                  aria-label={`Giá trị dòng ${idx + 1}`}
                  placeholder={r.operator === "between" ? "Từ giá trị..." : "Nhập giá trị..."}
                  value={r.value}
                  onChange={(e) => updateRule(r.id, { value: e.target.value })}
                />

                {r.operator === "between" && (
                  <input
                    type="text"
                    aria-label={`Giá trị đến dòng ${idx + 1}`}
                    placeholder="Đến giá trị..."
                    value={r.valueTo || ""}
                    onChange={(e) => updateRule(r.id, { valueTo: e.target.value })}
                  />
                )}

                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => removeRule(r.id)}
                  aria-label={`Xóa điều kiện dòng ${idx + 1}`}
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="button button-secondary" onClick={addRule}>
                + Thêm điều kiện
              </button>
              <button type="submit" className="button button-primary" disabled={loading}>
                {loading ? "Đang truy vấn..." : "Thực thi truy vấn"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                aria-label="Tên bộ lọc cần lưu"
                placeholder="Tên bộ lọc..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
              <button type="button" className="button button-ghost" onClick={handleSavePreset}>
                Lưu bộ lọc
              </button>
            </div>
          </div>

          {savedFilters.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>Bộ lọc đã lưu:</span>
              {savedFilters.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="button button-ghost"
                  style={{ fontSize: 12, padding: "2px 8px" }}
                  onClick={() => handleApplyPreset(p)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={handleRunSql} className="card" data-testid="sql-console-form" style={{ padding: 18, marginBottom: 20 }}>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
            Truy vấn SQL chỉ-đọc (SELECT, giới hạn 500 dòng, timeout 3s, ghi Audit Log):
          </label>
          <textarea
            aria-label="Câu lệnh SQL SELECT"
            rows={4}
            value={sqlText}
            onChange={(e) => setSqlText(e.target.value)}
            style={{ width: "100%", fontFamily: "monospace", padding: 10 }}
          />
          <div style={{ marginTop: 10 }}>
            <button type="submit" className="button button-primary" disabled={loading}>
              Chạy SQL (Read-Only)
            </button>
          </div>
          {sqlResult && (
            <div style={{ marginTop: 14, overflowX: "auto" }} data-testid="sql-result-table">
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Kết quả SQL: {sqlResult.rowCount} dòng
              </div>
              <table>
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
        </form>
      )}

      {/* Results table for Query Builder */}
      {mode === "builder" && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>
            Kết quả tìm kiếm nâng cao: {total} mẫu vật
          </div>
          {results.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: 13 }}>Chưa có kết quả hoặc nhấn "Thực thi truy vấn".</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Mã mẫu</th>
                  <th>Tên khoa học</th>
                  <th>Tên tiếng Việt</th>
                  <th>Tỉnh/Thành</th>
                  <th>Độ cao (m)</th>
                  <th>Ngày thu</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`${detailBase}/${item.id}`}>{item.specimenCode}</Link>
                    </td>
                    <td>
                      <em>{item.scientificName}</em>
                    </td>
                    <td>{item.commonNameVn || "—"}</td>
                    <td>{item.provinceNameVn || "—"}</td>
                    <td>{item.elevationM ?? "—"}</td>
                    <td>{item.collectionDate ? String(item.collectionDate).slice(0, 10) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
