import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/ui/EmptyState";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/ToastProvider";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import mediaService, { ALLOWED_MEDIA_LICENSES } from "../media.service";
import specimenService from "../../specimen/specimen.service";
import { getOrderColor } from "../../specimen/specimen.constants";

export default function MediaGalleryPage() {
  const isAdmin = useIsAdminContext();
  const { toast } = useToast();

  const [qInput, setQInput] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    order: "",
    provinceId: "",
    licenseCode: "",
    dwcaOnly: false,
    voucheredOnly: false,
    page: 1,
    limit: 24,
  });

  const [lookups, setLookups] = useState({ orders: [], provinces: [] });
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 24, totalPages: 0 });
  const [status, setStatus] = useState("loading");
  const [lightboxItem, setLightboxItem] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  // Admin Upload Modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [specQuery, setSpecQuery] = useState("");
  const [specSuggestions, setSpecSuggestions] = useState([]);
  const [uploadForm, setUploadForm] = useState({
    specimenId: "",
    specimenLabel: "",
    licenseCode: "cc-by",
    shotType: "habitus",
    attribution: "",
    isPublic: true,
  });
  const [uploading, setUploading] = useState(false);

  const debounceRef = useRef(null);
  const specTimer = useRef(null);

  const refreshStats = useCallback(() => {
    mediaService.getMediaStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    specimenService.getLookups().then(setLookups).catch(() => {});
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((p) => (p.q === qInput.trim() ? p : { ...p, q: qInput.trim(), page: 1 }));
    }, 320);
    return () => clearTimeout(debounceRef.current);
  }, [qInput]);

  useEffect(() => {
    if (specQuery.trim().length < 2) {
      setSpecSuggestions([]);
      return undefined;
    }
    clearTimeout(specTimer.current);
    specTimer.current = setTimeout(async () => {
      try {
        const res = await specimenService.getSpecimens({ q: specQuery.trim(), limit: 8 });
        setSpecSuggestions(res.items || []);
      } catch {
        setSpecSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(specTimer.current);
  }, [specQuery]);

  const fetchMedia = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await mediaService.getMediaList(filters);
      setItems(res.items);
      setPagination(res.pagination);
      setStatus("success");
    } catch (err) {
      toast(err.response?.data?.message || "Không thể tải thư viện hình ảnh", "error");
      setStatus("error");
    }
  }, [filters, toast]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadForm.specimenId) {
      toast("Vui lòng chọn tệp ảnh và mẫu vật liên kết", "warning");
      return;
    }
    setUploading(true);
    try {
      await mediaService.uploadMedia({
        file: uploadFile,
        specimenId: Number(uploadForm.specimenId),
        licenseCode: uploadForm.licenseCode,
        shotType: uploadForm.shotType,
        attribution: uploadForm.attribution,
        isPublic: uploadForm.isPublic,
      });
      toast("Đã lưu ảnh mẫu vật lên cụm MinIO nội bộ", "success");
      setUploadOpen(false);
      setUploadFile(null);
      fetchMedia();
      refreshStats();
    } catch (err) {
      toast(err.response?.data?.message || "Lỗi tải ảnh lên MinIO", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    try {
      await mediaService.deleteMedia(pendingDelete.id);
      toast("Đã xóa ảnh khỏi MinIO & CSDL", "success");
      setPendingDelete(null);
      if (lightboxItem?.id === pendingDelete.id) setLightboxItem(null);
      fetchMedia();
      refreshStats();
    } catch (err) {
      toast(err.response?.data?.message || "Không thể xóa ảnh", "error");
    }
  };

  const specBasePath = isAdmin ? "/admin/specimens" : "/specimens";

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name="sparkles" size={14} />
            Thư viện Hình ảnh Lưu trữ Nội bộ (MinIO Object Storage)
          </div>
          <h1>Thư viện hình ảnh côn trùng Việt Nam</h1>
          <p className="page-description">
            Toàn bộ hình ảnh được lưu trữ trực tiếp trên cụm máy chủ <strong>MinIO nội bộ</strong> và kiểm soát
            giấy phép Creative Commons riêng biệt trên từng tấm ảnh (loại bỏ hoàn toàn ảnh cấm phái sinh ND).
          </p>
        </div>

        {isAdmin ? (
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setUploadOpen(true)}
            >
              <Icon name="upload" size={16} />
              Tải ảnh lên MinIO
            </button>
          </div>
        ) : null}
      </div>

      {/* KPI Metrics */}
      {stats ? (
        <div className="metric-grid" style={{ marginBottom: 20 }}>
          <article className="card metric-card">
            <div className="metric-head">
              <span>Tổng ảnh trên MinIO</span>
              <span className="metric-icon">
                <Icon name="layers" size={16} />
              </span>
            </div>
            <div className="metric-value">{(stats.totalImages || 0).toLocaleString()}</div>
            <div className="metric-foot">
              Gắn với {(stats.specimensWithMedia || 0).toLocaleString()} mẫu vật
            </div>
          </article>

          <article className="card metric-card">
            <div className="metric-head">
              <span>Đạt chuẩn xuất DwC-A (GBIF)</span>
              <span className="metric-icon">
                <Icon name="check" size={16} />
              </span>
            </div>
            <div className="metric-value">{(stats.dwcaExportable || 0).toLocaleString()}</div>
            <div className="metric-foot">Giấy phép mở CC0 & CC BY 4.0</div>
          </article>

          <article className="card metric-card">
            <div className="metric-head">
              <span>Hiển thị Web (Hạn chế NC/SA)</span>
              <span className="metric-icon">
                <Icon name="shield" size={16} />
              </span>
            </div>
            <div className="metric-value">{(stats.restrictedNcSa || 0).toLocaleString()}</div>
            <div className="metric-foot">Tự động tách khỏi gói xuất CC BY</div>
          </article>

          <article className="card metric-card">
            <div className="metric-head">
              <span>Hạ tầng lưu trữ</span>
              <span className="metric-icon">
                <Icon name="database" size={16} />
              </span>
            </div>
            <div className="metric-value" style={{ fontSize: 22 }}>
              MinIO VN
            </div>
            <div className="metric-foot">Bucket: vietinsect-media</div>
          </article>
        </div>
      ) : null}

      {/* Filter Bar */}
      <section className="card panel" style={{ marginBottom: 20 }}>
        <div className="vi-filter-grid">
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label>Tìm loài / Mã mẫu vật / Tác giả</label>
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="VD: Papilio, Odonata, GBIF-..."
            />
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label>Bộ côn trùng (Order)</label>
            <select
              value={filters.order}
              onChange={(e) => setFilters((p) => ({ ...p, order: e.target.value, page: 1 }))}
            >
              <option value="">Tất cả các Bộ</option>
              {lookups.orders.map((o) => (
                <option key={o.id} value={o.scientificName}>
                  {o.scientificName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label>Tỉnh / Thành phố</label>
            <select
              value={filters.provinceId}
              onChange={(e) => setFilters((p) => ({ ...p, provinceId: e.target.value, page: 1 }))}
            >
              <option value="">Tất cả tỉnh/thành</option>
              {lookups.provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameVn}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label>Giấy phép ảnh (License)</label>
            <select
              value={filters.licenseCode}
              onChange={(e) => setFilters((p) => ({ ...p, licenseCode: e.target.value, page: 1 }))}
            >
              <option value="">Tất cả giấy phép hợp lệ</option>
              {ALLOWED_MEDIA_LICENSES.map((lic) => (
                <option key={lic.code} value={lic.code}>
                  {lic.code.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="vi-filter-subbar">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={filters.dwcaOnly}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, dwcaOnly: e.target.checked, page: 1 }))
                }
              />
              Chỉ ảnh xuất được gói DwC-A cho GBIF (CC0 / CC BY 4.0)
            </label>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={filters.voucheredOnly}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, voucheredOnly: e.target.checked, page: 1 }))
                }
              />
              Chỉ ảnh gắn mẫu vật bảo tàng (Preserved Voucher)
            </label>
          </div>

          <button
            type="button"
            className="button button-sm button-ghost"
            onClick={() => {
              setQInput("");
              setFilters({
                q: "",
                order: "",
                provinceId: "",
                licenseCode: "",
                dwcaOnly: false,
                voucheredOnly: false,
                page: 1,
                limit: 24,
              });
            }}
          >
            Đặt lại bộ lọc
          </button>
        </div>
      </section>

      {/* Media Plate Grid */}
      {status === "loading" ? (
        <div className="card panel">
          <LoadingState label="Đang tải tư liệu ảnh từ cụm lưu trữ MinIO..." />
        </div>
      ) : items.length === 0 ? (
        <div className="card panel">
          <EmptyState
            icon="layers"
            title="Chưa có hình ảnh khớp bộ lọc"
            description="Thử bỏ bớt điều kiện lọc hoặc tải lên ảnh mẫu vật mới vào MinIO."
          />
        </div>
      ) : (
        <>
          <div className="vi-media-grid">
            {items.map((img) => {
              const orderColor = getOrderColor(img.orderName);
              return (
                <article key={img.id} className="card vi-media-card">
                  <div
                    className="vi-media-thumb-wrap"
                    onClick={() => setLightboxItem(img)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setLightboxItem(img)}
                  >
                    <img
                      src={img.url}
                      alt={img.scientificName}
                      loading="lazy"
                      className="vi-media-thumb"
                    />
                    <span
                      className={`status-badge vi-media-license-chip ${
                        img.isDwcaExportable ? "status-public" : "status-warning"
                      }`}
                    >
                      {img.licenseCode.toUpperCase()}
                    </span>
                  </div>

                  <div className="vi-media-card-body">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <span
                        className="status-badge"
                        style={{ background: orderColor, color: "#FFFFFF", fontSize: 9 }}
                      >
                        {img.orderName || "Insecta"}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--vi-muted)", fontWeight: 600 }}>
                        {img.provinceNameVn || "Việt Nam"}
                      </span>
                    </div>

                    <strong className="taxonomy-name" style={{ fontSize: 15, marginTop: 6, display: "block" }}>
                      {img.scientificName}
                    </strong>

                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--vi-muted)",
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={img.attribution}
                    >
                      {img.attribution || "VietInsect MinIO Archive"}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: "1px solid #E2E8F0" }}>
                      <Link to={`${specBasePath}/${img.specimenId}`} className="vi-code-link">
                        {img.specimenCode || `#${img.specimenId}`}
                      </Link>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="icon-button"
                          style={{ width: 28, height: 28, color: "#B0241A" }}
                          title="Xóa ảnh khỏi MinIO"
                          onClick={() => setPendingDelete(img)}
                        >
                          <Icon name="close" size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="card vi-pagination-bar" style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, color: "var(--vi-muted)" }}>
              Trang <strong>{pagination.page}</strong> / <strong>{pagination.totalPages}</strong> · Tổng{" "}
              <strong>{pagination.total.toLocaleString()}</strong> ảnh
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="button button-sm button-ghost"
                disabled={pagination.page <= 1}
                onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
              >
                ← Trang trước
              </button>
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

      {/* Lightbox Xem chi tiết ảnh */}
      {lightboxItem ? (
        <div className="dialog-backdrop" onClick={() => setLightboxItem(null)}>
          <div
            className="dialog-card"
            style={{ width: "min(860px, 95vw)", padding: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button dialog-close"
              onClick={() => setLightboxItem(null)}
              aria-label="Đóng"
            >
              <Icon name="close" size={18} />
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: 20, alignItems: "start" }}>
              <div style={{ background: "#111111", border: "1px solid #111111", display: "grid", placeItems: "center", minHeight: 340 }}>
                <img
                  src={lightboxItem.url}
                  alt={lightboxItem.scientificName}
                  style={{ maxWidth: "100%", maxHeight: "68vh", objectFit: "contain" }}
                />
              </div>
              <div>
                <span className="eyebrow">MinIO Object · {lightboxItem.storageBucket}</span>
                <h2 className="taxonomy-name" style={{ marginTop: 4 }}>
                  {lightboxItem.scientificName}
                </h2>
                <div className="placeholder-list" style={{ marginTop: 12 }}>
                  <div className="placeholder-row">
                    <div>
                      <strong>Giấy phép bản quyền</strong>
                      <span>{lightboxItem.licenseLabel}</span>
                    </div>
                    <span
                      className={`status-badge ${
                        lightboxItem.isDwcaExportable ? "status-public" : "status-warning"
                      }`}
                    >
                      {lightboxItem.isDwcaExportable ? "DwC-A OK" : "WEB ONLY"}
                    </span>
                  </div>
                  <div className="placeholder-row">
                    <div>
                      <strong>Ghi công tác giả (Attribution)</strong>
                      <span>{lightboxItem.attribution || "—"}</span>
                    </div>
                  </div>
                  <div className="placeholder-row">
                    <div>
                      <strong>Mẫu vật & Địa điểm</strong>
                      <span>
                        {lightboxItem.specimenCode} · {lightboxItem.provinceNameVn || "Việt Nam"} ·{" "}
                        {lightboxItem.collectionDate || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <Link
                    to={`${specBasePath}/${lightboxItem.specimenId}`}
                    className="button button-primary"
                    style={{ flex: 1 }}
                  >
                    Hồ sơ mẫu vật →
                  </Link>
                  {lightboxItem.sourceUrl ? (
                    <a
                      href={lightboxItem.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="button button-ghost"
                    >
                      Nguồn gốc ↗
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Tải ảnh lên MinIO (Admin) */}
      {uploadOpen ? (
        <div className="dialog-backdrop" onClick={() => !uploading && setUploadOpen(false)}>
          <form
            onSubmit={handleUploadSubmit}
            className="dialog-card"
            style={{ width: "min(560px, 95vw)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="icon-button dialog-close"
              onClick={() => setUploadOpen(false)}
            >
              <Icon name="close" size={18} />
            </button>
            <span className="eyebrow">MinIO Object Storage · vietinsect-media</span>
            <h2 style={{ marginTop: 4, marginBottom: 14 }}>Tải ảnh mẫu vật lên máy chủ nội bộ</h2>

            <div className="form-field" style={{ position: "relative" }}>
              <label>Tìm & Chọn Mẫu vật liên kết *</label>
              <input
                value={specQuery}
                onChange={(e) => setSpecQuery(e.target.value)}
                placeholder={uploadForm.specimenLabel || "Nhập mã GBIF- / VN- hoặc tên loài..."}
              />
              {specSuggestions.length > 0 ? (
                <div className="taxonomy-suggestions">
                  {specSuggestions.map((s) => (
                    <div
                      key={s.id}
                      className="taxonomy-suggestion-item"
                      onClick={() => {
                        setUploadForm((p) => ({
                          ...p,
                          specimenId: s.id,
                          specimenLabel: `${s.specimenCode} · ${s.scientificName}`,
                        }));
                        setSpecQuery("");
                        setSpecSuggestions([]);
                      }}
                    >
                      <strong>{s.specimenCode}</strong>
                      <span>{s.scientificName}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {uploadForm.specimenLabel ? (
                <small style={{ color: "#2E7D32", fontWeight: 700 }}>
                  Đã chọn: {uploadForm.specimenLabel}
                </small>
              ) : null}
            </div>

            <div className="form-field">
              <label>Tệp ảnh mẫu vật (JPEG / PNG / WebP ≤ 15MB) *</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                required
              />
            </div>

            <div className="vi-form-grid-2">
              <div className="form-field">
                <label>Giấy phép bản quyền mở *</label>
                <select
                  value={uploadForm.licenseCode}
                  onChange={(e) => setUploadForm((p) => ({ ...p, licenseCode: e.target.value }))}
                >
                  {ALLOWED_MEDIA_LICENSES.map((lic) => (
                    <option key={lic.code} value={lic.code}>
                      {lic.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Góc chụp (Shot Type)</label>
                <select
                  value={uploadForm.shotType}
                  onChange={(e) => setUploadForm((p) => ({ ...p, shotType: e.target.value }))}
                >
                  <option value="habitus">Toàn thân bảo tàng (Habitus)</option>
                  <option value="dorsal">Mặt lưng (Dorsal)</option>
                  <option value="lateral">Mặt bên (Lateral)</option>
                  <option value="head">Đầu / Khẩu khí (Head)</option>
                  <option value="field">Ngoài tự nhiên (Field)</option>
                </select>
              </div>
            </div>

            <div className="form-field">
              <label>Ghi công tác giả ảnh (Attribution)</label>
              <input
                value={uploadForm.attribution}
                onChange={(e) => setUploadForm((p) => ({ ...p, attribution: e.target.value }))}
                placeholder="VD: © Viện Sinh thái và Tài nguyên sinh vật (CC BY 4.0)"
              />
            </div>

            <div className="dialog-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setUploadOpen(false)}
                disabled={uploading}
              >
                Hủy
              </button>
              <button type="submit" className="button button-primary" disabled={uploading}>
                {uploading ? "Đang lưu vào MinIO..." : "Tải lên MinIO"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Xóa tệp ảnh khỏi MinIO?"
        message="Tệp ảnh sẽ bị xóa khỏi cả bucket MinIO và bảng specimen_images."
        variant="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
