import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/ui/EmptyState";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/ToastProvider";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import { formatNumber } from "../../../utils/formatters";
import getApiErrorMessage from "../../../utils/apiError";
import dnaService, { GENE_MARKERS } from "../dna.service";
import specimenService from "../../specimen/specimen.service";
import { getOrderColor } from "../../specimen/specimen.constants";

export default function DnaListPage() {
  const { t, i18n } = useTranslation();
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
            {t("dna.eyebrow")}
          </div>
          <h1>{t("dna.listTitle")}</h1>
          <p className="page-description">{t("dna.listDesc")}</p>
        </div>

        <div className="hero-actions" style={{ marginTop: 0 }}>
          <button type="button" className="button button-ghost" onClick={handleExportCsv}>
            <Icon name="file" size={16} />
            {t("dna.exportCsv")}
          </button>
          {isAdmin ? (
            <button
              type="button"
              className="button button-primary"
              onClick={() => navigate("/admin/dna/new")}
            >
              <Icon name="plus" size={16} />
              {t("dna.createTitle")}
            </button>
          ) : null}
        </div>
      </div>

      {/* KPI Metrics Strip */}
      {stats ? (
        <div className="metric-grid" style={{ marginBottom: 20 }}>
          <article className="card metric-card">
            <div className="metric-head">
              <span>{t("dna.totalFasta")}</span>
              <span className="metric-icon">
                <Icon name="dna" size={16} />
              </span>
            </div>
            <div className="metric-value">{formatNumber(stats.totalSequences || 0, i18n.language)}</div>
            <div className="metric-foot">
              {t("dna.distinctTaxa", { count: formatNumber(stats.distinctTaxa || 0, i18n.language) })}
            </div>
          </article>

          <article className="card metric-card">
            <div className="metric-head">
              <span>{t("dna.linkedSpecimens")}</span>
              <span className="metric-icon">
                <Icon name="bug" size={16} />
              </span>
            </div>
            <div className="metric-value">{formatNumber(stats.linkedSpecimens || 0, i18n.language)}</div>
            <div className="metric-foot">{t("dna.linkedGbif")}</div>
          </article>

          <article className="card metric-card">
            <div className="metric-head">
              <span>{t("dna.avgLength")}</span>
              <span className="metric-icon">
                <Icon name="chart" size={16} />
              </span>
            </div>
            <div className="metric-value">{stats.avgLengthBp || 0} bp</div>
            <div className="metric-foot">{t("dna.avgGc", { pct: stats.avgGcPct || 0 })}</div>
          </article>

          <article className="card metric-card">
            <div className="metric-head">
              <span>{t("specimen.matchingResults")}</span>
              <span className="metric-icon">
                <Icon name="filter" size={16} />
              </span>
            </div>
            <div className="metric-value">{formatNumber(pagination.total || 0, i18n.language)}</div>
            <div className="metric-foot">
              {t("specimen.pageOf", {
                page: pagination.page,
                total: Math.max(1, pagination.totalPages),
              })}
            </div>
          </article>
        </div>
      ) : null}

      {/* Filter Bar */}
      <section className="card panel" style={{ marginBottom: 18 }}>
        <div className="vi-filter-grid">
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="dna-q">{t("dna.keywordLabel")}</label>
            <input
              id="dna-q"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder={t("dna.keywordPlaceholder")}
            />
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="dna-marker">{t("dna.marker")}</label>
            <select
              id="dna-marker"
              value={filters.marker}
              onChange={(e) => updateFilter("marker", e.target.value)}
            >
              <option value="">{t("dna.allMarkers")}</option>
              {GENE_MARKERS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="dna-order">{t("specimen.order")}</label>
            <select
              id="dna-order"
              value={filters.order}
              onChange={(e) => updateFilter("order", e.target.value)}
            >
              <option value="">{t("specimen.allOrders")}</option>
              {orders.map((o) => (
                <option key={o.id} value={o.scientificName}>
                  {o.scientificName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="dna-src">{t("dna.sourceDb")}</label>
            <select
              id="dna-src"
              value={filters.sourceDb}
              onChange={(e) => updateFilter("sourceDb", e.target.value)}
            >
              <option value="">{t("dna.allSourceDb")}</option>
              <option value="NCBI">NCBI GenBank</option>
              <option value="BOLD">BOLD Systems</option>
              <option value="INTERNAL">{t("dna.internalSeq")}</option>
            </select>
          </div>
        </div>

        <div className="vi-filter-subbar">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <select
              className="vi-compact-select"
              value={filters.isOrphaned}
              onChange={(e) => updateFilter("isOrphaned", e.target.value)}
              aria-label={t("dna.colLinkedSpecimen")}
            >
              <option value="">{t("dna.allLinkStates")}</option>
              <option value="false">{t("dna.linkedFieldSpecimen")}</option>
              <option value="true">{t("dna.orphanedRefSeq")}</option>
            </select>

            {isAdmin ? (
              <select
                className="vi-compact-select"
                value={filters.isPublic}
                onChange={(e) => updateFilter("isPublic", e.target.value)}
                aria-label={t("specimen.sharingStatus")}
              >
                <option value="">{t("specimen.allSharing")}</option>
                <option value="true">{t("specimen.currentlyPublic")}</option>
                <option value="false">{t("specimen.currentlyPrivate")}</option>
              </select>
            ) : null}

            <button type="button" className="button button-sm button-ghost" onClick={resetFilters}>
              {t("specimen.resetFilters")}
            </button>
          </div>

          <select
            className="vi-compact-select"
            value={`${filters.sortBy}:${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split(":");
              setFilters((p) => ({ ...p, sortBy, sortOrder, page: 1 }));
            }}
            aria-label={t("search.sortBy")}
          >
            <option value="createdAt:desc">{t("dna.sortNewestSync")}</option>
            <option value="sequenceLengthBp:desc">{t("dna.sortLengthDesc")}</option>
            <option value="gcContentPct:desc">{t("dna.sortGcDesc")}</option>
            <option value="scientificName:asc">{t("specimen.sortNameAsc")}</option>
            <option value="submissionDate:desc">{t("dna.sortSubmissionDesc")}</option>
          </select>
        </div>
      </section>

      {/* Data Table */}
      <section className="card" style={{ overflow: "hidden" }}>
        {status === "loading" ? (
          <LoadingState label={t("dna.loadingList")} />
        ) : status === "error" ? (
          <EmptyState
            icon="alert"
            title={t("dna.loadErrorTitle")}
            description={errorMsg}
            action={
              <button className="button button-ghost" onClick={fetchList}>
                {t("specimen.retry")}
              </button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="dna"
            title={t("dna.emptyListTitle")}
            description={t("dna.emptyListDesc")}
            action={
              isAdmin ? (
                <button className="button button-primary" onClick={() => navigate("/admin/dna/new")}>
                  {t("dna.addFirstSeq")}
                </button>
              ) : (
                <button className="button button-ghost" onClick={resetFilters}>
                  {t("search.clearFilters")}
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
                    <th>{t("dna.colSpeciesMolecular")}</th>
                    <th>{t("specimen.order")}</th>
                    <th>Marker</th>
                    <th>{t("dna.colLengthGc")}</th>
                    <th>{t("dna.colLinkedSpecimen")}</th>
                    <th>{t("dna.colExternalLinks")}</th>
                    {isAdmin ? <th>{t("specimen.colVisibility")}</th> : null}
                    <th style={{ textAlign: "right" }}>{t("common.actions")}</th>
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
                              {t("dna.publishedDate", { date: item.submissionDate })}
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
                              {t("dna.standaloneRef")}
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
                            {t("dna.viewFasta")}
                          </Link>
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                className="icon-button"
                                title={t("common.edit")}
                                onClick={() => navigate(`/admin/dna/new?id=${item.id}`)}
                              >
                                <Icon name="edit" size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                style={{ color: "#B0241A" }}
                                title={t("common.delete")}
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
                {t("dna.showingDnaRange", {
                  from: (pagination.page - 1) * pagination.limit + 1,
                  to: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: formatNumber(pagination.total, i18n.language),
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="button button-sm button-ghost"
                  disabled={pagination.page <= 1}
                  onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
                >
                  {t("specimen.prevPage")}
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
                  {t("specimen.nextPage")}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t("dna.deleteDnaTitle")}
        message={
          pendingDelete
            ? t("dna.deleteDnaMessage", {
                name: pendingDelete.genbankAccession || pendingDelete.scientificName,
              })
            : ""
        }
        variant="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
