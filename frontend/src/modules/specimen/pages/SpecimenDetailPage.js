import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/ToastProvider";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import specimenService from "../specimen.service";
import { formatBasisOfRecord, getOrderColor, SEX_LABELS } from "../specimen.constants";

function SpecimenMiniMap({ lat, lon, label, color }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current || lat == null || lon == null) return undefined;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [lat, lon],
      zoom: 8,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    L.circleMarker([lat, lon], {
      radius: 9,
      fillColor: color || "#2E7D32",
      color: "#111111",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    })
      .addTo(map)
      .bindPopup(`<strong>${label}</strong><br/>WGS84: ${lat.toFixed(5)}, ${lon.toFixed(5)}`)
      .openPopup();

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lon, label, color]);

  return <div ref={mapContainerRef} style={{ width: "100%", height: 290, border: "1px solid #111111" }} />;
}

export default function SpecimenDetailPage() {
  const { id } = useParams();
  const isAdmin = useIsAdminContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [specimen, setSpecimen] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState("dwc");

  const loadDetail = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await specimenService.getSpecimenById(id);
      setSpecimen(data);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Không tìm thấy hồ sơ mẫu vật");
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleTogglePublic = async () => {
    if (!specimen) return;
    try {
      const updated = await specimenService.togglePublic(specimen.id, !specimen.isPublic);
      setSpecimen(updated);
      toast(
        `Đã chuyển sang trạng thái ${updated.isPublic ? "Công khai" : "Nội bộ"}`,
        "success",
      );
    } catch (err) {
      toast(err.response?.data?.message || "Không thể đổi trạng thái", "error");
    }
  };

  if (status === "loading") {
    return (
      <div className="page-container page-content">
        <div className="card panel">
          <LoadingState label="Đang tải hồ sơ mẫu vật..." />
        </div>
      </div>
    );
  }

  if (status === "error" || !specimen) {
    return (
      <div className="page-container page-content">
        <div className="card panel">
          <EmptyState
            icon="alert"
            title="Không tìm thấy bản ghi mẫu vật"
            description={errorMsg}
            action={
              <button
                className="button button-primary"
                onClick={() => navigate(isAdmin ? "/admin/specimens" : "/specimens/search")}
              >
                Quay về danh sách mẫu vật
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const orderColor = getOrderColor(specimen.orderName);

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name="bug" size={14} />
            SCR-08 · Hồ sơ Mẫu vật Darwin Core · {specimen.specimenCode}
          </div>
          <h1 className="taxonomy-name" style={{ fontSize: "clamp(26px, 3vw, 40px)" }}>
            {specimen.scientificName}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 }}>
            <span
              className="status-badge"
              style={{ background: orderColor, color: "#FFFFFF", borderColor: "#111111" }}
            >
              Bộ: {specimen.orderName || specimen.taxonName}
            </span>
            {specimen.familyName ? (
              <span className="status-badge" style={{ background: "#F2F7F2" }}>
                Họ: {specimen.familyName}
              </span>
            ) : null}
            {specimen.genusName ? (
              <span className="status-badge" style={{ background: "#F2F7F2" }}>
                Giống: {specimen.genusName}
              </span>
            ) : null}
            <span className={`status-badge ${specimen.isPublic ? "status-public" : "status-private"}`}>
              {specimen.isPublic ? "PUBLIC OPEN DATA" : "INTERNAL ONLY"}
            </span>
            {specimen.gbifLink ? (
              <a
                href={specimen.gbifLink}
                target="_blank"
                rel="noreferrer"
                className="status-badge"
                style={{ background: "#E8F5E9", color: "#0F3820" }}
              >
                GBIF #{String(specimen.gbifOccurrenceId).replace(/^gbif:/, "")} ↗
              </a>
            ) : null}
          </div>
        </div>

        <div className="hero-actions" style={{ marginTop: 0 }}>
          <Link
            to={isAdmin ? "/admin/specimens" : "/specimens/search"}
            className="button button-ghost"
          >
            ← Danh sách
          </Link>
          {isAdmin ? (
            <>
              <button type="button" className="button button-ghost" onClick={handleTogglePublic}>
                {specimen.isPublic ? "Ẩn nội bộ" : "Công khai"}
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => navigate(`/admin/specimens/edit?id=${specimen.id}`)}
              >
                <Icon name="edit" size={16} />
                Chỉnh sửa hồ sơ
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Bố cục 2 cột: Thông tin chi tiết Darwin Core + Bản đồ vị trí */}
      <div className="screen-placeholder-grid" style={{ alignItems: "start" }}>
        <section className="card panel">
          <div className="tabs-row">
            <button
              className={`tab-button ${activeTab === "dwc" ? "active" : ""}`}
              onClick={() => setActiveTab("dwc")}
            >
              Metadata Darwin Core
            </button>
            <button
              className={`tab-button ${activeTab === "media" ? "active" : ""}`}
              onClick={() => setActiveTab("media")}
            >
              Hình ảnh ({specimen.images?.length || 0}) & DNA ({specimen.dnaSequences?.length || 0})
            </button>
            {isAdmin ? (
              <button
                className={`tab-button ${activeTab === "history" ? "active" : ""}`}
                onClick={() => setActiveTab("history")}
              >
                Lịch sử thay đổi ({specimen.changeHistory?.length || 0})
              </button>
            ) : null}
          </div>

          {activeTab === "dwc" ? (
            <div className="vi-kv-grid">
              <div className="vi-kv-item">
                <span>Mã định danh (specimenCode)</span>
                <strong>{specimen.specimenCode}</strong>
              </div>
              <div className="vi-kv-item">
                <span>Loại bản ghi (basisOfRecord)</span>
                <strong>{formatBasisOfRecord(specimen.basisOfRecord)}</strong>
              </div>
              <div className="vi-kv-item">
                <span>Tên khoa học gốc</span>
                <strong className="taxonomy-name">{specimen.scientificName}</strong>
              </div>
              <div className="vi-kv-item">
                <span>Tên tiếng Việt</span>
                <strong>{specimen.commonNameVn || "Chưa cập nhật"}</strong>
              </div>
              <div className="vi-kv-item">
                <span>Ngày thu mẫu (eventDate)</span>
                <strong>{specimen.collectionDate || "—"}</strong>
              </div>
              <div className="vi-kv-item">
                <span>Số lượng & Giới tính</span>
                <strong>
                  {specimen.individualCount} cá thể ·{" "}
                  {specimen.sex ? SEX_LABELS[specimen.sex] || specimen.sex : "Chưa rõ giới tính"}
                </strong>
              </div>
              <div className="vi-kv-item">
                <span>Tỉnh / Thành phố</span>
                <strong>{specimen.provinceNameVn || "Chưa phân tỉnh"}</strong>
              </div>
              <div className="vi-kv-item">
                <span>Địa điểm chi tiết (locality)</span>
                <strong>{specimen.localityDetail || specimen.district || "—"}</strong>
              </div>
              <div className="vi-kv-item">
                <span>Người thu mẫu (recordedBy)</span>
                <strong>{specimen.recordedBy || "—"}</strong>
              </div>
              <div className="vi-kv-item">
                <span>Đơn vị lưu trữ / Mã bộ sưu tập</span>
                <strong>
                  {[specimen.institutionCode, specimen.catalogNumber].filter(Boolean).join(" · ") ||
                    "—"}
                </strong>
              </div>
              <div className="vi-kv-item">
                <span>Sinh cảnh & Giai đoạn sống</span>
                <strong>
                  {[specimen.habitatLabelVn, specimen.lifeStageLabelVn].filter(Boolean).join(" · ") ||
                    "—"}
                </strong>
              </div>
              <div className="vi-kv-item">
                <span>Trạng thái lưu mẫu</span>
                <strong>{specimen.statusLabelVn || specimen.storageNumber || "—"}</strong>
              </div>
              {specimen.occurrenceRemarks || specimen.notes ? (
                <div className="vi-kv-item" style={{ gridColumn: "1 / -1" }}>
                  <span>Ghi chú thực địa / Nhận xét (occurrenceRemarks)</span>
                  <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6 }}>
                    {specimen.notes || specimen.occurrenceRemarks}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "media" ? (
            <div>
              <h3 className="species-tab-heading">Bộ ảnh mẫu vật ({specimen.images?.length || 0})</h3>
              {specimen.images?.length > 0 ? (
                <div className="info-grid" style={{ marginBottom: 24 }}>
                  {specimen.images.map((img) => (
                    <div key={img.id} className="card" style={{ overflow: "hidden" }}>
                      {img.url ? (
                        <a href={img.url} target="_blank" rel="noreferrer" style={{ display: "block", background: "#111111" }}>
                          <img
                            src={img.url}
                            alt={specimen.scientificName}
                            style={{ width: "100%", height: 190, objectFit: "cover", display: "block" }}
                          />
                        </a>
                      ) : null}
                      <div style={{ padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                          <strong style={{ fontSize: 12, textTransform: "uppercase" }}>
                            {img.shotType || "field"}
                          </strong>
                          {img.licenseCode ? (
                            <span className="status-badge status-public">
                              {img.licenseCode.toUpperCase()}
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--vi-muted)", marginTop: 4 }}>
                          {img.attribution || img.objectKey}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--vi-muted)", marginBottom: 24 }}>
                  Bản ghi này chưa đính kèm ảnh vi thể nội bộ.
                </p>
              )}

              <h3 className="species-tab-heading">
                Chuỗi mã vạch DNA liên kết ({specimen.dnaSequences?.length || 0})
              </h3>
              {specimen.dnaSequences?.length > 0 ? (
                <div className="placeholder-list">
                  {specimen.dnaSequences.map((dna) => (
                    <div key={dna.id} className="placeholder-row">
                      <div>
                        <strong>
                          {dna.genbankAccession || dna.boldProcessId || `DNA #${dna.id}`}
                        </strong>
                        <span>
                          Marker: {dna.geneMarker || "COI"} · {dna.sequenceLengthBp || "—"} bp
                        </span>
                      </div>
                      <Link
                        to={isAdmin ? `/admin/dna/${dna.id}/fasta` : `/dna/${dna.id}/fasta`}
                        className="button button-sm button-ghost"
                      >
                        Xem FASTA
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--vi-muted)" }}>
                  Chưa có trình tự COI / GenBank liên kết trực tiếp với mẫu vật này.
                </p>
              )}
            </div>
          ) : null}

          {activeTab === "history" && isAdmin ? (
            <div>
              {specimen.changeHistory?.length > 0 ? (
                <div className="placeholder-list">
                  {specimen.changeHistory.map((ch) => (
                    <div key={ch.id} className="placeholder-row">
                      <div>
                        <strong>Trường: {ch.fieldName}</strong>
                        <span>
                          {ch.oldValue || "(trống)"} → {ch.newValue || "(trống)"}
                        </span>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 11, color: "var(--vi-muted)" }}>
                        <strong>{ch.changedByUsername}</strong>
                        <div>{new Date(ch.changedAt).toLocaleString("vi-VN")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--vi-muted)" }}>
                  Chưa phát sinh chỉnh sửa thủ công kể từ khi nhập bản ghi.
                </p>
              )}
            </div>
          ) : null}
        </section>

        {/* Cột phải: Bản đồ vị trí thu mẫu */}
        <aside className="card panel">
          <div className="panel-title">
            <h2>Vị trí không gian (PostGIS)</h2>
            <Icon name="map" size={18} />
          </div>

          {specimen.latitude != null && specimen.longitude != null ? (
            <>
              <SpecimenMiniMap
                lat={specimen.latitude}
                lon={specimen.longitude}
                label={specimen.scientificName}
                color={orderColor}
              />
              <div className="info-grid" style={{ marginTop: 14 }}>
                <div className="info-block" style={{ borderRadius: 0 }}>
                  <span>Vĩ độ (Lat)</span>
                  <strong style={{ fontSize: 16 }}>{specimen.latitude.toFixed(5)}°N</strong>
                </div>
                <div className="info-block" style={{ borderRadius: 0 }}>
                  <span>Kinh độ (Lon)</span>
                  <strong style={{ fontSize: 16 }}>{specimen.longitude.toFixed(5)}°E</strong>
                </div>
              </div>
              <button
                type="button"
                className="button button-secondary"
                style={{ width: "100%", marginTop: 14 }}
                onClick={() =>
                  navigate(
                    `${isAdmin ? "/admin/map" : "/map"}?lat=${specimen.latitude}&lon=${specimen.longitude}&order=${encodeURIComponent(specimen.orderName || "")}`,
                  )
                }
              >
                <Icon name="map" size={16} />
                Khám phá vùng lân cận trên Bản đồ GIS
              </button>
            </>
          ) : (
            <EmptyState
              icon="map"
              title="Chưa có tọa độ GPS"
              description="Mẫu vật chưa được gắn tọa độ địa lý WGS84."
            />
          )}
        </aside>
      </div>
    </div>
  );
}
