import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/ToastProvider";
import http from "../../../services/http";

/**
 * SCR-29 · Kiểm soát Chia sẻ Công khai (Public / Private Control)
 *
 * Trang danh sách tập trung trạng thái hiển thị của từng bản ghi mẫu vật.
 * Toggle Public/Private từng bản ghi hoặc chọn lô batch update.
 * Preview giao diện User sẽ thấy sau khi toggle.
 */
export default function PublicPrivateControlPage() {
  const { toast } = useToast();

  // ── Filters ──────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterPublic, setFilterPublic] = useState(""); // "" | "true" | "false"
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // ── Data ─────────────────────────────────────────────────────────
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  // ── Selection ────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState([]);

  // ── Preview ──────────────────────────────────────────────────────
  const [previewItem, setPreviewItem] = useState(null);

  // ── Toggling state (disable buttons while in-flight) ─────────────
  const [togglingIds, setTogglingIds] = useState(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const debounceRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // ── Fetch ────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const params = { page, limit };
      if (debouncedSearch) params.q = debouncedSearch;
      if (filterPublic !== "") params.isPublic = filterPublic === "true";
      const { data } = await http.get("/specimens", { params });
      setItems(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 50, totalPages: 0 });
      setSelectedIds([]);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Không thể tải danh sách mẫu vật");
      setStatus("error");
    }
  }, [page, limit, debouncedSearch, filterPublic]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ── Selection helpers ────────────────────────────────────────────
  const allChecked = useMemo(
    () => items.length > 0 && items.every((item) => selectedIds.includes(item.id)),
    [items, selectedIds],
  );

  const toggleSelectAll = () => {
    if (allChecked) setSelectedIds([]);
    else setSelectedIds(items.map((item) => item.id));
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // ── Single toggle ───────────────────────────────────────────────
  const handleToggle = async (item) => {
    const nextPublic = !item.isPublic;
    setTogglingIds((prev) => new Set(prev).add(item.id));
    try {
      const { data } = await http.patch(`/specimens/${item.id}/public`, { isPublic: nextPublic });
      const updated = data.data;
      setItems((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, isPublic: updated.isPublic } : r)),
      );
      toast(
        `Đã chuyển ${item.specimenCode} sang ${updated.isPublic ? "Công khai" : "Riêng tư"}`,
        "success",
      );
    } catch (err) {
      toast(err.response?.data?.message || "Không thể đổi trạng thái hiển thị", "error");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // ── Batch toggle ────────────────────────────────────────────────
  const handleBatch = async (nextPublic) => {
    if (selectedIds.length === 0) return;
    setBatchLoading(true);
    try {
      const { data } = await http.patch("/specimens/batch-public", {
        specimenIds: selectedIds,
        isPublic: nextPublic,
      });
      toast(
        `Đã cập nhật ${data.data?.updatedCount ?? selectedIds.length} mẫu vật thành ${nextPublic ? "Công khai" : "Riêng tư"}`,
        "success",
      );
      fetchList();
    } catch (err) {
      toast(err.response?.data?.message || "Lỗi cập nhật hàng loạt", "error");
    } finally {
      setBatchLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="page-container page-content vi-page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name="lock" size={14} />
            Kiểm soát Chia sẻ Công khai
          </div>
          <h1>Quản lý Trạng thái Hiển thị Mẫu vật</h1>
          <p className="page-description">
            Toggle trạng thái Public / Private từng bản ghi hoặc chọn lô để cập nhật hàng loạt.
            Xem trước giao diện công khai trước khi chia sẻ.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <section className="card panel" style={{ marginBottom: 18 }}>
        <div className="vi-filter-grid" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div className="form-field" style={{ marginBottom: 0, flex: "1 1 280px" }}>
            <label htmlFor="flt-search">Tìm kiếm (Mã mẫu, Tên khoa học, Địa điểm)</label>
            <div style={{ position: "relative" }}>
              <input
                id="flt-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="VD: Papilio, GBIF-, Cúc Phương..."
              />
              {search ? (
                <button
                  type="button"
                  className="icon-button"
                  style={{ position: "absolute", right: 4, top: 4, width: 32, height: 32 }}
                  onClick={() => setSearch("")}
                  aria-label="Xóa từ khóa"
                >
                  <Icon name="close" size={14} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="form-field" style={{ marginBottom: 0, flex: "0 0 220px" }}>
            <label htmlFor="flt-status">Trạng thái hiển thị</label>
            <select
              id="flt-status"
              value={filterPublic}
              onChange={(e) => { setFilterPublic(e.target.value); setPage(1); }}
            >
              <option value="">Tất cả (Public + Private)</option>
              <option value="true">Công khai (Public)</option>
              <option value="false">Riêng tư (Private)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Batch Action Bar */}
      {selectedIds.length > 0 ? (
        <div className="vi-batch-bar">
          <strong>Đã chọn {selectedIds.length} mẫu vật</strong>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="button button-sm button-secondary"
              disabled={batchLoading}
              onClick={() => handleBatch(true)}
            >
              <Icon name="check" size={14} />
              Đánh dấu Công khai ({selectedIds.length})
            </button>
            <button
              type="button"
              className="button button-sm button-warning"
              disabled={batchLoading}
              onClick={() => handleBatch(false)}
            >
              Đánh dấu Riêng tư ({selectedIds.length})
            </button>
            <button
              type="button"
              className="button button-sm button-ghost"
              onClick={() => setSelectedIds([])}
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      ) : null}

      {/* Data Table */}
      <section className="card" style={{ overflow: "hidden" }}>
        {status === "loading" ? (
          <LoadingState label="Đang tải danh sách mẫu vật..." />
        ) : status === "error" ? (
          <EmptyState
            icon="alert"
            title="Lỗi truy vấn dữ liệu"
            description={errorMsg}
            action={
              <button className="button button-ghost" onClick={fetchList}>
                Thử lại
              </button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="search"
            title="Không tìm thấy mẫu vật phù hợp"
            description="Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
            action={
              <button
                className="button button-ghost"
                onClick={() => { setSearch(""); setFilterPublic(""); setPage(1); }}
              >
                Xóa bộ lọc
              </button>
            }
          />
        ) : (
          <>
            <div className="vi-table-scroll">
              <table className="vi-data-table">
                <thead>
                  <tr>
                    <th style={{ width: 42 }}>
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={toggleSelectAll}
                        aria-label="Chọn tất cả trang này"
                      />
                    </th>
                    <th>Mã mẫu</th>
                    <th>Tên khoa học</th>
                    <th>Tỉnh / Thành phố</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "center" }}>Toggle</th>
                    <th style={{ textAlign: "center" }}>Xem trước</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelectOne(item.id)}
                          aria-label={`Chọn ${item.specimenCode}`}
                        />
                      </td>
                      <td>
                        <span className="vi-code-link">{item.specimenCode}</span>
                      </td>
                      <td>
                        <span className="taxonomy-name" style={{ fontSize: 14 }}>
                          {item.scientificName}
                        </span>
                        {item.commonNameVn ? (
                          <div style={{ fontSize: 12, color: "var(--vi-muted)" }}>
                            {item.commonNameVn}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {item.provinceNameVn || "—"}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${item.isPublic ? "status-public" : "status-private"}`}
                          style={{
                            background: item.isPublic ? "var(--bs-success, #198754)" : "var(--bs-warning, #ffc107)",
                            color: item.isPublic ? "#fff" : "#212529",
                            padding: "3px 10px",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {item.isPublic ? "Public" : "Private"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="button button-sm button-ghost"
                          disabled={togglingIds.has(item.id)}
                          onClick={() => handleToggle(item)}
                          title={item.isPublic ? "Chuyển sang Riêng tư" : "Chuyển sang Công khai"}
                          style={{ minWidth: 44 }}
                        >
                          {togglingIds.has(item.id) ? (
                            <span style={{ fontSize: 12 }}>…</span>
                          ) : (
                            <Icon name={item.isPublic ? "lock" : "check"} size={15} />
                          )}
                        </button>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="button button-sm button-ghost"
                          onClick={() => setPreviewItem(item)}
                          title="Xem trước giao diện User"
                        >
                          <Icon name="search" size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="vi-pagination-bar">
              <div style={{ fontSize: 13, color: "var(--vi-muted)" }}>
                Hiển thị{" "}
                <strong>
                  {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </strong>{" "}
                trên tổng số <strong>{(pagination.total || 0).toLocaleString()}</strong> mẫu vật
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  className="vi-compact-select"
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  aria-label="Số dòng mỗi trang"
                >
                  <option value={25}>25 / trang</option>
                  <option value={50}>50 / trang</option>
                  <option value={100}>100 / trang</option>
                </select>
                <button
                  type="button"
                  className="button button-sm button-ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Trang trước
                </button>
                <span style={{ fontSize: 13, fontWeight: 800, padding: "0 8px" }}>
                  {pagination.page} / {Math.max(1, pagination.totalPages)}
                </span>
                <button
                  type="button"
                  className="button button-sm button-ghost"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Trang sau →
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Preview Modal – giao diện User sẽ thấy */}
      {previewItem ? (
        <div className="dialog-backdrop" onClick={() => setPreviewItem(null)}>
          <div
            className="dialog-card"
            style={{ width: "min(640px, 94vw)", maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button dialog-close"
              onClick={() => setPreviewItem(null)}
              aria-label="Đóng"
            >
              <Icon name="close" size={18} />
            </button>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              <Icon name="search" size={14} />
              Xem trước giao diện công khai
            </div>
            <h2 style={{ marginTop: 4, marginBottom: 16 }}>
              {previewItem.specimenCode}
            </h2>

            {previewItem.isPublic ? (
              <div>
                <table className="vi-data-table" style={{ marginBottom: 16 }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, width: 180 }}>Mã mẫu vật</td>
                      <td>{previewItem.specimenCode}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>Tên khoa học</td>
                      <td className="taxonomy-name">{previewItem.scientificName}</td>
                    </tr>
                    {previewItem.commonNameVn ? (
                      <tr>
                        <td style={{ fontWeight: 700 }}>Tên tiếng Việt</td>
                        <td>{previewItem.commonNameVn}</td>
                      </tr>
                    ) : null}
                    <tr>
                      <td style={{ fontWeight: 700 }}>Bộ / Họ</td>
                      <td>
                        {previewItem.orderName || "—"}{previewItem.familyName ? ` / ${previewItem.familyName}` : ""}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>Tỉnh / Thành phố</td>
                      <td>{previewItem.provinceNameVn || "—"}</td>
                    </tr>
                    {previewItem.collectionDate ? (
                      <tr>
                        <td style={{ fontWeight: 700 }}>Ngày thu mẫu</td>
                        <td>{previewItem.collectionDate}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                <span
                  className="status-badge"
                  style={{
                    background: "var(--bs-success, #198754)",
                    color: "#fff",
                    padding: "4px 12px",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  ✓ Hiển thị công khai cho người dùng
                </span>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Icon name="lock" size={48} />
                <p style={{ color: "var(--vi-muted)", marginTop: 12, fontSize: 15 }}>
                  Bản ghi này đang ở chế độ <strong>Riêng tư</strong>.
                  <br />
                  Người dùng công khai sẽ <strong>không</strong> thấy mẫu vật này.
                </p>
                <span
                  className="status-badge"
                  style={{
                    background: "var(--bs-warning, #ffc107)",
                    color: "#212529",
                    padding: "4px 12px",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Riêng tư – Không hiển thị
                </span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
