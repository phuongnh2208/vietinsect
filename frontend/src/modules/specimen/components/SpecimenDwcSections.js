import React from "react";
import { useTranslation } from "react-i18next";
import { formatBasisOfRecord, SEX_LABELS } from "../specimen.constants";

function MetadataRow({ label, dwcTerm, value, isItalic = false, highlight = false, emptyText = "Chưa ghi nhận" }) {
  const displayVal = value != null && String(value).trim() !== "" ? value : emptyText;
  return (
    <div className={`dwc-table-row ${highlight ? "is-highlight" : ""}`}>
      <div className="dwc-label-col">
        <span className="dwc-label-vn">{label}</span>
        {dwcTerm && <code className="dwc-term-code">{dwcTerm}</code>}
      </div>
      <div className="dwc-value-col">
        <span className={`dwc-value-text ${isItalic ? "is-italic" : ""}`}>
          {displayVal}
        </span>
      </div>
    </div>
  );
}

export default function SpecimenDwcSections({ specimen }) {
  const { t } = useTranslation();
  if (!specimen) return null;
  const notRecorded = t("common.notRecorded", "Chưa ghi nhận");

  return (
    <div className="vi-dwc-sections-container">
      {/* 1. Định danh & Phân loại */}
      <section className="vi-dwc-group card">
        <div className="dwc-group-header">
          <h3>1. Định danh & Phân loại học</h3>
          <span className="dwc-group-subtitle">Taxonomic Identification</span>
        </div>
        <div className="dwc-table-grid">
          <MetadataRow
            label="Mã định danh mẫu vật"
            dwcTerm="catalogNumber / specimenCode"
            value={specimen.specimenCode}
            highlight
          />
          <MetadataRow
            label="Mã định danh toàn cầu"
            dwcTerm="occurrenceID"
            value={specimen.gbifOccurrenceId || `vietinsect:specimen:${specimen.id}`}
          />
          <MetadataRow
            label="Loại bản ghi mẫu"
            dwcTerm="basisOfRecord"
            value={formatBasisOfRecord(specimen.basisOfRecord)}
          />
          <MetadataRow
            label="Tên khoa học"
            dwcTerm="scientificName"
            value={specimen.scientificName}
            isItalic
            highlight
          />
          <MetadataRow
            label="Tên tiếng Việt"
            dwcTerm="vernacularName"
            value={specimen.commonNameVn}
          />
          <MetadataRow
            label="Tên tiếng Anh"
            dwcTerm="vernacularName:en"
            value={specimen.commonNameEn}
          />
          <MetadataRow
            label="Cấp phân loại"
            dwcTerm="taxonRank"
            value={specimen.taxonRank}
            emptyText={notRecorded}
          />
          <MetadataRow
            label="Bộ côn trùng"
            dwcTerm="order"
            value={specimen.orderName}
          />
          <MetadataRow
            label="Họ phân loại"
            dwcTerm="family"
            value={specimen.familyName}
          />
          <MetadataRow
            label="Giống / Chi"
            dwcTerm="genus"
            value={specimen.genusName}
            isItalic
          />
        </div>
      </section>

      {/* 2. Thu thập & Mẫu vật bảo tàng */}
      <section className="vi-dwc-group card">
        <div className="dwc-group-header">
          <h3>2. Thông tin Thu thập & Mẫu vật</h3>
          <span className="dwc-group-subtitle">Event & Specimen Preservation</span>
        </div>
        <div className="dwc-table-grid">
          <MetadataRow
            label="Ngày thu thập"
            dwcTerm="eventDate"
            value={specimen.collectionDate}
          />
          <MetadataRow
            label="Người thu mẫu"
            dwcTerm="recordedBy"
            value={specimen.recordedBy}
          />
          <MetadataRow
            label="Số lượng cá thể"
            dwcTerm="individualCount"
            value={specimen.individualCount != null ? `${specimen.individualCount} cá thể` : null}
            emptyText={notRecorded}
          />
          <MetadataRow
            label="Giới tính"
            dwcTerm="sex"
            value={specimen.sex ? SEX_LABELS[specimen.sex] || specimen.sex : null}
            emptyText={notRecorded}
          />
          <MetadataRow
            label="Giai đoạn phát triển"
            dwcTerm="lifeStage"
            value={specimen.lifeStageLabelVn}
            emptyText={notRecorded}
          />
          <MetadataRow
            label="Tình trạng bảo quản"
            dwcTerm="preparations"
            value={specimen.statusLabelVn}
            emptyText={notRecorded}
          />
          <MetadataRow
            label="Đơn vị lưu trữ"
            dwcTerm="institutionCode"
            value={specimen.institutionCode}
            emptyText={notRecorded}
          />
          <MetadataRow
            label="Mã bộ sưu tập"
            dwcTerm="collectionCode"
            value={specimen.catalogNumber}
          />
          <MetadataRow
            label="Số tủ / Hộp lưu mẫu"
            dwcTerm="storageNumber"
            value={specimen.storageNumber}
          />
        </div>
      </section>

      {/* 3. Vị trí Địa lý & Tọa độ PostGIS */}
      <section className="vi-dwc-group card">
        <div className="dwc-group-header">
          <h3>3. Vị trí Địa lý & Tọa độ Không gian</h3>
          <span className="dwc-group-subtitle">Geography & Locality</span>
        </div>
        <div className="dwc-table-grid">
          <MetadataRow
            label="Quốc gia"
            dwcTerm="country"
            value="Việt Nam (VN)"
          />
          <MetadataRow
            label="Tỉnh / Thành phố"
            dwcTerm="stateProvince"
            value={specimen.provinceNameVn}
            highlight
          />
          <MetadataRow
            label="Quận / Huyện"
            dwcTerm="county / district"
            value={specimen.district}
          />
          <MetadataRow
            label="Xã / Phường / Thị trấn"
            dwcTerm="municipality / commune"
            value={specimen.commune}
          />
          <MetadataRow
            label="Địa điểm cụ thể"
            dwcTerm="locality"
            value={specimen.localityDetail}
          />
          <MetadataRow
            label="Vĩ độ thập phân"
            dwcTerm="decimalLatitude"
            value={specimen.latitude != null ? `${specimen.latitude.toFixed(6)}°N` : null}
          />
          <MetadataRow
            label="Kinh độ thập phân"
            dwcTerm="decimalLongitude"
            value={specimen.longitude != null ? `${specimen.longitude.toFixed(6)}°E` : null}
          />
          <MetadataRow
            label="Độ chính xác GPS"
            dwcTerm="coordinateUncertaintyInMeters"
            value={specimen.gpsAccuracyM != null ? `± ${specimen.gpsAccuracyM} mét` : null}
            emptyText={notRecorded}
          />
          <MetadataRow
            label="Hệ quy chiếu trắc địa"
            dwcTerm="geodeticDatum"
            value="WGS84 (EPSG:4326)"
          />
        </div>
      </section>

      {/* 4. Sinh thái & Sinh cảnh */}
      <section className="vi-dwc-group card">
        <div className="dwc-group-header">
          <h3>4. Sinh thái học & Sinh cảnh sống</h3>
          <span className="dwc-group-subtitle">Ecology & Habitat</span>
        </div>
        <div className="dwc-table-grid">
          <MetadataRow
            label="Kiểu sinh cảnh thu thập"
            dwcTerm="habitat"
            value={specimen.habitatLabelVn}
            emptyText={notRecorded}
          />
          <MetadataRow
            label="Phương thức thu thập"
            dwcTerm="samplingProtocol"
            value={specimen.samplingProtocol || null}
            emptyText={notRecorded}
          />
        </div>
      </section>

      {/* 5. Ghi chú & Nguồn gốc Dữ liệu */}
      <section className="vi-dwc-group card">
        <div className="dwc-group-header">
          <h3>5. Ghi chú Thực địa & Nguồn gốc Dữ liệu</h3>
          <span className="dwc-group-subtitle">Occurrence Remarks & Provenance</span>
        </div>
        <div className="dwc-table-grid">
          {specimen.occurrenceRemarks && (
            <MetadataRow
              label="Nhận xét thực địa"
              dwcTerm="occurrenceRemarks"
              value={specimen.occurrenceRemarks}
            />
          )}
          {specimen.notes && (
            <MetadataRow
              label="Ghi chú hệ thống"
              dwcTerm="notes"
              value={specimen.notes}
            />
          )}
          <MetadataRow
            label="Mã bộ dữ liệu nguồn"
            dwcTerm="datasetKey"
            value={specimen.gbifDatasetKey}
          />
          <MetadataRow
            label="Trạng thái chia sẻ"
            dwcTerm="accessRights"
            value={specimen.isPublic ? "Dữ liệu Mở Công khai (Public Open Data)" : "Nội bộ Nghiên cứu (Restricted / Private)"}
          />
          <MetadataRow
            label="Giấy phép phân phối"
            dwcTerm="license"
            value="CC BY 4.0 (Creative Commons Attribution 4.0 International)"
          />
          <MetadataRow
            label="Thời điểm tạo bản ghi"
            dwcTerm="dateIdentified / entryDate"
            value={specimen.createdAt ? new Date(specimen.createdAt).toLocaleString("vi-VN") : null}
          />
          <MetadataRow
            label="Cập nhật lần cuối"
            dwcTerm="modified"
            value={specimen.updatedAt ? new Date(specimen.updatedAt).toLocaleString("vi-VN") : null}
          />
        </div>
      </section>
    </div>
  );
}
