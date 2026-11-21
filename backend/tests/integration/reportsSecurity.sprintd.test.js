"use strict";

jest.setTimeout(60000);

const fs = require("fs");
const os = require("os");
const request = require("supertest");
const pdfParse = require("pdf-parse");
const app = require("../../app");
const pdfGenerator = require("../../src/modules/reports/pdfGenerator.service");
const labelService = require("../../src/modules/specimen/label.service");
const reportsService = require("../../src/modules/reports/reports.service");
const { closeRateLimiterRedis } = require("../../src/middleware/rateLimiter");

describe("Sprint D Group 1 Security Hardening", () => {
  afterAll(async () => {
    await pdfGenerator.closeBrowser();
    await closeRateLimiterRedis();
  });

  it("1. SSRF & HTML Injection: escapes <img/iframe/script> in labels and blocks 127.0.0.1:9200 requests in Puppeteer", async () => {
    const xssPayload = `<img src="http://127.0.0.1:9200/"><iframe src="http://127.0.0.1:9200/"></iframe><script>window.__pwn=1</script>`;
    const html = await labelService.buildLabelsHtml([
      {
        specimen_id: 999999,
        specimen_code: "SEC-TEST-01",
        scientific_name: "Papilio xuthus",
        common_name_vn: xssPayload,
        province_name_vn: "Hà Nội",
        locality_detail: xssPayload,
        collection_date: "2024-01-01",
        recorded_by: "Tester",
      },
    ]);

    // Raw HTML tags must be escaped, never injected
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img src=&quot;http://127.0.0.1:9200/&quot;&gt;");

    // Even if raw unescaped HTML tried to load 127.0.0.1:9200, Puppeteer intercepts & blocks it
    pdfGenerator.resetBlockedRequestCount();
    const pdfBuf = await pdfGenerator.renderHtmlToPdf(
      `<p>Safe text</p><img src="http://127.0.0.1:9200/secret" /><iframe src="http://[::1]:9200/"></iframe><script>document.body.innerHTML='PWNED'</script>`,
      { includeHeaderFooter: false, includeWatermark: false },
    );
    expect(pdfBuf.slice(0, 4).toString()).toBe("%PDF");
    expect(pdfGenerator.getBlockedRequestCount()).toBeGreaterThanOrEqual(1);

    const parsed = await pdfParse(pdfBuf);
    expect(parsed.text).toContain("Safe text");
    expect(parsed.text).not.toContain("PWNED");
  });

  it("2. Formula injection & DOCX XML escape: neutralizes =HYPERLINK, +, -, @, tab, CR", () => {
    expect(reportsService.sanitizeSpreadsheetCell('=HYPERLINK("http://evil.com","click")')).toBe(
      '\'=HYPERLINK("http://evil.com","click")',
    );
    expect(reportsService.sanitizeSpreadsheetCell("+1+1")).toBe("'+1+1");
    expect(reportsService.sanitizeSpreadsheetCell("-2+3")).toBe("'-2+3");
    expect(reportsService.sanitizeSpreadsheetCell("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
    expect(reportsService.sanitizeSpreadsheetCell("\t=1+1")).toBe("'\t=1+1");
    expect(reportsService.sanitizeSpreadsheetCell("\r=1+1")).toBe("'\r=1+1");
    expect(reportsService.sanitizeSpreadsheetCell("Papilio demoleus")).toBe("Papilio demoleus");
    expect(reportsService.sanitizeSpreadsheetCell(42)).toBe(42);

    // DOCX text strips illegal XML control characters
    expect(reportsService.sanitizeDocxText("Safe\x00\x07<xml>&text")).toBe("Safe<xml>&text");
  });

  it("3. Background export job: UUID jobId, owner isolation (403 for others), temp dir outside webroot, auto-cleanup on TTL", async () => {
    const created = pdfGenerator.createExportJob({
      ownerKey: "admin:1",
      filename: "test.pdf",
      contentType: "application/pdf",
      runFn: async () => Buffer.from("%PDF-1.4 test"),
      ttlMs: 60000,
    });
    expect(created.jobId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    // Wait for async job to write temp file
    await new Promise((r) => setTimeout(r, 80));
    const job = pdfGenerator.getExportJob(created.jobId);
    expect(job.status).toBe("done");
    expect(job.filePath.startsWith(os.tmpdir())).toBe(true);
    expect(fs.existsSync(job.filePath)).toBe(true);

    // Non-owner anonymous request gets 403
    const forbiddenRes = await request(app).get(`/api/reports/jobs/${created.jobId}`);
    expect(forbiddenRes.status).toBe(403);

    // TTL expiry removes temp file and job entry
    const removed = pdfGenerator.cleanupExpiredJobs(Date.now() + 120000);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(job.filePath)).toBe(false);
    expect(pdfGenerator.getExportJob(created.jobId)).toBeNull();
  });

  it("4. Limits: rejects > 500 labels (400) and rejects Puppeteer queue overflow (503)", async () => {
    const tooManyIds = Array.from({ length: 501 }, (_, i) => i + 1);
    const res = await request(app)
      .post("/api/reports/labels/pdf")
      .send({ specimenIds: tooManyIds });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");

    // Simulate queue saturation -> 503 PDF.QUEUE_OVERFLOW
    await pdfGenerator.acquireSlot(0);
    await pdfGenerator.acquireSlot(0);
    try {
      await expect(pdfGenerator.acquireSlot(0)).rejects.toMatchObject({
        statusCode: 503,
        code: "PDF.QUEUE_OVERFLOW",
      });
    } finally {
      pdfGenerator.releaseSlot();
      pdfGenerator.releaseSlot();
    }
  });
});
