import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";

/**
 * SpecimenImageViewerModal (Screen 4)
 * - Desktop 2-column scientific image viewer: 63% natural aspect-ratio image stage + 37% structured metadata panel.
 * - Supports Prev/Next navigation, Zoom In/Out/Reset, Fullscreen, Keyboard arrows & Escape.
 * - Never stretches or distorts portrait/landscape photographs (object-fit: contain on neutral scientific surface).
 */
export default function SpecimenImageViewerModal({
  open = false,
  items = [],
  currentIndex = 0,
  onIndexChange,
  onClose,
  specimenBasePath = "/specimens",
}) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [imgError, setImgError] = useState(false);

  const safeList = Array.isArray(items) ? items : [];
  const current = safeList[currentIndex] || safeList[0] || null;

  useEffect(() => {
    setZoom(1);
    setImgError(false);
  }, [currentIndex, open]);

  const handlePrev = useCallback(() => {
    if (safeList.length <= 1 || !onIndexChange) return;
    onIndexChange((currentIndex - 1 + safeList.length) % safeList.length);
  }, [currentIndex, onIndexChange, safeList.length]);

  const handleNext = useCallback(() => {
    if (safeList.length <= 1 || !onIndexChange) return;
    onIndexChange((currentIndex + 1) % safeList.length);
  }, [currentIndex, onIndexChange, safeList.length]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose && onClose();
      else if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)));
      else if (e.key === "-") setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
      else if (e.key === "0") setZoom(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, handlePrev, handleNext]);

  if (!open || !current) return null;

  const notProvided = t("media.notProvided");
  const sciName = current.scientificName || current.taxonName || notProvided;
  const specId = current.specimenId || current.specimen_id;
  const specCode = current.specimenCode || current.specimen_code || (specId ? `#${specId}` : notProvided);
  const license = (current.licenseCode || current.license_code || "CC-BY").toUpperCase();
  const shotType = current.shotType || current.shot_type || "habitus";
  const attribution = current.attribution || notProvided;
  const contributor = current.photographer || current.recordedBy || current.attribution || notProvided;
  const collectionDate = current.collectionDate
    ? String(current.collectionDate).slice(0, 10)
    : notProvided;
  const locality = current.provinceNameVn || current.localityDetail || notProvided;
  const storageSource = current.storageBucket
    ? `MinIO (${current.storageBucket})`
    : current.sourceProvider || "MinIO (vietinsect-media)";
  const originalUrl = current.sourceUrl || current.url;

  return (
    <div
      className="vi-img-modal-backdrop"
      data-testid="specimen-image-viewer-modal"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Xem ảnh mẫu vật ${sciName}`}
    >
      <div className="vi-img-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* LEFT 63%: Natural Aspect-Ratio Image Viewer Stage */}
        <div className="vi-img-modal-stage">
          <div className="vi-img-modal-topbar">
            <span className="vi-img-modal-counter">
              {currentIndex + 1} / {safeList.length}
            </span>
            <span className="vi-img-modal-shot-badge">{shotType.toUpperCase()}</span>
          </div>

          {safeList.length > 1 && (
            <>
              <button
                type="button"
                className="vi-img-modal-nav prev"
                onClick={handlePrev}
                aria-label={t("media.prevImage")}
                title={t("media.prevImage")}
              >
                <Icon name="chevron-left" size={20} />
              </button>
              <button
                type="button"
                className="vi-img-modal-nav next"
                onClick={handleNext}
                aria-label={t("media.nextImage")}
                title={t("media.nextImage")}
              >
                <Icon name="chevron-right" size={20} />
              </button>
            </>
          )}

          <div className="vi-img-modal-canvas">
            {!imgError ? (
              <img
                src={current.url}
                alt={sciName}
                className="vi-img-modal-photo"
                style={{ transform: `scale(${zoom})` }}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="vi-img-modal-fallback">
                <Icon name="image" size={36} />
                <span>{t("media.loadOriginalFailed")}</span>
              </div>
            )}
          </div>

          <div className="vi-img-modal-controls">
            <button
              type="button"
              className="vi-img-ctrl-btn"
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              aria-label={t("media.zoomOut")}
              title={t("media.zoomOut")}
            >
              −
            </button>
            <span className="vi-img-zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="vi-img-ctrl-btn"
              onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
              aria-label={t("media.zoomIn")}
              title={t("media.zoomIn")}
            >
              +
            </button>
            <button
              type="button"
              className="vi-img-ctrl-btn"
              onClick={() => setZoom(1)}
              aria-label={t("media.fitFrame")}
              title={t("media.fitFrame")}
            >
              Fit 1:1
            </button>
          </div>
        </div>

        {/* RIGHT 37%: Structured Scientific Metadata Panel */}
        <aside className="vi-img-modal-meta">
          <div className="vi-img-modal-meta-header">
            <div>
              <div className="eyebrow" style={{ marginBottom: 2 }}>
                {t("media.viewerEyebrow")}
              </div>
              <h2 className="vi-img-modal-title">
                <em>{sciName}</em>
              </h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label={t("common.close")}
              title={t("common.close")}
            >
              <Icon name="close" size={18} />
            </button>
          </div>

          <dl className="vi-img-meta-dl">
            <div className="vi-img-meta-row">
              <dt>{t("specimen.scientificName")}</dt>
              <dd>
                <strong>
                  <em>{sciName}</em>
                </strong>
              </dd>
            </div>
            <div className="vi-img-meta-row">
              <dt>{t("media.imageId")}</dt>
              <dd className="mono">{current.id ? `IMG-${current.id}` : notProvided}</dd>
            </div>
            <div className="vi-img-meta-row">
              <dt>{t("media.linkedSpecimen")}</dt>
              <dd className="mono">
                {specId ? (
                  <Link to={`${specimenBasePath}/${specId}`} onClick={onClose} className="vi-code-link">
                    {specCode}
                  </Link>
                ) : (
                  specCode
                )}
              </dd>
            </div>
            <div className="vi-img-meta-row">
              <dt>{t("media.shotTypeLabel")}</dt>
              <dd>{shotType}</dd>
            </div>
            <div className="vi-img-meta-row">
              <dt>{t("media.licenseLabel")}</dt>
              <dd>
                <span className="status-badge status-public">{license}</span>
                {current.licenseLabel ? (
                  <span style={{ display: "block", fontSize: 11, color: "#64748B", marginTop: 2 }}>
                    {current.licenseLabel}
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="vi-img-meta-row">
              <dt>{t("media.attributionLabel")}</dt>
              <dd>{attribution}</dd>
            </div>
            <div className="vi-img-meta-row">
              <dt>{t("media.contributorLabel")}</dt>
              <dd>{contributor}</dd>
            </div>
            <div className="vi-img-meta-row">
              <dt>{t("specimen.eventDate")}</dt>
              <dd className="mono">{collectionDate}</dd>
            </div>
            <div className="vi-img-meta-row">
              <dt>{t("media.localityLabel")}</dt>
              <dd>{locality}</dd>
            </div>
            <div className="vi-img-meta-row">
              <dt>{t("media.storageSourceLabel")}</dt>
              <dd className="mono">{storageSource}</dd>
            </div>
          </dl>

          <div className="vi-img-modal-actions">
            {specId ? (
              <Link
                to={`${specimenBasePath}/${specId}`}
                onClick={onClose}
                className="button button-primary"
                style={{ flex: 1, justifyContent: "center" }}
              >
                {t("media.viewSpecimenRecord")}
              </Link>
            ) : null}
            {originalUrl ? (
              <a
                href={originalUrl}
                target="_blank"
                rel="noreferrer"
                className="button button-ghost"
                style={{ justifyContent: "center" }}
              >
                {t("media.originalSource")}
              </a>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
