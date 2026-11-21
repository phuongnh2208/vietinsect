import React, { useState, useEffect } from "react";
import Icon from "../../../components/ui/Icon";

export default function SpecimenImageGallery({
  images = [],
  speciesImages = [],
  scientificName = "",
  gbifOccurrenceId = null,
}) {
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
    return (
      <div className="vi-specimen-gallery-empty card">
        <div className="gallery-empty-inner">
          <div className="gallery-empty-icon">
            <Icon name="image" size={32} />
          </div>
          <h4>Chưa có hình ảnh lưu trữ nội bộ</h4>
          <p>
            Bản ghi mẫu vật này chưa đính kèm ảnh vi thể nội bộ hoặc ảnh số hóa độ phân giải cao.
          </p>
          {gbifOccurrenceId && String(gbifOccurrenceId).includes("inaturalist") ? (
            <a
              href={gbifOccurrenceId}
              target="_blank"
              rel="noreferrer"
              className="button button-sm button-ghost"
              style={{ marginTop: 10 }}
            >
              <Icon name="external-link" size={14} />
              Tra cứu ảnh thực địa trên iNaturalist Open Data ↗
            </a>
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
            Ảnh mẫu vật ({images.length})
          </button>
          <button
            type="button"
            className={`gallery-source-btn ${activeTab === "species" ? "active" : ""}`}
            onClick={() => setActiveTab("species")}
          >
            Ảnh tham khảo loài ({speciesImages.length})
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
              aria-label="Phóng to ảnh"
            >
              <Icon name="zoom-in" size={16} />
              <span>Phóng to</span>
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
                    ? "ẢNH THAM CHIẾU CÙNG LOÀI"
                    : `ẢNH ĐẠI DIỆN PHÂN LOẠI (${
                        currentImg.referenceScientificName ||
                        currentImg.referenceTaxonName ||
                        currentImg.referenceMatchRank
                      })`}
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
                  Nguồn <Icon name="external-link" size={12} />
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

      {/* Lightbox Modal */}
      {lightboxOpen && currentImg && (
        <div className="vi-lightbox-backdrop" onClick={() => setLightboxOpen(false)}>
          <div className="vi-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setLightboxOpen(false)}
              aria-label="Đóng"
            >
              <Icon name="close" size={20} />
            </button>

            {currentList.length > 1 && (
              <>
                <button
                  type="button"
                  className="lightbox-nav-btn prev"
                  onClick={() =>
                    setSelectedIdx(
                      (prev) => (prev - 1 + currentList.length) % currentList.length,
                    )
                  }
                  aria-label="Ảnh trước"
                >
                  <Icon name="chevron-left" size={24} />
                </button>
                <button
                  type="button"
                  className="lightbox-nav-btn next"
                  onClick={() => setSelectedIdx((prev) => (prev + 1) % currentList.length)}
                  aria-label="Ảnh tiếp theo"
                >
                  <Icon name="chevron-right" size={24} />
                </button>
              </>
            )}

            <img
              src={currentImg.url}
              alt={scientificName}
              className="lightbox-img"
            />

            <div className="lightbox-caption">
              <strong><em>{scientificName}</em></strong>
              {currentImg.attribution && <span> · {currentImg.attribution}</span>}
              {currentImg.licenseCode && (
                <span className="lightbox-license"> ({currentImg.licenseCode.toUpperCase()})</span>
              )}
              <span className="lightbox-counter">
                {selectedIdx + 1} / {currentList.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
