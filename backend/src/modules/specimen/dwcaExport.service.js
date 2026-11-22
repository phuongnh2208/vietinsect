/**
 * dwcaExport.service.js
 * Triển khai hạng mục nền tảng Xuất dữ liệu tương thích GBIF (SRS F-SP-11, F-SR-06, F-RP-06 & §6.2):
 *  - Darwin Core Archive (.zip): occurrence.txt + multimedia.txt + meta.xml + eml.xml
 *  - Excel (.xlsx): 22 trường chuẩn song ngữ Việt / Darwin Core
 *  - GeoJSON (.geojson): RFC 7946 FeatureCollection cho các mẫu có tọa độ WGS84
 */
const ExcelJS = require("exceljs");
const knex = require("../../config/knex");
const { applyFilters } = require("./specimen.repository");
const { DWCA_EXPORTABLE_LICENSES } = require("../media/media.constants");
const { buildMediaProxyUrl } = require("../media/mediaUrl.util");
const { createZipArchive } = require("../../utils/zipBuilder");

const MAX_EXPORT_ROWS = 10000;

const LICENSE_URI_MAP = {
  cc0: "https://creativecommons.org/publicdomain/zero/1.0/legalcode",
  "cc-by": "https://creativecommons.org/licenses/by/4.0/legalcode",
  "cc-by-sa": "https://creativecommons.org/licenses/by-sa/4.0/legalcode",
  "cc-by-nc": "https://creativecommons.org/licenses/by-nc/4.0/legalcode",
  "cc-by-nc-sa": "https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode",
};

function resolveOccurrenceLicenseUri(rawLicense) {
  if (!rawLicense) return "";
  const key = String(rawLicense).trim().toLowerCase().replace(/\s+/g, "-");
  return LICENSE_URI_MAP[key] || String(rawLicense).trim();
}

function isNonCommercialLicense(rawLicense) {
  if (!rawLicense) return false;
  return String(rawLicense).toLowerCase().includes("nc");
}

