import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";
import { getOrderColor } from "../specimen.constants";

export default function SpecimenHeader({
  specimen,
  isAdmin = false,
  onTogglePublic,
  onDelete,
  onOpenLabelModal,
  onCopyText,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const orderColor = getOrderColor(specimen.orderName);
  const listFallbackPath = isAdmin ? "/admin/specimens" : "/specimens/search";

  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(listFallbackPath);
    }
  };

  const handleShare = () => {
    onCopyText(window.location.href, t("specimenDetail.copiedLink"));
  };

  const handleCopyCode = () => {
    onCopyText(specimen.specimenCode, t("specimenDetail.copiedCode", { code: specimen.specimenCode }));
  };

  const handleDownloadDwc = () => {
    const dwcJson = {
      id: specimen.id,
      catalogNumber: specimen.specimenCode,
      occurrenceID: specimen.gbifOccurrenceId || `vietinsect:specimen:${specimen.id}`,
      basisOfRecord: specimen.basisOfRecord,
      scientificName: specimen.scientificName,
      vernacularName: specimen.commonNameVn,
      taxonRank: specimen.taxonRank,
      order: specimen.orderName,
      family: specimen.familyName,
      genus: specimen.genusName,
      eventDate: specimen.collectionDate,
      recordedBy: specimen.recordedBy,
      individualCount: specimen.individualCount,
      sex: specimen.sex,
      country: "Vietnam",
      countryCode: "VN",
      stateProvince: specimen.provinceNameVn,
      decimalLatitude: specimen.latitude,
      decimalLongitude: specimen.longitude,
      geodeticDatum: "WGS84",
      institutionCode: specimen.institutionCode,
      collectionCode: specimen.catalogNumber,
      datasetKey: specimen.gbifDatasetKey,
      license: specimen.license || null,
      retrievedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(dwcJson, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `specimen-${specimen.specimenCode}-dwc.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="vi-specimen-header">
      {/* 1. Top Navigation Row: Nút Quay lại + Breadcrumb */}
      <div className="vi-header-nav-row">
        <div className="vi-header-nav-left">
          <button
            type="button"
            className="vi-back-page-btn"
            onClick={handleGoBack}
            title={t("common.back")}
          >
            <Icon name="chevron-left" size={15} />
            <span>{t("common.back")}</span>
          </button>

          <nav className="vi-specimen-breadcrumb" aria-label="Breadcrumb">
            <Link to={isAdmin ? "/admin/dashboard" : "/"}>{t("navigation.home")}</Link>
            <Icon name="chevron-right" size={12} />
            <Link to={listFallbackPath}>{t("specimenDetail.collection")}</Link>
            <Icon name="chevron-right" size={12} />
            <span className="breadcrumb-current">{specimen.specimenCode}</span>
          </nav>
        </div>
      </div>

      {/* 2. Main Title Row */}
      <div className="specimen-title-row">
        <div className="specimen-title-left">
          <div className="specimen-id-chip">
            <Icon name="bug" size={13} />
            <span>{t("specimenDetail.darwinCoreRecord")}</span>
            <span className="specimen-code-tag">{specimen.specimenCode}</span>
          </div>

          <h1 className="specimen-scientific-heading">
            <em>{specimen.scientificName}</em>
          </h1>

          {specimen.commonNameVn && (
            <div className="specimen-common-name">
              <span>{t("specimenDetail.commonNameLabel")}</span>
              <strong>{specimen.commonNameVn}</strong>
            </div>
          )}

          {/* Classification Badges */}
          <div className="specimen-badges-wrap">
            <span
              className="taxonomy-badge"
              style={{ backgroundColor: orderColor, color: "#FFFFFF", borderColor: "#D1D5DB" }}
            >
              {t("specimenDetail.orderPrefix")}: {specimen.orderName || "Insecta"}
            </span>

            {specimen.familyName && (
              <span className="taxonomy-badge family-badge">
                {t("specimenDetail.familyPrefix")}: {specimen.familyName}
              </span>
            )}

            {specimen.genusName && (
              <span className="taxonomy-badge genus-badge">
                {t("specimenDetail.genusPrefix")}: <em>{specimen.genusName}</em>
              </span>
            )}

            <span
              className={`status-badge ${specimen.isPublic ? "status-public" : "status-private"}`}
            >
              {specimen.isPublic ? "PUBLIC OPEN DATA" : "INTERNAL ONLY"}
            </span>

            {specimen.gbifLink && (
              <a
                href={specimen.gbifLink}
                target="_blank"
                rel="noreferrer"
                className="taxonomy-badge gbif-link-badge"
              >
                GBIF #{String(specimen.gbifOccurrenceId).replace(/^gbif:/, "")} ↗
              </a>
            )}
          </div>
        </div>

        {/* 3. Action Toolbar */}
        <div className="specimen-actions-toolbar">
          <div className="actions-group-public">
            <button
              type="button"
              className="button button-sm button-ghost"
              onClick={handleCopyCode}
            >
              <Icon name="copy" size={14} />
              {t("specimenDetail.copyId")}
            </button>

            <button
              type="button"
              className="button button-sm button-ghost"
              onClick={handleShare}
            >
              <Icon name="share" size={14} />
              {t("specimenDetail.share")}
            </button>

            <button
              type="button"
              className="button button-sm button-ghost"
              onClick={handleDownloadDwc}
            >
              <Icon name="download" size={14} />
              {t("specimenDetail.exportDwc")}
            </button>
          </div>

          {isAdmin && (
            <div className="actions-group-admin">
              <button
                type="button"
                className="button button-sm button-ghost"
                onClick={onOpenLabelModal}
              >
                <Icon name="printer" size={14} />
                {t("specimenDetail.printLabel")}
              </button>

              <button
                type="button"
                className="button button-sm button-ghost"
                onClick={onTogglePublic}
              >
                <Icon name={specimen.isPublic ? "lock" : "globe"} size={14} />
                {specimen.isPublic ? t("specimenDetail.hideInternal") : t("common.public")}
              </button>

              <button
                type="button"
                className="button button-sm button-primary"
                onClick={() => navigate(`/admin/specimens/edit?id=${specimen.id}`)}
              >
                <Icon name="edit" size={14} />
                {t("common.edit")}
              </button>

              <button
                type="button"
                className="button button-sm button-danger"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Icon name="trash" size={14} />
                {t("common.delete")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && (
        <div className="vi-confirm-backdrop" onClick={() => setDeleteConfirmOpen(false)}>
          <div className="vi-confirm-card card" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon alert">
              <Icon name="alert" size={28} />
            </div>
            <h3>Xác nhận xóa bản ghi mẫu vật?</h3>
            <p>
              Hành động này sẽ đánh dấu xóa mềm bản ghi <strong>{specimen.specimenCode}</strong>{" "}
              (<em>{specimen.scientificName}</em>). Mọi ảnh và liên kết DNA liên quan sẽ được đưa vào
              trạng thái lưu trữ bảo mật.
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  onDelete();
                }}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
