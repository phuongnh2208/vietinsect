import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/ui/EmptyState";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/ToastProvider";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import dnaService, { GENE_MARKERS } from "../dna.service";
import specimenService from "../../specimen/specimen.service";
import { getOrderColor } from "../../specimen/specimen.constants";

export default function DnaListPage() {
  const isAdmin = useIsAdminContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [qInput, setQInput] = useState(() => searchParams.get("q") || "");
  const [filters, setFilters] = useState(() => ({
    q: searchParams.get("q") || "",
    marker: searchParams.get("marker") || "",
    order: searchParams.get("order") || "",
    sourceDb: "",
    isOrphaned: "",
    isPublic: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    page: 1,
    limit: 25,
  }));

  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 0 });
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  const debounceRef = useRef(null);

  const refreshStats = useCallback(() => {
    dnaService.getDnaStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    specimenService
      .getLookups()
      .then((res) => setOrders(res.orders || []))
      .catch(() => {});
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => (prev.q === qInput.trim() ? prev : { ...prev, q: qInput.trim(), page: 1 }));
    }, 320);
    return () => clearTimeout(debounceRef.current);
  }, [qInput]);

  const fetchList = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const params = {
        ...filters,
        isOrphaned: filters.isOrphaned !== "" ? filters.isOrphaned === "true" : undefined,
        isPublic: isAdmin && filters.isPublic !== "" ? filters.isPublic === "true" : undefined,
      };
      const res = await dnaService.getDnaList(params);
      setItems(res.items);
      setPagination(res.pagination);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Không thể tải kho dữ liệu trình tự DNA");
      setStatus("error");
    }
  }, [filters, isAdmin]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const next = {};
    if (filters.q) next.q = filters.q;
    if (filters.marker) next.marker = filters.marker;
    if (filters.order) next.order = filters.order;
    setSearchParams(next, { replace: true });
  }, [filters.q, filters.marker, filters.order, setSearchParams]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const resetFilters = () => {
    setQInput("");
    setFilters({
      q: "",
      marker: "",
      order: "",
      sourceDb: "",
      isOrphaned: "",
      isPublic: "",
      sortBy: "createdAt",
      sortOrder: "desc",
      page: 1,
      limit: 25,
    });
  };

  const handleTogglePublic = async (item) => {
    try {
      const updated = await dnaService.togglePublic(item.id, !item.isPublic);
      setItems((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, isPublic: updated.isPublic } : r)),
      );
      toast(
        `Đã chuyển trình tự ${item.genbankAccession || `#${item.id}`} sang ${
          updated.isPublic ? "Công khai" : "Nội bộ"
        }`,
        "success",
      );
      refreshStats();
    } catch (err) {
      toast(err.response?.data?.message || "Không thể đổi trạng thái", "error");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    try {
      await dnaService.deleteDna(pendingDelete.id);
      toast(
        `Đã xóa bản ghi trình tự ${pendingDelete.genbankAccession || `#${pendingDelete.id}`}`,
        "success",
      );
      setPendingDelete(null);
      fetchList();
      refreshStats();
    } catch (err) {
      toast(err.response?.data?.message || "Không thể xóa bản ghi DNA", "error");
    }
  };

  const handleExportCsv = () => {
    if (items.length === 0) {
      toast("Không có dữ liệu trên trang để xuất CSV", "warning");
      return;
    }
    const headers = [
      "ID",
      "GenBankAccession",
      "BOLDProcessID",
      "ScientificName",
      "Order",
      "GeneMarker",
      "LengthBp",
      "GC_Percent",
      "SourceDB",
      "LinkedSpecimen",
      "SubmissionDate",
    ];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      headers.join(","),
      ...items.map((r) =>
        [
          r.id,
          r.genbankAccession,
          r.boldProcessId,
          r.scientificName,
          r.orderName,
          r.geneMarker,
          r.sequenceLengthBp,
          r.gcContentPct,
          r.sourceDb,
          r.specimenCode,
          r.submissionDate,
        ]
          .map(esc)
          .join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vietinsect-dna-p${pagination.page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast(`Đã xuất ${items.length} bản ghi DNA ra CSV`, "success");
  };

  const fastaBasePath = isAdmin ? "/admin/dna" : "/dna";
  const specimenBasePath = isAdmin ? "/admin/specimens" : "/specimens";

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name="dna" size={14} />
            Dữ liệu Phân tử DNA & GenBank / BOLD
          </div>
          <h1>Kho lưu trữ trình tự mã vạch DNA</h1>
          <p className="page-description">
            Tra cứu các trình tự gen ty thể và nhân (COI, 16S, 18S, ITS2, CytB), đối chiếu mã định danh
            quốc tế NCBI GenBank / BOLD Systems và liên kết trực tiếp về mẫu vật thực địa tại Việt Nam.
          </p>
        </div>

        <div className="hero-actions" style={{ marginTop: 0 }}>
          <button type="button" className="button button-ghost" onClick={handleExportCsv}>
            <Icon name="file" size={16} />
            Xuất bảng CSV
          </button>
          {isAdmin ? (
            <button
              type="button"
              className="button button-primary"
              onClick={() => navigate("/admin/dna/new")}
            >
              <Icon name="plus" size={16} />
              Thêm trình tự DNA
            </button>
          ) : null}
        </div>
      </div>

      {/* KPI Metrics Strip */}
      {stats ? (
        <div className="metric-grid" style={{ marginBottom: 20 }}>
          <article className="card metric-card">
            <div className="metric-head">
              <span>Tổng chuỗi FASTA</span>
              <span className="metric-icon">
                <Icon name="dna" size={16} />
              </span>
            </div>
            <div className="metric-value">{(stats.totalSequences || 0).toLocaleString()}</div>
            <div className="metric-foot">
              {(stats.distinctTaxa || 0).toLocaleString()} loài / taxon phân tử
            </div>
          </article>

          <article className="card metric-card">
            <div className="metric-head">
              <span>Liên kết mẫu vật VN</span>
              <span className="metric-icon">
                <Icon name="bug" size={16} />
              </span>
            </div>
            <div className="metric-value">{(stats.linkedSpecimens || 0).toLocaleString()}</div>
            <div className="metric-foot">Khớp trực tiếp kho mẫu vật GBIF</div>
          </article>

          <article className="card metric-card">
            <div className="metric-head">
              <span>Chiều dài trung bình</span>
              <span className="metric-icon">
                <Icon name="chart" size={16} />
              </span>
            </div>
            <div className="metric-value">{stats.avgLengthBp || 0} bp</div>
            <div className="metric-foot">Tỷ lệ G-C TB: {stats.avgGcPct || 0}%</div>
          </article>

          <article className="card metric-card">
            <div className="metric-head">
              <span>Kết quả khớp lọc</span>
              <span className="metric-icon">
                <Icon name="filter" size={16} />
              </span>
            </div>
            <div className="metric-value">{(pagination.total || 0).toLocaleString()}</div>
            <div className="metric-foot">
              Trang {pagination.page} / {Math.max(1, pagination.totalPages)}
            </div>
          </article>
        </div>
      ) : null}

      {/* Filter Bar */}
      <section className="card panel" style={{ marginBottom: 18 }}>
        <div className="vi-filter-grid">
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="dna-q">Từ khóa (Accession, BOLD ID, Tên loài, Mã mẫu vật)</label>
            <input
              id="dna-q"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="VD: AF469881, Papilio, Anopheles..."
            />
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="dna-marker">Chỉ thị Gen (Gene Marker)</label>
            <select
              id="dna-marker"
              value={filters.marker}
              onChange={(e) => updateFilter("marker", e.target.value)}
            >
              <option value="">Tất cả Marker</option>
              {GENE_MARKERS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="dna-order">Bộ côn trùng (Order)</label>
            <select
              id="dna-order"
              value={filters.order}
              onChange={(e) => updateFilter("order", e.target.value)}
            >
              <option value="">Tất cả 16 Bộ</option>
              {orders.map((o) => (
                <option key={o.id} value={o.scientificName}>
                  {o.scientificName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="dna-src">Nguồn cơ sở dữ liệu</label>
            <select
              id="dna-src"
              value={filters.sourceDb}
              onChange={(e) => updateFilter("sourceDb", e.target.value)}
            >
              <option value="">Tất cả (NCBI + BOLD + Nội bộ)</option>
              <option value="NCBI">NCBI GenBank</option>
              <option value="BOLD">BOLD Systems</option>
              <option value="INTERNAL">Giải trình tự nội bộ</option>
            </select>
          </div>
        </div>

        <div className="vi-filter-subbar">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <select
              className="vi-compact-select"
              value={filters.isOrphaned}
              onChange={(e) => updateFilter("isOrphaned", e.target.value)}
              aria-label="Trạng thái liên kết mẫu vật"
            >
              <option value="">Tất cả trạng thái liên kết</option>
              <option value="false">Đã liên kết mẫu vật thực địa</option>
              <option value="true">Chuỗi tham chiếu độc lập (Orphaned)</option>
            </select>

            {isAdmin ? (
              <select
                className="vi-compact-select"
                value={filters.isPublic}
                onChange={(e) => updateFilter("isPublic", e.target.value)}
                aria-label="Trạng thái chia sẻ"
              >
                <option value="">Tất cả (Public + Private)</option>
                <option value="true">Đang Công khai</option>
                <option value="false">Đang Ẩn nội bộ</option>
              </select>
            ) : null}

            <button type="button" className="button button-sm button-ghost" onClick={resetFilters}>
              Đặt lại bộ lọc
            </button>
          </div>

          <select
            className="vi-compact-select"
            value={`${filters.sortBy}:${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split(":");
              setFilters((p) => ({ ...p, sortBy, sortOrder, page: 1 }));
            }}
            aria-label="Sắp xếp theo"
          >
            <option value="createdAt:desc">Mới đồng bộ / nhập gần nhất</option>
            <option value="sequenceLengthBp:desc">Chiều dài chuỗi (Dài → Ngắn)</option>
            <option value="gcContentPct:desc">Tỷ lệ G-C % (Cao → Thấp)</option>
            <option value="scientificName:asc">Tên khoa học (A → Z)</option>
            <option value="submissionDate:desc">Ngày công bố GenBank</option>
          </select>
        </div>
      </section>

      {/* Data Table */}
      <section className="card" style={{ overflow: "hidden" }}>
        {status === "loading" ? (
          <LoadingState label="Đang tải danh sách trình tự nucleotide..." />
        ) : status === "error" ? (
          <EmptyState
            icon="alert"
            title="Không thể tải dữ liệu DNA"
            description={errorMsg}
            action={
              <button className="button button-ghost" onClick={fetchList}>
                Thử lại
              </button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="dna"
            title="Chưa có trình tự DNA khớp điều kiện"
            description="Hãy thử xóa bộ lọc hoặc nhập mới từ mã GenBank Accession."
            action={
              isAdmin ? (
                <button className="button button-primary" onClick={() => navigate("/admin/dna/new")}>
                  + Thêm chuỗi DNA đầu tiên
                </button>
              ) : (
                <button className="button button-ghost" onClick={resetFilters}>
                  Xóa bộ lọc
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="vi-table-scroll">
              <table className="vi-data-table">
                <thead>
                  <tr>
                    <th>GenBank / BOLD ID</th>
                    <th>Loài / Định danh phân tử</th>
                    <th>Bộ (Order)</th>
                    <th>Marker</th>
                    <th>Độ dài & G-C%</th>
                    <th>Mẫu vật liên kết</th>
                    <th>Liên kết quốc tế</th>
                    {isAdmin ? <th>Hiển thị</th> : null}
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const orderColor = getOrderColor(item.orderName);
                    return (
                      <tr key={item.id}>
                        <td>
                          <Link
                            to={`${fastaBasePath}/${item.id}/fasta`}
                            className="vi-code-link"
                          >
                            {item.genbankAccession || item.boldProcessId || `DNA-${item.id}`}
                          </Link>
                          {item.boldProcessId && item.genbankAccession ? (
                            <div style={{ fontSize: 11, color: "var(--vi-muted)", marginTop: 2 }}>
                              BOLD: {item.boldProcessId}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <Link
                            to={`${fastaBasePath}/${item.id}/fasta`}
                            className="taxonomy-name"
                            style={{ display: "block", fontSize: 14 }}
                          >
                            {item.scientificName}
                          </Link>
                          {item.submissionDate ? (
                            <span style={{ fontSize: 11, color: "var(--vi-muted)" }}>
                              Công bố: {item.submissionDate}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <span
                            className="status-badge"
                            style={{
                              background: orderColor,
                              color: "#FFFFFF",
                              borderColor: "#111111",
                            }}
                          >
                            {item.orderName || item.taxonName}
                          </span>
                        </td>
                        <td>
                          <span
                            className="status-badge"
                            style={{ background: "#E8F5E9", color: "#0F3820" }}
                          >
                            {item.geneMarker}
                          </span>
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>
                          <strong>{item.sequenceLengthBp ? `${item.sequenceLengthBp} bp` : "—"}</strong>
                          {item.gcContentPct != null ? (
                            <div style={{ color: "var(--vi-muted)", fontSize: 11 }}>
                              GC: {item.gcContentPct}%
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {item.specimenId && item.specimenCode ? (
                            <Link
                              to={`${specimenBasePath}/${item.specimenId}`}
                              className="vi-code-link"
                            >
                              {item.specimenCode}
                            </Link>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--vi-muted)" }}>
                              Tham chiếu độc lập
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {item.externalLinks?.ncbi ? (
                              <a
                                href={item.externalLinks.ncbi}
                                target="_blank"
                                rel="noreferrer"
                                className="status-badge"
                                style={{ background: "#FFFFFF" }}
                              >
                                NCBI ↗
                              </a>
                            ) : null}
                            {item.externalLinks?.bold ? (
                              <a
                                href={item.externalLinks.bold}
                                target="_blank"
                                rel="noreferrer"
                                className="status-badge"
                                style={{ background: "#FFFFFF" }}
                              >
                                BOLD ↗
                              </a>
                            ) : null}
                          </div>
                        </td>
                        {isAdmin ? (
                          <td>
                            <button
                              type="button"
                              onClick={() => handleTogglePublic(item)}
                              className={`status-badge ${
                                item.isPublic ? "status-public" : "status-private"
                              }`}
                              style={{ cursor: "pointer" }}
                            >
                              {item.isPublic ? "PUBLIC" : "PRIVATE"}
                            </button>
                          </td>
                        ) : null}
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <Link
                            to={`${fastaBasePath}/${item.id}/fasta`}
                            className="button button-sm button-secondary"
                            style={{ marginRight: isAdmin ? 6 : 0 }}
                          >
                            Xem FASTA
                          </Link>
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                className="icon-button"
                                title="Chỉnh sửa trình tự"
                                onClick={() => navigate(`/admin/dna/new?id=${item.id}`)}
                              >
                                <Icon name="edit" size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                style={{ color: "#B0241A" }}
                                title="Xóa trình tự"
                                onClick={() => setPendingDelete(item)}
                              >
                                <Icon name="close" size={15} />
                              </button>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="vi-pagination-bar">
              <div style={{ fontSize: 13, color: "var(--vi-muted)" }}>
                Hiển thị{" "}
                <strong>
                  {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </strong>{" "}
                trên tổng số <strong>{pagination.total.toLocaleString()}</strong> trình tự DNA
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="button button-sm button-ghost"
                  disabled={pagination.page <= 1}
                  onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
                >
                  ← Trang trước
                </button>
                <span style={{ fontSize: 13, fontWeight: 800, padding: "0 8px" }}>
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  className="button button-sm button-ghost"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
                >
                  Trang sau →
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Xóa bản ghi trình tự DNA?"
        message={
          pendingDelete
            ? `Bạn có chắc muốn xóa trình tự ${
                pendingDelete.genbankAccession || pendingDelete.scientificName
              }? Thao tác này không xóa mẫu vật thực địa liên kết.`
            : ""
        }
        variant="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