function formatDateIso(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

function sanitizeTsvCell(val) {
  if (val === null || val === undefined) return "";
  return String(val).replace(/[\t\r\n]+/g, " ").trim();
}

function escapeXml(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function mapBasisOfRecordDwc(raw) {
  const map = {
    PRESERVED_SPECIMEN: "PreservedSpecimen",
    HUMAN_OBSERVATION: "HumanObservation",
    MATERIAL_SAMPLE: "MaterialSample",
    LIVING_SPECIMEN: "LivingSpecimen",
    FOSSIL_SPECIMEN: "FossilSpecimen",
  };
  return map[raw] || "PreservedSpecimen";
}

async function fetchSpecimensForExport(filters = {}, { isAdmin = false } = {}) {
  const maxLimit = Math.min(MAX_EXPORT_ROWS, Math.max(1, Number(filters.maxRows) || 5000));

  // Đối với gói DwC-A xuất sang GBIF, mặc định chỉ xuất bản ghi Public trừ khi Admin chỉ định includePrivate=true
  const includePrivate = Boolean(
    isAdmin && (filters.includePrivate === true || filters.includePrivate === "true"),
  );

  const qb = knex({ s: "specimens" })
    .join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id")
    .join({ t1: "taxa" }, "s.taxon_id", "t1.taxon_id")
    .leftJoin({ t2: "taxa" }, "t1.parent_id", "t2.taxon_id")
    .leftJoin({ t3: "taxa" }, "t2.parent_id", "t3.taxon_id")
    .leftJoin({ t4: "taxa" }, "t3.parent_id", "t4.taxon_id")
    .leftJoin({ p: "provinces" }, "s.province_id", "p.province_id")
    .leftJoin({ h: "habitat_types" }, "s.habitat_id", "h.habitat_id")
    .leftJoin({ ls: "life_stages" }, "s.life_stage_id", "ls.stage_id")
    .leftJoin({ st: "specimen_status_types" }, "s.status_id", "st.status_id")
    .select(
      "s.specimen_id",
      "sr.specimen_code",
      "sr.gbif_occurrence_id",
      "sr.basis_of_record",
      "sr.catalog_number",
      "sr.institution_code",
      "sr.recorded_by",
      "sr.occurrence_remarks",
      "sr.coordinate_uncertainty_m",
      "sr.identified_by",
      "sr.date_identified",
      "sr.license",
      "sr.references_url",
      "sr.rights_holder",
      "sr.dataset_name",
      "s.gbif_scientific_name",
      "t1.scientific_name as taxon_name",
      "t1.taxon_rank",
      knex.raw(`COALESCE(
        CASE WHEN t1.taxon_rank = 'Order' THEN t1.scientific_name END,
        CASE WHEN t2.taxon_rank = 'Order' THEN t2.scientific_name END,
        CASE WHEN t3.taxon_rank = 'Order' THEN t3.scientific_name END,
        CASE WHEN t4.taxon_rank = 'Order' THEN t4.scientific_name END
      ) AS order_name`),
      knex.raw(`COALESCE(
        CASE WHEN t1.taxon_rank = 'Family' THEN t1.scientific_name END,
        CASE WHEN t2.taxon_rank = 'Family' THEN t2.scientific_name END,
        CASE WHEN t3.taxon_rank = 'Family' THEN t3.scientific_name END
      ) AS family_name`),
      knex.raw(`COALESCE(
        CASE WHEN t1.taxon_rank = 'Genus' THEN t1.scientific_name END,
        CASE WHEN t2.taxon_rank = 'Genus' THEN t2.scientific_name END
      ) AS genus_name`),
      "s.common_name_vn",
      "s.common_name_en",
      "p.province_name_vn",
      "p.province_name_en",
      "s.district",
      "s.commune",
      "s.locality_detail",
      knex.raw("ST_Y(s.collection_point::geometry) AS latitude"),
      knex.raw("ST_X(s.collection_point::geometry) AS longitude"),
      "s.gps_accuracy_m",
      "s.elevation_m",
      "s.collection_date",
      "s.sex",
      "s.individual_count",
      "h.label_vn as habitat_label_vn",
      "ls.label_vn as life_stage_label_vn",
      "st.label_vn as status_label_vn",
      "s.storage_number",
      "s.notes",
      "s.is_public",
    );

  if (filters.format === "geojson") {
    qb.whereNotNull("s.collection_point");
  }

  applyFilters(qb, filters, { includePrivate, needRegistryJoin: true });
  qb.orderBy("s.collection_date", "desc").orderBy("s.specimen_id", "desc").limit(maxLimit);

  return qb;
}

function buildMetaXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<archive xmlns="http://rs.tdwg.org/dwc/text/" metadata="eml.xml">
  <core encoding="UTF-8" fieldsTerminatedBy="\\t" linesTerminatedBy="\\n" fieldsEnclosedBy="" ignoreHeaderLines="1" rowType="http://rs.tdwg.org/dwc/terms/Occurrence">
    <files>
      <location>occurrence.txt</location>
    </files>
    <id index="0" />
    <field index="1" term="http://rs.tdwg.org/dwc/terms/occurrenceID" />
    <field index="2" term="http://rs.tdwg.org/dwc/terms/catalogNumber" />
    <field index="3" term="http://rs.tdwg.org/dwc/terms/institutionCode" />
    <field index="4" term="http://rs.tdwg.org/dwc/terms/basisOfRecord" />
    <field index="5" term="http://rs.tdwg.org/dwc/terms/scientificName" />
    <field index="6" term="http://rs.tdwg.org/dwc/terms/taxonRank" />
    <field index="7" term="http://rs.tdwg.org/dwc/terms/kingdom" />
    <field index="8" term="http://rs.tdwg.org/dwc/terms/phylum" />
    <field index="9" term="http://rs.tdwg.org/dwc/terms/class" />
    <field index="10" term="http://rs.tdwg.org/dwc/terms/order" />
    <field index="11" term="http://rs.tdwg.org/dwc/terms/family" />
    <field index="12" term="http://rs.tdwg.org/dwc/terms/genus" />
    <field index="13" term="http://rs.tdwg.org/dwc/terms/vernacularName" />
    <field index="14" term="http://rs.tdwg.org/dwc/terms/countryCode" />
    <field index="15" term="http://rs.tdwg.org/dwc/terms/stateProvince" />
    <field index="16" term="http://rs.tdwg.org/dwc/terms/county" />
    <field index="17" term="http://rs.tdwg.org/dwc/terms/municipality" />
    <field index="18" term="http://rs.tdwg.org/dwc/terms/locality" />
    <field index="19" term="http://rs.tdwg.org/dwc/terms/decimalLatitude" />
    <field index="20" term="http://rs.tdwg.org/dwc/terms/decimalLongitude" />
    <field index="21" term="http://rs.tdwg.org/dwc/terms/coordinateUncertaintyInMeters" />
    <field index="22" term="http://rs.tdwg.org/dwc/terms/eventDate" />
    <field index="23" term="http://rs.tdwg.org/dwc/terms/sex" />
    <field index="24" term="http://rs.tdwg.org/dwc/terms/individualCount" />
    <field index="25" term="http://rs.tdwg.org/dwc/terms/recordedBy" />
    <field index="26" term="http://rs.tdwg.org/dwc/terms/habitat" />
    <field index="27" term="http://rs.tdwg.org/dwc/terms/lifeStage" />
    <field index="28" term="http://rs.tdwg.org/dwc/terms/preparations" />
    <field index="29" term="http://rs.tdwg.org/dwc/terms/occurrenceRemarks" />
    <field index="30" term="http://purl.org/dc/terms/license" />
    <field index="31" term="http://rs.tdwg.org/dwc/terms/identifiedBy" />
    <field index="32" term="http://rs.tdwg.org/dwc/terms/dateIdentified" />
    <field index="33" term="http://purl.org/dc/terms/references" />
    <field index="34" term="http://purl.org/dc/terms/rightsHolder" />
    <field index="35" term="http://rs.tdwg.org/dwc/terms/datasetName" />
  </core>
  <extension encoding="UTF-8" fieldsTerminatedBy="\\t" linesTerminatedBy="\\n" fieldsEnclosedBy="" ignoreHeaderLines="1" rowType="http://rs.gbif.org/terms/1.0/Multimedia">
    <files>
      <location>multimedia.txt</location>
    </files>
    <coreid index="0" />
    <field index="1" term="http://purl.org/dc/terms/type" />
    <field index="2" term="http://purl.org/dc/terms/format" />
    <field index="3" term="http://purl.org/dc/terms/identifier" />
    <field index="4" term="http://purl.org/dc/terms/creator" />
    <field index="5" term="http://purl.org/dc/terms/license" />
  </extension>
</archive>
`;
}

function buildEmlXml(recordCount) {
  const pubDate = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<eml:eml xmlns:eml="eml://ecoinformatics.org/eml-2.1.1"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         packageId="vn.vast.ioit.vietinsect.${pubDate}"
         system="VietInsect BigData System"
         xml:lang="vi">
  <dataset>
    <title xml:lang="vi">Cơ sở dữ liệu Mẫu vật Côn trùng Tài nguyên Việt Nam (VietInsect BigData)</title>
    <creator>
      <organizationName>Viện Công nghệ Thông tin — Viện Hàn lâm Khoa học và Công nghệ Việt Nam (IOIT / VAST)</organizationName>
      <address>
        <city>Hà Nội</city>
        <country>VN</country>
      </address>
    </creator>
    <pubDate>${escapeXml(pubDate)}</pubDate>
    <language>vi</language>
    <abstract>
      <para>Gói dữ liệu Darwin Core Archive trích xuất từ hệ thống VietInsect BigData (${recordCount} bản ghi mẫu vật). Tuân thủ Nghị định 73/2017/NĐ-CP và Nghị định thư Nagoya (CBD 2010) về tiếp cận nguồn gen và chia sẻ lợi ích (ABS).</para>
    </abstract>
    <intellectualRights>
      <para>This work is licensed under a <ulink url="http://creativecommons.org/licenses/by/4.0/legalcode"><citetitle>Creative Commons Attribution (CC-BY) 4.0 License</citetitle></ulink>. Non-commercial (NC) and No-Derivatives (ND) media assets are automatically excluded from this archive.</para>
    </intellectualRights>
  </dataset>
</eml:eml>
`;
}

async function generateDwcaZip(filters = {}, { isAdmin = false } = {}) {
  const rows = await fetchSpecimensForExport(filters, { isAdmin });
  const specimenIds = rows.map((r) => r.specimen_id);

  // Truy vấn ảnh đính kèm: CHỈ lấy ảnh Public và thuộc DWCA_EXPORTABLE_LICENSES ('cc0', 'cc-by') theo SRS §6.2
  let mediaRows = [];
  if (specimenIds.length > 0) {
    mediaRows = await knex("specimen_images")
      .whereIn("specimen_id", specimenIds)
      .where("is_public", true)
      .whereIn("license_code", DWCA_EXPORTABLE_LICENSES)
      .select("image_id", "specimen_id", "object_key", "attribution", "license_code");
  }

  const occHeaders = [
    "id",
    "occurrenceID",
    "catalogNumber",
    "institutionCode",
    "basisOfRecord",
    "scientificName",
    "taxonRank",
    "kingdom",
    "phylum",
    "class",
    "order",
    "family",
    "genus",
    "vernacularName",
    "countryCode",
    "stateProvince",
    "county",
    "municipality",
    "locality",
    "decimalLatitude",
    "decimalLongitude",
    "coordinateUncertaintyInMeters",
    "eventDate",
    "sex",
    "individualCount",
    "recordedBy",
    "habitat",
    "lifeStage",
    "preparations",
    "occurrenceRemarks",
    "license",
    "identifiedBy",
    "dateIdentified",
    "references",
    "rightsHolder",
    "datasetName",
  ];

  const occLines = [occHeaders.join("\t")];
  for (const r of rows) {
    // Bản ghi NC không được gộp vào gói DwC-A gắn giấy phép CC BY
    if (isNonCommercialLicense(r.license)) continue;
    const sciName = r.gbif_scientific_name || r.taxon_name || "Insecta";
    const occId = r.gbif_occurrence_id || `urn:catalog:VAST:VIETINSECT:${r.specimen_code}`;
    occLines.push(
      [
        r.specimen_id,
        occId,
        r.catalog_number || r.specimen_code,
        r.institution_code || "VAST-IOIT",
        mapBasisOfRecordDwc(r.basis_of_record),
        sciName,
        (r.taxon_rank || "").toLowerCase(),
        "Animalia",
        "Arthropoda",
        "Insecta",
        r.order_name || "",
        r.family_name || "",
        r.genus_name || "",
        r.common_name_vn || r.common_name_en || "",
        "VN",
        r.province_name_vn || r.province_name_en || "",
        r.district || "",
        r.commune || "",
        r.locality_detail || "",
        r.latitude != null ? Number(r.latitude).toFixed(6) : "",
        r.longitude != null ? Number(r.longitude).toFixed(6) : "",
        r.coordinate_uncertainty_m != null
          ? Number(r.coordinate_uncertainty_m)
          : r.gps_accuracy_m != null
            ? Number(r.gps_accuracy_m)
            : "",
        formatDateIso(r.collection_date),
        r.sex || "",
        r.individual_count || 1,
        r.recordedBy || r.recorded_by || "",
        r.habitat_label_vn || "",
        r.life_stage_label_vn || "",
        r.status_label_vn || "",
        r.occurrence_remarks || r.notes || "",
        resolveOccurrenceLicenseUri(r.license),
        r.identified_by || "",
        formatDateIso(r.date_identified),
        r.references_url || "",
        r.rights_holder || "",
        r.dataset_name || "",
      ]
        .map(sanitizeTsvCell)
        .join("\t"),
    );
  }

  const mediaHeaders = ["coreid", "type", "format", "identifier", "creator", "license"];
  const mediaLines = [mediaHeaders.join("\t")];
  for (const m of mediaRows) {
    const licCode = (m.license_code || "cc-by").toLowerCase();
    const proxyUrl = buildMediaProxyUrl(m.image_id, { isAdmin: false, isEffectivelyPublic: true });
    mediaLines.push(
      [
        m.specimen_id,
        "StillImage",
        "image/jpeg",
        proxyUrl,
        m.attribution || "VietInsect / VAST",
        LICENSE_URI_MAP[licCode] || LICENSE_URI_MAP["cc-by"],
      ]
        .map(sanitizeTsvCell)
        .join("\t"),
    );
  }

  const buffer = createZipArchive([
    { name: "meta.xml", content: buildMetaXml() },
    { name: "eml.xml", content: buildEmlXml(rows.length) },
    { name: "occurrence.txt", content: occLines.join("\n") + "\n" },
    { name: "multimedia.txt", content: mediaLines.join("\n") + "\n" },
  ]);

  return {
    buffer,
    recordCount: rows.length,
    mediaCount: mediaRows.length,
    contentType: "application/zip",
    filename: `vietinsect-dwca-${new Date().toISOString().slice(0, 10)}.zip`,
  };
}

async function generateExcelBuffer(filters = {}, { isAdmin = false } = {}) {
  const rows = await fetchSpecimensForExport(filters, { isAdmin });
  const wb = new ExcelJS.Workbook();
  wb.creator = "VietInsect BigData System — VAST";
  wb.created = new Date();

  const ws = wb.addWorksheet("Specimens (Darwin Core)");
  ws.columns = [
    { header: "Mã mẫu vật (specimenCode)", key: "specimenCode", width: 22 },
    { header: "Tên khoa học (scientificName)", key: "scientificName", width: 28 },
    { header: "Tên thường VN", key: "commonNameVn", width: 20 },
    { header: "Tên thường EN", key: "commonNameEn", width: 20 },
    { header: "Bộ (Order)", key: "orderName", width: 16 },
    { header: "Họ (Family)", key: "familyName", width: 18 },
    { header: "Giống (Genus)", key: "genusName", width: 18 },
    { header: "Tỉnh/Thành (stateProvince)", key: "province", width: 20 },
    { header: "Huyện (county)", key: "district", width: 16 },
    { header: "Xã (municipality)", key: "commune", width: 16 },
    { header: "Địa danh cụ thể (locality)", key: "locality", width: 26 },
    { header: "Vĩ độ WGS84 (decimalLatitude)", key: "lat", width: 16 },
    { header: "Kinh độ WGS84 (decimalLongitude)", key: "lon", width: 16 },
    { header: "Sai số GPS (m)", key: "gpsAcc", width: 14 },
    { header: "Độ cao (m) [minimumElevationInMeters - tùy chọn]", key: "elevationM", width: 18 },
    { header: "Ngày thu mẫu (eventDate)", key: "collectionDate", width: 16 },
    { header: "Người thu (recordedBy)", key: "recordedBy", width: 22 },
    { header: "Sinh cảnh (habitat)", key: "habitat", width: 18 },
    { header: "Giai đoạn sống (lifeStage)", key: "lifeStage", width: 16 },
    { header: "Giới tính (sex)", key: "sex", width: 14 },
    { header: "Số lượng (individualCount)", key: "count", width: 14 },
    { header: "Trạng thái bảo quản", key: "status", width: 18 },
    { header: "Số hiệu lưu trữ / Ghi chú", key: "notes", width: 28 },
  ];

  ws.getRow(1).font = { bold: true };

  for (const r of rows) {
    ws.addRow({
      specimenCode: r.specimen_code,
      scientificName: r.gbif_scientific_name || r.taxon_name || "Insecta",
      commonNameVn: r.common_name_vn || "",
      commonNameEn: r.common_name_en || "",
      orderName: r.order_name || "",
      familyName: r.family_name || "",
      genusName: r.genus_name || "",
      province: r.province_name_vn || "",
      district: r.district || "",
      commune: r.commune || "",
      locality: r.locality_detail || "",
      lat: r.latitude != null ? Number(r.latitude) : null,
      lon: r.longitude != null ? Number(r.longitude) : null,
      gpsAcc: r.gps_accuracy_m != null ? Number(r.gps_accuracy_m) : null,
      elevationM: r.elevation_m != null ? Number(r.elevation_m) : null,
      collectionDate: formatDateIso(r.collection_date),
      recordedBy: r.recorded_by || "",
      habitat: r.habitat_label_vn || "",
      lifeStage: r.life_stage_label_vn || "",
      sex: r.sex || "",
      count: r.individual_count || 1,
      status: r.status_label_vn || "",
      notes: [r.storage_number, r.notes || r.occurrence_remarks].filter(Boolean).join(" | "),
    });
  }

  const rawBuf = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(rawBuf),
    recordCount: rows.length,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `vietinsect-specimens-${new Date().toISOString().slice(0, 10)}.xlsx`,
  };
}

