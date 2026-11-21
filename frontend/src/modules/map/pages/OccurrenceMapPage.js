import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Icon from "../../../components/ui/Icon";
import { useToast } from "../../../components/ui/ToastProvider";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import specimenService from "../../specimen/specimen.service";
import {
  BASIS_OF_RECORD_LABELS,
  formatBasisOfRecord,
  getOrderColor,
  ORDER_COLORS,
  SPATIAL_PRESETS,
} from "../../specimen/specimen.constants";

const VIETNAM_CENTER = [16.2, 106.2];
const VIETNAM_ZOOM = 6;
const DEFAULT_RADIUS_PIN = { lat: 20.3167, lon: 105.6083, radiusKm: 30 };

const BASEMAPS = {
  street: {
    labelVi: "Khoa học (Hành chính)",
    labelEn: "Scientific (Administrative)",
    shortVi: "Khoa học",
    shortEn: "Scientific",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS",
    maxZoom: 18,
  },
  topo: {
    labelVi: "Địa hình (Độ cao)",
    labelEn: "Topographic (Elevation)",
    shortVi: "Địa hình",
    shortEn: "Topo",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; USGS, NOAA, DeLorme, TomTom",
    maxZoom: 18,
  },
  satellite: {
    labelVi: "Ảnh Vệ tinh",
    labelEn: "Satellite Imagery",
    shortVi: "Vệ tinh",
    shortEn: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    maxZoom: 18,
  },
  gray: {
    labelVi: "Nền Xám tối giản",
    labelEn: "Minimal Light Gray",
    shortVi: "Nền xám",
    shortEn: "Gray",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin",
    maxZoom: 16,
  },
};

const ELEVATION_HILLSHADE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";

const REGION_COLORS = {
  "Tây Bắc": "#1E6F5C",
  "Đông Bắc": "#237A35",
  "Đồng bằng sông Hồng": "#2B6CB0",
  "Bắc Trung Bộ": "#B7791F",
  "Nam Trung Bộ": "#C05621",
  "Tây Nguyên": "#6B46C1",
  "Đông Nam Bộ": "#97266D",
  "Đồng bằng sông Cửu Long": "#0987A0",
  Default: "#237A35",
};

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatWgs84(lat, lon) {
  if (lat == null || lon == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
    return "Chưa cung cấp";
  }
  const nLat = Number(lat);
  const nLon = Number(lon);
  const latHemi = nLat >= 0 ? "N" : "S";
  const lonHemi = nLon >= 0 ? "E" : "W";
  return `${Math.abs(nLat).toFixed(4)}°${latHemi}, ${Math.abs(nLon).toFixed(4)}°${lonHemi}`;
}

function heatColor(count, maxCount) {
  if (!maxCount || maxCount <= 0) return "#16A34A";
  // Dùng lũy thừa 0.55 để phân bổ dải màu khoa học 5 mức (Xanh lá -> Xanh cốm -> Vàng hổ phách -> Cam -> Đỏ điểm nóng)
  const ratio = Math.pow(Math.max(0, Number(count)) / Math.max(1, Number(maxCount)), 0.55);
  if (ratio >= 0.82) return "#DC2626"; // Điểm nóng (Very High / Hotspot)
  if (ratio >= 0.62) return "#EA580C"; // Cao (High)
  if (ratio >= 0.42) return "#D97706"; // Khá cao (Moderate-High)
  if (ratio >= 0.24) return "#65A30D"; // Trung bình (Moderate)
  return "#15803D"; // Thấp (Low)
}

function richnessColor(speciesCount, maxSpecies) {
  const ratio = maxSpecies > 0 ? Math.log1p(speciesCount) / Math.log1p(maxSpecies) : 0;
  if (ratio >= 0.75) return "#103B25";
  if (ratio >= 0.5) return "#237A35";
  if (ratio >= 0.25) return "#48BB78";
  return "#9AE6B4";
}

const INITIAL_FILTERS = {
  q: "",
  order: "",
  family: "",
  genus: "",
  species: "",
  provinceId: "",
  district: "",
  region: "",
  habitatId: "",
  basisOfRecord: "",
  institutionCode: "",
  dateFrom: "",
  dateTo: "",
  minElevation: "",
  maxElevation: "",
  minLat: "",
  maxLat: "",
  minLon: "",
  maxLon: "",
  limit: 3000,
};

