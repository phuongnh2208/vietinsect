import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const orderColor = getOrderColor(specimen.orderName);

  const handleShare = () => {
    onCopyText(window.location.href, "Đã sao chép liên kết hồ sơ mẫu vật");
  };

  const handleCopyCode = () => {
    onCopyText(specimen.specimenCode, `Đã sao chép mã ${specimen.specimenCode}`);
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
      license: "CC BY 4.0",
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
      {/* 1. Breadcrumb navigation */}
      <nav className="vi-specimen-breadcrumb" aria-label="Breadcrumb">
        <Link to={isAdmin ? "/admin/dashboard" : "/"}>Trang chủ</Link>
        <Icon name="chevron-right" size={12} />
        <Link to={isAdmin ? "/admin/specimens" : "/specimens/search"}>Bộ sưu tập Mẫu vật</Link>
        <Icon name="chevron-right" size={12} />
        <span className="breadcrumb-current">{specimen.specimenCode}</span>
      </nav>

      {/* 2. Main Title Row */}
      <div className="specimen-title-row">
        <div className="specimen-title-left">
          <div className="specimen-id-chip">
            <Icon name="bug" size={13} />
            <span>SCR-08 · HỒ SƠ MẪU VẬT DARWIN CORE</span>
            <span className="specimen-code-tag">{specimen.specimenCode}</span>
          </div>

          <h1 className="specimen-scientific-heading">
            <em>{specimen.scientificName}</em>
          </h1>

          {specimen.commonNameVn && (
            <div className="specimen-common-name">
              <span>Tên tiếng Việt: </span>
              <strong>{specimen.commonNameVn}</strong>
            </div>
          )}

          {/* Classification Badges */}
          <div className="specimen-badges-wrap">
            <span
              className="taxonomy-badge"
              style={{ backgroundColor: orderColor, color: "#FFFFFF", borderColor: "#111111" }}
            >
              Bộ: {specimen.orderName || "Insecta"}
            </span>

            {specimen.familyName && (
              <span className="taxonomy-badge family-badge">
                Họ: {specimen.familyName}
              </span>
            )}

            {specimen.genusName && (
              <span className="taxonomy-badge genus-badge">
                Giống: <em>{specimen.genusName}</em>
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
                title="Mở bản ghi gốc trên cổng dữ liệu quốc tế GBIF"
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
              title="Sao chép mã định danh mẫu vật"
            >
              <Icon name="copy" size={14} />
              Mã ID
            </button>

            <button
              type="button"
              className="button button-sm button-ghost"
              onClick={handleShare}
              title="Sao chép liên kết chia sẻ"
            >
              <Icon name="share" size={14} />
              Chia sẻ
            </button>

            <button
              type="button"
              className="button button-sm button-ghost"
              onClick={handleDownloadDwc}
              title="Tải tệp JSON chuẩn Darwin Core"
            >
              <Icon name="download" size={14} />
              Xuất DwC
            </button>
          </div>

          {/* Admin Context Actions */}
          {isAdmin && (
            <div className="actions-group-admin">
              <button
                type="button"
                className="button button-sm button-ghost"
                onClick={onOpenLabelModal}
                title="Xem và in nhãn tiêu bản cắm kim bảo tàng"
              >
                <Icon name="printer" size={14} />
                In nhãn
              </button>

              <button
                type="button"
                className="button button-sm button-ghost"
                onClick={onTogglePublic}
                title="Chuyển đổi trạng thái Công khai / Nội bộ"
              >
                <Icon name={specimen.isPublic ? "lock" : "globe"} size={14} />
                {specimen.isPublic ? "Ẩn nội bộ" : "Công khai"}
              </button>

              <button
                type="button"
                className="button button-sm button-primary"
                onClick={() => navigate(`/admin/specimens/edit?id=${specimen.id}`)}
              >
                <Icon name="edit" size={14} />
                Chỉnh sửa
              </button>

              <button
                type="button"
                className="button button-sm button-danger"
                onClick={() => setDeleteConfirmOpen(true)}
                title="Xóa mẫu vật khỏi hệ thống"
              >
                <Icon name="trash" size={14} />
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
