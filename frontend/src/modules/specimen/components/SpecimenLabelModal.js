import React from "react";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";

export default function SpecimenLabelModal({ specimen, isOpen, onClose }) {
  const { t } = useTranslation();
  if (!isOpen || !specimen) return null;
  const notRecorded = t("common.notRecorded", "Chưa ghi nhận");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="vi-label-modal-backdrop" onClick={onClose}>
      <div className="vi-label-modal-content card" onClick={(e) => e.stopPropagation()}>
        <div className="label-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="printer" size={18} />
            <h3 style={{ margin: 0 }}>Nhãn mẫu vật bảo tàng (Specimen Pinned Label)</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="label-modal-body">
          <p className="label-modal-desc">
            Bản xem trước nhãn tiêu bản cắm kim / bảo tàng chuẩn kích thước quy định (35mm × 55mm).
          </p>

          {/* Khung nhãn mẫu vật in */}
          <div className="vi-museum-label-sheet">
            <div className="vi-museum-pinned-label">
              <div className="label-institute">VIỆT NAM · BẢO TÀNG THIÊN NHIÊN (VAST)</div>
              <div className="label-taxon-name">
                <em>{specimen.scientificName}</em>
              </div>
              <div className="label-hierarchy">
                {specimen.orderName || notRecorded} : {specimen.familyName || notRecorded}
              </div>
              <div className="label-locality">
                {specimen.provinceNameVn || notRecorded}
                {specimen.localityDetail ? `, ${specimen.localityDetail}` : ""}
              </div>
              {specimen.latitude != null && specimen.longitude != null && (
                <div className="label-coords">
                  WGS84: {specimen.latitude.toFixed(4)}°N, {specimen.longitude.toFixed(4)}°E
                </div>
              )}
              <div className="label-date-collector">
                <span>📅 {specimen.collectionDate || notRecorded}</span>
                <span>👤 {specimen.recordedBy || notRecorded}</span>
              </div>
              <div className="label-code-footer">
                <strong>{specimen.specimenCode}</strong>
                <span>{specimen.basisOfRecord || notRecorded}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="label-modal-footer">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="button button-primary" onClick={handlePrint}>
            <Icon name="printer" size={16} />
            In nhãn tiêu bản
          </button>
        </div>
      </div>
    </div>
  );
}
