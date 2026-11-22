import React from "react";
import { useTranslation } from "react-i18next";
import { formatBasisOfRecord, SEX_LABELS } from "../specimen.constants";
import { formatDateTime } from "../../../utils/formatters";

function MetadataRow({ label, dwcTerm, value, isItalic = false, highlight = false, emptyText }) {
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
  const { t, i18n } = useTranslation();
  if (!specimen) return null;
  const notRecorded = t("specimenDetail.notRecorded");

  return (
    <div className="vi-dwc-sections-container">
      {/* 1. Định danh & Phân loại */}
      <section className="vi-dwc-group card">
        <div className="dwc-group-header">
          <h3>{t("specimenDetail.sec1Title")}</h3>
          <span className="dwc-group-subtitle">Taxonomic Identification</span>
        </div>
        <div className="dwc-table-grid">
          <MetadataRow label={t("specimenDetail.catalogCode")} dwcTerm="catalogNumber / specimenCode" value={specimen.specimenCode} highlight emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.globalId")} dwcTerm="occurrenceID" value={specimen.gbifOccurrenceId || `vietinsect:specimen:${specimen.id}`} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.recordType")} dwcTerm="basisOfRecord" value={formatBasisOfRecord(specimen.basisOfRecord)} emptyText={notRecorded} />
          <MetadataRow label={t("specimen.scientificName")} dwcTerm="scientificName" value={specimen.scientificName} isItalic highlight emptyText={notRecorded} />
          <MetadataRow label={t("specimen.vernacularName")} dwcTerm="vernacularName" value={specimen.commonNameVn} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.englishName")} dwcTerm="vernacularName:en" value={specimen.commonNameEn} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.taxonRank")} dwcTerm="taxonRank" value={specimen.taxonRank} emptyText={notRecorded} />
          <MetadataRow label={t("specimen.order")} dwcTerm="order" value={specimen.orderName} emptyText={notRecorded} />
          <MetadataRow label={t("specimen.family")} dwcTerm="family" value={specimen.familyName} emptyText={notRecorded} />
          <MetadataRow label={t("specimen.genus")} dwcTerm="genus" value={specimen.genusName} isItalic emptyText={notRecorded} />
        </div>
      </section>

      {/* 2. Thu thập & Mẫu vật bảo tàng */}
      <section className="vi-dwc-group card">
        <div className="dwc-group-header">
          <h3>{t("specimenDetail.sec2Title")}</h3>
          <span className="dwc-group-subtitle">Event & Specimen Preservation</span>
        </div>
        <div className="dwc-table-grid">
          <MetadataRow label={t("specimenDetail.collectionDate")} dwcTerm="eventDate" value={specimen.collectionDate} emptyText={notRecorded} />
          <MetadataRow label={t("specimen.recordedBy")} dwcTerm="recordedBy" value={specimen.recordedBy} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.individualCount")} dwcTerm="individualCount" value={specimen.individualCount != null ? t("specimenDetail.individualsUnit", { count: specimen.individualCount }) : null} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.sex")} dwcTerm="sex" value={specimen.sex ? SEX_LABELS[specimen.sex] || specimen.sex : null} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.lifeStage")} dwcTerm="lifeStage" value={specimen.lifeStageLabelVn} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.preservation")} dwcTerm="preparations" value={specimen.statusLabelVn} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.institution")} dwcTerm="institutionCode" value={specimen.institutionCode} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.collectionCode")} dwcTerm="collectionCode" value={specimen.catalogNumber} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.storageNumber")} dwcTerm="storageNumber" value={specimen.storageNumber} emptyText={notRecorded} />
        </div>
      </section>

      {/* 3. Vị trí Địa lý & Tọa độ PostGIS */}
      <section className="vi-dwc-group card">
        <div className="dwc-group-header">
          <h3>{t("specimenDetail.sec3Title")}</h3>
          <span className="dwc-group-subtitle">Geography & Locality</span>
        </div>
        <div className="dwc-table-grid">
          <MetadataRow label={t("specimenDetail.country")} dwcTerm="country" value="Vietnam (VN)" emptyText={notRecorded} />
          <MetadataRow label={t("specimen.province")} dwcTerm="stateProvince" value={specimen.provinceNameVn} highlight emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.district")} dwcTerm="county / district" value={specimen.district} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.commune")} dwcTerm="municipality / commune" value={specimen.commune} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.specificLocality")} dwcTerm="locality" value={specimen.localityDetail} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.decimalLat")} dwcTerm="decimalLatitude" value={specimen.latitude != null ? `${specimen.latitude.toFixed(6)}°N` : null} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.decimalLon")} dwcTerm="decimalLongitude" value={specimen.longitude != null ? `${specimen.longitude.toFixed(6)}°E` : null} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.gpsAccuracy")} dwcTerm="coordinateUncertaintyInMeters" value={(specimen.coordinateUncertaintyM ?? specimen.gpsAccuracyM) != null ? `± ${specimen.coordinateUncertaintyM ?? specimen.gpsAccuracyM} m` : null} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.geodeticDatum")} dwcTerm="geodeticDatum" value="WGS84 (EPSG:4326)" emptyText={notRecorded} />
        </div>
      </section>

      {/* 4. Sinh thái & Sinh cảnh */}
      <section className="vi-dwc-group card">
        <div className="dwc-group-header">
          <h3>{t("specimenDetail.sec4Title")}</h3>
          <span className="dwc-group-subtitle">Ecology & Habitat</span>
        </div>
        <div className="dwc-table-grid">
          <MetadataRow label={t("specimenDetail.habitatType")} dwcTerm="habitat" value={specimen.habitatLabelVn} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.samplingProtocol")} dwcTerm="samplingProtocol" value={specimen.samplingProtocol || null} emptyText={notRecorded} />
        </div>
      </section>

      {/* 5. Ghi chú & Nguồn gốc Dữ liệu */}
      <section className="vi-dwc-group card">
        <div className="dwc-group-header">
          <h3>{t("specimenDetail.sec5Title")}</h3>
          <span className="dwc-group-subtitle">Occurrence Remarks & Provenance</span>
        </div>
        <div className="dwc-table-grid">
          {specimen.occurrenceRemarks && (
            <MetadataRow label={t("specimenDetail.occurrenceRemarks")} dwcTerm="occurrenceRemarks" value={specimen.occurrenceRemarks} emptyText={notRecorded} />
          )}
          {specimen.notes && (
            <MetadataRow label={t("specimenDetail.systemNotes")} dwcTerm="notes" value={specimen.notes} emptyText={notRecorded} />
          )}
          <MetadataRow label={t("specimenDetail.identifiedBy", "Người định loại")} dwcTerm="identifiedBy" value={specimen.identifiedBy} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.dateIdentified", "Ngày định loại")} dwcTerm="dateIdentified" value={specimen.dateIdentified ? String(specimen.dateIdentified).slice(0, 10) : null} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.entryDate", "Ngày nhập")} dwcTerm="entryDate" value={specimen.createdAt ? formatDateTime(specimen.createdAt, i18n.language) : null} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.updatedAt")} dwcTerm="modified" value={specimen.updatedAt ? formatDateTime(specimen.updatedAt, i18n.language) : null} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.datasetName", "Bộ dữ liệu")} dwcTerm="datasetName" value={specimen.datasetName} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.datasetKey")} dwcTerm="datasetKey" value={specimen.gbifDatasetKey} emptyText={notRecorded} />
          <MetadataRow label={t("specimenDetail.rightsHolder", "Chủ sở hữu bản quyền")} dwcTerm="rightsHolder" value={specimen.rightsHolder} emptyText={notRecorded} />
          <MetadataRow
            label={t("specimenDetail.license")}
            dwcTerm="license"
            value={specimen.license ? <span className="badge badge-license">{specimen.license}</span> : null}
            emptyText={notRecorded}
          />
          <MetadataRow
            label={t("specimenDetail.referencesUrl", "Liên kết nguồn")}
            dwcTerm="references"
            value={
              specimen.referencesUrl ? (
                <a href={specimen.referencesUrl} target="_blank" rel="noopener noreferrer">
                  {specimen.referencesUrl}
                </a>
              ) : null
            }
            emptyText={notRecorded}
          />
          <MetadataRow label={t("specimenDetail.accessRights")} dwcTerm="accessRights" value={specimen.isPublic ? t("common.public") : t("common.private")} emptyText={notRecorded} />
          {(specimen.gbifFamily || specimen.gbifGenus || specimen.gbifSpecies) && (
            <MetadataRow
              label={t("specimenDetail.gbifTaxonomy", "Phân loại GBIF gốc")}
              dwcTerm="gbif:family / genus / species"
              value={[specimen.gbifFamily, specimen.gbifGenus, specimen.gbifSpecies].filter(Boolean).join(" › ")}
              emptyText={notRecorded}
            />
          )}
          <MetadataRow
            label={t("specimenDetail.suggestedAttribution", "Ghi nguồn")}
            dwcTerm="bibliographicCitation"
            value={
              specimen.scientificName
                ? `${specimen.scientificName}${specimen.rightsHolder || specimen.recordedBy ? ` · © ${specimen.rightsHolder || specimen.recordedBy}` : ""}${specimen.license ? ` (${specimen.license})` : ""}${specimen.datasetName ? ` · ${specimen.datasetName}` : ""}`
                : null
            }
            emptyText={notRecorded}
          />
        </div>
      </section>
    </div>
  );
}
