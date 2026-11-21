"use strict";

const ExcelJS = require("exceljs");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
} = require("docx");
const knex = require("../../config/knex");
const {
  renderHtmlToPdf,
  getOrgReportConfig,
  escapeHtml,
  formatUtcPlus7,
} = require("./pdfGenerator.service");

/**
 * Lấy dữ liệu báo cáo thống kê tổng hợp (F-RP-01).
 * Ép s.is_public = true ở tầng SQL query khi !isAdmin.
 */
async function getSummaryReportData({ isAdmin = false } = {}) {
  const baseWhere = (qb) => {
    qb.whereNull("s.deleted_at");
    if (!isAdmin) qb.where("s.is_public", true);
  };

  const [totalsRow] = await knex({ s: "specimens" })
    .where(baseWhere)
    .select(
      knex.raw("COUNT(*)::int AS total_specimens"),
      knex.raw("COUNT(DISTINCT s.taxon_id)::int AS total_taxa"),
      knex.raw("COUNT(DISTINCT s.province_id)::int AS total_provinces"),
    );

  const topProvinces = await knex({ s: "specimens" })
    .join({ p: "provinces" }, "s.province_id", "p.province_id")
    .where(baseWhere)
    .groupBy("p.province_id", "p.province_name_vn")
    .select(
      "p.province_id",
      "p.province_name_vn",
      knex.raw("COUNT(s.specimen_id)::int AS specimen_count"),
      knex.raw("COUNT(DISTINCT s.taxon_id)::int AS species_count"),
    )
    .orderBy("specimen_count", "desc")
    .limit(10);

  const byOrder = await knex({ s: "specimens" })
    .join({ t1: "taxa" }, "s.taxon_id", "t1.taxon_id")
    .leftJoin({ t2: "taxa" }, "t1.parent_id", "t2.taxon_id")
    .leftJoin({ t3: "taxa" }, "t2.parent_id", "t3.taxon_id")
    .leftJoin({ t4: "taxa" }, "t3.parent_id", "t4.taxon_id")
    .where(baseWhere)
    .select(
      knex.raw(`COALESCE(
        CASE WHEN t1.taxon_rank = 'Order' THEN t1.scientific_name END,
        CASE WHEN t2.taxon_rank = 'Order' THEN t2.scientific_name END,
        CASE WHEN t3.taxon_rank = 'Order' THEN t3.scientific_name END,
        CASE WHEN t4.taxon_rank = 'Order' THEN t4.scientific_name END,
        'Chưa phân bộ'
      ) AS order_name`),
      knex.raw("COUNT(s.specimen_id)::int AS specimen_count"),
    )
    .groupByRaw("1")
    .orderBy("specimen_count", "desc")
    .limit(16);

  return {
    scope: isAdmin ? "Toàn bộ hệ thống (Admin)" : "Dữ liệu công khai (Public — bản rút gọn)",
    totals: {
      totalSpecimens: Number(totalsRow?.total_specimens || 0),
      totalTaxa: Number(totalsRow?.total_taxa || 0),
      totalProvinces: Number(totalsRow?.total_provinces || 0),
    },
    topProvinces,
    byOrder,
  };
}