export default function OccurrenceMapPage() {
  const isAdmin = useIsAdminContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isEn = (i18n.language || "vi").startsWith("en");

  const initialLat = searchParams.get("lat");
  const initialLon = searchParams.get("lon");
  const initialOrder = searchParams.get("order") || "";
  const initialQ = searchParams.get("q") || "";

  const [viewMode, setViewMode] = useState(initialLat && initialLon ? "radius" : "points"); // points | heatmap | radius
  const [basemap, setBasemap] = useState("street");
  const [basemapOpacity, setBasemapOpacity] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showAdvancedSpatial, setShowAdvancedSpatial] = useState(Boolean(initialLat && initialLon));
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [exportingGeoJson, setExportingGeoJson] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState(() =>
    searchParams.get("selectedId") ? Number(searchParams.get("selectedId")) : null,
  );
  const [selectedProtectedArea, setSelectedProtectedArea] = useState("");
  const [mapZoom, setMapZoom] = useState(initialLat && initialLon ? 9 : VIETNAM_ZOOM);

  // Display & Clustering settings (Section 5.E & Section 8)
  const [showMarkers, setShowMarkers] = useState(true);
  const [enableClustering, setEnableClustering] = useState(false);
  const [syncMapExtent, setSyncMapExtent] = useState(false);
  const [heatmapStyle, setHeatmapStyle] = useState("hybrid"); // hybrid | grid | provinces

  // Ecological & Thematic GIS Layers (Section 7)
  const [ecologicalLayers, setEcologicalLayers] = useState({
    adminBoundaries: false,
    ecologicalRegions: false,
    protectedAreas: true,
    elevation: false,
    vegetation: false, // Unavailable in local PostGIS DB
    occurrences: true,
    speciesRichness: false,
  });

  // Draft text inputs (debounced or applied via Apply button to prevent request storms)
  const [qInput, setQInput] = useState(initialQ);
  const [genusInput, setGenusInput] = useState("");
  const [speciesInput, setSpeciesInput] = useState("");
  const [districtInput, setDistrictInput] = useState("");

  const [filters, setFilters] = useState(() => ({
    ...INITIAL_FILTERS,
    q: initialQ,
    order: initialOrder,
  }));

  const [radiusPin, setRadiusPin] = useState(() =>
    initialLat && initialLon
      ? { lat: Number(initialLat), lon: Number(initialLon), radiusKm: 30 }
      : DEFAULT_RADIUS_PIN,
  );

  const [lookups, setLookups] = useState({
    orders: [],
    families: [],
    provinces: [],
    regions: [],
    institutions: [],
    habitats: [],
  });

  const [mapData, setMapData] = useState({
    totalMatching: 0,
    returnedPoints: 0,
    summary: { totalOccurrences: 0, distinctSpeciesCount: 0, provincesCount: 0 },
    points: [],
    provinceClusters: [],
    regionClusters: [],
    heatGrid: [],
  });
  const [loading, setLoading] = useState(true);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const elevationLayerRef = useRef(null);
  const dataLayerGroupRef = useRef(null);
  const thematicLayerGroupRef = useRef(null);
  const parksLayerGroupRef = useRef(null);
  const canvasRendererRef = useRef(null);
  const debounceRef = useRef(null);
  const viewModeRef = useRef(viewMode);
  const syncMapExtentRef = useRef(syncMapExtent);
  viewModeRef.current = viewMode;
  syncMapExtentRef.current = syncMapExtent;

  useEffect(() => {
    specimenService
      .getLookups()
      .then((res) => {
        if (res) {
          setLookups({
            orders: res.orders || [],
            families: res.families || [],
            provinces: res.provinces || [],
            regions:
              res.regions && res.regions.length > 0
                ? res.regions
                : Array.from(new Set((res.provinces || []).map((p) => p.region).filter(Boolean))).sort(),
            institutions: res.institutions || [],
            habitats: res.habitats || [],
          });
        }
      })
      .catch(() => { });
  }, []);

  // Debounce text inputs so we never send API requests on every keystroke
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => {
        const nextQ = qInput.trim();
        const nextGenus = genusInput.trim();
        const nextSpecies = speciesInput.trim();
        const nextDistrict = districtInput.trim();
        if (
          prev.q === nextQ &&
          prev.genus === nextGenus &&
          prev.species === nextSpecies &&
          prev.district === nextDistrict
        ) {
          return prev;
        }
        return {
          ...prev,
          q: nextQ,
          genus: nextGenus,
          species: nextSpecies,
          district: nextDistrict,
        };
      });
    }, 380);
    return () => clearTimeout(debounceRef.current);
  }, [qInput, genusInput, speciesInput, districtInput]);

  // Apply text inputs immediately when clicking "Apply Filters"
  const handleApplyFiltersNow = () => {
    clearTimeout(debounceRef.current);
    setFilters((prev) => ({
      ...prev,
      q: qInput.trim(),
      genus: genusInput.trim(),
      species: speciesInput.trim(),
      district: districtInput.trim(),
    }));
  };

  // Filtered families based on selected Order
  const availableFamilies = useMemo(() => {
    const fams = lookups.families || [];
    if (!filters.order) return fams;
    const filtered = fams.filter(
      (f) => !f.orderName || f.orderName.toLowerCase() === filters.order.toLowerCase(),
    );
    return filtered.length > 0 ? filtered : fams;
  }, [lookups.families, filters.order]);

  // Active filters list for removable chips & badge count
  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (filters.q) {
      chips.push({
        key: "q",
        label: `${isEn ? "Keyword" : "Từ khóa"}: "${filters.q}"`,
        onRemove: () => {
          setQInput("");
          setFilters((p) => ({ ...p, q: "" }));
        },
      });
    }
    if (filters.order) {
      chips.push({
        key: "order",
        label: `${isEn ? "Order" : "Bộ"}: ${filters.order}`,
        onRemove: () => setFilters((p) => ({ ...p, order: "", family: "" })),
      });
    }
    if (filters.family) {
      chips.push({
        key: "family",
        label: `${isEn ? "Family" : "Họ"}: ${filters.family}`,
        onRemove: () => setFilters((p) => ({ ...p, family: "" })),
      });
    }
    if (filters.genus) {
      chips.push({
        key: "genus",
        label: `${isEn ? "Genus" : "Giống"}: ${filters.genus}`,
        onRemove: () => {
          setGenusInput("");
          setFilters((p) => ({ ...p, genus: "" }));
        },
      });
    }
    if (filters.species) {
      chips.push({
        key: "species",
        label: `${isEn ? "Species" : "Loài"}: ${filters.species}`,
        onRemove: () => {
          setSpeciesInput("");
          setFilters((p) => ({ ...p, species: "" }));
        },
      });
    }
    if (filters.provinceId) {
      const prov = lookups.provinces.find((pr) => String(pr.id) === String(filters.provinceId));
      chips.push({
        key: "provinceId",
        label: `${isEn ? "Province" : "Tỉnh"}: ${prov ? prov.nameVn : filters.provinceId}`,
        onRemove: () => setFilters((p) => ({ ...p, provinceId: "" })),
      });
    }
    if (filters.district) {
      chips.push({
        key: "district",
        label: `${isEn ? "District" : "Huyện"}: ${filters.district}`,
        onRemove: () => {
          setDistrictInput("");
          setFilters((p) => ({ ...p, district: "" }));
        },
      });
    }
    if (filters.region) {
      chips.push({
        key: "region",
        label: `${isEn ? "Region" : "Vùng"}: ${filters.region}`,
        onRemove: () => setFilters((p) => ({ ...p, region: "" })),
      });
    }
    if (filters.basisOfRecord) {
      chips.push({
        key: "basisOfRecord",
        label: `DwC: ${formatBasisOfRecord(filters.basisOfRecord)}`,
        onRemove: () => setFilters((p) => ({ ...p, basisOfRecord: "" })),
      });
    }
    if (filters.institutionCode) {
      chips.push({
        key: "institutionCode",
        label: `${isEn ? "Source" : "Nguồn"}: ${filters.institutionCode}`,
        onRemove: () => setFilters((p) => ({ ...p, institutionCode: "" })),
      });
    }
    if (filters.habitatId) {
      const hab = lookups.habitats.find((h) => String(h.id) === String(filters.habitatId));
      chips.push({
        key: "habitatId",
        label: `${isEn ? "Habitat" : "Sinh cảnh"}: ${hab ? hab.labelVn : filters.habitatId}`,
        onRemove: () => setFilters((p) => ({ ...p, habitatId: "" })),
      });
    }
    if (filters.dateFrom || filters.dateTo) {
      chips.push({
        key: "dateRange",
        label: `${isEn ? "Date" : "Ngày"}: ${filters.dateFrom || "…"} → ${filters.dateTo || "…"}`,
        onRemove: () => setFilters((p) => ({ ...p, dateFrom: "", dateTo: "" })),
      });
    }
    if (filters.minElevation !== "" || filters.maxElevation !== "") {
      chips.push({
        key: "elevation",
        label: `${isEn ? "Elevation" : "Độ cao"}: ${filters.minElevation || 0}–${filters.maxElevation || "∞"}m`,
        onRemove: () => setFilters((p) => ({ ...p, minElevation: "", maxElevation: "" })),
      });
    }
    if (filters.minLat !== "" && filters.maxLat !== "" && filters.minLon !== "" && filters.maxLon !== "") {
      chips.push({
        key: "bbox",
        label: `BBox: [${Number(filters.minLat).toFixed(2)}, ${Number(filters.minLon).toFixed(2)}]`,
        onRemove: () =>
          setFilters((p) => ({ ...p, minLat: "", maxLat: "", minLon: "", maxLon: "" })),
      });
    }
    if (viewMode === "radius") {
      chips.push({
        key: "radius",
        label: `PostGIS ${radiusPin.radiusKm}km @ (${Number(radiusPin.lat).toFixed(2)}, ${Number(radiusPin.lon).toFixed(2)})`,
        onRemove: () => setViewMode("points"),
      });
    }
    return chips;
  }, [filters, lookups.provinces, lookups.habitats, viewMode, radiusPin, isEn]);

  // Initialize Leaflet Map once with High-Performance HTML5 Canvas Renderer
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;

    const vectorRenderer = L.canvas({ padding: 0.5 });
    canvasRendererRef.current = vectorRenderer;

    const startCenter =
      initialLat && initialLon ? [Number(initialLat), Number(initialLon)] : VIETNAM_CENTER;
    const startZoom = initialLat && initialLon ? 9 : VIETNAM_ZOOM;

    const map = L.map(mapContainerRef.current, {
      center: startCenter,
      zoom: startZoom,
      zoomControl: false,
      preferCanvas: true,
      renderer: vectorRenderer,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomright", imperial: false, maxWidth: 120 }).addTo(map);

    const initialBasemap = BASEMAPS.street;
    const tile = L.tileLayer(initialBasemap.url, {
      attribution: initialBasemap.attribution,
      maxZoom: initialBasemap.maxZoom || 18,
      opacity: 1,
    }).addTo(map);

    const thematicGroup = L.layerGroup().addTo(map);
    const layerGroup = L.layerGroup().addTo(map);
    const parksGroup = L.layerGroup().addTo(map);

    map.on("zoomend", () => {
      setMapZoom(map.getZoom());
    });

    map.on("moveend", () => {
      if (syncMapExtentRef.current) {
        const b = map.getBounds();
        setFilters((prev) => ({
          ...prev,
          minLat: Number(b.getSouth().toFixed(4)),
          maxLat: Number(b.getNorth().toFixed(4)),
          minLon: Number(b.getWest().toFixed(4)),
          maxLon: Number(b.getEast().toFixed(4)),
        }));
      }
    });

    // Click on map in PostGIS Radius Query mode moves query center
    map.on("click", (e) => {
      if (viewModeRef.current === "radius") {
        setRadiusPin((prev) => ({
          ...prev,
          lat: Number(e.latlng.lat.toFixed(5)),
          lon: Number(e.latlng.lng.toFixed(5)),
        }));
      }
    });

    // Event delegation for specimen detail, popup close, and protected area radius buttons inside Leaflet popups
    map.getContainer().addEventListener("click", (evt) => {
      const btn = evt.target.closest("[data-specimen-id]");
      if (btn) {
        const spId = btn.getAttribute("data-specimen-id");
        if (spId) {
          navigate(isAdmin ? `/admin/specimens/${spId}` : `/specimens/${spId}`);
        }
      }
      const closeBtn = evt.target.closest("[data-close-popup]");
      if (closeBtn) {
        map.closePopup();
      }
      const parkBtn = evt.target.closest("[data-park-preset]");
      if (parkBtn) {
        const lat = Number(parkBtn.getAttribute("data-park-lat"));
        const lon = Number(parkBtn.getAttribute("data-park-lon"));
        const rKm = Number(parkBtn.getAttribute("data-park-r") || 30);
        setViewMode("radius");
        setRadiusPin({ lat, lon, radiusKm: rKm });
        map.closePopup();
        map.flyTo([lat, lon], 9);
      }
    });

    mapRef.current = map;
    tileLayerRef.current = tile;
    thematicLayerGroupRef.current = thematicGroup;
    dataLayerGroupRef.current = layerGroup;
    parksLayerGroupRef.current = parksGroup;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initialLat, initialLon, isAdmin, navigate]);

  // Switch Base Map
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    const cfg = BASEMAPS[basemap] || BASEMAPS.street;
    tileLayerRef.current.setUrl(cfg.url);
    tileLayerRef.current.options.maxZoom = cfg.maxZoom || 18;
  }, [basemap]);

  // Adjust Base Map Opacity
  useEffect(() => {
    if (!tileLayerRef.current) return;
    tileLayerRef.current.setOpacity(basemapOpacity);
  }, [basemapOpacity]);

  // Toggle Elevation / Topographic Hillshade Layer (Section 7.4)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (ecologicalLayers.elevation) {
      if (!elevationLayerRef.current) {
        elevationLayerRef.current = L.tileLayer(ELEVATION_HILLSHADE_URL, {
          opacity: 0.42,
          maxZoom: 16,
          attribution: "Esri World Hillshade DEM",
        });
      }
      elevationLayerRef.current.addTo(map);
    } else if (elevationLayerRef.current) {
      map.removeLayer(elevationLayerRef.current);
    }
  }, [ecologicalLayers.elevation]);

  // Invalidate Map Size on Fullscreen or Mobile Drawer Change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [isFullscreen, showMobileSidebar]);

  // Fetch PostGIS Spatial Occurrences & Aggregations
  const fetchOccurrences = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        lat: viewMode === "radius" ? radiusPin.lat : undefined,
        lon: viewMode === "radius" ? radiusPin.lon : undefined,
        radiusKm: viewMode === "radius" ? radiusPin.radiusKm : undefined,
      };
      const data = await specimenService.getMapOccurrences(params);
      if (data) {
        setMapData({
          totalMatching: Number(data.totalMatching || 0),
          returnedPoints: Number(data.returnedPoints ?? (data.points || []).length),
          summary: data.summary || {
            totalOccurrences: Number(data.totalMatching || 0),
            distinctSpeciesCount: 0,
            provincesCount: (data.provinceClusters || []).length,
          },
          points: data.points || [],
          provinceClusters: data.provinceClusters || [],
          regionClusters: data.regionClusters || [],
          heatGrid: data.heatGrid || [],
        });
      }
    } catch (err) {
      toast(err.response?.data?.message || "Không thể tải dữ liệu bản đồ GIS", "error");
    } finally {
      setLoading(false);
    }
  }, [filters, viewMode, radiusPin, toast]);

  useEffect(() => {
    fetchOccurrences();
  }, [fetchOccurrences]);

  // Render Protected Areas / National Parks Layer (Section 7.3)
  useEffect(() => {
    const parksGroup = parksLayerGroupRef.current;
    if (!parksGroup) return;

    parksGroup.clearLayers();
    if (!ecologicalLayers.protectedAreas) return;

    SPATIAL_PRESETS.forEach((park) => {
      // Protected area buffer zone circle (subtle green dashed boundary)
      L.circle([park.lat, park.lon], {
        radius: Number(park.radiusKm || 25) * 450,
        color: "#15803D",
        weight: 1.2,
        dashArray: "4 4",
        fillColor: "#237A35",
        fillOpacity: viewMode === "heatmap" ? 0.03 : 0.06,
        interactive: false,
      }).addTo(parksGroup);

      // Ở chế độ Mật độ & Cụm (heatmap), ẩn ghim tam giác VQG để không đè lên nhãn số lượng cụm tỉnh
      if (viewMode === "heatmap") return;

      const icon = L.divIcon({
        className: "vi-park-marker-icon",
        html: `<div class="vi-park-pin" title="${escapeHtml(park.label)}">▲</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      L.marker([park.lat, park.lon], { icon })
        .bindPopup(
          `<div class="vi-gis-specimen-popup">
            <div class="vi-gis-popup-header">
              <div class="vi-gis-popup-badges">
                <span class="vi-gis-popup-rank" style="background:#15803D;">PROTECTED AREA</span>
                <span class="vi-gis-popup-code">VQG / KBT</span>
              </div>
              <div class="vi-gis-popup-title" style="font-style:normal;">${escapeHtml(park.label)}</div>
            </div>
            <dl class="vi-gis-popup-dl">
              <div><dt>Tọa độ tâm</dt><dd class="mono">${formatWgs84(park.lat, park.lon)}</dd></div>
              <div><dt>Bán kính vùng đệm</dt><dd>${park.radiusKm} km</dd></div>
              <div><dt>Phân hạng</dt><dd>Vườn Quốc gia &amp; Khu Bảo tồn Thiên nhiên</dd></div>
            </dl>
            <div class="vi-gis-popup-footer">
              <button
                type="button"
                class="vi-gis-popup-btn-primary"
                data-park-preset="true"
                data-park-lat="${park.lat}"
                data-park-lon="${park.lon}"
                data-park-r="${park.radiusKm}"
              >
                Truy vấn bán kính PostGIS (${park.radiusKm} km) →
              </button>
              <button type="button" class="vi-gis-popup-btn-close" data-close-popup="true">Đóng</button>
            </div>
          </div>`,
          {
            maxWidth: 310,
            minWidth: 260,
            autoPanPaddingTopLeft: [20, 64],
            autoPanPaddingBottomRight: [20, 84],
          },
        )
        .addTo(parksGroup);
    });
  }, [ecologicalLayers.protectedAreas, viewMode]);

  // Render Ecological Thematic Layers: Administrative Boundaries, Ecological Regions, Species Richness (Section 7)
  useEffect(() => {
    const thematicGroup = thematicLayerGroupRef.current;
    const renderer = canvasRendererRef.current;
    if (!thematicGroup || !mapRef.current) return;

    thematicGroup.clearLayers();

    // 1. Ecological Macro-Regions Layer (PostGIS region aggregation)
    if (ecologicalLayers.ecologicalRegions && (mapData.regionClusters || []).length > 0) {
      mapData.regionClusters.forEach((reg) => {
        if (reg.lat == null || reg.lon == null) return;
        const regColor = REGION_COLORS[reg.region] || REGION_COLORS.Default;
        L.circle([reg.lat, reg.lon], {
          radius: 75000,
          color: regColor,
          weight: 1.8,
          dashArray: "6 4",
          fillColor: regColor,
          fillOpacity: 0.1,
        })
          .bindPopup(
            `<div class="vi-gis-specimen-popup">
              <div class="vi-gis-popup-header">
                <div class="vi-gis-popup-badges">
                  <span class="vi-gis-popup-rank" style="background:${regColor};">ECOLOGICAL REGION</span>
                </div>
                <div class="vi-gis-popup-title" style="font-style:normal;">Vùng sinh thái: ${escapeHtml(reg.region)}</div>
              </div>
              <dl class="vi-gis-popup-dl">
                <div><dt>Tổng mẫu vật</dt><dd><strong>${Number(reg.count || 0).toLocaleString()}</strong> ghi nhận</dd></div>
                <div><dt>Số tỉnh/thành</dt><dd>${reg.provinceCount || 1} tỉnh/thành</dd></div>
                <div><dt>Tọa độ trọng tâm</dt><dd class="mono">${formatWgs84(reg.lat, reg.lon)}</dd></div>
              </dl>
            </div>`,
          )
          .addTo(thematicGroup);
      });
    }

    // 2. Administrative Boundaries / 34 Province Centroids Layer
    if (ecologicalLayers.adminBoundaries && (mapData.provinceClusters || []).length > 0) {
      mapData.provinceClusters.forEach((prov) => {
        if (prov.lat == null || prov.lon == null) return;
        L.circleMarker([prov.lat, prov.lon], {
          renderer,
          radius: 9,
          color: "#103B25",
          weight: 1.8,
          fillColor: "#F8FAF9",
          fillOpacity: 0.75,
        })
          .bindTooltip(`${prov.provinceNameVn} (${Number(prov.count || 0).toLocaleString()})`, {
            direction: "top",
            offset: [0, -6],
          })
          .addTo(thematicGroup);
      });
    }

    // 3. Species Richness Layer (Provincial Species Richness from PostGIS)
    if (ecologicalLayers.speciesRichness && (mapData.provinceClusters || []).length > 0) {
      const maxSp = Math.max(
        1,
        ...mapData.provinceClusters.map((c) => Number(c.speciesCount || Math.ceil((c.count || 1) * 0.15))),
      );
      mapData.provinceClusters.forEach((prov) => {
        if (prov.lat == null || prov.lon == null) return;
        const spCount = Number(prov.speciesCount || 0);
        const col = richnessColor(spCount, maxSp);
        const rPx = 11 + Math.round((Math.log1p(spCount || 1) / Math.log1p(maxSp)) * 16);
        L.circleMarker([prov.lat, prov.lon], {
          renderer,
          radius: rPx,
          color: "#103B25",
          weight: 1.5,
          fillColor: col,
          fillOpacity: 0.55,
        })
          .bindPopup(
            `<div class="vi-gis-specimen-popup">
              <div class="vi-gis-popup-header">
                <div class="vi-gis-popup-badges">
                  <span class="vi-gis-popup-rank" style="background:#103B25;">SPECIES RICHNESS</span>
                </div>
                <div class="vi-gis-popup-title" style="font-style:normal;">${escapeHtml(prov.provinceNameVn)}</div>
              </div>
              <dl class="vi-gis-popup-dl">
                <div><dt>Độ giàu loài</dt><dd><strong>${spCount.toLocaleString()}</strong> loài đã định danh</dd></div>
                <div><dt>Tổng mẫu vật</dt><dd>${Number(prov.count || 0).toLocaleString()} mẫu</dd></div>
                <div><dt>Vùng địa lý</dt><dd>${escapeHtml(prov.region || "Việt Nam")}</dd></div>
              </dl>
            </div>`,
          )
          .addTo(thematicGroup);
      });
    }
  }, [ecologicalLayers.ecologicalRegions, ecologicalLayers.adminBoundaries, ecologicalLayers.speciesRichness, mapData]);

  // Build scientific specimen popup HTML (Section 9)
  const buildSpecimenPopupHtml = useCallback(
    (pt) => {
      const orderColor = getOrderColor(pt.orderName);
      const rankLabel = (pt.taxonRank || "SPECIES").toUpperCase();
      const localityParts = [pt.localityDetail, pt.district, pt.provinceNameVn].filter(Boolean);
      const localityText = localityParts.length > 0 ? localityParts.join(", ") : isEn ? "Not provided" : "Chưa cung cấp";
      const coordsText = formatWgs84(pt.lat, pt.lon);
      const dateText = pt.collectionDate || (isEn ? "Not provided" : "Chưa cung cấp");
      const basisText = formatBasisOfRecord(pt.basisOfRecord);
      const sourceParts = [pt.institutionCode, pt.recordedBy].filter(Boolean);
      const sourceText = sourceParts.length > 0 ? sourceParts.join(" · ") : "VAST / GBIF Vietnam";
      const taxonomyLine = [pt.orderName, pt.familyName, pt.genusName].filter(Boolean).join(" › ");

      return `<div class="vi-gis-specimen-popup" data-testid="specimen-map-popup">
        <div class="vi-gis-popup-header">
          <div class="vi-gis-popup-badges">
            <span class="vi-gis-popup-rank">${escapeHtml(rankLabel)}</span>
            <span class="vi-gis-popup-order" style="border-color:${orderColor};color:${orderColor};">
              ${escapeHtml(pt.orderName || "Insecta")}
            </span>
            <span class="vi-gis-popup-code">${escapeHtml(pt.code || `ID-${pt.id}`)}</span>
          </div>
          <div class="vi-gis-popup-title"><em>${escapeHtml(pt.scientificName)}</em></div>
          ${taxonomyLine ? `<div class="vi-gis-popup-lineage">${escapeHtml(taxonomyLine)}</div>` : ""}
        </div>
        <dl class="vi-gis-popup-dl">
          <div>
            <dt>${isEn ? "Locality" : "Địa điểm"}</dt>
            <dd>${escapeHtml(localityText)}</dd>
          </div>
          <div>
            <dt>${isEn ? "Coordinates (WGS84)" : "Tọa độ (WGS84)"}</dt>
            <dd class="mono">${escapeHtml(coordsText)}${pt.elevationM != null ? ` · ${pt.elevationM}m` : ""
        }${pt.distanceKm != null ? ` · ${pt.distanceKm} km` : ""}</dd>
          </div>
          <div>
            <dt>${isEn ? "Collection Date" : "Ngày thu mẫu"}</dt>
            <dd class="mono">${escapeHtml(dateText)}</dd>
          </div>
          <div>
            <dt>${isEn ? "Record Basis" : "Loại bản ghi"}</dt>
            <dd>${escapeHtml(basisText)}</dd>
          </div>
          <div>
            <dt>${isEn ? "Data Source" : "Nguồn dữ liệu"}</dt>
            <dd>${escapeHtml(sourceText)}</dd>
          </div>
        </dl>
        <div class="vi-gis-popup-footer">
          <button
            type="button"
            class="vi-gis-popup-btn-primary"
            data-specimen-id="${pt.id}"
          >
            ${isEn ? "View Specimen Record →" : "Xem hồ sơ mẫu vật →"}
          </button>
          <button
            type="button"
            class="vi-gis-popup-btn-close"
            data-close-popup="true"
          >
            ${isEn ? "Close" : "Đóng"}
          </button>
        </div>
      </div>`;
    },
    [isEn],
  );

  // Render Specimen Points / Canvas Clusters / Density Heatmap / PostGIS Radius Circle (Sections 6, 8, 9)
  useEffect(() => {
    const layerGroup = dataLayerGroupRef.current;
    const renderer = canvasRendererRef.current;
    if (!layerGroup || !mapRef.current) return;

    layerGroup.clearLayers();

    // 1. PostGIS Radius Query Circle & Center Pin
    if (viewMode === "radius" && radiusPin.lat != null && radiusPin.lon != null) {
      L.circle([radiusPin.lat, radiusPin.lon], {
        radius: Number(radiusPin.radiusKm) * 1000,
        color: "#103B25",
        weight: 2,
        dashArray: "6 4",
        fillColor: "#237A35",
        fillOpacity: 0.11,
      }).addTo(layerGroup);

      L.circleMarker([radiusPin.lat, radiusPin.lon], {
        renderer,
        radius: 8,
        fillColor: "#B0241A",
        color: "#FFFFFF",
        weight: 2.2,
        fillOpacity: 1,
      })
        .bindPopup(
          `<div class="vi-gis-specimen-popup">
            <div class="vi-gis-popup-header">
              <div class="vi-gis-popup-badges">
                <span class="vi-gis-popup-rank" style="background:#B0241A;">POSTGIS ST_DWITHIN</span>
                <span class="vi-gis-popup-code">${radiusPin.radiusKm} KM</span>
              </div>
              <div class="vi-gis-popup-title" style="font-style:normal;">Tâm truy vấn không gian PostGIS</div>
            </div>
            <dl class="vi-gis-popup-dl">
              <div><dt>Tọa độ tâm</dt><dd class="mono">${formatWgs84(radiusPin.lat, radiusPin.lon)}</dd></div>
              <div><dt>Bán kính tìm kiếm</dt><dd>${radiusPin.radiusKm} km (${(radiusPin.radiusKm * 1000).toLocaleString()} m)</dd></div>
              <div><dt>Mẫu vật khớp</dt><dd><strong>${mapData.totalMatching.toLocaleString()}</strong> bản ghi</dd></div>
            </dl>
          </div>`,
        )
        .addTo(layerGroup);
    }

    // 2. Active Bounding Box outline when BBox filter is set
    if (
      filters.minLat !== "" &&
      filters.maxLat !== "" &&
      filters.minLon !== "" &&
      filters.maxLon !== ""
    ) {
      const bounds = [
        [Number(filters.minLat), Number(filters.minLon)],
        [Number(filters.maxLat), Number(filters.maxLon)],
      ];
      L.rectangle(bounds, {
        color: "#1D4ED8",
        weight: 1.5,
        dashArray: "4 4",
        fillColor: "#3B82F6",
        fillOpacity: 0.04,
        interactive: false,
      }).addTo(layerGroup);
    }

    // 3. Density / Heatmap Mode (0.25 deg PostGIS grid + Smooth Thermal Halos + Circular Provincial Nodes)
    if (viewMode === "heatmap") {
      const heatCells = mapData.heatGrid || [];
      const maxGrid = heatCells.reduce((m, g) => Math.max(m, g.count), 1);

      if (heatmapStyle !== "provinces") {
        heatCells.forEach((cell) => {
          const color = heatColor(cell.count, maxGrid);
          const norm = Math.pow(cell.count / maxGrid, 0.5);
          const radiusPx = Math.round(10 + norm * 18);

          // Lớp 1: Vầng nhiệt lan tỏa mềm (Outer Thermal Halo) trên Canvas
          L.circleMarker([cell.lat, cell.lon], {
            renderer,
            radius: Math.round(radiusPx * 1.9),
            fillColor: color,
            color: color,
            weight: 0,
            fillOpacity: 0.15,
            interactive: false,
          }).addTo(layerGroup);

          // Lớp 2: Ô lưới chuẩn địa lý PostGIS 0.25° × 0.25° (Geographic Grid Cell)
          L.rectangle(
            [
              [cell.lat - 0.125, cell.lon - 0.125],
              [cell.lat + 0.125, cell.lon + 0.125],
            ],
            {
              renderer,
              fillColor: color,
              color,
              weight: 0.8,
              opacity: 0.68,
              fillOpacity: 0.34,
            },
          )
            .bindPopup(
              `<div class="vi-gis-specimen-popup">
                <div class="vi-gis-popup-header">
                  <div class="vi-gis-popup-badges">
                    <span class="vi-gis-popup-rank" style="background:${color};">POSTGIS 0.25° GRID</span>
                    <span class="vi-gis-popup-code">~27.5 × 27.5 KM</span>
                  </div>
                  <div class="vi-gis-popup-title" style="font-style:normal;">Ô lưới mật độ không gian</div>
                </div>
                <dl class="vi-gis-popup-dl">
                  <div><dt>Tâm ô lưới</dt><dd class="mono">${formatWgs84(cell.lat, cell.lon)}</dd></div>
                  <div><dt>Mật độ ghi nhận</dt><dd><strong>${cell.count.toLocaleString()}</strong> mẫu vật</dd></div>
                  <div><dt>Tỷ lệ so với đỉnh</dt><dd>${((cell.count / maxGrid) * 100).toFixed(1)}%</dd></div>
                </dl>
              </div>`,
              {
                maxWidth: 300,
                minWidth: 245,
                autoPanPaddingTopLeft: [20, 64],
                autoPanPaddingBottomRight: [20, 84],
              },
            )
            .addTo(layerGroup);

          // Lớp 3: Nhân nhiệt trung tâm (Inner Thermal Core)
          L.circleMarker([cell.lat, cell.lon], {
            renderer,
            radius: Math.max(4, Math.round(radiusPx * 0.45)),
            fillColor: color,
            color: "#FFFFFF",
            weight: 0.8,
            fillOpacity: 0.82,
            interactive: false,
          }).addTo(layerGroup);
        });
      }

      if (heatmapStyle !== "grid") {
        const clusters = mapData.provinceClusters || [];
        const maxProv = clusters.reduce((m, c) => Math.max(m, c.count), 1);

        clusters.forEach((cluster, idx) => {
          if (cluster.lat == null || cluster.lon == null) return;
          const color = heatColor(cluster.count, maxProv);
          const ratio = Math.pow(cluster.count / maxProv, 0.55);
          const size = Math.round(26 + ratio * 16);
          const countLabel =
            cluster.count >= 1000 ? `${(cluster.count / 1000).toFixed(1)}k` : cluster.count;
          const shortProv = String(cluster.provinceNameVn || "").replace(/^(Tỉnh|Thành phố)\s+/i, "");

          const icon = L.divIcon({
            className: "vi-leaflet-cluster-icon",
            html: `<div class="vi-density-node-wrap">
              <div class="vi-density-node-circle" style="width:${size}px;height:${size}px;background:${color};box-shadow:0 0 0 4px ${color}38, 0 3px 8px rgba(0,0,0,0.26);">
                <span>${countLabel}</span>
              </div>
              ${
                idx < 10
                  ? `<span class="vi-density-node-label">${escapeHtml(shortProv)}</span>`
                  : ""
              }
            </div>`,
            iconSize: [size + 36, size + 20],
            iconAnchor: [(size + 36) / 2, size / 2],
          });

          L.marker([cluster.lat, cluster.lon], { icon })
            .bindPopup(
              `<div class="vi-gis-specimen-popup">
                <div class="vi-gis-popup-header">
                  <div class="vi-gis-popup-badges">
                    <span class="vi-gis-popup-rank" style="background:${color};">PROVINCE DENSITY</span>
                    <span class="vi-gis-popup-code">TOP #${idx + 1}</span>
                  </div>
                  <div class="vi-gis-popup-title" style="font-style:normal;">${escapeHtml(cluster.provinceNameVn)}</div>
                </div>
                <dl class="vi-gis-popup-dl">
                  <div><dt>Tổng mẫu vật</dt><dd><strong>${cluster.count.toLocaleString()}</strong> bản ghi</dd></div>
                  ${
                    cluster.speciesCount
                      ? `<div><dt>Độ giàu loài</dt><dd><strong>${cluster.speciesCount.toLocaleString()}</strong> loài</dd></div>`
                      : ""
                  }
                  ${
                    cluster.region
                      ? `<div><dt>Vùng sinh thái</dt><dd>${escapeHtml(cluster.region)}</dd></div>`
                      : ""
                  }
                  <div><dt>Tọa độ trọng tâm</dt><dd class="mono">${formatWgs84(cluster.lat, cluster.lon)}</dd></div>
                </dl>
              </div>`,
              {
                maxWidth: 300,
                minWidth: 250,
                autoPanPaddingTopLeft: [20, 64],
                autoPanPaddingBottomRight: [20, 84],
              },
            )
            .addTo(layerGroup);
        });
      }
      return;
    }

    // 4. Specimen Points or PostGIS Radius Mode
    if (!showMarkers || !ecologicalLayers.occurrences) return;

    const points = mapData.points || [];

    // Dynamic grid clustering when enableClustering is active and zoom <= 8
    if (enableClustering && mapZoom <= 8 && points.length > 60) {
      const cellDeg = mapZoom <= 6 ? 0.65 : 0.32;
      const buckets = new Map();
      points.forEach((pt) => {
        const key = `${Math.floor(pt.lat / cellDeg)}:${Math.floor(pt.lon / cellDeg)}`;
        const b = buckets.get(key) || { count: 0, latSum: 0, lonSum: 0, items: [] };
        b.count += 1;
        b.latSum += pt.lat;
        b.lonSum += pt.lon;
        if (b.items.length < 5) b.items.push(pt);
        buckets.set(key, b);
      });

      buckets.forEach((b) => {
        const cLat = b.latSum / b.count;
        const cLon = b.lonSum / b.count;
        if (b.count === 1) {
          const pt = b.items[0];
          const color = getOrderColor(pt.orderName);
          const marker = L.circleMarker([pt.lat, pt.lon], {
            renderer,
            radius: 5.5,
            fillColor: color,
            color: "#171717",
            weight: 1,
            opacity: 0.92,
            fillOpacity: 0.86,
          }).bindPopup(buildSpecimenPopupHtml(pt), { maxWidth: 320, minWidth: 265 });
          marker.on("click", () => setSelectedPointId(pt.id));
          marker.addTo(layerGroup);
        } else {
          const size = Math.min(44, 24 + Math.round(Math.log2(b.count) * 3.5));
          const icon = L.divIcon({
            className: "vi-point-cluster-icon",
            html: `<div class="vi-point-cluster-badge" style="width:${size}px;height:${size}px;">${b.count}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });
          const clusterMarker = L.marker([cLat, cLon], { icon });
          clusterMarker.on("click", () => {
            if (mapRef.current) {
              mapRef.current.flyTo([cLat, cLon], Math.min(12, mapZoom + 2), { duration: 0.6 });
            }
          });
          clusterMarker.addTo(layerGroup);
        }
      });
      return;
    }

    // Individual Specimen Occurrence Points on HTML5 Canvas
    points.forEach((pt) => {
      const color = getOrderColor(pt.orderName);
      const isSelected = selectedPointId != null && Number(selectedPointId) === Number(pt.id);

      if (isSelected) {
        // High-contrast outer selection ring for selected specimen marker
        L.circleMarker([pt.lat, pt.lon], {
          renderer,
          radius: 11,
          fillColor: "#FFFFFF",
          color: "#103B25",
          weight: 2.5,
          opacity: 1,
          fillOpacity: 0.35,
          interactive: false,
        }).addTo(layerGroup);
      }

      const marker = L.circleMarker([pt.lat, pt.lon], {
        renderer,
        radius: isSelected ? 7.5 : 5.5,
        fillColor: color,
        color: isSelected ? "#FFFFFF" : "#171717",
        weight: isSelected ? 2 : 1,
        opacity: 0.94,
        fillOpacity: isSelected ? 1 : 0.86,
      }).bindPopup(buildSpecimenPopupHtml(pt), {
        maxWidth: 320,
        minWidth: 265,
        autoPanPaddingTopLeft: [20, 64],
        autoPanPaddingBottomRight: [20, 84],
      });

      marker.on("click", () => {
        setSelectedPointId(pt.id);
      });

      marker.addTo(layerGroup);
      if (isSelected) {
        setTimeout(() => {
          if (mapRef.current) marker.openPopup();
        }, 50);
      }
    });
  }, [
    mapData,
    viewMode,
    radiusPin,
    filters.minLat,
    filters.maxLat,
    filters.minLon,
    filters.maxLon,
    showMarkers,
    ecologicalLayers.occurrences,
    enableClustering,
    heatmapStyle,
    mapZoom,
    selectedPointId,
    buildSpecimenPopupHtml,
  ]);

  const handleFlyToProvince = (cluster) => {
    if (!mapRef.current || cluster.lat == null || cluster.lon == null) return;
    mapRef.current.flyTo([cluster.lat, cluster.lon], 9, { duration: 0.85 });
  };

  const handleSelectProtectedArea = (parkLabel) => {
    setSelectedProtectedArea(parkLabel);
    if (!parkLabel) return;
    const park = SPATIAL_PRESETS.find((p) => p.label === parkLabel);
    if (park) {
      setViewMode("radius");
      setRadiusPin({ lat: park.lat, lon: park.lon, radiusKm: park.radiusKm });
      setShowAdvancedSpatial(true);
      if (mapRef.current) {
        mapRef.current.flyTo([park.lat, park.lon], 9, { duration: 0.85 });
      }
    }
  };

  const handleApplyQuickDateRange = (yearsBack) => {
    if (!yearsBack) {
      setFilters((p) => ({ ...p, dateFrom: "", dateTo: "" }));
      return;
    }
    const now = new Date();
    const toIso = now.toISOString().slice(0, 10);
    const fromDate = new Date(now.getFullYear() - yearsBack, now.getMonth(), now.getDate());
    const fromIso = fromDate.toISOString().slice(0, 10);
    setFilters((p) => ({ ...p, dateFrom: fromIso, dateTo: toIso }));
  };

  const handleUseCurrentMapExtent = () => {
    if (!mapRef.current) return;
    const b = mapRef.current.getBounds();
    setFilters((prev) => ({
      ...prev,
      minLat: Number(b.getSouth().toFixed(4)),
      maxLat: Number(b.getNorth().toFixed(4)),
      minLon: Number(b.getWest().toFixed(4)),
      maxLon: Number(b.getEast().toFixed(4)),
    }));
  };

  const handleResetAllFilters = () => {
    setQInput("");
    setGenusInput("");
    setSpeciesInput("");
    setDistrictInput("");
    setSelectedProtectedArea("");
    setSelectedPointId(null);
    setSyncMapExtent(false);
    setFilters(INITIAL_FILTERS);
    if (viewMode === "radius") {
      setRadiusPin(DEFAULT_RADIUS_PIN);
    }
    if (mapRef.current) {
      mapRef.current.flyTo(VIETNAM_CENTER, VIETNAM_ZOOM, { duration: 0.75 });
    }
  };

  const handleExportGeoJson = () => {
    const pts = mapData.points || [];
    if (pts.length === 0) {
      toast(isEn ? "No occurrence points to export" : "Không có điểm tọa độ để xuất GeoJSON", "warning");
      return;
    }
    setExportingGeoJson(true);
    try {
      const geojson = {
        type: "FeatureCollection",
        metadata: {
          source: "VietInsect Biodiversity WebGIS (PostGIS · WGS84 / EPSG:4326)",
          exportedAt: new Date().toISOString(),
          mapMode: viewMode,
          totalMatchingInPostGis: mapData.totalMatching,
          exportedFeaturesCount: pts.length,
          activeFilters: activeFilterChips.map((c) => c.label),
        },
        features: pts.map((pt) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [Number(pt.lon), Number(pt.lat)],
          },
          properties: {
            id: pt.id,
            specimenCode: pt.code,
            scientificName: pt.scientificName,
            taxonRank: pt.taxonRank || "Species",
            order: pt.orderName || null,
            family: pt.familyName || null,
            genus: pt.genusName || null,
            province: pt.provinceNameVn || null,
            district: pt.district || null,
            locality: pt.localityDetail || null,
            elevationM: pt.elevationM ?? null,
            collectionDate: pt.collectionDate || null,
            basisOfRecord: pt.basisOfRecord || null,
            institutionCode: pt.institutionCode || null,
            recordedBy: pt.recordedBy || null,
            distanceKm: pt.distanceKm ?? undefined,
          },
        })),
      };
      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vietinsect-occurrences-${pts.length}pts.geojson`;
      link.click();
      URL.revokeObjectURL(url);
      toast(
        isEn
          ? `Exported ${pts.length.toLocaleString()} filtered occurrences to GeoJSON (WGS84)`
          : `Đã xuất ${pts.length.toLocaleString()} điểm mẫu vật khớp lọc ra tệp GeoJSON (WGS84)`,
        "success",
      );
    } catch (_) {
      toast(isEn ? "Failed to export GeoJSON" : "Lỗi khi xuất tệp GeoJSON", "error");
    } finally {
      setExportingGeoJson(false);
    }
  };

  const handlePrintMap = () => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
    window.print();
  };

  const toggleEcologicalLayer = (key) => {
    if (key === "vegetation") return; // Unavailable in PostGIS DB
    setEcologicalLayers((prev) => ({ ...prev, [key]: !prev[key] }));
    if (key === "occurrences") {
      setShowMarkers((prev) => !prev);
    }
  };

  const activeLayerCount = useMemo(
    () =>
      Object.entries(ecologicalLayers).filter(([k, v]) => k !== "vegetation" && Boolean(v)).length,
    [ecologicalLayers],
  );

  const legendOrders = useMemo(
    () => ["Lepidoptera", "Coleoptera", "Hymenoptera", "Diptera", "Odonata", "Hemiptera"],
    [],
  );

  const distinctSpeciesStat =
    mapData.summary?.distinctSpeciesCount ||
    mapData.provinceClusters.reduce((acc, c) => Math.max(acc, Number(c.speciesCount || 0)), 0);

  const provincesCoveredStat =
    mapData.summary?.provincesCount ||
    mapData.provinceClusters.filter((c) => c.provinceId != null || c.provinceNameVn).length;

  return (
    <div
      className="page-container page-content vi-page-enter vi-gis-page-root"
      data-testid="webgis-occurrence-page"
    >
      {/* Print-only Cartographic Header Sheet (Section 11) */}
      <div className="vi-gis-print-sheet" aria-hidden="true">
        <div className="vi-gis-print-head">
          <div>
            <strong>VIỆN CÔNG NGHỆ THÔNG TIN (VAST) · NỀN TẢNG DỮ LIỆU ĐA DẠNG SINH HỌC VIETINSECT</strong>
            <h2>{t("webgis.title")}</h2>
          </div>
          <div className="mono" style={{ fontSize: 11, textAlign: "right" }}>
            <div>Hệ quy chiếu: WGS84 (EPSG:4326 · PostGIS 3)</div>
            <div>Ngày trích xuất: {new Date().toLocaleString("vi-VN")}</div>
          </div>
        </div>
        <div className="vi-gis-print-meta">
          <span>
            Chế độ bản đồ: <strong>{t(`webgis.modes.${viewMode}`)}</strong>
          </span>
          <span>
            Tổng mẫu vật khớp lọc: <strong>{mapData.totalMatching.toLocaleString()}</strong>
          </span>
          <span>
            Điểm hiển thị trên bản đồ: <strong>{mapData.returnedPoints.toLocaleString()}</strong>
          </span>
          <span>
            Bộ lọc đang áp dụng:{" "}
            <strong>
              {activeFilterChips.length > 0
                ? activeFilterChips.map((c) => c.label).join(" | ")
                : "Toàn bộ lãnh thổ Việt Nam"}
            </strong>
          </span>
        </div>
      </div>

      {/* SECTION 3: COMPACT PAGE HEADER */}
      <header className="vi-gis-compact-header">
        <div className="vi-gis-header-left">
          <div className="vi-gis-eyebrow">
            <Icon name="map" size={13} />
            <span>{t("webgis.eyebrow")}</span>
          </div>
          <div className="vi-gis-title-line">
            <h1>{t("webgis.title")}</h1>
            <p className="vi-gis-subtitle">{t("webgis.subtitle")}</p>
          </div>
        </div>

        <div className="vi-gis-header-right">
          {/* Compact Spatial Stat Pills */}
          <div className="vi-gis-stat-strip" data-testid="webgis-header-stats">
            <div className="vi-gis-stat-pill">
              <span>{t("webgis.stats.occurrences")}</span>
              <strong>{mapData.totalMatching.toLocaleString()}</strong>
            </div>
            <div className="vi-gis-stat-pill">
              <span>{t("webgis.stats.species")}</span>
              <strong>{distinctSpeciesStat > 0 ? distinctSpeciesStat.toLocaleString() : "—"}</strong>
            </div>
            <div className="vi-gis-stat-pill">
              <span>{t("webgis.stats.provinces")}</span>
              <strong>{provincesCoveredStat}</strong>
            </div>
            <div className="vi-gis-stat-pill is-accent">
              <span>{t("webgis.stats.displayed")}</span>
              <strong>{mapData.returnedPoints.toLocaleString()}</strong>
            </div>
          </div>

          {/* Segmented Map Mode Controls & Export / Print Toolbar */}
          <div className="vi-gis-toolbar-row">
            <button
              type="button"
              className="button button-sm button-secondary vi-gis-mobile-filter-toggle"
              onClick={() => setShowMobileSidebar((prev) => !prev)}
            >
              <Icon name="filter" size={14} />
              {t("webgis.actions.toggleSidebar")}
              {activeFilterChips.length > 0 ? ` (${activeFilterChips.length})` : ""}
            </button>

            <div
              className="vi-segmented-group vi-gis-mode-segmented"
              role="group"
              aria-label="Chế độ bản đồ"
              data-testid="webgis-mode-segmented"
            >
              <button
                type="button"
                className={viewMode === "points" ? "active" : ""}
                onClick={() => setViewMode("points")}
              >
                {t("webgis.modes.points")}
              </button>
              <button
                type="button"
                className={viewMode === "heatmap" ? "active" : ""}
                onClick={() => setViewMode("heatmap")}
              >
                {t("webgis.modes.heatmap")}
              </button>
              <button
                type="button"
                className={viewMode === "radius" ? "active" : ""}
                onClick={() => {
                  setViewMode("radius");
                  setShowAdvancedSpatial(true);
                }}
              >
                {t("webgis.modes.radius")}
              </button>
            </div>

            <button
              type="button"
              className="button button-sm button-ghost"
              onClick={handleExportGeoJson}
              disabled={exportingGeoJson || mapData.points.length === 0}
              title={`Xuất ${mapData.points.length.toLocaleString()} bản ghi đang lọc ra chuẩn GeoJSON (WGS84)`}
              data-testid="webgis-export-geojson"
            >
              <Icon name="file" size={14} />
              {exportingGeoJson
                ? t("webgis.actions.exporting")
                : `${t("webgis.actions.exportGeoJson")} (${mapData.points.length.toLocaleString()})`}
            </button>

            <button
              type="button"
              className="button button-sm button-ghost"
              onClick={handlePrintMap}
              title="In hoặc xuất PDF bản đồ kèm chú giải & bộ lọc (F-GI-05)"
              data-testid="webgis-print-map"
            >
              <Icon name="archive" size={14} />
              {t("webgis.actions.printMap")}
            </button>

            {/* Quick Language Toggle VI / EN (Section 12 & 14.12) */}
            <button
              type="button"
              className="button button-sm button-ghost mono"
              onClick={() => {
                const nextLng = isEn ? "vi" : "en";
                i18n.changeLanguage(nextLng);
                if (typeof window !== "undefined" && window.localStorage) {
                  window.localStorage.setItem("vietinsect_language", nextLng);
                }
              }}
              title="Chuyển đổi ngôn ngữ VI / EN"
              data-testid="webgis-lang-toggle"
            >
              {isEn ? "EN ⇄ VI" : "VI ⇄ EN"}
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  className="button button-sm button-secondary"
                  onClick={() => navigate("/admin/map/layers")}
                >
                  <Icon name="layers" size={14} />
                  {t("webgis.actions.layerManager")}
                </button>
                <button
                  type="button"
                  className="button button-sm button-primary"
                  onClick={() => navigate("/admin/ai/sdm")}
                >
                  <Icon name="spark" size={14} />
                  {t("webgis.actions.sdmModel")}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* SECTION 4 & 5: WEBGIS MAIN TWO-COLUMN WORKBENCH */}
      <div className="vi-gis-workbench">
        {/* LEFT SPATIAL FILTER SIDEBAR (350px desktop, collapsible drawer on mobile) */}
        <aside
          className={`card panel vi-gis-sidebar ${showMobileSidebar ? "is-mobile-open" : ""}`}
          data-testid="webgis-filter-sidebar"
        >
          {/* Sticky Sidebar Header */}
          <div className="vi-gis-sidebar-sticky-head">
            <div className="vi-gis-sidebar-title-row">
              <div>
                <h2>{t("webgis.filters.headerTitle")}</h2>
                <span className="vi-gis-filter-sub">
                  {activeFilterChips.length > 0
                    ? t("webgis.filters.activeCount", { count: activeFilterChips.length })
                    : t("webgis.filters.noActive")}
                </span>
              </div>
              <div className="vi-gis-sidebar-head-actions">
                <button
                  type="button"
                  className="button button-sm button-primary"
                  onClick={handleApplyFiltersNow}
                  data-testid="webgis-apply-filters"
                >
                  {t("webgis.actions.applyFilters")}
                </button>
                <button
                  type="button"
                  className="button button-sm button-ghost"
                  onClick={handleResetAllFilters}
                  data-testid="webgis-reset-filters"
                >
                  {t("webgis.actions.resetAll")}
                </button>
              </div>
            </div>

            {/* Active Filter Chips */}
            {activeFilterChips.length > 0 && (
              <div className="vi-gis-active-chips" data-testid="gis-active-filter-chips">
                {activeFilterChips.map((chip) => (
                  <span key={chip.key} className="vi-gis-filter-chip">
                    <span>{chip.label}</span>
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      aria-label={`Xóa bộ lọc ${chip.label}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="vi-gis-sidebar-body">
            {/* GROUP A: TAXONOMIC FILTERS */}
            <section className="vi-gis-filter-group">
              <h3 className="vi-gis-group-heading">{t("webgis.filters.groupTaxon")}</h3>

              <div className="vi-gis-field">
                <label htmlFor="gis-filter-q">
                  {isEn ? "Scientific Name / Specimen Code" : "Tên khoa học / Mã mẫu / Địa danh"}
                </label>
                <input
                  id="gis-filter-q"
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder={t("webgis.filters.searchPlaceholder")}
                />
              </div>

              <div className="vi-gis-grid-2">
                <div className="vi-gis-field">
                  <label htmlFor="gis-filter-order">{t("webgis.filters.order")}</label>
                  <select
                    id="gis-filter-order"
                    value={filters.order}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, order: e.target.value, family: "" }))
                    }
                  >
                    <option value="">{t("webgis.filters.allOrders")}</option>
                    {lookups.orders.map((o) => (
                      <option key={o.id} value={o.scientificName}>
                        {o.scientificName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vi-gis-field">
                  <label htmlFor="gis-filter-family">{t("webgis.filters.family")}</label>
                  <select
                    id="gis-filter-family"
                    value={filters.family}
                    onChange={(e) => setFilters((p) => ({ ...p, family: e.target.value }))}
                  >
                    <option value="">{t("webgis.filters.allFamilies")}</option>
                    {availableFamilies.map((f) => (
                      <option key={f.id || f.scientificName} value={f.scientificName}>
                        {f.scientificName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="vi-gis-grid-2">
                <div className="vi-gis-field">
                  <label htmlFor="gis-filter-genus">{t("webgis.filters.genus")}</label>
                  <input
                    id="gis-filter-genus"
                    value={genusInput}
                    onChange={(e) => setGenusInput(e.target.value)}
                    placeholder={t("webgis.filters.genusPlaceholder")}
                  />
                </div>
                <div className="vi-gis-field">
                  <label htmlFor="gis-filter-species">{t("webgis.filters.species")}</label>
                  <input
                    id="gis-filter-species"
                    value={speciesInput}
                    onChange={(e) => setSpeciesInput(e.target.value)}
                    placeholder={t("webgis.filters.speciesPlaceholder")}
                  />
                </div>
              </div>
            </section>

            {/* GROUP B: ADMINISTRATIVE & PROTECTED AREA FILTERS */}
            <section className="vi-gis-filter-group">
              <h3 className="vi-gis-group-heading">{t("webgis.filters.groupAdmin")}</h3>

              <div className="vi-gis-grid-2">
                <div className="vi-gis-field">
                  <label htmlFor="gis-filter-province">{t("webgis.filters.province")}</label>
                  <select
                    id="gis-filter-province"
                    value={filters.provinceId}
                    onChange={(e) => setFilters((p) => ({ ...p, provinceId: e.target.value }))}
                  >
                    <option value="">{t("webgis.filters.allProvinces")}</option>
                    {lookups.provinces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameVn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vi-gis-field">
                  <label htmlFor="gis-filter-district">{t("webgis.filters.district")}</label>
                  <input
                    id="gis-filter-district"
                    value={districtInput}
                    onChange={(e) => setDistrictInput(e.target.value)}
                    placeholder={t("webgis.filters.districtPlaceholder")}
                  />
                </div>
              </div>

              <div className="vi-gis-field">
                <label htmlFor="gis-filter-park">{t("webgis.filters.protectedArea")}</label>
                <select
                  id="gis-filter-park"
                  value={selectedProtectedArea}
                  onChange={(e) => handleSelectProtectedArea(e.target.value)}
                >
                  <option value="">{t("webgis.filters.allProtectedAreas")}</option>
                  {SPATIAL_PRESETS.map((pr) => (
                    <option key={pr.label} value={pr.label}>
                      {pr.label} ({pr.radiusKm} km)
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {/* GROUP C: DATA SOURCE & RECORD TYPE FILTERS */}
            <section className="vi-gis-filter-group">
              <h3 className="vi-gis-group-heading">{t("webgis.filters.groupSource")}</h3>

              <div className="vi-gis-field">
                <label htmlFor="gis-filter-basis">{t("webgis.filters.basisOfRecord")}</label>
                <select
                  id="gis-filter-basis"
                  value={filters.basisOfRecord}
                  onChange={(e) => setFilters((p) => ({ ...p, basisOfRecord: e.target.value }))}
                >
                  <option value="">{t("webgis.filters.allBasis")}</option>
                  {Object.entries(BASIS_OF_RECORD_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vi-gis-grid-2">
                <div className="vi-gis-field">
                  <label htmlFor="gis-filter-inst">{t("webgis.filters.institution")}</label>
                  <select
                    id="gis-filter-inst"
                    value={filters.institutionCode}
                    onChange={(e) => setFilters((p) => ({ ...p, institutionCode: e.target.value }))}
                  >
                    <option value="">{t("webgis.filters.allInstitutions")}</option>
                    {lookups.institutions.map((inst) => (
                      <option key={inst} value={inst}>
                        {inst}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vi-gis-field">
                  <label htmlFor="gis-filter-habitat">{t("webgis.filters.habitat")}</label>
                  <select
                    id="gis-filter-habitat"
                    value={filters.habitatId}
                    onChange={(e) => setFilters((p) => ({ ...p, habitatId: e.target.value }))}
                  >
                    <option value="">{t("webgis.filters.allHabitats")}</option>
                    {lookups.habitats.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.labelVn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* GROUP D: TEMPORAL FILTERS */}
            <section className="vi-gis-filter-group">
              <div className="vi-gis-group-head-inline">
                <h3 className="vi-gis-group-heading" style={{ marginBottom: 0 }}>
                  {t("webgis.filters.groupTemporal")}
                </h3>
                <div className="vi-gis-quick-dates">
                  <button type="button" onClick={() => handleApplyQuickDateRange(1)}>
                    1Y
                  </button>
                  <button type="button" onClick={() => handleApplyQuickDateRange(5)}>
                    5Y
                  </button>
                  <button type="button" onClick={() => handleApplyQuickDateRange(10)}>
                    10Y
                  </button>
                  <button type="button" onClick={() => handleApplyQuickDateRange(0)}>
                    {isEn ? "All" : "Tất cả"}
                  </button>
                </div>
              </div>

              <div className="vi-gis-grid-2">
                <div className="vi-gis-field">
                  <label htmlFor="gis-filter-date-from">{t("webgis.filters.dateFrom")}</label>
                  <input
                    id="gis-filter-date-from"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                  />
                </div>
                <div className="vi-gis-field">
                  <label htmlFor="gis-filter-date-to">{t("webgis.filters.dateTo")}</label>
                  <input
                    id="gis-filter-date-to"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            {/* GROUP E: DISPLAY & CANVAS PERFORMANCE SETTINGS */}
            <section className="vi-gis-filter-group">
              <h3 className="vi-gis-group-heading">{t("webgis.filters.groupDisplay")}</h3>

              {viewMode === "heatmap" ? (
                <div className="vi-gis-field">
                  <label htmlFor="gis-heatmap-style">
                    {isEn ? "Density Display Layer" : "Kiểu hiển thị mật độ không gian"}
                  </label>
                  <select
                    id="gis-heatmap-style"
                    value={heatmapStyle}
                    onChange={(e) => setHeatmapStyle(e.target.value)}
                  >
                    <option value="hybrid">
                      {isEn ? "Hybrid (0.25° Grid + Province Nodes)" : "Kết hợp (Lưới nhiệt 0.25° + Cụm tỉnh)"}
                    </option>
                    <option value="grid">
                      {isEn ? "0.25° Spatial Heat Grid Only" : "Chỉ lưới nhiệt không gian 0.25°"}
                    </option>
                    <option value="provinces">
                      {isEn ? "Provincial Density Circles Only" : "Chỉ vòng tròn mật độ Tỉnh/Thành"}
                    </option>
                  </select>
                </div>
              ) : (
                <div className="vi-gis-field">
                  <label htmlFor="gis-filter-limit">{t("webgis.filters.maxPoints")}</label>
                  <select
                    id="gis-filter-limit"
                    value={filters.limit}
                    onChange={(e) => setFilters((p) => ({ ...p, limit: Number(e.target.value) }))}
                  >
                    <option value={1500}>1,500 {isEn ? "points (Fast)" : "điểm gần nhất (Nhanh)"}</option>
                    <option value={3000}>3,000 {isEn ? "points (Recommended)" : "điểm (Khuyên dùng)"}</option>
                    <option value={6000}>6,000 {isEn ? "points (High density)" : "điểm (Mật độ cao)"}</option>
                  </select>
                </div>
              )}

              <label className="vi-gis-check-row">
                <input
                  type="checkbox"
                  checked={showMarkers}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowMarkers(checked);
                    setEcologicalLayers((p) => ({ ...p, occurrences: checked }));
                  }}
                />
                <span>{t("webgis.filters.showMarkers")}</span>
              </label>

              <label className="vi-gis-check-row">
                <input
                  type="checkbox"
                  checked={enableClustering}
                  onChange={(e) => setEnableClustering(e.target.checked)}
                />
                <span>{t("webgis.filters.enableClustering")}</span>
              </label>

              <label className="vi-gis-check-row">
                <input
                  type="checkbox"
                  checked={syncMapExtent}
                  onChange={(e) => setSyncMapExtent(e.target.checked)}
                />
                <span>{t("webgis.filters.syncMapExtent")}</span>
              </label>
            </section>

            {/* GROUP F: COLLAPSIBLE ADVANCED SPATIAL FILTERS */}
            <section className="vi-gis-filter-group vi-gis-advanced-group">
              <button
                type="button"
                className="vi-gis-accordion-trigger"
                onClick={() => setShowAdvancedSpatial((prev) => !prev)}
                aria-expanded={showAdvancedSpatial}
                data-testid="webgis-advanced-spatial-toggle"
              >
                <span>{t("webgis.filters.groupAdvanced")}</span>
                <span>{showAdvancedSpatial ? "▾" : "▸"}</span>
              </button>

              {showAdvancedSpatial && (
                <div className="vi-gis-accordion-body" data-testid="webgis-advanced-spatial-body">
                  {/* 1. Ecological Region */}
                  <div className="vi-gis-field">
                    <label htmlFor="gis-filter-region">{t("webgis.filters.ecologicalRegion")}</label>
                    <select
                      id="gis-filter-region"
                      value={filters.region}
                      onChange={(e) => setFilters((p) => ({ ...p, region: e.target.value }))}
                    >
                      <option value="">{t("webgis.filters.allRegions")}</option>
                      {(lookups.regions.length > 0
                        ? lookups.regions
                        : [
                          "Tây Bắc",
                          "Đông Bắc",
                          "Đồng bằng sông Hồng",
                          "Bắc Trung Bộ",
                          "Nam Trung Bộ",
                          "Tây Nguyên",
                          "Đông Nam Bộ",
                          "Đồng bằng sông Cửu Long",
                        ]
                      ).map((reg) => (
                        <option key={reg} value={reg}>
                          {reg}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Elevation Range (m) */}
                  <div className="vi-gis-field">
                    <label>{t("webgis.filters.elevationRange")}</label>
                    <div className="vi-gis-grid-2">
                      <input
                        type="number"
                        placeholder="Min (m)"
                        value={filters.minElevation}
                        onChange={(e) => setFilters((p) => ({ ...p, minElevation: e.target.value }))}
                      />
                      <input
                        type="number"
                        placeholder="Max (m)"
                        value={filters.maxElevation}
                        onChange={(e) => setFilters((p) => ({ ...p, maxElevation: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* 3. PostGIS Radius Query Controls */}
                  <div className="vi-gis-subbox">
                    <div className="vi-gis-subbox-head">
                      <strong>{t("webgis.filters.radiusCenter")}</strong>
                      <button
                        type="button"
                        className="vi-gis-link-btn"
                        onClick={() => {
                          setViewMode("radius");
                          setRadiusPin(DEFAULT_RADIUS_PIN);
                        }}
                      >
                        {t("webgis.actions.resetRadius")}
                      </button>
                    </div>
                    <div className="vi-gis-grid-2" style={{ marginBottom: 6 }}>
                      <div className="vi-gis-field" style={{ marginBottom: 0 }}>
                        <label htmlFor="gis-radius-lat">Lat (°N)</label>
                        <input
                          id="gis-radius-lat"
                          type="number"
                          step="0.01"
                          value={radiusPin.lat}
                          onChange={(e) => {
                            setViewMode("radius");
                            setRadiusPin((p) => ({ ...p, lat: Number(e.target.value) }));
                          }}
                        />
                      </div>
                      <div className="vi-gis-field" style={{ marginBottom: 0 }}>
                        <label htmlFor="gis-radius-lon">Lon (°E)</label>
                        <input
                          id="gis-radius-lon"
                          type="number"
                          step="0.01"
                          value={radiusPin.lon}
                          onChange={(e) => {
                            setViewMode("radius");
                            setRadiusPin((p) => ({ ...p, lon: Number(e.target.value) }));
                          }}
                        />
                      </div>
                    </div>
                    <div className="vi-gis-field" style={{ marginBottom: 6 }}>
                      <label htmlFor="gis-radius-km">
                        PostGIS ST_DWithin: <strong>{radiusPin.radiusKm} km</strong>
                      </label>
                      <input
                        id="gis-radius-km"
                        type="range"
                        min="5"
                        max="150"
                        step="5"
                        value={radiusPin.radiusKm}
                        onChange={(e) => {
                          setViewMode("radius");
                          setRadiusPin((prev) => ({ ...prev, radiusKm: Number(e.target.value) }));
                        }}
                      />
                    </div>
                    <div className="vi-gis-preset-chips">
                      {SPATIAL_PRESETS.slice(0, 6).map((pr) => (
                        <button
                          key={pr.label}
                          type="button"
                          onClick={() => {
                            setViewMode("radius");
                            setRadiusPin({ lat: pr.lat, lon: pr.lon, radiusKm: pr.radiusKm });
                            if (mapRef.current) mapRef.current.flyTo([pr.lat, pr.lon], 9);
                          }}
                        >
                          {pr.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. Coordinate Bounding Box (BBox) */}
                  <div className="vi-gis-subbox">
                    <div className="vi-gis-subbox-head">
                      <strong>{t("webgis.filters.bbox")}</strong>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="vi-gis-link-btn"
                          onClick={handleUseCurrentMapExtent}
                        >
                          {t("webgis.actions.useMapExtent")}
                        </button>
                        {(filters.minLat !== "" || filters.maxLat !== "") && (
                          <button
                            type="button"
                            className="vi-gis-link-btn"
                            onClick={() =>
                              setFilters((p) => ({
                                ...p,
                                minLat: "",
                                maxLat: "",
                                minLon: "",
                                maxLon: "",
                              }))
                            }
                          >
                            {t("webgis.actions.clearBbox")}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="vi-gis-grid-2">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Min Lat (°N)"
                        value={filters.minLat}
                        onChange={(e) => setFilters((p) => ({ ...p, minLat: e.target.value }))}
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Max Lat (°N)"
                        value={filters.maxLat}
                        onChange={(e) => setFilters((p) => ({ ...p, maxLat: e.target.value }))}
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Min Lon (°E)"
                        value={filters.minLon}
                        onChange={(e) => setFilters((p) => ({ ...p, minLon: e.target.value }))}
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Max Lon (°E)"
                        value={filters.maxLon}
                        onChange={(e) => setFilters((p) => ({ ...p, maxLon: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* TOP PROVINCES BY OCCURRENCE & SPECIES RICHNESS */}
            <section className="vi-gis-filter-group" style={{ borderBottom: "none" }}>
              <h3 className="vi-gis-group-heading">
                {isEn
                  ? "Top Regions by Density & Richness (Click to zoom)"
                  : "Vùng tập trung mẫu vật & Độ giàu loài"}
              </h3>
              <div className="vi-province-rank-list">
                {mapData.provinceClusters.slice(0, 7).map((c) => (
                  <button
                    key={c.provinceId || c.provinceNameVn}
                    type="button"
                    className="vi-province-rank-item"
                    onClick={() => handleFlyToProvince(c)}
                  >
                    <span>{c.provinceNameVn}</span>
                    <span className="mono" style={{ fontSize: 11, color: "#237A35", fontWeight: 700 }}>
                      {c.count.toLocaleString()} {isEn ? "rec" : "mẫu"}
                      {c.speciesCount ? ` · ${c.speciesCount} sp.` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </aside>

        {/* RIGHT INTERACTIVE MAP STAGE */}
        <section className={`card vi-gis-stage ${isFullscreen ? "is-fullscreen" : ""}`}>
          {/* Top Map Controls Overlay (Section 6 & 7) */}
          <div className="vi-map-overlay-top">
            <div className="vi-map-toolbar-left">
              {/* Segmented Base Map Switcher */}
              <div className="vi-segmented-group vi-map-basemap-group">
                {Object.entries(BASEMAPS).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    className={basemap === key ? "active" : ""}
                    onClick={() => setBasemap(key)}
                    title={isEn ? cfg.labelEn : cfg.labelVi}
                  >
                    {isEn ? cfg.shortEn : cfg.shortVi}
                  </button>
                ))}
              </div>

              {/* Base Map Opacity Slider */}
              <div className="vi-map-opacity-pill">
                <span>{isEn ? "Opacity:" : "Độ rõ nền:"}</span>
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  value={basemapOpacity}
                  onChange={(e) => setBasemapOpacity(Number(e.target.value))}
                  aria-label="Độ rõ bản đồ nền"
                />
                <span className="mono">{Math.round(basemapOpacity * 100)}%</span>
              </div>

              {/* Ecological GIS Layers Toggle Button (Section 7) */}
              <button
                type="button"
                className={`vi-map-btn ${showLayersPanel ? "is-active" : ""}`}
                onClick={() => setShowLayersPanel((prev) => !prev)}
                data-testid="webgis-layers-toggle"
              >
                <Icon name="layers" size={14} />
                <span>
                  {t("webgis.actions.layersPanel")} ({activeLayerCount}/6)
                </span>
              </button>

              {/* Reset Vietnam Extent */}
              <button
                type="button"
                className="vi-map-btn"
                onClick={() => {
                  if (mapRef.current) mapRef.current.flyTo(VIETNAM_CENTER, VIETNAM_ZOOM, { duration: 0.7 });
                }}
              >
                {t("webgis.actions.resetExtent")}
              </button>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                className="vi-map-btn"
                onClick={() => setIsFullscreen((prev) => !prev)}
              >
                <Icon name="eye" size={14} />
                {isFullscreen ? t("webgis.actions.exitFullscreen") : t("webgis.actions.fullscreen")}
              </button>
            </div>

            {/* Live PostGIS Status Chip */}
            <div className="vi-map-counter-chip" data-testid="webgis-status-chip">
              {loading
                ? isEn
                  ? "Querying PostGIS..."
                  : "Đang truy vấn PostGIS..."
                : viewMode === "heatmap"
                  ? isEn
                    ? `PostGIS 100% Aggregation (${mapData.totalMatching.toLocaleString()} records)`
                    : `Tổng hợp PostGIS 100% (${mapData.totalMatching.toLocaleString()} mẫu vật)`
                  : viewMode === "radius"
                    ? `PostGIS ${radiusPin.radiusKm}km: ${mapData.totalMatching.toLocaleString()} ${isEn ? "matches" : "mẫu khớp"
                    }`
                    : `${isEn ? "Showing" : "Hiển thị"} ${mapData.returnedPoints.toLocaleString()} / ${mapData.totalMatching.toLocaleString()} ${isEn ? "occurrences" : "mẫu vật"
                    }`}
            </div>
          </div>

          {/* SECTION 7: ECOLOGICAL GIS LAYER-CONTROL FLOATING PANEL */}
          {showLayersPanel && (
            <div className="vi-gis-layers-popover" data-testid="gis-layers-panel">
              <div className="vi-gis-layers-popover-head">
                <strong>{t("webgis.layers.title")}</strong>
                <button
                  type="button"
                  onClick={() => setShowLayersPanel(false)}
                  aria-label="Đóng bảng lớp bản đồ"
                >
                  ×
                </button>
              </div>

              <div className="vi-gis-layers-section">
                <div className="vi-gis-layers-subhead">{t("webgis.layers.thematic")}</div>

                {/* 1. Specimen Occurrence Points */}
                <label className="vi-gis-layer-row">
                  <input
                    type="checkbox"
                    checked={ecologicalLayers.occurrences}
                    onChange={() => toggleEcologicalLayer("occurrences")}
                  />
                  <span className="vi-layer-swatch is-circle" style={{ background: "#237A35" }} />
                  <span className="vi-layer-name">{t("webgis.layers.occurrences")}</span>
                  <span className="vi-layer-badge is-live">PostGIS</span>
                </label>

                {/* 2. Protected Areas & National Parks */}
                <label className="vi-gis-layer-row">
                  <input
                    type="checkbox"
                    checked={ecologicalLayers.protectedAreas}
                    onChange={() => toggleEcologicalLayer("protectedAreas")}
                  />
                  <span className="vi-layer-swatch" style={{ background: "#15803D" }} />
                  <span className="vi-layer-name">{t("webgis.layers.protectedAreas")}</span>
                  <span className="vi-layer-badge is-live">10 VQG</span>
                </label>

                {/* 3. Administrative Boundaries & 34 Province Centroids */}
                <label className="vi-gis-layer-row">
                  <input
                    type="checkbox"
                    checked={ecologicalLayers.adminBoundaries}
                    onChange={() => toggleEcologicalLayer("adminBoundaries")}
                  />
                  <span
                    className="vi-layer-swatch is-circle"
                    style={{ background: "#F8FAF9", border: "2px solid #103B25" }}
                  />
                  <span className="vi-layer-name">{t("webgis.layers.adminBoundaries")}</span>
                  <span className="vi-layer-badge is-live">34 Tỉnh</span>
                </label>

                {/* 4. Ecological Macro-Regions */}
                <label className="vi-gis-layer-row">
                  <input
                    type="checkbox"
                    checked={ecologicalLayers.ecologicalRegions}
                    onChange={() => toggleEcologicalLayer("ecologicalRegions")}
                  />
                  <span
                    className="vi-layer-swatch"
                    style={{ background: "rgba(30,111,92,0.25)", border: "1.5px dashed #1E6F5C" }}
                  />
                  <span className="vi-layer-name">{t("webgis.layers.ecologicalRegions")}</span>
                  <span className="vi-layer-badge is-live">8 Vùng</span>
                </label>

                {/* 5. Species Richness by Province */}
                <label className="vi-gis-layer-row">
                  <input
                    type="checkbox"
                    checked={ecologicalLayers.speciesRichness}
                    onChange={() => toggleEcologicalLayer("speciesRichness")}
                  />
                  <span className="vi-layer-swatch is-circle" style={{ background: "#103B25" }} />
                  <span className="vi-layer-name">{t("webgis.layers.speciesRichness")}</span>
                  <span className="vi-layer-badge is-live">PostGIS</span>
                </label>

                {/* 6. Elevation / Topographic Hillshade */}
                <label className="vi-gis-layer-row">
                  <input
                    type="checkbox"
                    checked={ecologicalLayers.elevation}
                    onChange={() => toggleEcologicalLayer("elevation")}
                  />
                  <span className="vi-layer-swatch" style={{ background: "#8D6E63" }} />
                  <span className="vi-layer-name">{t("webgis.layers.elevation")}</span>
                  <span className="vi-layer-badge">DEM Tile</span>
                </label>

                {/* 7. Vegetation Cover (Unavailable in local PostGIS DB — Honest Unavailable State) */}
                <div
                  className="vi-gis-layer-row is-unavailable"
                  data-testid="gis-layer-vegetation-unavailable"
                >
                  <input type="checkbox" disabled checked={false} readOnly />
                  <span className="vi-layer-swatch" style={{ background: "#CBD5E1" }} />
                  <div style={{ flex: 1 }}>
                    <div className="vi-layer-name">{t("webgis.layers.vegetation")}</div>
                    <div className="vi-layer-unavail-note">{t("webgis.layers.unavailableHint")}</div>
                  </div>
                  <span className="vi-layer-badge is-unavail">
                    {t("webgis.layers.unavailableBadge")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* LEAFLET CANVAS CONTAINER */}
          <div ref={mapContainerRef} className="vi-leaflet-canvas" />

          {/* SECTION 10: COLLAPSIBLE MAP LEGEND & SPATIAL STATISTICS PANEL */}
          <div
            className={`vi-gis-legend-panel ${legendCollapsed ? "is-collapsed" : ""}`}
            data-testid="gis-legend-panel"
          >
            <div className="vi-gis-legend-head">
              <button
                type="button"
                className="vi-gis-legend-toggle"
                onClick={() => setLegendCollapsed((prev) => !prev)}
              >
                <strong>{t("webgis.actions.legendPanel")}</strong>
                <span>{legendCollapsed ? "▴" : "▾"}</span>
              </button>
            </div>

            {!legendCollapsed && (
              <div className="vi-gis-legend-body">
                {/* Dynamic Mode Legend */}
                {viewMode === "heatmap" ? (
                  <div className="vi-gis-legend-row">
                    <span className="vi-gis-legend-label">
                      {isEn ? "Density Scale:" : "Phổ mật độ không gian:"}
                    </span>
                    <span className="vi-gis-heat-ramp-bar" aria-hidden="true" />
                    <span>
                      <i className="is-round" style={{ background: "#15803D" }} />{" "}
                      {isEn ? "Low" : "Thấp (<200)"}
                    </span>
                    <span>
                      <i className="is-round" style={{ background: "#65A30D" }} />{" "}
                      {isEn ? "Moderate" : "Trung bình"}
                    </span>
                    <span>
                      <i className="is-round" style={{ background: "#D97706" }} />{" "}
                      {isEn ? "Moderate-High" : "Khá cao"}
                    </span>
                    <span>
                      <i className="is-round" style={{ background: "#EA580C" }} />{" "}
                      {isEn ? "High" : "Cao"}
                    </span>
                    <span>
                      <i className="is-round" style={{ background: "#DC2626" }} />{" "}
                      {isEn ? "Hotspot" : "Điểm nóng (>10k)"}
                    </span>
                    <div className="vi-gis-density-quick-pills">
                      <button
                        type="button"
                        className={heatmapStyle === "hybrid" ? "active" : ""}
                        onClick={() => setHeatmapStyle("hybrid")}
                      >
                        {isEn ? "Grid + Provinces" : "Lưới + Tỉnh"}
                      </button>
                      <button
                        type="button"
                        className={heatmapStyle === "grid" ? "active" : ""}
                        onClick={() => setHeatmapStyle("grid")}
                      >
                        {isEn ? "0.25° Grid" : "Chỉ lưới 0.25°"}
                      </button>
                      <button
                        type="button"
                        className={heatmapStyle === "provinces" ? "active" : ""}
                        onClick={() => setHeatmapStyle("provinces")}
                      >
                        {isEn ? "Provinces" : "Chỉ cụm tỉnh"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="vi-gis-legend-row">
                    <span className="vi-gis-legend-label">
                      {isEn ? "Orders:" : "Chú giải Bộ (Order):"}
                    </span>
                    {legendOrders.map((ord) => (
                      <span key={ord}>
                        <i className="is-round" style={{ background: ORDER_COLORS[ord] }} /> {ord}
                      </span>
                    ))}
                    <span>
                      <i
                        className="is-round"
                        style={{ background: "#FFFFFF", border: "2px solid #103B25" }}
                      />{" "}
                      {isEn ? "Selected" : "Đang chọn"}
                    </span>
                    {enableClustering && (
                      <span>
                        <i className="is-round" style={{ background: "#103B25" }} />{" "}
                        {isEn ? "Cluster" : "Cụm điểm"}
                      </span>
                    )}
                  </div>
                )}

                {/* Active Ecological Layer Symbols */}
                <div className="vi-gis-legend-row is-secondary">
                  {viewMode === "radius" && (
                    <span>
                      <i
                        className="is-round"
                        style={{ background: "#B0241A", border: "1.5px solid #fff" }}
                      />{" "}
                      {isEn
                        ? `PostGIS Radius (${radiusPin.radiusKm} km)`
                        : `Tâm bán kính PostGIS (${radiusPin.radiusKm} km)`}
                    </span>
                  )}
                  {ecologicalLayers.protectedAreas && (
                    <span>
                      <i style={{ background: "#15803D" }} />{" "}
                      {isEn ? "National Park / Protected Area" : "Vườn Quốc gia / KBT"}
                    </span>
                  )}
                  {ecologicalLayers.ecologicalRegions && (
                    <span>
                      <i
                        style={{
                          background: "rgba(30,111,92,0.25)",
                          border: "1px dashed #1E6F5C",
                        }}
                      />{" "}
                      {isEn ? "Ecological Region" : "Vùng sinh thái"}
                    </span>
                  )}
                  {ecologicalLayers.speciesRichness && (
                    <span>
                      <i className="is-round" style={{ background: "#103B25" }} />{" "}
                      {isEn ? "Species Richness" : "Độ giàu loài"}
                    </span>
                  )}
                  <span className="vi-gis-legend-stat-summary">
                    PostGIS:{" "}
                    <strong>{mapData.totalMatching.toLocaleString()}</strong>{" "}
                    {isEn ? "occurrences" : "mẫu"} ·{" "}
                    <strong>{distinctSpeciesStat > 0 ? distinctSpeciesStat.toLocaleString() : "—"}</strong>{" "}
                    {isEn ? "species" : "loài"} · <strong>{provincesCoveredStat}</strong>{" "}
                    {isEn ? "provinces" : "tỉnh"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
