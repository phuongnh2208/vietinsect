"use strict";

jest.setTimeout(60000);

const request = require("supertest");
const jwt = require("jsonwebtoken");
const { PNG } = require("pngjs");
const jsQR = require("jsqr");
const pdfParseMod = require("pdf-parse");
const app = require("../../app");
const knex = require("../../src/config/knex");
const pool = require("../../src/config/db");
const { JWT_SECRET } = require("../../src/config/jwt");
const labelService = require("../../src/modules/specimen/label.service");
const pdfGenerator = require("../../src/modules/reports/pdfGenerator.service");
const { closeRateLimiterRedis } = require("../../src/middleware/rateLimiter");

async function extractPdfText(buffer) {
  if (typeof pdfParseMod === "function") {
    const res = await pdfParseMod(buffer);
    return res.text || "";
  }
  if (pdfParseMod && typeof pdfParseMod.PDFParse === "function") {
    const parser = new pdfParseMod.PDFParse({ data: buffer });
    const res = await parser.getText();
    if (typeof parser.destroy === "function") await parser.destroy();
    return res.text || "";
  }
  throw new Error("Unsupported pdf-parse export");
}

function decodeQrFromDataUrl(dataUrl) {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const png = PNG.sync.read(Buffer.from(base64, "base64"));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return decoded ? decoded.data : null;
}

