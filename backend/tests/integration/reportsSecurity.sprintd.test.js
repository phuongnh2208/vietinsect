"use strict";

jest.setTimeout(60000);

const pdfParse = require("pdf-parse");
const pdfGenerator = require("../../src/modules/reports/pdfGenerator.service");
const labelService = require("../../src/modules/specimen/label.service");

describe("Sprint D Group 1 Security Hardening", () => {
  afterAll(async () => {
    await pdfGenerator.closeBrowser();
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
});
