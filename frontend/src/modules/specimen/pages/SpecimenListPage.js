import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import specimenService from "../specimen.service";
import SpecimenForm from "../components/SpecimenForm";
import {
  BASIS_OF_RECORD_LABELS,
  formatBasisOfRecord,
  getOrderColor,
  SPATIAL_PRESETS,
} from "../specimen.constants";

export default function SpecimenListPage() {
  const { t, i18n } = useTranslation();
  const isAdmin = useIsAdminContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  // State bộ lọc đọc khởi tạo từ URL query
  const [qInput, setQInput] = useState(() => searchParams.get("q") || "");
  const [filters, setFilters] = useState(() => ({
    q: searchParams.get("q") || "",
    taxonId: searchParams.get("taxonId") || "",
    order: searchParams.get("order") || "",
    provinceId: searchParams.get("provinceId") || "",
    basisOfRecord: searchParams.get("basisOfRecord") || "",
    isPublic: "",
    dateFrom: "",
    dateTo: "",
    lat: "",
    lon: "",
    radiusKm: 25,
    sortBy: "collectionDate",
    sortOrder: "desc",
    page: 1,
    limit: 25,
  }));

  const [showSpatialFilter, setShowSpatialFilter] = useState(false);
  const [lookups, setLookups] = useState({ orders: [], provinces: [] });
  const [stats, setStats] = useState(null);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 0 });
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  // Admin selection & modals
  const [selectedIds, setSelectedIds] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [visibleCols, setVisibleCols] = useState({
    basis: true,
    coords: true,
    collector: false,
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);

  const debounceRef = useRef(null);

  // Tải danh mục & thống kê tổng quan
  const refreshStats = useCallback(() => {
    specimenService.getStats().then(setStats).catch(() => { });
  }, []);

  useEffect(() => {
    specimenService.getLookups().then(setLookups).catch(() => { });
    refreshStats();
  }, [refreshStats]);

  // Debounce ô tìm kiếm từ khóa
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => {
        if (prev.q === qInput.trim()) return prev;
        return { ...prev, q: qInput.trim(), page: 1 };
      });
    }, 320);
    return () => clearTimeout(debounceRef.current);
  }, [qInput]);

  // Fetch danh sách mẫu vật khi filters thay đổi
  const fetchList = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const queryPayload = {
        ...filters,
        taxonId: filters.taxonId ? Number(filters.taxonId) : undefined,
        isPublic:
          isAdmin && filters.isPublic !== "" ? filters.isPublic === "true" : undefined,
        lat: showSpatialFilter && filters.lat !== "" ? Number(filters.lat) : undefined,
        lon: showSpatialFilter && filters.lon !== "" ? Number(filters.lon) : undefined,
        radiusKm:
          showSpatialFilter && filters.lat !== "" && filters.lon !== ""
            ? Number(filters.radiusKm || 25)
            : undefined,
      };
      const result = await specimenService.getSpecimens(queryPayload);
      setItems(result.items);
      setPagination(result.pagination);
      setSelectedIds([]);
      setStatus("success");
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, t));
      setStatus("error");
    }
  }, [filters, isAdmin, showSpatialFilter, t]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Đồng bộ URL nhẹ cho chia sẻ bộ lọc cơ bản
  useEffect(() => {
    const nextParams = {};
    if (filters.q) nextParams.q = filters.q;
    if (filters.taxonId) nextParams.taxonId = filters.taxonId;
    if (filters.order) nextParams.order = filters.order;
    if (filters.provinceId) nextParams.provinceId = filters.provinceId;
    setSearchParams(nextParams, { replace: true });
  }, [filters.q, filters.taxonId, filters.order, filters.provinceId, setSearchParams]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const resetFilters = () => {
    setQInput("");
    setShowSpatialFilter(false);
    setFilters({
      q: "",
      taxonId: "",
      order: "",
      provinceId: "",
      basisOfRecord: "",
      isPublic: "",
      dateFrom: "",
      dateTo: "",
      lat: "",
      lon: "",
      radiusKm: 25,
      sortBy: "collectionDate",
      sortOrder: "desc",
      page: 1,
      limit: 25,
    });
  };

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

  const handleTogglePublic = async (item) => {
    try {
      const updated = await specimenService.togglePublic(item.id, !item.isPublic);
      setItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, isPublic: updated.isPublic } : r)));
      toast(
        `Đã chuyển ${item.specimenCode} sang ${updated.isPublic ? "Công khai" : "Nội bộ"}`,
        "success",
      );
      refreshStats();
    } catch (err) {
      toast(err.response?.data?.message || "Không thể đổi trạng thái hiển thị", "error");
    }
  };

  const handleBatchPublic = async (nextPublic) => {
    if (selectedIds.length === 0) return;
    try {
      const res = await specimenService.batchTogglePublic(selectedIds, nextPublic);
      toast(
        `Đã cập nhật ${res.updatedCount} mẫu vật thành ${nextPublic ? "Công khai" : "Nội bộ"}`,
        "success",
      );
      fetchList();
      refreshStats();
    } catch (err) {
      toast(err.response?.data?.message || "Lỗi cập nhật hàng loạt", "error");
    }
  };

  const handleFormSubmit = async (payload) => {
    setSubmittingForm(true);
    try {
      if (editingItem) {
        await specimenService.updateSpecimen(editingItem.id, payload);
        toast(`Đã cập nhật ${editingItem.specimenCode}`, "success");
      } else {
        const created = await specimenService.createSpecimen(payload);
        toast(`Đã thêm mẫu vật mới ${created.specimenCode}`, "success");
      }
      setModalOpen(false);
      setEditingItem(null);
      fetchList();
      refreshStats();
    } catch (err) {
      toast(err.response?.data?.message || "Không thể lưu mẫu vật", "error");
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    try {
      await specimenService.deleteSpecimen(pendingDelete.id);
      toast(`Đã xóa mẫu vật ${pendingDelete.specimenCode}`, "success");
      setPendingDelete(null);
      fetchList();
      refreshStats();
    } catch (err) {
      toast(err.response?.data?.message || "Không thể xóa mẫu vật", "error");
    }
  };

  const [exportingFmt, setExportingFmt] = useState(null);

  const handleServerExport = async (format) => {
    if (exportingFmt) return;
    setExportingFmt(format);
    try {
      const blob = await specimenService.exportSpecimens({
        format,
        q: filters.q,
        order: filters.order,
        provinceId: filters.provinceId,
        basisOfRecord: filters.basisOfRecord,
        isPublic: filters.isPublic,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
      const ext = format === "xlsx" ? "xlsx" : format === "geojson" ? "geojson" : "zip";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vietinsect-${format}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      link.click();
      URL.revokeObjectURL(url);
      toast(
        format === "dwca"
          ? "Đã đóng gói và tải xuống Darwin Core Archive (.zip chuẩn GBIF)"
          : `Đã tải xuống tệp ${ext.toUpperCase()} thành công`,
        "success",
      );
    } catch (err) {
      toast("Không thể xuất dữ liệu lúc này, vui lòng thử lại", "error");
    } finally {
      setExportingFmt(null);
    }
  };

  const detailBasePath = isAdmin ? "/admin/specimens" : "/specimens";

  return (
    <div className="page-container page-content vi-page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name={isAdmin ? "database" : "search"} size={14} />
            {isAdmin ? t("specimen.title") : t("specimen.publicPortalEyebrow")}
          </div>
          <h1>{isAdmin ? t("specimen.adminHeading") : t("specimen.publicHeading")}</h1>
          <p className="page-description">
            {isAdmin ? t("specimen.adminDesc") : t("specimen.publicDesc")}
          </p>
        </div>

        <div className="hero-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => navigate(isAdmin ? "/admin/map" : "/map")}
          >
            <Icon name="map" size={16} />
            {t("specimen.viewOnMap")}
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => handleServerExport("dwca")}
            disabled={Boolean(exportingFmt)}
          >
            <Icon name="archive" size={16} />
            {exportingFmt === "dwca" ? t("specimen.packaging") : "DwC-A (.zip)"}
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => handleServerExport("xlsx")}
            disabled={Boolean(exportingFmt)}
          >
            <Icon name="file" size={16} />
            {exportingFmt === "xlsx" ? t("specimen.exporting") : "Excel (.xlsx)"}
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => handleServerExport("geojson")}
            disabled={Boolean(exportingFmt)}
          >
            <Icon name="globe" size={16} />
            {exportingFmt === "geojson" ? t("specimen.exporting") : "GeoJSON"}
          </button>
          {isAdmin ? (
            <>
              <Link to="/admin/specimens/import" className="button button-ghost">
                <Icon name="upload" size={16} />
                {t("specimen.importExcel")}
              </Link>
              <Link to="/admin/specimens/batch-edit" className="button button-ghost">
                <Icon name="edit" size={16} />
                {t("specimen.batchEdit")}
              </Link>
              <Link to="/admin/specimens/labels" className="button button-ghost">
                <Icon name="printer" size={16} />
                {t("specimen.printLabels")}
              </Link>
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  setEditingItem(null);
                  setModalOpen(true);
                }}
              >
                <Icon name="plus" size={16} />
                {t("specimen.addSpecimen")}
              </button>
            </>
          ) : (
            <Link to="/search/advanced" className="button button-secondary">
              <Icon name="filter" size={16} />
              {t("navigation.advancedSearch")}
            </Link>
          )}
        </div>
      </div>

      {/* KPI Metrics Strip */}
      {stats ? (
        <div className="metric-grid" style={{ marginBottom: 20 }}>
          <article className="card metric-card">
            <div className="metric-head">
              <span>{t("specimen.totalSpecimens")}</span>
              <span className="metric-icon">
                <Icon name="bug" size={16} />
              </span>
            </div>
            <div className="metric-value">{formatNumber(stats.totalSpecimens || 0, i18n.language)}</div>
            <div className="metric-foot">
              {t("specimen.withGps", { count: formatNumber(stats.withCoordinates || 0, i18n.language) })}
            </div>
          </article>

          <article className="card metric-card">
            <div className="metric-head">
              <span>{t("specimen.digitizedSpecies")}</span>
              <span className="metric-icon">
                <Icon name="leaf" size={16} />
              </span>
            </div>
            <div className="metric-value">
              {formatNumber(stats.taxa?.species || stats.distinctBinomialSpecies || 0, i18n.language)}
            </div>
            <div className="metric-foot">
              {t("specimen.familiesGenera", {
                families: formatNumber(stats.taxa?.families || 0, i18n.language),
                genera: formatNumber(stats.taxa?.genera || 0, i18n.language),
              })}
            </div>
          </article>

          <article className="card metric-card">
            <div className="metric-head">
              <span>{t("specimen.geoCoverage")}</span>
              <span className="metric-icon">
                <Icon name="map" size={16} />
              </span>
            </div>
            <div className="metric-value">{stats.provincesCovered || 0} / 34</div>
            <div className="metric-foot">{t("specimen.standardizedProvinces")}</div>
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

      {/* Filter Workbench */}
      <section className="card panel" style={{ marginBottom: 18 }}>
        <div className="vi-filter-grid">
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="flt-q">{t("specimen.keywordLabel")}</label>
            <div style={{ position: "relative" }}>
              <input
                id="flt-q"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder={t("specimen.keywordPlaceholder")}
              />
              {qInput ? (
                <button
                  type="button"
                  className="icon-button"
                  style={{ position: "absolute", right: 4, top: 4, width: 32, height: 32 }}
                  onClick={() => setQInput("")}
                  aria-label={t("specimen.clearKeyword")}
                >
                  <Icon name="close" size={14} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="flt-order">{t("specimen.order")}</label>
            <select
              id="flt-order"
              value={filters.order}
              onChange={(e) => updateFilter("order", e.target.value)}
            >
              <option value="">{t("specimen.allOrders")}</option>
              {lookups.orders.map((o) => {
                const localizedName = t(`orders.${o.scientificName}`, {
                  defaultValue: i18n.language.startsWith("en")
                    ? o.vernacularNameEn || ""
                    : o.vernacularNameVn || "",
                });
                return (
                  <option key={o.id} value={o.scientificName}>
                    {o.scientificName} {localizedName ? `(${localizedName})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="flt-prov">{t("specimen.province")}</label>
            <select
              id="flt-prov"
              value={filters.provinceId}
              onChange={(e) => updateFilter("provinceId", e.target.value)}
            >
              <option value="">{t("specimen.allProvinces")}</option>
              {lookups.provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameVn}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="flt-basis">{t("specimen.basisOfRecord")}</label>
            <select
              id="flt-basis"
              value={filters.basisOfRecord}
              onChange={(e) => updateFilter("basisOfRecord", e.target.value)}
            >
              <option value="">{t("specimen.allSources")}</option>
              {Object.entries(BASIS_OF_RECORD_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="flt-from">{t("specimen.dateFrom")}</label>
            <input
              id="flt-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
            />
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="flt-to">{t("specimen.dateTo")}</label>
            <input
              id="flt-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
            />
          </div>

          {isAdmin ? (
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="flt-pub">{t("specimen.sharingStatus")}</label>
              <select
                id="flt-pub"
                value={filters.isPublic}
                onChange={(e) => updateFilter("isPublic", e.target.value)}
              >
                <option value="">{t("specimen.allSharing")}</option>
                <option value="true">{t("specimen.currentlyPublic")}</option>
                <option value="false">{t("specimen.currentlyPrivate")}</option>
              </select>
            </div>
          ) : null}
        </div>

        {/* Toolbar phụ: PostGIS Radius + Sắp xếp + Cột hiển thị */}
        <div className="vi-filter-subbar">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className={`button button-sm ${showSpatialFilter ? "button-secondary" : "button-ghost"}`}
              onClick={() => setShowSpatialFilter((v) => !v)}
            >
              <Icon name="map" size={14} />
              {t("specimen.spatialQuery")}
            </button>

            <button type="button" className="button button-sm button-ghost" onClick={resetFilters}>
              {t("specimen.resetFilters")}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
            <select
              className="vi-compact-select"
              value={`${filters.sortBy}:${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split(":");
                setFilters((prev) => ({ ...prev, sortBy, sortOrder, page: 1 }));
              }}
              aria-label={t("search.sortBy")}
            >
              <option value="collectionDate:desc">{t("specimen.sortDateDesc")}</option>
              <option value="collectionDate:asc">{t("specimen.sortDateAsc")}</option>
              <option value="scientificName:asc">{t("specimen.sortNameAsc")}</option>
              <option value="individualCount:desc">{t("specimen.sortCountDesc")}</option>
              <option value="specimenId:desc">{t("specimen.sortNewest")}</option>
            </select>

            <button
              type="button"
              className="button button-sm button-ghost"
              onClick={() => setColMenuOpen((v) => !v)}
            >
              <Icon name="layers" size={14} />
              {t("specimen.columns")}
            </button>

            {colMenuOpen ? (
              <div className="vi-dropdown-popover">
                <label>
                  <input
                    type="checkbox"
                    checked={visibleCols.basis}
                    onChange={(e) => setVisibleCols((c) => ({ ...c, basis: e.target.checked }))}
                  />
                  {t("specimen.basisOfRecord")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={visibleCols.coords}
                    onChange={(e) => setVisibleCols((c) => ({ ...c, coords: e.target.checked }))}
                  />
                  {t("specimen.colCoords")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={visibleCols.collector}
                    onChange={(e) =>
                      setVisibleCols((c) => ({ ...c, collector: e.target.checked }))
                    }
                  />
                  {t("specimen.colCollector")}
                </label>
              </div>
            ) : null}
          </div>
        </div>

        {/* Khung lọc bán kính không gian PostGIS */}
        {showSpatialFilter ? (
          <div className="vi-spatial-box">
            <div className="vi-spatial-presets">
              <span>{t("specimen.hotspots")}</span>
              {SPATIAL_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="button button-sm button-ghost"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      lat: preset.lat,
                      lon: preset.lon,
                      radiusKm: preset.radiusKm,
                      page: 1,
                    }))
                  }
                >
                  {preset.label} ({preset.radiusKm}km)
                </button>
              ))}
            </div>
            <div className="vi-form-grid-3" style={{ marginTop: 10 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label>{t("specimen.centerLat")}</label>
                <input
                  type="number"
                  step="any"
                  value={filters.lat}
                  onChange={(e) => updateFilter("lat", e.target.value)}
                  placeholder="20.3167"
                />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label>{t("specimen.centerLon")}</label>
                <input
                  type="number"
                  step="any"
                  value={filters.lon}
                  onChange={(e) => updateFilter("lon", e.target.value)}
                  placeholder="105.6083"
                />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label>{t("specimen.radiusKm")}</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={filters.radiusKm}
                  onChange={(e) => updateFilter("radiusKm", e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Thanh tác vụ hàng loạt Admin */}
      {isAdmin && selectedIds.length > 0 ? (
        <div className="vi-batch-bar">
          <strong>{t("specimen.selectedCount", { count: selectedIds.length })}</strong>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="button button-sm button-secondary"
              onClick={() => handleBatchPublic(true)}
            >
              <Icon name="check" size={14} />
              {t("specimen.makePublic", { count: selectedIds.length })}
            </button>
            <button
              type="button"
              className="button button-sm button-warning"
              onClick={() => handleBatchPublic(false)}
            >
              {t("specimen.makePrivate", { count: selectedIds.length })}
            </button>
            <button
              type="button"
              className="button button-sm button-ghost"
              onClick={() => setSelectedIds([])}
            >
              {t("specimen.deselect")}
            </button>
          </div>
        </div>
      ) : null}

      {/* Data Table */}
      <section className="card" style={{ overflow: "hidden" }}>
        {status === "loading" ? (
          <LoadingState label={t("specimen.loadingList")} />
        ) : status === "error" ? (
          <EmptyState
            icon="alert"
            title={t("specimen.queryError")}
            description={errorMsg}
            action={
              <button className="button button-ghost" onClick={fetchList}>
                {t("specimen.retry")}
              </button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="search"
            title={t("specimen.emptyTitle")}
            description={t("specimen.emptyDescription")}
            action={
              <button className="button button-ghost" onClick={resetFilters}>
                {t("search.clearFilters")}
              </button>
            }
          />
        ) : (
          <>
            <div className="vi-table-scroll">
              <table className="vi-data-table">
                <thead>
                  <tr>
                    {isAdmin ? (
                      <th style={{ width: 42 }}>
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={toggleSelectAll}
                          aria-label={t("common.all")}
                        />
                      </th>
                    ) : null}
                    <th>{t("specimen.colCatalog")}</th>
                    <th>{t("specimen.colSciName")}</th>
                    <th>{t("specimen.colOrderFamily")}</th>
                    <th>{t("specimen.colDate")}</th>
                    <th>{t("specimen.colProvinceLocality")}</th>
                    {visibleCols.coords ? <th>{t("specimen.colGps")}</th> : null}
                    {visibleCols.basis ? <th>{t("specimen.colSource")}</th> : null}
                    {visibleCols.collector ? <th>{t("specimen.colCollectorShort")}</th> : null}
                    {isAdmin ? <th>{t("specimen.colVisibility")}</th> : null}
                    <th style={{ textAlign: "right" }}>{t("specimen.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const orderColor = getOrderColor(item.orderName);
                    return (
                      <tr key={`${item.id}-${item.collectionDate}`}>
                        {isAdmin ? (
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(item.id)}
                              onChange={() => toggleSelectOne(item.id)}
                              aria-label={`Chọn ${item.specimenCode}`}
                            />
                          </td>
                        ) : null}
                        <td>
                          <Link
                            to={`${detailBasePath}/${item.id}`}
                            className="vi-code-link"
                          >
                            {item.specimenCode}
                          </Link>
                        </td>
                        <td>
                          <Link
                            to={`${detailBasePath}/${item.id}`}
                            className="taxonomy-name"
                            style={{ display: "block", fontSize: 14 }}
                          >
                            {item.scientificName}
                          </Link>
                          {item.commonNameVn ? (
                            <span style={{ fontSize: 12, color: "var(--vi-muted)" }}>
                              {item.commonNameVn}
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
                          {item.familyName ? (
                            <div style={{ fontSize: 11, color: "var(--vi-muted)", marginTop: 3 }}>
                              {item.familyName}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ whiteSpace: "nowrap", fontWeight: 600, color: "#111111" }}>
                          {item.collectionDate || "—"}
                        </td>
                        <td style={{ color: "#111111" }}>
                          <div style={{ fontWeight: 600, color: "#111111" }}>
                            {item.provinceNameVn || t("specimen.unassignedProvince")}
                          </div>
                          {item.localityDetail ? (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#555555",
                                maxWidth: 220,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={item.localityDetail}
                            >
                              {item.localityDetail}
                            </div>
                          ) : null}
                          {item.distanceKm !== undefined ? (
                            <span style={{ fontSize: 11, color: "#2E7D32", fontWeight: 700 }}>
                              {t("specimen.distanceFromCenter", { km: item.distanceKm })}
                            </span>
                          ) : null}
                        </td>
                        {visibleCols.coords ? (
                          <td
                            style={{
                              fontFamily: "monospace",
                              fontSize: 12,
                              whiteSpace: "nowrap",
                              color: "#111111",
                              fontWeight: 600,
                            }}
                          >
                            {item.latitude != null && item.longitude != null
                              ? `${Number(item.latitude).toFixed(4)}°N, ${Number(item.longitude).toFixed(4)}°E`
                              : "—"}
                          </td>
                        ) : null}
                        {visibleCols.basis ? (
                          <td>
                            <span style={{ fontSize: 12, color: "var(--vi-muted)", fontWeight: 600 }}>
                              {formatBasisOfRecord(item.basisOfRecord)}
                            </span>
                          </td>
                        ) : null}
                        {visibleCols.collector ? (
                          <td style={{ fontSize: 12, maxWidth: 160 }}>
                            {item.recordedBy || "—"}
                          </td>
                        ) : null}
                        {isAdmin ? (
                          <td>
                            <button
                              type="button"
                              onClick={() => handleTogglePublic(item)}
                              className={`status-badge ${item.isPublic ? "status-public" : "status-private"}`}
                              style={{ cursor: "pointer" }}
                              title="Nhấn để chuyển đổi Công khai / Nội bộ"
                            >
                              {item.isPublic ? "PUBLIC" : "PRIVATE"}
                            </button>
                          </td>
                        ) : null}
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <Link
                            to={`${detailBasePath}/${item.id}`}
                            className="button button-sm button-ghost"
                            style={{ marginRight: isAdmin ? 6 : 0 }}
                          >
                            {t("common.details")}
                          </Link>
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                className="icon-button"
                                title="Chỉnh sửa nhanh"
                                onClick={async () => {
                                  try {
                                    const full = await specimenService.getSpecimenById(item.id);
                                    setEditingItem(full);
                                    setModalOpen(true);
                                  } catch {
                                    setEditingItem(item);
                                    setModalOpen(true);
                                  }
                                }}
                              >
                                <Icon name="edit" size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                style={{ color: "#B0241A" }}
                                title="Xóa bản ghi"
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

            {/* Pagination Footer */}
            <div className="vi-pagination-bar">
              <div style={{ fontSize: 13, color: "var(--vi-muted)" }}>
                {t("specimen.showingRange", {
                  from: (pagination.page - 1) * pagination.limit + 1,
                  to: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: formatNumber(pagination.total, i18n.language),
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  className="vi-compact-select"
                  value={filters.limit}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, limit: Number(e.target.value), page: 1 }))
                  }
                  aria-label={t("common.page")}
                >
                  <option value={25}>{t("specimen.perPage", { n: 25 })}</option>
                  <option value={50}>{t("specimen.perPage", { n: 50 })}</option>
                  <option value={100}>{t("specimen.perPage", { n: 100 })}</option>
                </select>

                <button
                  type="button"
                  className="button button-sm button-ghost"
                  disabled={pagination.page <= 1}
                  onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
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
                  onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  {t("specimen.nextPage")}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Modal Thêm / Sửa mẫu vật (Admin) */}
      {modalOpen ? (
        <div className="dialog-backdrop" onClick={() => !submittingForm && setModalOpen(false)}>
          <div
            className="dialog-card"
            style={{ width: "min(960px, 96vw)", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button dialog-close"
              onClick={() => setModalOpen(false)}
              aria-label={t("common.close")}
            >
              <Icon name="close" size={18} />
            </button>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              <Icon name={editingItem ? "edit" : "plus"} size={14} />
              {editingItem ? t("specimen.editEyebrow") : t("specimen.createEyebrow")}
            </div>
            <h2 style={{ marginTop: 4, marginBottom: 16 }}>
              {editingItem
                ? t("specimen.updateTitle", { code: editingItem.specimenCode })
                : t("specimen.createModalTitle")}
            </h2>
            <SpecimenForm
              initialData={editingItem}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                setModalOpen(false);
                setEditingItem(null);
              }}
              submitting={submittingForm}
            />
          </div>
        </div>
      ) : null}

      {/* Hộp thoại xác nhận xóa */}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t("specimen.deleteRecordTitle")}
        message={
          pendingDelete
            ? t("specimen.deleteRecordMessage", {
              code: pendingDelete.specimenCode,
              name: pendingDelete.scientificName,
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