function buildOrderBarChartSvg(byOrder = []) {
  if (!byOrder.length) return "<p>Chưa có dữ liệu phân bố theo Bộ.</p>";
  const maxVal = Math.max(1, ...byOrder.map((r) => Number(r.specimen_count || 0)));
  const rowH = 22;
  const height = byOrder.length * rowH + 20;
  const bars = byOrder
    .map((r, i) => {
      const y = i * rowH + 10;
      const w = Math.max(4, Math.round((Number(r.specimen_count || 0) / maxVal) * 320));
      return `
        <text x="0" y="${y + 13}" font-size="10" fill="#111">${escapeHtml(r.order_name)}</text>
        <rect x="130" y="${y + 2}" width="${w}" height="14" fill="#0F3820" rx="2" />
        <text x="${136 + w}" y="${y + 13}" font-size="10" font-weight="700" fill="#0F3820">${Number(
          r.specimen_count || 0,
        )}</text>
      `;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="${height}" style="display:block;margin:8px 0;">${bars}</svg>`;
}

async function generateSummaryPdf({ isAdmin = false } = {}) {
  const data = await getSummaryReportData({ isAdmin });

  const provRows = data.topProvinces
    .map(
      (p, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(p.province_name_vn)}</td>
        <td>${Number(p.specimen_count)}</td>
        <td>${Number(p.species_count)}</td>
      </tr>
    `,
    )
    .join("");

  const html = `
    <h1>BÁO CÁO THỐNG KÊ TỔNG HỢP MẪU VẬT CÔN TRÙNG</h1>
    <p><strong>Phạm vi dữ liệu:</strong> ${escapeHtml(data.scope)}</p>
    <table>
      <thead>
        <tr>
          <th>Tổng số mẫu vật</th>
          <th>Tổng số bậc phân loại (Taxa)</th>
          <th>Số tỉnh/thành có mẫu</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${data.totals.totalSpecimens}</strong></td>
          <td><strong>${data.totals.totalTaxa}</strong></td>
          <td><strong>${data.totals.totalProvinces}</strong></td>
        </tr>
      </tbody>
    </table>

    <h2 style="margin-top:14px;">1. Phân bố mẫu vật theo Bộ côn trùng</h2>
    ${buildOrderBarChartSvg(data.byOrder)}

    <h2 style="margin-top:14px;">2. Top 10 Tỉnh/Thành phố có nhiều mẫu vật nhất</h2>
    <table>
      <thead>
        <tr>
          <th>STT</th>
          <th>Tỉnh / Thành phố</th>
          <th>Số mẫu vật</th>
          <th>Số loài / Taxon</th>
        </tr>
      </thead>
      <tbody>
        ${provRows || '<tr><td colspan="4">Chưa có dữ liệu</td></tr>'}
      </tbody>
    </table>
  `;

  return renderHtmlToPdf(html, {
    format: "A4",
    includeHeaderFooter: true,
    includeWatermark: true,
  });
}

async function generateSummaryExcel({ isAdmin = false } = {}) {
  const data = await getSummaryReportData({ isAdmin });
  const wb = new ExcelJS.Workbook();
  wb.creator = "VietInsect - VAST";
  wb.created = new Date();

  const overview = wb.addWorksheet("Tong_Quan");
  overview.addRow(["BÁO CÁO THỐNG KÊ TỔNG HỢP MẪU VẬT CÔN TRÙNG (VIETINSECT)"]);
  overview.addRow(["Phạm vi dữ liệu", data.scope]);
  overview.addRow(["Thời gian trích xuất", formatUtcPlus7(new Date())]);
  overview.addRow([]);
  overview.addRow(["Tổng số mẫu vật", data.totals.totalSpecimens]);
  overview.addRow(["Tổng số bậc phân loại", data.totals.totalTaxa]);
  overview.addRow(["Số tỉnh/thành có mẫu", data.totals.totalProvinces]);

  const topSheet = wb.addWorksheet("Top_10_Tinh");
  topSheet.addRow(["STT", "Tỉnh / Thành phố", "Số mẫu vật", "Số loài"]);
  data.topProvinces.forEach((p, idx) => {
    topSheet.addRow([idx + 1, p.province_name_vn, Number(p.specimen_count), Number(p.species_count)]);
  });

  const orderSheet = wb.addWorksheet("Theo_Bo");
  orderSheet.addRow(["Bộ côn trùng", "Số mẫu vật"]);
  data.byOrder.forEach((o) => {
    orderSheet.addRow([o.order_name, Number(o.specimen_count)]);
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Lấy danh lục loài sắp xếp theo Bộ → Họ → Loài (F-RP-02).
 * Ép s.is_public = true ở tầng SQL query khi !isAdmin.
 */
async function getSpeciesChecklistData(filters = {}, { isAdmin = false } = {}) {
  const qb = knex({ s: "specimens" })
    .join({ t1: "taxa" }, "s.taxon_id", "t1.taxon_id")
    .leftJoin({ t2: "taxa" }, "t1.parent_id", "t2.taxon_id")
    .leftJoin({ t3: "taxa" }, "t2.parent_id", "t3.taxon_id")
    .leftJoin({ t4: "taxa" }, "t3.parent_id", "t4.taxon_id")
    .whereNull("s.deleted_at");

  if (!isAdmin) {
    qb.where("s.is_public", true);
  }
  if (filters.provinceId) {
    qb.where("s.province_id", Number(filters.provinceId));
  }
  if (filters.dateFrom) {
    qb.where("s.collection_date", ">=", filters.dateFrom);
  }
  if (filters.dateTo) {
    qb.where("s.collection_date", "<=", filters.dateTo);
  }

  const orderExpr = `COALESCE(
    CASE WHEN t1.taxon_rank = 'Order' THEN t1.scientific_name END,
    CASE WHEN t2.taxon_rank = 'Order' THEN t2.scientific_name END,
    CASE WHEN t3.taxon_rank = 'Order' THEN t3.scientific_name END,
    CASE WHEN t4.taxon_rank = 'Order' THEN t4.scientific_name END,
    'Chưa phân bộ'
  )`;
  const familyExpr = `COALESCE(
    CASE WHEN t1.taxon_rank = 'Family' THEN t1.scientific_name END,
    CASE WHEN t2.taxon_rank = 'Family' THEN t2.scientific_name END,
    CASE WHEN t3.taxon_rank = 'Family' THEN t3.scientific_name END,
    'Chưa phân họ'
  )`;

  if (filters.order && String(filters.order).trim()) {
    qb.whereRaw(`${orderExpr} ILIKE ?`, [String(filters.order).trim()]);
  }

  const rows = await qb
    .select(
      knex.raw(`${orderExpr} AS order_name`),
      knex.raw(`${familyExpr} AS family_name`),
      "t1.scientific_name",
      "t1.scientific_name_authorship as author_year",
      "t1.vernacular_name_vn",
      "t1.vernacular_name_en",
      "t1.iucn_status",
      knex.raw("COUNT(s.specimen_id)::int AS specimen_count"),
    )
    .groupBy(
      "t1.taxon_id",
      "t1.scientific_name",
      "t1.scientific_name_authorship",
      "t1.vernacular_name_vn",
      "t1.vernacular_name_en",
      "t1.iucn_status",
      knex.raw(orderExpr),
      knex.raw(familyExpr),
    )
    .orderByRaw(`${orderExpr} ASC, ${familyExpr} ASC, t1.scientific_name ASC`)
    .limit(Math.min(2000, Math.max(1, Number(filters.limit) || 500)));

  return rows;
}

async function generateChecklistPdf(filters = {}, { isAdmin = false } = {}) {
  const rows = await getSpeciesChecklistData(filters, { isAdmin });
  const scope = isAdmin ? "Toàn bộ hệ thống (Admin)" : "Dữ liệu công khai (Public — bản rút gọn)";

  const trs = rows
    .map(
      (r, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(r.order_name)}</td>
        <td>${escapeHtml(r.family_name)}</td>
        <td><em>${escapeHtml(r.scientific_name)}</em>${
          r.author_year ? ` ${escapeHtml(r.author_year)}` : ""
        }</td>
        <td>${escapeHtml(r.vernacular_name_vn || "—")}${
          r.vernacular_name_en ? ` / ${escapeHtml(r.vernacular_name_en)}` : ""
        }</td>
        <td>${Number(r.specimen_count)}</td>
        <td>${escapeHtml(r.iucn_status || "NE")}</td>
      </tr>
    `,
    )
    .join("");

  const html = `
    <h1>DANH LỤC LOÀI CÔN TRÙNG (BỘ → HỌ → LOÀI)</h1>
    <p><strong>Phạm vi:</strong> ${escapeHtml(scope)} · <strong>Tổng số loài:</strong> ${rows.length}</p>
    <table>
      <thead>
        <tr>
          <th>STT</th>
          <th>Bộ (Order)</th>
          <th>Họ (Family)</th>
          <th>Tên khoa học &amp; Tác giả</th>
          <th>Tên thường (VN / EN)</th>
          <th>Số mẫu</th>
          <th>IUCN</th>
        </tr>
      </thead>
      <tbody>
        ${trs || '<tr><td colspan="7">Không có loài phù hợp điều kiện lọc</td></tr>'}
      </tbody>
    </table>
  `;

  return renderHtmlToPdf(html, {
    format: "A4",
    includeHeaderFooter: true,
    includeWatermark: true,
  });
}

async function generateChecklistDocx(filters = {}, { isAdmin = false } = {}) {
  const [rows, org] = await Promise.all([
    getSpeciesChecklistData(filters, { isAdmin }),
    getOrgReportConfig(),
  ]);
  const scope = isAdmin ? "Toàn bộ hệ thống (Admin)" : "Dữ liệu công khai (Public — bản rút gọn)";

  const headerRow = new TableRow({
    children: ["STT", "Bộ", "Họ", "Tên khoa học", "Tên thường (VN/EN)", "Số mẫu", "IUCN"].map(
      (h) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        }),
    ),
  });

  const dataRows = rows.map(
    (r, idx) =>
      new TableRow({
        children: [
          String(idx + 1),
          String(r.order_name || "—"),
          String(r.family_name || "—"),
          `${r.scientific_name || ""}${r.author_year ? ` ${r.author_year}` : ""}`,
          `${r.vernacular_name_vn || "—"}${r.vernacular_name_en ? ` / ${r.vernacular_name_en}` : ""}`,
          String(r.specimen_count || 0),
          String(r.iucn_status || "NE"),
        ].map((val) => new TableCell({ children: [new Paragraph(val)] })),
      }),
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: org.nationalTitle, bold: true, size: 22 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `${org.parentOrg} — ${org.orgName}`, bold: true, size: 20 })],
          }),
          new Paragraph({
            text: "DANH LỤC LOÀI CÔN TRÙNG (BỘ → HỌ → LOÀI)",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Phạm vi: ${scope} | Trích xuất: ${formatUtcPlus7(new Date())} | Tổng số loài: ${rows.length}`,
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = {
  getSummaryReportData,
  generateSummaryPdf,
  generateSummaryExcel,
  getSpeciesChecklistData,
  generateChecklistPdf,
  generateChecklistDocx,
};
