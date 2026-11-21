"use strict";

const QRCode = require("qrcode");
const knex = require("../../config/knex");
const { renderHtmlToPdf, escapeHtml } = require("../reports/pdfGenerator.service");

const ALLOWED_TEMPLATES = new Set(["specify7", "museum-box", "pin-mini"]);
const ALLOWED_FONTS = new Set(["DejaVu Sans", "Segoe UI", "Times New Roman", "Courier New", "Arial"]);

async function generateQrDataUrl(text) {
  const payload = String(text || "UNKNOWN");
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 110,
  });
}

/**
 * Truy vấn lô mẫu vật để in nhãn — ép s.is_public = true nếu không phải Admin.
 */
async function fetchSpecimensForLabels(specimenIds, { isAdmin = false } = {}) {
  const cleanIds = (Array.isArray(specimenIds) ? specimenIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 500);

  if (cleanIds.length === 0) return [];

  const qb = knex({ s: "specimens" })
    .join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id")
    .join({ t: "taxa" }, "s.taxon_id", "t.taxon_id")
    .leftJoin({ p: "provinces" }, "s.province_id", "p.province_id")
    .whereIn("s.specimen_id", cleanIds)
    .whereNull("s.deleted_at")
    .select(
      "s.specimen_id",
      "sr.specimen_code",
      "sr.recorded_by",
      "t.scientific_name",
      "s.common_name_vn",
      "p.province_name_vn",
      "s.locality_detail",
      "s.collection_date",
      "s.is_public",
      knex.raw("ST_Y(s.collection_point::geometry) AS latitude"),
      knex.raw("ST_X(s.collection_point::geometry) AS longitude"),
    )
    .orderBy("s.specimen_id", "asc");

  if (!isAdmin) {
    qb.where("s.is_public", true);
  }

  return qb;
}

async function buildLabelsHtml(specimens, options = {}) {
  const template = ALLOWED_TEMPLATES.has(options.template) ? options.template : "specify7";
  const fontFamily = ALLOWED_FONTS.has(options.fontFamily) ? options.fontFamily : "DejaVu Sans";
  const fontSize = Math.min(12, Math.max(7, Number(options.fontSize) || 9));
  const colsPerRow = [2, 3, 4].includes(Number(options.colsPerRow)) ? Number(options.colsPerRow) : 3;
  const includeQr = options.includeQr !== false;
  const includeGps = options.includeGps !== false;
  const institutionTitle = String(
    options.institutionTitle || "VIỆN HÀN LÂM KH&CN VIỆT NAM (VAST)",
  ).slice(0, 120);

  const qrMap = new Map();
  if (includeQr) {
    await Promise.all(
      specimens.map(async (s) => {
        const code = s.specimen_code || `SPEC-${s.specimen_id}`;
        qrMap.set(s.specimen_id, await generateQrDataUrl(code));
      }),
    );
  }

  const minHeight = template === "museum-box" ? "58mm" : template === "pin-mini" ? "26mm" : "35mm";

  const cards = specimens
    .map((s) => {
      const code = s.specimen_code || `SPEC-${s.specimen_id}`;
      const qrSrc = qrMap.get(s.specimen_id);
      const colDate = s.collection_date
        ? new Date(s.collection_date).toISOString().slice(0, 10)
        : "—";
      const gpsHtml =
        includeGps && s.latitude != null && s.longitude != null
          ? `<div><strong>GPS:</strong> ${Number(s.latitude).toFixed(4)}°N, ${Number(
              s.longitude,
            ).toFixed(4)}°E</div>`
          : "";
      return `
        <div class="label-card">
          <div class="label-top">
            <div class="label-inst">${escapeHtml(institutionTitle)}</div>
            <div class="label-sci"><em>${escapeHtml(s.scientific_name)}</em></div>
            ${s.common_name_vn ? `<div class="label-vn">${escapeHtml(s.common_name_vn)}</div>` : ""}
            <div class="label-meta">
              <div><strong>Địa điểm:</strong> ${escapeHtml(s.province_name_vn || "Việt Nam")}${
                s.locality_detail ? ` (${escapeHtml(s.locality_detail)})` : ""
              }</div>
              ${gpsHtml}
              <div><strong>Ngày thu:</strong> ${escapeHtml(colDate)} · <strong>Leg:</strong> ${escapeHtml(
                s.recorded_by || "VAST",
              )}</div>
            </div>
          </div>
          <div class="label-bottom">
            <span class="label-code">${escapeHtml(code)}</span>
            ${qrSrc ? `<img class="label-qr" src="${qrSrc}" alt="QR ${escapeHtml(code)}" />` : ""}
          </div>
        </div>
      `;
    })
    .join("\n");

  return `
    <style>
      .label-grid {
        display: grid;
        grid-template-columns: repeat(${colsPerRow}, 1fr);
        gap: 6px;
        font-family: '${fontFamily}', 'DejaVu Sans', Arial, sans-serif;
        font-size: ${fontSize}px;
      }
      .label-card {
        border: 1.5px solid #111;
        padding: 5px 6px;
        min-height: ${minHeight};
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        page-break-inside: avoid;
        break-inside: avoid;
        background: #fff;
      }
      .label-inst {
        font-size: ${Math.max(6, fontSize - 2)}px;
        font-weight: 800;
        border-bottom: 1px solid #111;
        padding-bottom: 2px;
        margin-bottom: 3px;
        letter-spacing: 0.3px;
      }
      .label-sci { font-size: ${fontSize + 2}px; font-weight: 700; color: #000; }
      .label-vn { font-size: ${Math.max(7, fontSize - 1)}px; color: #0f3820; margin-bottom: 2px; }
      .label-meta { line-height: 1.3; margin-top: 2px; }
      .label-bottom {
        border-top: 1px dashed #333;
        margin-top: 4px;
        padding-top: 3px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .label-code { font-family: 'Courier New', monospace; font-weight: 800; font-size: ${fontSize}px; }
      .label-qr { width: 34px; height: 34px; }
    </style>
    <div class="label-grid">${cards}</div>
  `;
}

async function generateLabelsPdf(specimenIds, options = {}, { isAdmin = false } = {}) {
  const specimens = await fetchSpecimensForLabels(specimenIds, { isAdmin });
  if (specimens.length === 0) {
    const err = new Error("Không tìm thấy mẫu vật hợp lệ để in nhãn");
    err.statusCode = 404;
    err.code = "LABEL.NO_SPECIMENS";
    throw err;
  }

  const html = await buildLabelsHtml(specimens, options);
  const paperSize = options.paperSize === "A5" ? "A5" : "A4";
  const buffer = await renderHtmlToPdf(html, {
    format: paperSize,
    includeHeaderFooter: Boolean(options.includeHeaderFooter),
    includeWatermark: false,
  });

  return { buffer, count: specimens.length, specimens };
}

module.exports = {
  generateQrDataUrl,
  fetchSpecimensForLabels,
  buildLabelsHtml,
  generateLabelsPdf,
};
