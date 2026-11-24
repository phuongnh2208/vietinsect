import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import searchService from "../../search/search.service";
import useSearchQueryParams from "../../search/useSearchQueryParams";
import FacetPanel from "../../search/components/FacetPanel";
import ActiveFilters from "../../search/components/ActiveFilters";
import ViewSwitcher from "../../search/components/ViewSwitcher";
import SearchResultViews from "../../search/components/SearchResultViews";
import "./AdvancedSearchPage.css";

export default function AdvancedSearchPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const detailBase = isAdminRoute ? "/admin/specimens" : "/specimens";

  const { state, updateParams, resetFilters } = useSearchQueryParams();

  const [searchInput, setSearchInput] = useState(state.q || "");
  const [data, setData] = useState({
    items: [],
    facets: {},
    pagination: { total: 0, page: 1, limit: 25, totalPages: 0 },
    synonymNotice: null,
  });
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState(null); // { status, message }
  const debounceRef = useRef(null);

  useEffect(() => {
    setSearchInput(state.q || "");
  }, [state.q]);

  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams({ q: val.trim() });
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const apiParams = useMemo(() => {
    const p = {
      page: state.page,
      limit: state.limit,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
    };
    const optionalKeys = [
      "q",
      "order",
      "family",
      "genus",
      "species",
      "province",
      "yearFrom",
      "yearTo",
      "mediaType",
      "iucnStatus",
      "elevationMin",
      "elevationMax",
      "recordedBy",
    ];
    for (const k of optionalKeys) {
      if (state[k] !== "" && state[k] != null) p[k] = state[k];
    }
    if (state.hasGps === true || state.hasGps === false) {
      p.hasGps = state.hasGps;
    }
    return p;
  }, [state]);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setErrorState(null);
    try {
      const res = await searchService.searchSpecimens(apiParams);
      setData({
        items: Array.isArray(res?.items) ? res.items : Array.isArray(res?.data) ? res.data : [],
        facets: res?.facets || {},
        pagination: res?.pagination || {
          total: 0,
          page: state.page || 1,
          limit: state.limit || 25,
          totalPages: 0,
        },
        synonymNotice: res?.synonymNotice || null,
      });
    } catch (err) {
      const status = err?.response?.status || err?.status || 500;
      const message =
        status === 503
          ? t(
              "search.errors.serviceUnavailable",
              "Dịch vụ tìm kiếm Elasticsearch tạm thời không khả dụng (503). Vui lòng thử lại sau."
            )
          : err?.response?.data?.message ||
            err?.message ||
            t("search.errors.generic", "Không thể tải kết quả tìm kiếm.");
      setErrorState({ status, message });
      setData((prev) => ({ ...prev, items: [] }));
    } finally {
      setLoading(false);
    }
  }, [apiParams, state.limit, state.page, t]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleSelectOrder = (orderName) => {
    updateParams({ order: orderName, family: "", genus: "", species: "" });
  };

  const handleRemoveFilter = (key) => {
    if (key === "order") {
      updateParams({ order: "", family: "", genus: "", species: "" });
    } else if (key === "family") {
      updateParams({ family: "", genus: "", species: "" });
    } else if (key === "genus") {
      updateParams({ genus: "", species: "" });
    } else {
      updateParams({ [key]: "" });
    }
  };

  const { items, facets, pagination, synonymNotice } = data;
  const totalPages = pagination.totalPages || 0;
  const currentPage = pagination.page || 1;

  return (
    <div className="adv-search-page">
      {/* Header + Search Bar */}
      <div className="adv-search-header-card">
        <div className="adv-search-top-row">
          <div>
            <h1 className="adv-search-title">
              {t("search.title", "Tìm kiếm & Khám phá Mẫu vật")}
            </h1>
            <p className="adv-search-subtitle">
              {t(
                "search.subtitle",
                "Tìm kiếm toàn văn tiếng Việt không dấu, lọc đa chiều (8 facet) và 5 chế độ hiển thị."
              )}
            </p>
          </div>
          <ViewSwitcher
            activeView={state.view}
            onChange={(v) => updateParams({ view: v }, { resetPage: false })}
          />
        </div>

        <div className="adv-search-bar-row">
          <div className="adv-search-input-wrap">
            <input
              type="search"
              value={searchInput}
              onChange={handleSearchInputChange}
              placeholder={t(
                "search.placeholder",
                "Nhập tên khoa học, tên tiếng Việt không dấu (vd: bo canh cung), mã mẫu, địa danh..."
              )}
              aria-label={t("search.inputAria", "Từ khóa tìm kiếm mẫu vật")}
              className="adv-search-input"
            />
          </div>
          <select
            value={state.sortBy || "relevance"}
            onChange={(e) => updateParams({ sortBy: e.target.value })}
            aria-label={t("search.sortAria", "Sắp xếp kết quả")}
            className="adv-search-sort"
          >
            <option value="relevance">{t("search.sort.relevance", "Độ liên quan")}</option>
            <option value="specimenId">{t("search.sort.catalogNumber", "Mã mẫu")}</option>
            <option value="scientificName">{t("search.sort.scientificName", "Tên khoa học")}</option>
            <option value="collectionDate">{t("search.sort.collectionYear", "Ngày thu mẫu")}</option>
            <option value="createdAt">{t("search.sort.createdAt", "Mới nhất")}</option>
          </select>
        </div>

        <ActiveFilters
          state={state}
          onRemove={handleRemoveFilter}
          onReset={resetFilters}
        />
      </div>

      {/* Synonym notice */}
      {synonymNotice && (
        <div role="status" className="adv-search-notice">
          {typeof synonymNotice === "string"
            ? synonymNotice
            : synonymNotice.message ||
              t("search.synonymNotice", "Đã mở rộng tìm kiếm theo tên đồng danh (synonym).")}
        </div>
      )}

      {/* Explicit 503 / Error Banner */}
      {errorState && (
        <div role="alert" data-testid="search-error-banner" className="adv-search-error">
          <div>
            <strong>
              {errorState.status === 503
                ? t("search.errors.title503", "Dịch vụ tìm kiếm tạm ngừng (503)")
                : t("search.errors.title", "Lỗi tìm kiếm")}
              :
            </strong>{" "}
            {errorState.message}
          </div>
          <button
            type="button"
            onClick={fetchResults}
            className="button button-sm button-primary"
          >
            {t("search.retry", "Thử lại")}
          </button>
        </div>
      )}

      {/* Main Layout: Facet Sidebar + Results */}
      <div className="adv-search-layout">
        <div className="adv-search-sidebar">
          <FacetPanel
            facets={facets}
            state={state}
            onChange={(patch) => updateParams(patch)}
          />
        </div>

        <section className="adv-search-results">
          <div className="adv-search-meta">
            <span>
              {loading
                ? t("search.loading", "Đang tìm kiếm...")
                : t("search.resultCount", {
                    total: pagination.total || 0,
                    defaultValue: `Tìm thấy ${(pagination.total || 0).toLocaleString("vi-VN")} mẫu vật`,
                  })}
            </span>
            {totalPages > 1 && (
              <span>
                {t("search.pageInfo", {
                  page: currentPage,
                  totalPages,
                  defaultValue: `Trang ${currentPage} / ${totalPages}`,
                })}
              </span>
            )}
          </div>

          {!loading && !errorState && items.length === 0 && state.view !== "treemap" ? (
            <div className="adv-search-empty">
              {t("search.empty", "Không tìm thấy mẫu vật phù hợp với bộ lọc hiện tại.")}
            </div>
          ) : (
            <SearchResultViews
              view={state.view}
              items={items}
              facets={facets}
              detailBase={detailBase}
              onSelectOrder={handleSelectOrder}
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && state.view !== "treemap" && (
            <div className="adv-search-pagination">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => updateParams({ page: currentPage - 1 }, { resetPage: false })}
                className="button button-sm button-ghost"
              >
                {t("search.pagination.prev", "Trang trước")}
              </button>
              <span className="adv-search-page-info">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => updateParams({ page: currentPage + 1 }, { resetPage: false })}
                className="button button-sm button-ghost"
              >
                {t("search.pagination.next", "Trang sau")}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
