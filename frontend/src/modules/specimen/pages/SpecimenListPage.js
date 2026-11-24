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
import "./SpecimenListPage.css";

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
    family: searchParams.get("family") || "",
    genus: searchParams.get("genus") || "",
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
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);
  const colMenuRef = useRef(null);

  const debounceRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
      if (colMenuRef.current && !colMenuRef.current.contains(e.target)) {
        setColMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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
    if (filters.family) nextParams.family = filters.family;
    if (filters.genus) nextParams.genus = filters.genus;
    if (filters.provinceId) nextParams.provinceId = filters.provinceId;
    setSearchParams(nextParams, { replace: true });
  }, [
    filters.q,
    filters.taxonId,
    filters.order,
    filters.family,
    filters.genus,
    filters.provinceId,
    setSearchParams,
  ]);

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
      family: "",
      genus: "",
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
  const isEn = i18n.language.startsWith("en");

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    clearTimeout(debounceRef.current);
    const trimmed = qInput.trim();
    if (filters.q !== trimmed) {
      setFilters((prev) => ({ ...prev, q: trimmed, page: 1 }));
    } else {
      fetchList();
    }
  };

  const sortOptions = useMemo(
    () => [
      { value: "collectionDate:desc", label: t("specimen.sortDateDesc") },
      { value: "collectionDate:asc", label: t("specimen.sortDateAsc") },
      { value: "scientificName:asc", label: t("specimen.sortNameAsc") },
      { value: "individualCount:desc", label: t("specimen.sortCountDesc") },
      { value: "specimenId:desc", label: t("specimen.sortNewest") },
    ],
    [t],
  );

  const activeSortLabel = useMemo(() => {
    const current = `${filters.sortBy}:${filters.sortOrder}`;
    return sortOptions.find((o) => o.value === current)?.label || sortOptions[0].label;
  }, [filters.sortBy, filters.sortOrder, sortOptions]);

  const activeChips = useMemo(() => {
    const chips = [];
    if (filters.q) {
      chips.push({
        key: "q",
        label: `${isEn ? "Keyword" : "Từ khóa"}: ${filters.q}`,
        onRemove: () => {
          setQInput("");
          updateFilter("q", "");
        },
      });
    }
    if (filters.order) {
      chips.push({
        key: "order",
        label: `${isEn ? "Order" : "Bộ"}: ${filters.order}`,
        onRemove: () => updateFilter("order", ""),
      });
    }
    if (filters.family) {
      chips.push({
        key: "family",
        label: `${t("specimen.family")}: ${filters.family}`,
        onRemove: () => updateFilter("family", ""),
      });
    }
    if (filters.genus) {
      chips.push({
        key: "genus",
        label: `${t("specimen.genus")}: ${filters.genus}`,
        onRemove: () => updateFilter("genus", ""),
      });
    }
    if (filters.provinceId) {
      const prov = lookups.provinces.find((p) => String(p.id) === String(filters.provinceId));
      chips.push({
        key: "provinceId",
        label: `${isEn ? "Province" : "Tỉnh"}: ${prov ? prov.nameVn : filters.provinceId}`,
        onRemove: () => updateFilter("provinceId", ""),
      });
    }
    if (filters.basisOfRecord) {
      chips.push({
        key: "basisOfRecord",
        label: `${isEn ? "Source" : "Nguồn"}: ${formatBasisOfRecord(filters.basisOfRecord)}`,
        onRemove: () => updateFilter("basisOfRecord", ""),
      });
    }
    if (filters.dateFrom || filters.dateTo) {
      const rangeText =
        filters.dateFrom && filters.dateTo
          ? `${filters.dateFrom} – ${filters.dateTo}`
          : filters.dateFrom
            ? `≥ ${filters.dateFrom}`
            : `≤ ${filters.dateTo}`;
      chips.push({
        key: "dateRange",
        label: `${isEn ? "Date" : "Ngày"}: ${rangeText}`,
        onRemove: () =>
          setFilters((prev) => ({ ...prev, dateFrom: "", dateTo: "", page: 1 })),
      });
    }
    if (showSpatialFilter && filters.lat !== "" && filters.lon !== "") {
      chips.push({
        key: "spatial",
        label: `GPS: ${filters.lat}, ${filters.lon} (${filters.radiusKm || 25}km)`,
        onRemove: () =>
          setFilters((prev) => ({ ...prev, lat: "", lon: "", radiusKm: 25, page: 1 })),
      });
    }
    if (isAdmin && filters.isPublic !== "") {
      chips.push({
        key: "isPublic",
        label: `${t("specimen.sharingStatus")}: ${
          filters.isPublic === "true"
            ? t("specimen.currentlyPublic")
            : t("specimen.currentlyPrivate")
        }`,
        onRemove: () => updateFilter("isPublic", ""),
      });
    }
    return chips;
  }, [filters, showSpatialFilter, lookups.provinces, isAdmin, isEn, t]);

  return (
    <div className="page-container page-content vi-page-enter vi-portal-page">
      {/* 1. Page Header */}
      <header className="vi-portal-header">
        <div className="vi-portal-header-copy">
          <div className="vi-portal-eyebrow">
            <Icon name={isAdmin ? "database" : "search"} size={13} />
            {isAdmin ? t("specimen.title") : t("specimen.publicPortalEyebrow")}
          </div>
          <h1 className="vi-portal-title">
            {isAdmin ? t("specimen.adminHeading") : t("specimen.publicHeading")}
          </h1>
          <p className="vi-portal-desc">
            {isAdmin ? t("specimen.adminDesc") : t("specimen.publicDesc")}
          </p>
        </div>

        <div className="vi-portal-actions">
          <button
            type="button"
            className="vp-btn"
            onClick={() => navigate(isAdmin ? "/admin/map" : "/map")}
          >
            <Icon name="map" size={15} />
            {t("specimen.viewOnMap")}
          </button>

          <div className="vp-dropdown-wrap" ref={exportMenuRef}>
            <button
              type="button"
              className="vp-btn"
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={Boolean(exportingFmt)}
              aria-expanded={exportMenuOpen}
            >
              <Icon name="archive" size={15} />
              {exportingFmt
                ? exportingFmt === "dwca"
                  ? t("specimen.packaging")
                  : t("specimen.exporting")
                : isEn
                  ? "Export Data ▾"
                  : "Xuất dữ liệu ▾"}
            </button>

            {exportMenuOpen ? (
              <div className="vp-dropdown-menu">
                <button
                  type="button"
                  className="vp-dropdown-item"
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleServerExport("dwca");
                  }}
                  disabled={Boolean(exportingFmt)}
                >
                  <Icon name="archive" size={14} />
                  DwC-A (.zip)
                </button>
                <button
                  type="button"
                  className="vp-dropdown-item"
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleServerExport("xlsx");
                  }}
                  disabled={Boolean(exportingFmt)}
                >
                  <Icon name="file" size={14} />
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  className="vp-dropdown-item"
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleServerExport("geojson");
                  }}
                  disabled={Boolean(exportingFmt)}
                >
                  <Icon name="globe" size={14} />
                  GeoJSON
                </button>
              </div>
            ) : null}
          </div>

          {isAdmin ? (
            <>
              <Link to="/admin/specimens/import" className="vp-btn">
                <Icon name="upload" size={15} />
                {t("specimen.importExcel")}
              </Link>
              <Link to="/admin/specimens/batch-edit" className="vp-btn">
                <Icon name="edit" size={15} />
                {t("specimen.batchEdit")}
              </Link>
              <Link to="/admin/specimens/labels" className="vp-btn">
                <Icon name="printer" size={15} />
                {t("specimen.printLabels")}
              </Link>
              <button
                type="button"
                className="vp-btn vp-btn-primary"
                onClick={() => {
                  setEditingItem(null);
                  setModalOpen(true);
                }}
              >
                <Icon name="plus" size={15} />
                {t("specimen.addSpecimen")}
              </button>
            </>
          ) : (
            <Link to="/search/advanced" className="vp-btn vp-btn-primary">
              <Icon name="filter" size={15} />
              {t("navigation.advancedSearch")}
            </Link>
          )}
        </div>
      </header>

      {/* 2. Compact Data Summary Strip (Real API data only) */}
      {stats ? (
        <section className="vi-summary-strip" aria-label={isEn ? "Data summary" : "Tổng quan dữ liệu"}>
          <div className="vi-summary-item">
            <span className="vi-summary-label">{t("specimen.totalSpecimens")}</span>
            <span className="vi-summary-value">
              {formatNumber(stats.totalSpecimens || 0, i18n.language)}
            </span>
            <span className="vi-summary-meta">
              {t("specimen.withGps", {
                count: formatNumber(stats.withCoordinates || 0, i18n.language),
              })}
            </span>
          </div>

          <div className="vi-summary-item">
            <span className="vi-summary-label">
              {isEn ? "Insect Orders" : "Số bộ côn trùng"}
            </span>
            <span className="vi-summary-value">
              {formatNumber(lookups.orders.length || 0, i18n.language)}
            </span>
            <span className="vi-summary-meta">
              {t("specimen.familiesGenera", {
                families: formatNumber(stats.taxa?.families || 0, i18n.language),
                genera: formatNumber(stats.taxa?.genera || 0, i18n.language),
              })}
            </span>
          </div>

          <div className="vi-summary-item">
            <span className="vi-summary-label">
              {isEn ? "Provinces Recorded" : "Tỉnh / thành có ghi nhận"}
            </span>
            <span className="vi-summary-value">
              {stats.provincesCovered || 0} / 34
            </span>
            <span className="vi-summary-meta">{t("specimen.standardizedProvinces")}</span>
          </div>

          <div className="vi-summary-item">
            <span className="vi-summary-label">{t("specimen.digitizedSpecies")}</span>
            <span className="vi-summary-value">
              {formatNumber(
                stats.taxa?.species || stats.distinctBinomialSpecies || 0,
                i18n.language,
              )}
            </span>
            <span className="vi-summary-meta">
              {isEn
                ? `${Object.keys(BASIS_OF_RECORD_LABELS).length} DwC record types`
                : `${Object.keys(BASIS_OF_RECORD_LABELS).length} chuẩn nguồn bản ghi DwC`}
            </span>
          </div>
        </section>
      ) : null}

      {/* 3. Structured Search & Filter Panel */}
      <form className="vi-search-panel" onSubmit={handleSearchSubmit}>
        {/* Main Full-Width Keyword Search */}
        <div className="vi-search-main">
          <div className="vi-search-input-wrap">
            <span className="vi-search-icon">
              <Icon name="search" size={16} />
            </span>
            <input
              id="flt-q"
              className="vi-search-input"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder={
                isEn
                  ? "Search by scientific name, catalog code, locality, collector..."
                  : "Tìm theo tên khoa học, mã mẫu vật, địa điểm, người thu mẫu..."
              }
              aria-label={t("specimen.keywordLabel")}
            />
            {qInput ? (
              <button
                type="button"
                className="vi-search-clear"
                onClick={() => {
                  setQInput("");
                  updateFilter("q", "");
                }}
                aria-label={t("specimen.clearKeyword")}
              >
                <Icon name="close" size={14} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Basic Filters Grid (6 balanced fields: 3x2 on desktop, 2x3 on tablet, 1x6 on mobile) */}
        <div className="vi-search-body">
          <div className={`vi-basic-grid ${isAdmin ? "is-admin" : ""}`}>
            <div className="vp-field">
              <label htmlFor="flt-order">{t("specimen.order")}</label>
              <select
                id="flt-order"
                value={filters.order}
                onChange={(e) => updateFilter("order", e.target.value)}
              >
                <option value="">{t("specimen.allOrders")}</option>
                {lookups.orders.map((o) => {
                  const localizedName = t(`orders.${o.scientificName}`, {
                    defaultValue: isEn
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

            <div className="vp-field">
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

            <div className="vp-field">
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

            <div className="vp-field">
              <label htmlFor="flt-from">{t("specimen.dateFrom")}</label>
              <input
                id="flt-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
              />
            </div>

            <div className="vp-field">
              <label htmlFor="flt-to">{t("specimen.dateTo")}</label>
              <input
                id="flt-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
              />
            </div>

            <div className="vp-field">
              <label htmlFor="flt-sort">{t("search.sortBy")}</label>
              <select
                id="flt-sort"
                value={`${filters.sortBy}:${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split(":");
                  setFilters((prev) => ({ ...prev, sortBy, sortOrder, page: 1 }));
                }}
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {isAdmin ? (
              <div className="vp-field">
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

          {/* Collapsible Advanced Filters (PostGIS Spatial Radius) */}
          <div className="vi-advanced-section">
            <button
              type="button"
              className="vi-advanced-toggle"
              onClick={() => setShowSpatialFilter((v) => !v)}
              aria-expanded={showSpatialFilter}
            >
              <Icon name="map" size={14} />
              {isEn ? "Advanced Filters" : "Bộ lọc nâng cao"} ({t("specimen.spatialQuery")})
              <span>{showSpatialFilter ? "▴" : "▾"}</span>
            </button>

            {showSpatialFilter ? (
              <div className="vi-advanced-content">
                <div className="vi-hotspots-row">
                  <span className="vi-hotspots-label">{t("specimen.hotspots")}</span>
                  {SPATIAL_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="vp-btn vp-btn-sm"
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
                <div className="vi-spatial-grid">
                  <div className="vp-field">
                    <label htmlFor="flt-lat">{t("specimen.centerLat")}</label>
                    <input
                      id="flt-lat"
                      type="number"
                      step="any"
                      value={filters.lat}
                      onChange={(e) => updateFilter("lat", e.target.value)}
                      placeholder="20.3167"
                    />
                  </div>
                  <div className="vp-field">
                    <label htmlFor="flt-lon">{t("specimen.centerLon")}</label>
                    <input
                      id="flt-lon"
                      type="number"
                      step="any"
                      value={filters.lon}
                      onChange={(e) => updateFilter("lon", e.target.value)}
                      placeholder="105.6083"
                    />
                  </div>
                  <div className="vp-field">
                    <label htmlFor="flt-radius">{t("specimen.radiusKm")}</label>
                    <input
                      id="flt-radius"
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
          </div>
        </div>

        {/* Filter Footer Actions */}
        <div className="vi-search-footer">
          <div className="vi-search-footer-left">
            <button type="button" className="vp-btn vp-btn-sm" onClick={resetFilters}>
              {t("specimen.resetFilters")}
            </button>
            <span className="vi-filter-count-badge">
              {activeChips.length > 0 ? (
                <>
                  <strong>{activeChips.length}</strong>{" "}
                  {isEn ? "active filters" : "bộ lọc đang áp dụng"}
                </>
              ) : isEn ? (
                "No filters applied"
              ) : (
                "Chưa áp dụng bộ lọc"
              )}
            </span>
          </div>

          <button type="submit" className="vp-btn vp-btn-primary">
            <Icon name="search" size={15} />
            {isEn ? "Search Specimens" : "Tìm kiếm mẫu vật"}
          </button>
        </div>
      </form>

      {/* 4. Active Filter Chips */}
      {activeChips.length > 0 ? (
        <div className="vi-chips-bar" role="region" aria-label={isEn ? "Active filters" : "Bộ lọc đang áp dụng"}>
          <span className="vi-chips-title">{isEn ? "Active:" : "Đang lọc:"}</span>
          {activeChips.map((chip) => (
            <span key={chip.key} className="vi-filter-chip">
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`${isEn ? "Remove" : "Xóa"} ${chip.label}`}
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className="vi-chips-clear-all" onClick={resetFilters}>
            {isEn ? "Clear all" : "Xóa tất cả"}
          </button>
        </div>
      ) : null}

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

      {/* 5. Results Section */}
      <section className="vi-results-card">
        {/* Results Topbar: count, page, active sort, per-page, view switch & column picker */}
        <div className="vi-results-topbar">
          <div className="vi-results-meta">
            <span>
              <strong>{formatNumber(pagination.total || 0, i18n.language)}</strong>{" "}
              {isEn ? "results" : "kết quả"}
            </span>
            <span className="vi-results-divider" />
            <span>
              {t("specimen.pageOf", {
                page: pagination.page,
                total: Math.max(1, pagination.totalPages),
              })}
            </span>
            <span className="vi-results-divider" />
            <span>
              {isEn ? "Sorted by:" : "Sắp xếp:"} <strong>{activeSortLabel}</strong>
            </span>
          </div>

          <div className="vi-results-controls">
            <select
              className="vp-compact-select"
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

            <div className="vp-dropdown-wrap" ref={colMenuRef}>
              <button
                type="button"
                className="vp-btn vp-btn-sm"
                onClick={() => setColMenuOpen((v) => !v)}
                aria-expanded={colMenuOpen}
              >
                <Icon name="layers" size={14} />
                {t("specimen.columns")}
              </button>

              {colMenuOpen ? (
                <div className="vp-dropdown-menu">
                  <label className="vp-dropdown-check">
                    <input
                      type="checkbox"
                      checked={visibleCols.basis}
                      onChange={(e) => setVisibleCols((c) => ({ ...c, basis: e.target.checked }))}
                    />
                    {t("specimen.basisOfRecord")}
                  </label>
                  <label className="vp-dropdown-check">
                    <input
                      type="checkbox"
                      checked={visibleCols.coords}
                      onChange={(e) => setVisibleCols((c) => ({ ...c, coords: e.target.checked }))}
                    />
                    {t("specimen.colCoords")}
                  </label>
                  <label className="vp-dropdown-check">
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

            <div className="vi-view-switch" role="group" aria-label={isEn ? "View mode" : "Chế độ hiển thị"}>
              <button type="button" className="vi-view-switch-btn is-active" aria-current="page">
                <Icon name="database" size={13} />
                {isEn ? "List" : "Danh sách"}
              </button>
              <button
                type="button"
                className="vi-view-switch-btn"
                onClick={() => navigate(isAdmin ? "/admin/map" : "/map")}
              >
                <Icon name="map" size={13} />
                {isEn ? "Map" : "Bản đồ"}
              </button>
            </div>
          </div>
        </div>

        {status === "loading" ? (
          <LoadingState label={t("specimen.loadingList")} />
        ) : status === "error" ? (
          <EmptyState
            icon="alert"
            title={t("specimen.queryError")}
            description={errorMsg}
            action={
              <button type="button" className="vp-btn" onClick={fetchList}>
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
              <button type="button" className="vp-btn" onClick={resetFilters}>
                {t("search.clearFilters")}
              </button>
            }
          />
        ) : (
          <>
            <div className="vi-portal-table-wrap">
              <table className="vi-portal-table">
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
                            className="vp-code-mono"
                          >
                            {item.specimenCode}
                          </Link>
                        </td>
                        <td>
                          <Link
                            to={`${detailBasePath}/${item.id}`}
                            className="vp-sci-name"
                          >
                            {item.scientificName}
                          </Link>
                          {item.commonNameVn ? (
                            <span className="vp-sub-text">{item.commonNameVn}</span>
                          ) : null}
                        </td>
                        <td>
                          <span
                            className="vp-order-pill"
                            style={{ background: orderColor }}
                          >
                            {item.orderName || item.taxonName}
                          </span>
                          {item.familyName ? (
                            <span className="vp-sub-text">{item.familyName}</span>
                          ) : null}
                        </td>
                        <td style={{ whiteSpace: "nowrap", fontWeight: 500 }}>
                          {item.collectionDate || "—"}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {item.provinceNameVn || t("specimen.unassignedProvince")}
                          </div>
                          {item.localityDetail ? (
                            <div
                              className="vp-sub-text"
                              style={{
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
                            <span style={{ fontSize: 11, color: "#155B35", fontWeight: 700 }}>
                              {t("specimen.distanceFromCenter", { km: item.distanceKm })}
                            </span>
                          ) : null}
                        </td>
                        {visibleCols.coords ? (
                          <td
                            style={{
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                              fontSize: 12,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.latitude != null && item.longitude != null
                              ? `${Number(item.latitude).toFixed(4)}°N, ${Number(item.longitude).toFixed(4)}°E`
                              : "—"}
                          </td>
                        ) : null}
                        {visibleCols.basis ? (
                          <td>
                            <span className="vp-sub-text" style={{ marginTop: 0 }}>
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
                            className="vp-btn vp-btn-sm"
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
            <div className="vi-portal-pagination">
              <div style={{ fontSize: 13, color: "var(--vp-muted)" }}>
                {t("specimen.showingRange", {
                  from: (pagination.page - 1) * pagination.limit + 1,
                  to: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: formatNumber(pagination.total, i18n.language),
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="vp-btn vp-btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  {t("specimen.prevPage")}
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, padding: "0 6px" }}>
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  className="vp-btn vp-btn-sm"
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
