import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  const isAdmin = useIsAdminContext();
  const [active, setActive] = useState(TABS[0].id);

  const [specimens, setSpecimens] = useState([]);
  const [specLoading, setSpecLoading] = useState(false);

  const [dnaRecords, setDnaRecords] = useState([]);
  const [dnaLoading, setDnaLoading] = useState(false);

  const [mapData, setMapData] = useState({ points: [], provinceClusters: [], totalMatching: 0 });
  const [mapLoading, setMapLoading] = useState(false);
  const [basemapMode, setBasemapMode] = useState("street"); // street | satellite (SRS F-TX-05)

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    async function loadRelatedData() {
      setSpecLoading(true);
      setDnaLoading(true);
      setMapLoading(true);

      try {
        const [specRes, dnaByTaxon, mapRes] = await Promise.all([
          specimenService.getSpecimens({ taxonId: profile.id, limit: 25 }).catch(() => ({ items: [] })),
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
          setSpecimens(specRes.items || []);
          setDnaRecords(finalDna);
          setMapData(mapRes || { points: [], provinceClusters: [], totalMatching: 0 });
        }
      } finally {
        if (!cancelled) {
          setSpecLoading(false);
          setDnaLoading(false);
          setMapLoading(false);
        }
      }
    }

    loadRelatedData();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.scientificName]);

  const specimenListUrl = isAdmin
    ? `/admin/specimens?taxonId=${profile.id}`
    : `/specimens/search?taxonId=${profile.id}`;

  return (
    <div>
      <div className="tabs-row">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-button${active === tab.id ? " active" : ""}`}
            onClick={() => setActive(tab.id)}
          >
            <Icon name={tab.icon} size={14} /> {tab.label}
            {tab.id === "specimens" && profile.specimenCount != null ? ` (${profile.specimenCount})` : ""}
            {tab.id === "dna" && dnaRecords.length > 0 ? ` (${dnaRecords.length})` : ""}
          </button>
        ))}
      </div>

      {/* TAB 1: Hình thái & Sinh thái (Preserve DOM với display: none theo Code Review D4) */}
      <div style={{ display: active === "morphology" ? "block" : "none" }}>
        <div className="species-tab-grid" style={{ marginBottom: 20 }}>
          <div>
            <h3 className="species-tab-heading">Mô tả Hình thái học (Morphology)</h3>
            <p className="page-description">
              {profile.morphologyDescription ||
                `Đơn vị phân loại ${profile.scientificName} (${profile.rank}) đã được chuẩn hóa trong cơ sở dữ liệu danh pháp côn trùng Việt Nam theo quy tắc ICZN.`}
            </p>
          </div>
          <div>
            <h3 className="species-tab-heading">Đặc điểm Sinh thái & Sinh cảnh (Ecology)</h3>
            <p className="page-description">
              {profile.ecologyDescription ||
                `Ghi nhận ${profile.specimenCount || 0} tiêu bản/quan sát thực địa tại Việt Nam.`}
            </p>
          </div>
        </div>

        <table className="vi-dwc-table">
          <tbody>
            <tr>
              <th>Tên khoa học chuẩn (scientificName)</th>
              <td>
                <strong>
                  <em>{profile.scientificName}</em>
                </strong>{" "}
                {profile.scientificNameAuthorship || ""}
              </td>
            </tr>
            <tr>
              <th>Bậc phân loại (taxonRank)</th>
              <td>{profile.rank}</td>
            </tr>
            <tr>
              <th>Tên thường gọi (vernacularName)</th>
              <td>
                {profile.vernacularNameVn || "—"} / {profile.vernacularNameEn || "—"}
              </td>
            </tr>
            <tr>
              <th>Trạng thái danh pháp (taxonomicStatus)</th>
              <td>{(profile.taxonomicStatus || "accepted").toUpperCase()}</td>
            </tr>
            <tr>
              <th>Tình trạng bảo tồn (IUCN Red List)</th>
              <td>{profile.iucnStatus || "NE (Chưa đánh giá)"}</td>
            </tr>
            <tr>
              <th>Tổng số mẫu vật liên kết</th>
              <td>
                <strong>{(profile.specimenCount || 0).toLocaleString("vi-VN")}</strong> mẫu vật
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TAB 2: Danh sách Mẫu vật thuộc Loài (F-TX-05) */}
      <div style={{ display: active === "specimens" ? "block" : "none" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <span className="page-description" style={{ margin: 0 }}>
            Hiển thị <strong>{specimens.length}</strong> /{" "}
            <strong>{(profile.specimenCount || 0).toLocaleString("vi-VN")}</strong> mẫu vật thuộc{" "}
            <em>{profile.scientificName}</em>
          </span>
          <Link to={specimenListUrl} className="button button-sm button-primary">
            Xem toàn bộ {(profile.specimenCount || 0).toLocaleString("vi-VN")} mẫu vật →
          </Link>
        </div>

        {specLoading ? (
          <LoadingState label="Đang tải danh sách mẫu vật của loài..." />
        ) : specimens.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table className="vi-dwc-table">
              <thead>
                <tr>
                  <th>Mã mẫu vật</th>
                  <th>Tên khoa học</th>
                  <th>Tỉnh / Thành phố</th>
                  <th>Ngày thu mẫu</th>
                  <th>Tọa độ WGS84</th>
                  <th>Hồ sơ</th>
                </tr>
              </thead>
              <tbody>
                {specimens.map((sp) => (
                  <tr key={sp.id}>
                    <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{sp.specimenCode}</td>
                    <td>
                      <em>{sp.scientificName}</em>
                    </td>
                    <td>{sp.provinceNameVn || sp.localityDetail || "—"}</td>
                    <td>{sp.collectionDate || "—"}</td>
                    <td style={{ fontFamily: "monospace" }}>
                      {sp.latitude != null && sp.longitude != null
                        ? `${sp.latitude.toFixed(4)}°N, ${sp.longitude.toFixed(4)}°E`
                        : "—"}
                    </td>
                    <td>
                      <Link
                        to={isAdmin ? `/admin/specimens/${sp.id}` : `/specimens/${sp.id}`}
                        className="dna-ext-link"
                      >
                        Chi tiết →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="bug"
            title="Chưa có mẫu vật"
            description="Chưa ghi nhận mẫu vật nào thuộc đơn vị phân loại này."
          />
        )}
      </div>

      {/* TAB 3: Chuỗi Mã vạch DNA & GenBank / BOLD (F-TX-05, F-DN-03, F-DN-05) */}
      <div style={{ display: active === "dna" ? "block" : "none" }}>
        {dnaLoading ? (
          <LoadingState label="Đang tải trình tự mã vạch DNA của loài..." />
        ) : dnaRecords.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table className="vi-dwc-table">
              <thead>
                <tr>
                  <th>Gen Marker</th>
                  <th>GenBank Accession (NCBI)</th>
                  <th>BOLD Systems (F-DN-03)</th>
                  <th>Độ dài (bp)</th>
                  <th>Tỷ lệ G-C</th>
                  <th>Tác giả công bố</th>
                  <th>Chuỗi FASTA</th>
                </tr>
              </thead>
              <tbody>
                {dnaRecords.map((seq) => (
                  <tr key={seq.id}>
                    <td>
                      <span className="dna-marker-badge">{seq.geneMarker || "COI"}</span>
                    </td>
                    <td style={{ fontFamily: "monospace", fontWeight: 700 }}>
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
                        "—"
                      )}
                    </td>
                    <td style={{ fontFamily: "monospace" }}>{seq.sequenceLengthBp || "—"} bp</td>
                    <td style={{ fontFamily: "monospace" }}>
                      {seq.gcContentPct != null ? `${seq.gcContentPct}%` : "—"}
                    </td>
                    <td>{seq.authorName || "INSDC"}</td>
                    <td>
                      <Link
                        to={isAdmin ? `/admin/dna/${seq.id}/fasta` : `/dna/${seq.id}/fasta`}
                        className="button button-sm button-primary"
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
              <Link
                to={isAdmin ? "/admin/dna" : "/dna"}
                className="button button-sm button-ghost"
              >
                Tra cứu Kho dữ liệu Phân tử DNA →
              </Link>
            }
          />
        )}
      </div>

      {/* TAB 4: Hoạt tính Sinh/Hóa học (F-TX-07) */}
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
                  <span>{record.description || "Không có mô tả chi tiết."}</span>
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
            description="Hoạt tính sinh/hóa học của loài sẽ hiển thị tại đây khi được bổ sung (F-TX-07)."
          />
        )}
      </div>

      {/* TAB 5: Bản đồ Phân bố Không gian Leaflet + Ảnh Vệ tinh (F-TX-05) */}
      <div style={{ display: active === "distribution" ? "block" : "none" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <span className="page-description" style={{ margin: 0 }}>
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
          <div style={{ height: 420, border: "1px solid #111111" }}>
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
                      <div>Tỉnh/Thành: {pt.provinceNameVn || "—"}</div>
                      <div>Ngày thu: {pt.collectionDate || "—"}</div>
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
