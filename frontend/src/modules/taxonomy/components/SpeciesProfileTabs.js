import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Icon from "../../../components/ui/Icon";
import EmptyState from "../../../components/ui/EmptyState";
import LoadingState from "../../../components/ui/LoadingState";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import specimenService from "../../specimen/specimen.service";
import dnaService from "../../dna/dna.service";

const TABS = [
  { id: "morphology", label: "Hình thái & Sinh thái", icon: "leaf" },
  { id: "specimens", label: "Mẫu vật", icon: "bug" },
  { id: "dna", label: "DNA & GenBank / BOLD", icon: "dna" },
  { id: "activity", label: "Hoạt tính Sinh/Hóa", icon: "chart" },
  { id: "distribution", label: "Phân bố Không gian", icon: "map" },
];

const ESRI_STREET_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const ESRI_SATELLITE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export default function SpeciesProfileTabs({ profile }) {
  const { t } = useTranslation();
  const isAdmin = useIsAdminContext();
  const [active, setActive] = useState(TABS[0].id);

  // Screen 2: Specimens table state with search, province filter, sort, pagination
  const [specimens, setSpecimens] = useState([]);
  const [specTotal, setSpecTotal] = useState(profile?.specimenCount || 0);
  const [specLoading, setSpecLoading] = useState(false);
  const [specError, setSpecError] = useState(null);
  const [specFilters, setSpecFilters] = useState({
    q: "",
    provinceId: "",
    sortOrder: "desc",
    page: 1,
    limit: 20,
  });
  const [provinces, setProvinces] = useState([]);

  const [dnaRecords, setDnaRecords] = useState([]);
  const [dnaLoading, setDnaLoading] = useState(false);

  const [mapData, setMapData] = useState({ points: [], provinceClusters: [], totalMatching: 0 });
  const [mapLoading, setMapLoading] = useState(false);
  const [basemapMode, setBasemapMode] = useState("street");

  useEffect(() => {
    specimenService
      .getLookups()
      .then((lk) => setProvinces(lk?.provinces || []))
      .catch(() => {});
  }, []);

  const loadSpecimens = useCallback(async () => {
    if (!profile?.id) return;
    setSpecLoading(true);
    setSpecError(null);
    try {
      const res = await specimenService.getSpecimens({
        taxonId: profile.id,
        q: specFilters.q || undefined,
        provinceId: specFilters.provinceId || undefined,
        sortBy: "collectionDate",
        sortOrder: specFilters.sortOrder,
        page: specFilters.page,
        limit: specFilters.limit,
      });
      setSpecimens(res.items || []);
      if (res.pagination?.total != null) {
        setSpecTotal(res.pagination.total);
      }
    } catch (err) {
      setSpecError(err?.response?.data?.message || err?.message || "Không thể tải danh sách mẫu vật.");
    } finally {
      setSpecLoading(false);
    }
  }, [profile?.id, specFilters]);

  useEffect(() => {
    loadSpecimens();
  }, [loadSpecimens]);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    async function loadDnaAndMap() {
      setDnaLoading(true);
      setMapLoading(true);
      try {
        const [dnaByTaxon, mapRes] = await Promise.all([
          dnaService.getDnaList({ taxonId: profile.id, limit: 25 }).catch(() => ({ items: [] })),
          specimenService.getMapOccurrences({ taxonId: profile.id, limit: 500 }).catch(() => ({
            points: [],
            provinceClusters: [],
            totalMatching: 0,
          })),
        ]);

        let finalDna = dnaByTaxon.items || [];
        if (finalDna.length === 0 && profile.scientificName) {
          const dnaByName = await dnaService
            .getDnaList({ q: profile.scientificName, limit: 20 })
            .catch(() => ({ items: [] }));
          finalDna = dnaByName.items || [];
        }

        if (!cancelled) {
          setDnaRecords(finalDna);
          setMapData(mapRes || { points: [], provinceClusters: [], totalMatching: 0 });
        }
      } finally {
        if (!cancelled) {
          setDnaLoading(false);
          setMapLoading(false);
        }
      }
    }

    loadDnaAndMap();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.scientificName]);

  const notProvided = t("common.notProvided", "Chưa cung cấp");
  const specimenListUrl = isAdmin
    ? `/admin/specimens?taxonId=${profile.id}`
    : `/specimens/search?taxonId=${profile.id}`;
  const specTotalPages = Math.max(1, Math.ceil((specTotal || 0) / specFilters.limit));

  return (
    <div>
      {/* Consistent Tab Navigation */}
      <div className="vi-refined-tabs-row" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={`vi-refined-tab-btn${active === tab.id ? " active" : ""}`}
            onClick={() => setActive(tab.id)}
          >
            <Icon name={tab.icon} size={15} />
            <span>{tab.label}</span>
            {tab.id === "specimens" && profile.specimenCount != null ? (
              <span className="vi-tab-count-badge">
                {(profile.specimenCount || 0).toLocaleString("vi-VN")}
              </span>
            ) : null}
            {tab.id === "dna" && dnaRecords.length > 0 ? (
              <span className="vi-tab-count-badge">{dnaRecords.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* SCREEN 1 — TAB 1: Balanced Two-Column Morphology & Ecology */}
      <div
        style={{ display: active === "morphology" ? "block" : "none" }}
        data-testid="tab-panel-morphology"
      >
        <div className="vi-morph-eco-grid">
          {/* LEFT COLUMN: Morphology & Taxonomic Identity */}
          <div className="vi-sci-panel">
            <h3 className="vi-sci-panel-title">
              <Icon name="leaf" size={15} />
              <span>Hình thái học &amp; Định danh Khoa học</span>
            </h3>
            <dl className="vi-sci-dl">
              <div className="vi-sci-row">
                <dt>Mô tả hình thái (Morphology)</dt>
                <dd>{profile.morphologyDescription || notProvided}</dd>
              </div>
              <div className="vi-sci-row">
                <dt>Tên khoa học (Scientific Name)</dt>
                <dd>
                  <strong>
                    <em>{profile.scientificName}</em>
                  </strong>{" "}
                  {profile.scientificNameAuthorship || ""}
                </dd>
              </div>
              <div className="vi-sci-row">
                <dt>Bậc phân loại (Taxonomic Rank)</dt>
                <dd>{profile.rank || notProvided}</dd>
              </div>
              <div className="vi-sci-row">
                <dt>Tên thường gọi (Vernacular Name)</dt>
                <dd>
                  {profile.vernacularNameVn || profile.vernacularNameEn
                    ? `${profile.vernacularNameVn || notProvided} / ${
                        profile.vernacularNameEn || notProvided
                      }`
                    : notProvided}
                </dd>
              </div>
              <div className="vi-sci-row">
                <dt>Trạng thái danh pháp (Taxonomic Status)</dt>
                <dd>
                  <span className="vi-status-pill">
                    {(profile.taxonomicStatus || "accepted").toUpperCase()}
                  </span>
                </dd>
              </div>
              <div className="vi-sci-row">
                <dt>Tình trạng bảo tồn (IUCN Red List)</dt>
                <dd>{profile.iucnStatus || notProvided}</dd>
              </div>
            </dl>
          </div>

          {/* RIGHT COLUMN: Ecology & Habitat */}
          <div className="vi-sci-panel">
            <h3 className="vi-sci-panel-title">
              <Icon name="globe" size={15} />
              <span>Sinh cảnh &amp; Đặc điểm Sinh thái học</span>
            </h3>
            <dl className="vi-sci-dl">
              <div className="vi-sci-row">
                <dt>Sinh cảnh (Habitat)</dt>
                <dd>{profile.habitat || profile.distributionSummary || notProvided}</dd>
              </div>
              <div className="vi-sci-row">
                <dt>Đặc điểm sinh thái (Ecological Characteristics)</dt>
                <dd>{profile.ecologyDescription || notProvided}</dd>
              </div>
              <div className="vi-sci-row">
                <dt>Giai đoạn phát triển (Life Stage)</dt>
                <dd>{profile.lifeStage || notProvided}</dd>
              </div>
              <div className="vi-sci-row">
                <dt>Cây chủ / Vật chủ (Host Plants)</dt>
                <dd>{profile.hostPlants || notProvided}</dd>
              </div>
              <div className="vi-sci-row">
                <dt>Ghi chú sinh thái (Ecological Notes)</dt>
                <dd>{profile.economicValueDescription || notProvided}</dd>
              </div>
              <div className="vi-sci-row">
                <dt>Số bản ghi mẫu vật liên kết</dt>
                <dd>
                  <strong>{(profile.specimenCount || 0).toLocaleString("vi-VN")}</strong> bản ghi mẫu vật
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* SCREEN 2 — TAB 2: Professional Scientific Specimen Data Table */}
      <div
        style={{ display: active === "specimens" ? "block" : "none" }}
        data-testid="tab-panel-specimens"
      >
        {/* Table Controls Toolbar */}
        <div className="vi-spec-table-toolbar">
          <div className="vi-spec-table-summary">
            Tổng số: <strong>{(specTotal || 0).toLocaleString("vi-VN")}</strong> mẫu vật · Đang hiển
            thị: <strong>{specimens.length}</strong> bản ghi
          </div>

          <div className="vi-spec-table-controls">
            <input
              type="text"
              className="vi-compact-input"
              aria-label="Tìm trong mẫu vật của loài"
              placeholder="Tìm mã mẫu / địa điểm..."
              value={specFilters.q}
              onChange={(e) =>
                setSpecFilters((p) => ({ ...p, q: e.target.value, page: 1 }))
              }
            />

            <select
              className="vi-compact-select"
              aria-label="Lọc theo tỉnh thành"
              value={specFilters.provinceId}
              onChange={(e) =>
                setSpecFilters((p) => ({ ...p, provinceId: e.target.value, page: 1 }))
              }
            >
              <option value="">Tất cả tỉnh/thành</option>
              {provinces.map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.nameVn}
                </option>
              ))}
            </select>

            <select
              className="vi-compact-select"
              aria-label="Sắp xếp theo ngày thu mẫu"
              value={specFilters.sortOrder}
              onChange={(e) =>
                setSpecFilters((p) => ({ ...p, sortOrder: e.target.value, page: 1 }))
              }
            >
              <option value="desc">Ngày thu: Mới nhất</option>
              <option value="asc">Ngày thu: Cũ nhất</option>
            </select>

            <Link to={specimenListUrl} className="button button-sm button-primary">
              Xem toàn bộ {(profile.specimenCount || 0).toLocaleString("vi-VN")} mẫu vật →
            </Link>
          </div>
        </div>

        {/* Table Content / Loading / Error / Empty States */}
        {specLoading ? (
          <LoadingState label="Đang tải danh sách mẫu vật thuộc loài..." />
        ) : specError ? (
          <EmptyState
            icon="alert"
            title="Lỗi tải danh sách mẫu vật"
            description={specError}
            action={
              <button type="button" className="button button-sm button-primary" onClick={loadSpecimens}>
                Thử lại
              </button>
            }
          />
        ) : specimens.length > 0 ? (
          <>
            <div className="vi-table-scroll-wrap">
              <table className="vi-scientific-data-table" data-testid="species-specimens-table">
                <thead>
                  <tr>
                    <th>Mã mẫu vật</th>
                    <th>Tên khoa học</th>
                    <th>Tỉnh / Thành phố</th>
                    <th>Ngày thu mẫu</th>
                    <th>Tọa độ (WGS84)</th>
                    <th>Trạng thái bản ghi</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {specimens.map((sp) => {
                    const detailUrl = isAdmin ? `/admin/specimens/${sp.id}` : `/specimens/${sp.id}`;
                    const basisLabel =
                      sp.basisOfRecord === "PRESERVED_SPECIMEN"
                        ? "Tiêu bản bảo tàng"
                        : sp.basisOfRecord === "HUMAN_OBSERVATION"
                        ? "Quan sát thực địa"
                        : sp.basisOfRecord || "Tiêu bản";
                    return (
                      <tr key={sp.id}>
                        <td className="mono">
                          <Link to={detailUrl} className="vi-code-link">
                            {sp.specimenCode || `#${sp.id}`}
                          </Link>
                        </td>
                        <td>
                          <em>{sp.scientificName || profile.scientificName}</em>
                        </td>
                        <td>{sp.provinceNameVn || sp.localityDetail || notProvided}</td>
                        <td className="mono">
                          {sp.collectionDate ? String(sp.collectionDate).slice(0, 10) : notProvided}
                        </td>
                        <td className="mono">
                          {sp.latitude != null && sp.longitude != null
                            ? `${Number(sp.latitude).toFixed(4)}°N, ${Number(sp.longitude).toFixed(
                                4
                              )}°E`
                            : notProvided}
                        </td>
                        <td>
                          <span className="vi-record-status-chip">{basisLabel}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Link to={detailUrl} className="vi-table-action-link">
                            Xem chi tiết →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {specTotalPages > 1 && (
              <div className="vi-compact-pagination">
                <span>
                  Trang <strong>{specFilters.page}</strong> / <strong>{specTotalPages}</strong>
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="button button-sm button-ghost"
                    disabled={specFilters.page <= 1}
                    onClick={() => setSpecFilters((p) => ({ ...p, page: p.page - 1 }))}
                  >
                    ← Trang trước
                  </button>
                  <button
                    type="button"
                    className="button button-sm button-ghost"
                    disabled={specFilters.page >= specTotalPages}
                    onClick={() => setSpecFilters((p) => ({ ...p, page: p.page + 1 }))}
                  >
                    Trang sau →
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon="bug"
            title="Không tìm thấy mẫu vật phù hợp"
            description="Chưa ghi nhận mẫu vật nào khớp với bộ lọc hiện tại cho loài này."
          />
        )}
      </div>

      {/* TAB 3: DNA & GenBank / BOLD */}
      <div style={{ display: active === "dna" ? "block" : "none" }}>
        {dnaLoading ? (
          <LoadingState label="Đang tải trình tự mã vạch DNA của loài..." />
        ) : dnaRecords.length > 0 ? (
          <div className="vi-table-scroll-wrap">
            <table className="vi-scientific-data-table">
              <thead>
                <tr>
                  <th>Gen Marker</th>
                  <th>GenBank Accession (NCBI)</th>
                  <th>BOLD Systems</th>
                  <th>Độ dài (bp)</th>
                  <th>Tỷ lệ G-C</th>
                  <th>Tác giả công bố</th>
                  <th style={{ textAlign: "right" }}>Chuỗi FASTA</th>
                </tr>
              </thead>
              <tbody>
                {dnaRecords.map((seq) => (
                  <tr key={seq.id}>
                    <td>
                      <span className="dna-marker-badge">{seq.geneMarker || "COI"}</span>
                    </td>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {seq.genbankAccession ? (
                        <a
                          href={`https://www.ncbi.nlm.nih.gov/nuccore/${encodeURIComponent(
                            seq.genbankAccession
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="dna-ext-link"
                        >
                          {seq.genbankAccession} <Icon name="external-link" size={12} />
                        </a>
                      ) : (
                        `DNA #${seq.id}`
                      )}
                    </td>
                    <td>
                      {seq.boldProcessId || seq.binUri ? (
                        <a
                          href={`https://boldsystems.org/index.php/Taxbrowser_Taxonpage?taxid=${encodeURIComponent(
                            seq.boldProcessId || seq.binUri
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="vi-bold-blue-badge"
                        >
                          BOLD: {seq.boldProcessId || seq.binUri} ↗
                        </a>
                      ) : (
                        notProvided
                      )}
                    </td>
                    <td className="mono">{seq.sequenceLengthBp || "—"} bp</td>
                    <td className="mono">{seq.gcContentPct != null ? `${seq.gcContentPct}%` : "—"}</td>
                    <td>{seq.authorName || "INSDC"}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        to={isAdmin ? `/admin/dna/${seq.id}/fasta` : `/dna/${seq.id}/fasta`}
                        className="vi-table-action-link"
                      >
                        Xem FASTA →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="dna"
            title="Chưa có trình tự DNA riêng cho loài này"
            description={`Chưa ghi nhận trình tự COI / GenBank trực tiếp cho ${profile.scientificName}.`}
            action={
              <Link to={isAdmin ? "/admin/dna" : "/dna"} className="button button-sm button-ghost">
                Tra cứu Kho dữ liệu Phân tử DNA →
              </Link>
            }
          />
        )}
      </div>

      {/* TAB 4: Biochemical Activity */}
      <div style={{ display: active === "activity" ? "block" : "none" }}>
        {profile.bioactivity && profile.bioactivity.length > 0 ? (
          <div className="placeholder-list">
            {profile.bioactivity.map((record) => (
              <div key={record.id} className="placeholder-row">
                <div>
                  <strong>
                    {record.activityType}
                    {record.activityLevel ? ` · ${record.activityLevel}` : ""}
                  </strong>
                  <span>{record.description || notProvided}</span>
                  {record.referenceTitle ? (
                    <span>
                      Tài liệu: {record.referenceTitle}
                      {record.referenceDoi ? ` (DOI: ${record.referenceDoi})` : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="sparkles"
            title="Chưa có dữ liệu hoạt tính"
            description="Hoạt tính sinh/hóa học của loài sẽ hiển thị tại đây khi được bổ sung."
          />
        )}
      </div>

      {/* TAB 5: Spatial Distribution */}
      <div style={{ display: active === "distribution" ? "block" : "none" }}>
        <div className="vi-spec-table-toolbar">
          <span className="vi-spec-table-summary">
            Ghi nhận <strong>{mapData.points?.length || 0}</strong> tọa độ phân bố GPS của{" "}
            <em>{profile.scientificName}</em> tại Việt Nam.
          </span>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={`button button-sm ${basemapMode === "street" ? "button-primary" : "button-ghost"}`}
              onClick={() => setBasemapMode("street")}
            >
              Bản đồ Khoa học (Esri)
            </button>
            <button
              type="button"
              className={`button button-sm ${
                basemapMode === "satellite" ? "button-primary" : "button-ghost"
              }`}
              onClick={() => setBasemapMode("satellite")}
            >
              Ảnh Vệ tinh (Satellite)
            </button>
            <Link
              to={
                isAdmin
                  ? `/admin/map?q=${encodeURIComponent(profile.scientificName)}`
                  : `/map?q=${encodeURIComponent(profile.scientificName)}`
              }
              className="button button-sm button-ghost"
            >
              Mở Bản đồ GIS đầy đủ →
            </Link>
          </div>
        </div>

        {mapLoading ? (
          <LoadingState label="Đang tải bản đồ phân bố không gian..." />
        ) : active === "distribution" ? (
          <div style={{ height: 420, border: "1px solid #DCE3E8" }}>
            <MapContainer
              center={[16.2, 106.5]}
              zoom={5}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                key={basemapMode}
                attribution="Tiles &copy; Esri"
                url={basemapMode === "satellite" ? ESRI_SATELLITE_URL : ESRI_STREET_URL}
              />
              {(mapData.points || []).map((pt) => (
                <CircleMarker
                  key={pt.id}
                  center={[pt.lat, pt.lon]}
                  radius={6}
                  pathOptions={{
                    color: "#103B25",
                    weight: 1.5,
                    fillColor: "#237A35",
                    fillOpacity: 0.85,
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: 12 }}>
                      <strong>
                        <em>{pt.scientificName}</em>
                      </strong>
                      <div>Mã mẫu: {pt.code}</div>
                      <div>Tỉnh/Thành: {pt.provinceNameVn || notProvided}</div>
                      <div>Ngày thu: {pt.collectionDate || notProvided}</div>
                      <div style={{ marginTop: 4 }}>
                        <Link to={isAdmin ? `/admin/specimens/${pt.id}` : `/specimens/${pt.id}`}>
                          Xem hồ sơ mẫu vật →
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        ) : null}
      </div>
    </div>
  );
}
