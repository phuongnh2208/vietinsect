import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export const VALID_VIEWS = ["list", "label", "gallery", "map", "treemap"];
export const VALID_SORT_BY = ["relevance", "collectionDate", "createdAt", "specimenId", "scientificName"];

function parseSafeInt(raw, min, max, fallback = "") {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

export default function useSearchQueryParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo(() => {
    const rawView = searchParams.get("view") || "list";
    const view = VALID_VIEWS.includes(rawView) ? rawView : "list";

    const rawSort = searchParams.get("sortBy") || "relevance";
    const sortBy = VALID_SORT_BY.includes(rawSort) ? rawSort : "relevance";

    const rawOrderDir = searchParams.get("sortOrder") || "desc";
    const sortOrder = rawOrderDir === "asc" ? "asc" : "desc";

    const hasGpsRaw = searchParams.get("hasGps");
    const hasGps = hasGpsRaw === "true" ? true : hasGpsRaw === "false" ? false : "";

    return {
      q: searchParams.get("q") || "",
      view,
      page: parseSafeInt(searchParams.get("page"), 1, 400, 1),
      limit: parseSafeInt(searchParams.get("limit"), 1, 100, 25),
      sortBy,
      sortOrder,
      order: searchParams.get("order") || "",
      family: searchParams.get("family") || "",
      genus: searchParams.get("genus") || "",
      species: searchParams.get("species") || "",
      province: searchParams.get("province") || "",
      yearFrom: parseSafeInt(searchParams.get("yearFrom"), 1800, 2050, ""),
      yearTo: parseSafeInt(searchParams.get("yearTo"), 1800, 2050, ""),
      mediaType: searchParams.get("mediaType") || "",
      iucnStatus: searchParams.get("iucnStatus") || "",
      elevationMin: parseSafeInt(searchParams.get("elevationMin"), -500, 9000, ""),
      elevationMax: parseSafeInt(searchParams.get("elevationMax"), -500, 9000, ""),
      recordedBy: searchParams.get("recordedBy") || "",
      hasGps,
    };
  }, [searchParams]);

  const updateParams = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === "") {
          next.delete(k);
        } else {
          next.set(k, String(v));
        }
      }
      if (resetPage && !("page" in patch)) {
        next.delete("page");
      }
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const resetFilters = useCallback(() => {
    const next = new URLSearchParams();
    if (state.view && state.view !== "list") {
      next.set("view", state.view);
    }
    setSearchParams(next);
  }, [setSearchParams, state.view]);

  return { state, updateParams, resetFilters };
}
