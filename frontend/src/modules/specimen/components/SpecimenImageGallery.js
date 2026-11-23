import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";
import SpecimenImageViewerModal from "../../media/components/SpecimenImageViewerModal";

export default function SpecimenImageGallery({
  images = [],
  speciesImages = [],
  scientificName = "",
  gbifOccurrenceId = null,
  referencesUrl = null,
  license = null,
  rightsHolder = null,
  recordedBy = null,
  datasetName = null,
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(images.length > 0 ? "specimen" : "species");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const currentList = activeTab === "specimen" ? images : speciesImages;
  const currentImg = currentList[selectedIdx] || currentList[0];

  useEffect(() => {
    setSelectedIdx(0);
  }, [activeTab]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (!lightboxOpen) return;
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") {
        setSelectedIdx((prev) => (prev + 1) % currentList.length);
      }
      if (e.key === "ArrowLeft") {
        setSelectedIdx((prev) => (prev - 1 + currentList.length) % currentList.length);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, currentList.length]);

  const hasAnyImages = images.length > 0 || speciesImages.length > 0;

  if (!hasAnyImages) {
    const sourceLink =
      referencesUrl ||
      (gbifOccurrenceId && /^https?:\/\//i.test(String(gbifOccurrenceId))
        ? String(gbifOccurrenceId)
        : null);
    const contributor = rightsHolder || recordedBy || null;
    return (
      <div className="vi-specimen-gallery-empty card">
        <div className="gallery-empty-inner">
          <div className="gallery-empty-icon">
            <Icon name="image" size={32} />
          </div>
          <h4>{t("specimenDetail.noInternalImages")}</h4>
          <p>{t("specimenDetail.noInternalImagesDesc")}</p>
          {sourceLink ? (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <a
                href={sourceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-sm button-ghost"
              >
                <Icon name="external-link" size={14} />
                {t("specimenDetail.viewSourcePhoto", "Xem ảnh gốc tại nguồn")} ↗
              </a>
              {(contributor || license || datasetName) && (
                <small style={{ opacity: 0.8 }}>
                  {[contributor ? `© ${contributor}` : null, license, datasetName].filter(Boolean).join(" · ")}
                </small>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="vi-specimen-gallery card">
      {/* Switcher giữa Ảnh mẫu vật và Ảnh tham chiếu loài nếu có cả 2 */}
      {images.length > 0 && speciesImages.length > 0 && (
        <div className="gallery-source-tabs">
          <button
            type="button"
            className={`gallery-source-btn ${activeTab === "specimen" ? "active" : ""}`}
            onClick={() => setActiveTab("specimen")}
          >
            {t("specimenDetail.specimenPhotos", { count: images.length })}
          </button>
          <button
            type="button"
            className={`gallery-source-btn ${activeTab === "species" ? "active" : ""}`}
            onClick={() => setActiveTab("species")}
          >
            {t("specimenDetail.speciesRefPhotos", { count: speciesImages.length })}
          </button>
        </div>
      )}

      {/* Main Image Stage */}
      {currentImg && (
        <div className="gallery-main-stage">
          <div
            className="gallery-image-wrapper"
            onClick={() => setLightboxOpen(true)}
            title="Nhấp để xem ảnh phóng to đầy màn hình"
          >
            <img
              src={currentImg.url}
              alt={`${scientificName} - ${currentImg.shotType || "specimen"}`}
              className="gallery-main-img"
            />
            <button
              type="button"
              className="gallery-zoom-badge"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(true);
              }}
              aria-label={t("specimenDetail.zoom")}
            >
              <Icon name="zoom-in" size={16} />
              <span>{t("specimenDetail.zoom")}</span>
            </button>
          </div>

          {/* Metadata caption bên dưới ảnh chính */}
          <div className="gallery-meta-bar">
            <div className="gallery-meta-left">
              <span className="gallery-shot-badge">
                {currentImg.shotType ? currentImg.shotType.toUpperCase() : "FIELD OBSERVATION"}
              </span>
              {currentImg.isSpeciesReference && (
                <span className="gallery-ref-badge">
                  {currentImg.referenceMatchRank === "Species"
                    ? t("specimenDetail.sameSpeciesRef")
                    : t("specimenDetail.taxonRefPhoto", {
                        name:
                          currentImg.referenceScientificName ||
                          currentImg.referenceTaxonName ||
                          currentImg.referenceMatchRank,
                      })}
                </span>
              )}
              {currentImg.licenseCode && (
                <span className="gallery-license-badge">
                  {currentImg.licenseCode.toUpperCase()}
                </span>
              )}
            </div>
            <div className="gallery-meta-right">
              {currentImg.attribution && (
                <span className="gallery-attribution" title={currentImg.attribution}>
                  {currentImg.attribution}
                </span>
              )}
              {currentImg.sourceUrl && (
                <a
                  href={currentImg.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="gallery-source-link"
                >
                  {t("specimenDetail.source")} <Icon name="external-link" size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thumbnail Strip nếu có nhiều hơn 1 ảnh */}
      {currentList.length > 1 && (
        <div className="gallery-thumbs-strip">
          {currentList.map((img, idx) => (
            <button
              key={img.id || idx}
              type="button"
              className={`gallery-thumb-item ${selectedIdx === idx ? "is-active" : ""}`}
              onClick={() => setSelectedIdx(idx)}
            >
              <img src={img.thumbnailUrl || img.url} alt={`Thumbnail ${idx + 1}`} />
              {selectedIdx === idx && <div className="thumb-indicator" />}
            </button>
          ))}
        </div>
      )}

      {/* Screen 4: Unified Scientific Image Viewer Modal */}
      <SpecimenImageViewerModal
        open={lightboxOpen && Boolean(currentImg)}
        items={currentList.map((img) => ({
          ...img,
          scientificName: img.referenceScientificName || scientificName,
        }))}
        currentIndex={selectedIdx}
        onIndexChange={setSelectedIdx}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