async function generateGeoJsonBuffer(filters = {}, { isAdmin = false } = {}) {
  const rows = await fetchSpecimensForExport({ ...filters, format: "geojson" }, { isAdmin });
  const fc = {
    type: "FeatureCollection",
    name: "VietInsect_Specimens_WGS84",
    crs: {
      type: "name",
      properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
    },
    features: rows
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [Number(Number(r.longitude).toFixed(6)), Number(Number(r.latitude).toFixed(6))],
        },
        properties: {
          specimenId: Number(r.specimen_id),
          specimenCode: r.specimen_code,
          scientificName: r.gbif_scientific_name || r.taxon_name || "Insecta",
          order: r.order_name || null,
          family: r.family_name || null,
          genus: r.genus_name || null,
          province: r.province_name_vn || null,
          eventDate: formatDateIso(r.collection_date) || null,
          basisOfRecord: mapBasisOfRecordDwc(r.basis_of_record),
          individualCount: r.individual_count || 1,
        },
      })),
  };

  return {
    buffer: Buffer.from(JSON.stringify(fc, null, 2), "utf8"),
    recordCount: fc.features.length,
    contentType: "application/geo+json; charset=utf-8",
    filename: `vietinsect-specimens-${new Date().toISOString().slice(0, 10)}.geojson`,
  };
}

async function exportSpecimensData(filters = {}, { isAdmin = false } = {}) {
  const fmt = String(filters.format || "dwca").toLowerCase();
  if (fmt === "xlsx" || fmt === "excel") {
    return generateExcelBuffer(filters, { isAdmin });
  }
  if (fmt === "geojson") {
    return generateGeoJsonBuffer(filters, { isAdmin });
  }
  return generateDwcaZip(filters, { isAdmin });
}

module.exports = {
  exportSpecimensData,
};
