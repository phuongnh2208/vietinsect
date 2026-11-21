import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../../components/ui/Icon";
import EmptyState from "../../../components/ui/EmptyState";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/ToastProvider";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import mediaService, { ALLOWED_MEDIA_LICENSES } from "../media.service";
import specimenService from "../../specimen/specimen.service";
import { getOrderColor } from "../../specimen/specimen.constants";
import SpecimenImageViewerModal from "../components/SpecimenImageViewerModal";

/**
 * MediaGalleryPage (Screen 5 — /media)
 * - Compact 1-line header + inline statistics pills (NO 4 oversized dashboard cards).
 * - Compact sticky horizontal filter toolbar.
 * - Image Gallery placed immediately below so the first row of specimen images is visible at 1440×900 without scrolling.
 */
export default function MediaGalleryPage() {
  const isAdmin = useIsAdminContext();
  const { toast } = useToast();

  const [qInput, setQInput] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    q: "",
    order: "",
    provinceId: "",
    shotType: "",
    licenseCode: "",
    sortBy: "newest",
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
  const [errorMsg, setErrorMsg] = useState("");
  const [brokenIds, setBrokenIds] = useState({});
  const [viewerIndex, setViewerIndex] = useState(null);
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
    }, 280);
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
    setErrorMsg("");
    try {
      const res = await mediaService.getMediaList(filters);
      setItems(res.items || []);
      setPagination(res.pagination || { total: 0, page: 1, limit: 24, totalPages: 0 });
      setStatus("success");
    } catch (err) {
      const msg = err?.response?.data?.message || "Không thể tải thư viện hình ảnh";
      setErrorMsg(msg);
      toast(msg, "error");
      setStatus("error");
    }
  }, [filters, toast]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleResetFilters = () => {
    setQInput("");
    setFilters({
      q: "",
      order: "",
      provinceId: "",
      shotType: "",
      licenseCode: "",
      sortBy: "newest",
      dwcaOnly: false,
      voucheredOnly: false,
      page: 1,
      limit: 24,
    });
  };

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
      setViewerIndex(null);
      fetchMedia();
      refreshStats();
    } catch (err) {
      toast(err.response?.data?.message || "Không thể xóa ảnh", "error");
    }
  };

  const specBasePath = isAdmin ? "/admin/specimens" : "/specimens";

  return (
    <div className="page-container page-content vi-media-page-compact" data-testid="media-library-page">
      {/* A & B: Compact Top Header + Single Horizontal Row of Inline Statistics */}
      <header className="vi-media-compact-header">
        <div className="vi-media-title-block">
          <div className="eyebrow" style={{ marginBottom: 2 }}>
            <Icon name="image" size={13} />
            <span>THƯ VIỆN HÌNH ẢNH</span>
          </div>
          <h1 className="vi-media-compact-h1">Thư viện hình ảnh côn trùng Việt Nam</h1>
          <p className="vi-media-compact-desc">
            Tư liệu ảnh tiêu bản và thực địa lưu trữ trên cụm MinIO nội bộ, chuẩn hóa giấy phép Creative Commons.
          </p>
        </div>

        <div className="vi-media-inline-stats" data-testid="media-compact-stats">
          <div className="vi-inline-stat-item">
            <span className="vi-inline-stat-label">Tổng ảnh</span>
            <strong className="vi-inline-stat-val">
              {(stats?.totalImages ?? pagination.total ?? 0).toLocaleString("vi-VN")}
            </strong>
          </div>
          <div className="vi-inline-stat-item">
            <span className="vi-inline-stat-label">Mẫu vật có ảnh</span>
            <strong className="vi-inline-stat-val">
              {(stats?.specimensWithMedia ?? 0).toLocaleString("vi-VN")}
            </strong>
          </div>
          <div className="vi-inline-stat-item">
            <span className="vi-inline-stat-label">Chuẩn GBIF</span>
            <strong className="vi-inline-stat-val">
              {(stats?.dwcaExportable ?? 0).toLocaleString("vi-VN")}
            </strong>
          </div>
          <div className="vi-inline-stat-item">
            <span className="vi-inline-stat-label">Lưu trữ</span>
            <strong className="vi-inline-stat-val">MinIO VN</strong>
          </div>

          {isAdmin ? (
            <button
              type="button"
              className="button button-sm button-primary"
              onClick={() => setUploadOpen(true)}
            >
              <Icon name="upload" size={14} />
              <span>Tải ảnh lên</span>
            </button>
          ) : null}
        </div>
      </header>

      {/* C & H: Compact Sticky Horizontal Filter Toolbar */}
      <section className="vi-media-sticky-toolbar" aria-label="Bộ lọc thư viện ảnh">
        <div className="vi-media-toolbar-row">
          <div className="vi-media-search-input-wrap">
            <Icon name="search" size={14} />
            <input
              type="text"
              aria-label="Tìm theo tên khoa học hoặc mã mẫu vật"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Tìm tên loài, mã mẫu vật, tác giả..."
            />
          </div>

          <select
            className="vi-compact-select"
            aria-label="Lọc theo bộ côn trùng"
            value={filters.order}
            onChange={(e) => setFilters((p) => ({ ...p, order: e.target.value, page: 1 }))}
          >
            <option value="">Tất cả Bộ (Order)</option>
            {lookups.orders.map((o) => (
              <option key={o.id} value={o.scientificName}>
                {o.scientificName}
              </option>
            ))}
          </select>

          <select
            className="vi-compact-select"
            aria-label="Lọc theo tỉnh thành"
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

          <select
            className="vi-compact-select"
            aria-label="Lọc theo góc chụp"
            value={filters.shotType}
            onChange={(e) => setFilters((p) => ({ ...p, shotType: e.target.value, page: 1 }))}
          >
            <option value="">Tất cả góc chụp</option>
            <option value="habitus">Toàn thân (Habitus)</option>
            <option value="dorsal">Mặt lưng (Dorsal)</option>
            <option value="lateral">Mặt bên (Lateral)</option>
            <option value="field">Thực địa (Field)</option>
          </select>

          <select
            className="vi-compact-select"
            aria-label="Lọc theo giấy phép"
            value={filters.licenseCode}
            onChange={(e) => setFilters((p) => ({ ...p, licenseCode: e.target.value, page: 1 }))}
          >
            <option value="">Tất cả giấy phép</option>
            {ALLOWED_MEDIA_LICENSES.map((lic) => (
              <option key={lic.code} value={lic.code}>
                {lic.code.toUpperCase()}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="button button-sm button-ghost"
            onClick={() => setShowAdvancedFilters((v) => !v)}
          >
            {showAdvancedFilters ? "Ẩn lọc phụ" : "Lọc phụ"}
          </button>

          <button
            type="button"
            className="button button-sm button-ghost"
            onClick={handleResetFilters}
          >
            Đặt lại
          </button>
        </div>

        {showAdvancedFilters ? (
          <div className="vi-media-adv-filter-row">
            <label className="vi-compact-check-label">
              <input
                type="checkbox"
                checked={filters.dwcaOnly}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, dwcaOnly: e.target.checked, page: 1 }))
                }
              />
              <span>Chỉ ảnh xuất gói DwC-A (CC0 / CC BY 4.0)</span>
            </label>
            <label className="vi-compact-check-label">
              <input
                type="checkbox"
                checked={filters.voucheredOnly}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, voucheredOnly: e.target.checked, page: 1 }))
                }
              />
              <span>Chỉ ảnh gắn tiêu bản bảo tàng (Preserved Voucher)</span>
            </label>
          </div>
        ) : null}
      </section>

      {/* D, E, F, G: Primary Image Gallery immediately visible in first viewport */}
      {status === "loading" ? (
        <div className="vi-media-grid-refined" data-testid="media-loading-skeleton">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card vi-media-skeleton-card">
              <div className="vi-media-skeleton-thumb" />
              <div className="vi-media-skeleton-lines" />
            </div>
          ))}
        </div>
      ) : status === "error" ? (
        <div className="card panel">
          <EmptyState
            icon="alert"
            title="Lỗi tải thư viện hình ảnh"
            description={errorMsg}
            action={
              <button type="button" className="button button-sm button-primary" onClick={fetchMedia}>
                Thử lại
              </button>
            }
          />
        </div>
      ) : items.length === 0 ? (
        <div className="card panel">
          <EmptyState
            icon="layers"
            title="Không có hình ảnh khớp bộ lọc"
            description="Thử đặt lại bộ lọc hoặc thay đổi từ khóa tìm kiếm."
            action={
              <button
                type="button"
                className="button button-sm button-secondary"
                onClick={handleResetFilters}
              >
                Đặt lại bộ lọc
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="vi-media-grid-refined" data-testid="media-gallery-grid">
            {items.map((img, idx) => {
              const orderColor = getOrderColor(img.orderName);
              const isBroken = Boolean(brokenIds[img.id]);
              return (
                <article key={img.id} className="card vi-media-card-refined">
                  <div
                    className="vi-media-photo-box"
                    onClick={() => setViewerIndex(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setViewerIndex(idx)}
                  >
                    {!isBroken ? (
                      <img
                        src={img.thumbnailUrl || img.url}
                        alt={img.scientificName}
                        loading="lazy"
                        className="vi-media-photo-img"
                        onError={() => setBrokenIds((prev) => ({ ...prev, [img.id]: true }))}
                      />
                    ) : (
                      <div className="vi-media-broken-fallback">
                        <Icon name="image" size={24} />
                        <span>Ảnh không khả dụng</span>
                      </div>
                    )}

                    {img.shotType ? (
                      <span className="vi-media-shot-chip">{img.shotType}</span>
                    ) : null}

                    <span
                      className={`status-badge vi-media-license-chip ${
                        img.isDwcaExportable ? "status-public" : "status-warning"
                      }`}
                    >
                      {(img.licenseCode || "cc-by").toUpperCase()}
                    </span>

                    <div className="vi-media-hover-overlay">
                      <span>Phóng to ảnh</span>
                    </div>
                  </div>

                  <div className="vi-media-card-caption">
                    <div className="vi-media-card-title-row">
                      <em className="vi-media-sci-name" title={img.scientificName}>
                        {img.scientificName}
                      </em>
                      <span
                        className="vi-media-order-dot"
                        style={{ background: orderColor }}
                        title={img.orderName || "Insecta"}
                      />
                    </div>

                    <div className="vi-media-card-meta-row">
                      <Link to={`${specBasePath}/${img.specimenId}`} className="vi-code-link mono">
                        {img.specimenCode || `#${img.specimenId}`}
                      </Link>
                      <span className="vi-media-prov-text">
                        {img.provinceNameVn || "Việt Nam"}
                      </span>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="vi-media-del-btn"
                          title="Xóa ảnh khỏi MinIO"
                          onClick={() => setPendingDelete(img)}
                        >
                          <Icon name="close" size={12} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="card vi-pagination-bar" style={{ marginTop: 14, padding: "10px 16px" }}>
            <div style={{ fontSize: 12, color: "var(--vi-muted)" }}>
              Trang <strong>{pagination.page}</strong> / <strong>{pagination.totalPages || 1}</strong> · Tổng{" "}
              <strong>{(pagination.total || 0).toLocaleString("vi-VN")}</strong> ảnh
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

      {/* Screen 4: Redesigned Specimen Image Viewer Modal */}
      <SpecimenImageViewerModal
        open={viewerIndex !== null}
        items={items}
        currentIndex={viewerIndex ?? 0}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerIndex(null)}
        specimenBasePath={specBasePath}
      />

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
              <label>Tìm &amp; Chọn Mẫu vật liên kết *</label>
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
                      <span>
                        <em>{s.scientificName}</em>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {uploadForm.specimenLabel ? (
                <small style={{ color: "#237A35", fontWeight: 700 }}>
                  Đã chọn: {uploadForm.specimenLabel}
                </small>
              ) : null}
            </div>

            <div className="form-field">
              <label>Tệp ảnh mẫu vật (JPEG / PNG ≤ 15MB) *</label>
              <input
                type="file"
                accept="image/jpeg,image/png"
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