describe("Sprint D Group 1 – Specimen Labels PDF (QR) & Scientific Reports PDF/DOCX/XLSX", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  let adminToken;
  let publicSpecimenId;
  let privateSpecimenId;
  let publicCode;
  let privateCode;
  let privateTaxonId;

  beforeAll(async () => {
    const admin = await knex("admin_users").select("admin_id", "username").first();
    adminToken = jwt.sign(
      { adminId: Number(admin.admin_id), username: admin.username, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    const existingTaxon = await knex("taxa").where("taxon_rank", "Species").first();

    // Create a unique private taxon so we can verify it NEVER appears in public checklist PDF/DOCX
    const [privTaxon] = await knex("taxa")
      .insert({
        scientific_name: `Privatus secretus ${suffix}`,
        slug: `privatus-secretus-${suffix.toLowerCase()}`,
        taxon_rank: "Species",
        parent_id: existingTaxon.parent_id,
        vernacular_name_vn: `Bọ bí mật ${suffix}`,
        iucn_status: "CR",
      })
      .returning("taxon_id");
    privateTaxonId = privTaxon.taxon_id;

    publicCode = `LBL-PUB-${suffix}`;
    privateCode = `LBL-PRIV-${suffix}`;

    const pubRes = await request(app)
      .post("/api/specimens")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        specimenCode: publicCode,
        basisOfRecord: "PRESERVED_SPECIMEN",
        taxonId: existingTaxon.taxon_id,
        collectionDate: "2024-06-15",
        commonNameVn: `Bướm phượng tiếng Việt có dấu ${suffix}`,
        isPublic: true,
      });
    expect(pubRes.status).toBe(201);
    publicSpecimenId = pubRes.body.data.specimenId || pubRes.body.data.id;

    const privRes = await request(app)
      .post("/api/specimens")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        specimenCode: privateCode,
        basisOfRecord: "PRESERVED_SPECIMEN",
        taxonId: privateTaxonId,
        collectionDate: "2024-06-16",
        commonNameVn: `Mẫu bí mật nội bộ ${suffix}`,
        isPublic: false,
      });
    expect(privRes.status).toBe(201);
    privateSpecimenId = privRes.body.data.specimenId || privRes.body.data.id;
  });

  afterAll(async () => {
    await pdfGenerator.closeBrowser();
    const ids = [publicSpecimenId, privateSpecimenId].filter(Boolean);
    if (ids.length) {
      await knex("es_sync_outbox").whereIn("entity_id", ids).delete();
      await knex("specimen_change_history").whereIn("specimen_id", ids).delete();
      await knex("specimens").whereIn("specimen_id", ids).delete();
      await knex("specimen_registry").whereIn("specimen_id", ids).delete();
    }
    if (privateTaxonId) {
      await knex("taxa").where("taxon_id", privateTaxonId).delete();
    }
    await closeRateLimiterRedis();
    await knex.destroy();
    await pool.end();
  });

  it("1. QR code generated for specimen decodes to exact specimen code", async () => {
    const dataUrl = await labelService.generateQrDataUrl(publicCode);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    const decoded = decodeQrFromDataUrl(dataUrl);
    expect(decoded).toBe(publicCode);
  });

  it("2. Puppeteer blocks external internet URLs (data sovereignty)", () => {
    expect(pdfGenerator.isAllowedInternalUrl("about:blank")).toBe(true);
    expect(pdfGenerator.isAllowedInternalUrl("data:image/png;base64,abc")).toBe(true);
    expect(pdfGenerator.isAllowedInternalUrl("http://127.0.0.1:5000/api/media/1/file")).toBe(true);
    expect(pdfGenerator.isAllowedInternalUrl("https://fonts.googleapis.com/css")).toBe(false);
    expect(pdfGenerator.isAllowedInternalUrl("https://evil.example.com/steal")).toBe(false);
  });

  it("3. Summary PDF contains VAST header, UTC+7 footer, VietInsect watermark, and Vietnamese diacritics", async () => {
    const res = await request(app)
      .get("/api/reports/summary?format=pdf")
      .buffer(true)
      .parse((resStream, cb) => {
        const chunks = [];
        resStream.on("data", (c) => chunks.push(c));
        resStream.on("end", () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    const pdfBuf = res.body;
    expect(pdfBuf.slice(0, 4).toString()).toBe("%PDF");

    const text = await extractPdfText(pdfBuf);
    // Header: Quốc hiệu + Viện CNTT - VAST
    expect(text).toContain("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM");
    expect(text).toContain("VIỆN CÔNG NGHỆ THÔNG TIN");
    // Footer: UTC+7 + Trang
    expect(text).toContain("UTC+7");
    expect(text).toContain("Trang");
    // Watermark: VietInsect
    expect(text).toContain("VietInsect");
    // Vietnamese diacritics
    expect(text).toContain("BÁO CÁO THỐNG KÊ TỔNG HỢP MẪU VẬT CÔN TRÙNG");
  });

  it("4. Summary Excel (.xlsx) and Checklist (.docx) return valid binary files", async () => {
    const xlsxRes = await request(app).get("/api/reports/summary?format=xlsx");
    expect(xlsxRes.status).toBe(200);
    expect(xlsxRes.headers["content-type"]).toContain("spreadsheetml.sheet");

    const docxRes = await request(app).get("/api/reports/checklist?format=docx");
    expect(docxRes.status).toBe(200);
    expect(docxRes.headers["content-type"]).toContain("wordprocessingml.document");
  });

  it("5. Privacy: User does NOT receive Private specimen in Checklist PDF or Labels PDF; Admin receives both", async () => {
    // Public User checklist PDF must NOT contain privateTaxon
    const pubChecklistRes = await request(app)
      .get("/api/reports/checklist?format=pdf")
      .buffer(true)
      .parse((s, cb) => {
        const c = [];
        s.on("data", (d) => c.push(d));
        s.on("end", () => cb(null, Buffer.concat(c)));
      });
    expect(pubChecklistRes.status).toBe(200);
    const pubChecklistText = await extractPdfText(pubChecklistRes.body);
    expect(pubChecklistText).not.toContain(`Privatus secretus ${suffix}`);

    // Admin checklist PDF DOES contain privateTaxon
    const admChecklistRes = await request(app)
      .get("/api/reports/checklist?format=pdf")
      .set("Authorization", `Bearer ${adminToken}`)
      .buffer(true)
      .parse((s, cb) => {
        const c = [];
        s.on("data", (d) => c.push(d));
        s.on("end", () => cb(null, Buffer.concat(c)));
      });
    expect(admChecklistRes.status).toBe(200);
    const admChecklistText = await extractPdfText(admChecklistRes.body);
    expect(admChecklistText).toContain(`Privatus secretus ${suffix}`);

    // Public User labels PDF requesting both public + private IDs only gets public
    const pubLabelRes = await request(app)
      .post("/api/reports/labels/pdf")
      .send({
        specimenIds: [publicSpecimenId, privateSpecimenId],
        template: "specify7",
        fontFamily: "DejaVu Sans",
        paperSize: "A4",
        colsPerRow: 3,
      })
      .buffer(true)
      .parse((s, cb) => {
        const c = [];
        s.on("data", (d) => c.push(d));
        s.on("end", () => cb(null, Buffer.concat(c)));
      });
    expect(pubLabelRes.status).toBe(200);
    const pubLabelText = await extractPdfText(pubLabelRes.body);
    expect(pubLabelText).toContain(publicCode);
    expect(pubLabelText).toContain(`Bướm phượng tiếng Việt có dấu ${suffix}`);
    expect(pubLabelText).not.toContain(privateCode);

    // Admin labels PDF gets both
    const admLabelRes = await request(app)
      .post("/api/reports/labels/pdf")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        specimenIds: [publicSpecimenId, privateSpecimenId],
        template: "specify7",
      })
      .buffer(true)
      .parse((s, cb) => {
        const c = [];
        s.on("data", (d) => c.push(d));
        s.on("end", () => cb(null, Buffer.concat(c)));
      });
    expect(admLabelRes.status).toBe(200);
    const admLabelText = await extractPdfText(admLabelRes.body);
    expect(admLabelText).toContain(publicCode);
    expect(admLabelText).toContain(privateCode);
  });

  it("6. Large export background job returns 202 and completes asynchronously", async () => {
    const startRes = await request(app).get("/api/reports/summary?format=xlsx&async=true");
    expect(startRes.status).toBe(202);
    const { jobId } = startRes.body.data;
    expect(jobId).toBeTruthy();

    let status = "pending";
    for (let i = 0; i < 20; i += 1) {
      const pollRes = await request(app).get(`/api/reports/jobs/${jobId}`);
      expect(pollRes.status).toBe(200);
      status = pollRes.body.data.status;
      if (status === "done" || status === "failed") break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(status).toBe("done");

    const dlRes = await request(app).get(`/api/reports/jobs/${jobId}/download`);
    expect(dlRes.status).toBe(200);
    expect(dlRes.headers["content-type"]).toContain("spreadsheetml.sheet");
  });
});
