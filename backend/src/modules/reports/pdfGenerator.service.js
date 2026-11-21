"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");
const logger = require("../../config/logger");
const systemRepository = require("../system/system.repository");

const MAX_CONCURRENT_RENDERS = Math.max(1, Number(process.env.PDF_MAX_CONCURRENCY) || 2);
const MAX_QUEUED_RENDERS = Math.max(1, Number(process.env.PDF_MAX_QUEUE) || 10);
const DEFAULT_TIMEOUT_MS = Math.max(5000, Number(process.env.PDF_TIMEOUT_MS) || 30000);

const DEFAULT_ORG_CONFIG = {
  nationalTitle: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
  nationalMotto: "Độc lập - Tự do - Hạnh phúc",
  parentOrg: "VIỆN HÀN LÂM KHOA HỌC VÀ CÔNG NGHỆ VIỆT NAM",
  orgName: "VIỆN CÔNG NGHỆ THÔNG TIN (VAST)",
  watermarkText: "VietInsect",
  logoDataUrl: null,
};

let browserPromise = null;
let activeRenders = 0;
let blockedRequestCount = 0;
const waitQueue = [];

// Background export job store (file tạm lưu ngoài webroot, tự xóa sau TTL)
const exportJobs = new Map();
const MAX_JOBS = 100;
const EXPORT_TMP_DIR = path.join(os.tmpdir(), "vietinsect-reports");
const DEFAULT_JOB_TTL_MS = Math.max(60000, Number(process.env.REPORT_JOB_TTL_MS) || 15 * 60 * 1000);

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatUtcPlus7(date = new Date()) {
  const utcMs = date.getTime() + 7 * 60 * 60 * 1000;
  const d = new Date(utcMs);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} (UTC+7)`;
}

/**
 * Lấy cấu hình logo & thông tin tổ chức từ bảng system_config (SCR-30, F-RP-05).
 */
async function getOrgReportConfig() {
  try {
    const row = await systemRepository.findConfigByKey("report_org_info");
    if (row && row.config_value) {
      const parsed =
        typeof row.config_value === "string" ? JSON.parse(row.config_value) : row.config_value;
      return { ...DEFAULT_ORG_CONFIG, ...parsed };
    }
  } catch (err) {
    logger.warn(`[PDF ORG CONFIG] Fallback to default: ${err?.message}`);
  }
  return { ...DEFAULT_ORG_CONFIG };
}

/**
 * Chỉ cho phép about:blank và data:image/* (QR/logo nhúng).
 * CHẶN toàn bộ http/https/file/localhost/127.0.0.1/::1/mạng nội bộ và redirect.
 */
function isAllowedInternalUrl(url) {
  if (!url) return false;
  const normalized = String(url).trim().toLowerCase();
  if (normalized === "about:blank") return true;
  if (normalized.startsWith("data:image/")) return true;
  return false;
}

function getBlockedRequestCount() {
  return blockedRequestCount;
}

function resetBlockedRequestCount() {
  blockedRequestCount = 0;
}

async function acquireSlot(maxQueue = MAX_QUEUED_RENDERS) {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders += 1;
    return;
  }
  if (waitQueue.length >= maxQueue) {
    const err = new Error("Hàng đợi sinh PDF đang quá tải, vui lòng thử lại sau");
    err.statusCode = 503;
    err.code = "PDF.QUEUE_OVERFLOW";
    throw err;
  }
  await new Promise((resolve) => waitQueue.push(resolve));
  activeRenders += 1;
}

function releaseSlot() {
  activeRenders = Math.max(0, activeRenders - 1);
  if (waitQueue.length > 0 && activeRenders < MAX_CONCURRENT_RENDERS) {
    const next = waitQueue.shift();
    next();
  }
}

function resolveExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  try {
    const defaultPath = puppeteer.executablePath();
    if (defaultPath && fs.existsSync(defaultPath)) return defaultPath;
  } catch (_) {
    // fallback to system browser
  }
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ];
  return candidates.find((p) => fs.existsSync(p)) || undefined;
}

async function getBrowser() {
  if (!browserPromise) {
    const executablePath = resolveExecutablePath();
    // Chỉ bật --no-sandbox khi chạy dưới user không phải root (Linux container non-root) hoặc Windows dev
    const isRootLinux = typeof process.getuid === "function" && process.getuid() === 0;
    const sandboxArgs = isRootLinux ? [] : ["--no-sandbox", "--disable-setuid-sandbox"];
    browserPromise = puppeteer
      .launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
        args: [
          ...sandboxArgs,
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--font-render-hinting=none",
        ],
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  const browser = await browserPromise;
  if (!browser.connected) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

async function closeBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch (_) {
      // ignore
    } finally {
      browserPromise = null;
    }
  }
}

function buildHeaderTemplate(org) {
  const logoHtml =
    org.logoDataUrl && String(org.logoDataUrl).startsWith("data:image/")
      ? `<img src="${org.logoDataUrl}" style="height:26px;margin-right:8px;vertical-align:middle;" />`
      : "";
  return `
    <div style="width:100%;font-family:'Segoe UI','DejaVu Sans',Arial,sans-serif;font-size:8.5px;color:#111;padding:0 14mm;border-bottom:1px solid #0F3820;display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="display:flex;align-items:center;">
        ${logoHtml}
        <div>
          <div style="font-weight:700;color:#0F3820;">${escapeHtml(org.parentOrg)}</div>
          <div style="font-weight:800;">${escapeHtml(org.orgName)}</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:800;">${escapeHtml(org.nationalTitle)}</div>
        <div style="font-weight:600;text-decoration:underline;">${escapeHtml(org.nationalMotto)}</div>
      </div>
    </div>
  `;
}

function buildFooterTemplate(timestampText) {
  return `
    <div style="width:100%;font-family:'Segoe UI','DejaVu Sans',Arial,sans-serif;font-size:8px;color:#475569;padding:0 14mm;border-top:0.5px solid #cbd5e1;display:flex;justify-content:space-between;align-items:center;">
      <span>Trích xuất từ VietInsect: ${escapeHtml(timestampText)}</span>
      <span>Trang <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>
  `;
}

function wrapWithWatermarkAndBaseStyles(bodyHtml, { watermarkText = "VietInsect", includeWatermark = true } = {}) {
  const wm = includeWatermark
    ? `<div class="vietinsect-watermark" aria-hidden="true">${escapeHtml(watermarkText)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'DejaVu Sans', Arial, sans-serif;
      color: #111827;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.45;
    }
    .vietinsect-watermark {
      position: fixed;
      top: 42%;
      left: 12%;
      font-size: 72px;
      font-weight: 800;
      color: rgba(15, 56, 32, 0.08);
      transform: rotate(-32deg);
      pointer-events: none;
      z-index: 0;
      letter-spacing: 6px;
      white-space: nowrap;
    }
    .pdf-content { position: relative; z-index: 1; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 700; color: #0f3820; }
    h1, h2, h3 { color: #0f3820; margin: 0 0 6px 0; }
  </style>
</head>
<body>
  ${wm}
  <div class="pdf-content">${bodyHtml}</div>
</body>
</html>`;
}

/**
 * Render HTML thành PDF bằng Puppeteer với:
 * - Hàng đợi giới hạn đồng thời (MAX_CONCURRENT_RENDERS)
 * - Timeout & dọn dẹp page trong finally (không rò rỉ tiến trình)
 * - Chặn mọi request ra internet (chỉ cho phép nội bộ/data URI)
 * - Header Quốc hiệu + Viện CNTT – VAST, Footer UTC+7 + số trang, Watermark mờ "VietInsect"
 */
async function renderHtmlToPdf(
  bodyHtml,
  {
    format = "A4",
    landscape = false,
    includeHeaderFooter = true,
    includeWatermark = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    margin,
  } = {},
) {
  const org = await getOrgReportConfig();
  const timestampText = formatUtcPlus7(new Date());
  const fullHtml = wrapWithWatermarkAndBaseStyles(bodyHtml, {
    watermarkText: org.watermarkText || "VietInsect",
    includeWatermark,
  });

  await acquireSlot();
  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    // Tắt JavaScript trong trang render (không cần JS để tạo PDF tĩnh)
    await page.setJavaScriptEnabled(false);

    // Chặn tuyệt đối Puppeteer gọi ra internet, localhost, 127.0.0.1, IPv6 nội bộ & redirect
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const reqUrl = req.url();
      const isRedirect = Array.isArray(req.redirectChain?.()) && req.redirectChain().length > 0;
      if (!isRedirect && isAllowedInternalUrl(reqUrl)) {
        req.continue();
      } else {
        blockedRequestCount += 1;
        logger.warn(`[PDF BLOCKED REQUEST] ${reqUrl}`);
        req.abort("blockedbyclient");
      }
    });

    await page.setContent(fullHtml, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    const pdfOptions = {
      format,
      landscape,
      printBackground: true,
      timeout: timeoutMs,
      margin: margin || (
        includeHeaderFooter
          ? { top: "24mm", bottom: "18mm", left: "14mm", right: "14mm" }
          : { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" }
      ),
    };

    if (includeHeaderFooter) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = buildHeaderTemplate(org);
      pdfOptions.footerTemplate = buildFooterTemplate(timestampText);
    }

    const pdfUint8 = await page.pdf(pdfOptions);
    return Buffer.from(pdfUint8);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    releaseSlot();
  }
}

function removeJobFile(job) {
  if (job && job.filePath && fs.existsSync(job.filePath)) {
    try {
      fs.unlinkSync(job.filePath);
    } catch (_) {
      // ignore
    }
  }
}

function cleanupExpiredJobs(nowMs = Date.now()) {
  let removed = 0;
  for (const [id, job] of exportJobs.entries()) {
    if (job.expiresAt && nowMs >= job.expiresAt) {
      removeJobFile(job);
      exportJobs.delete(id);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Tạo background job cho xuất báo cáo/nhãn kích thước lớn.
 * - jobId: UUID v4 ngẫu nhiên
 * - file tạm lưu tại EXPORT_TMP_DIR (ngoài webroot), tự xóa sau ttlMs
 */
function createExportJob({ ownerKey, filename, contentType, runFn, ttlMs = DEFAULT_JOB_TTL_MS }) {
  cleanupExpiredJobs();
  const jobId = crypto.randomUUID();
  const job = {
    jobId,
    ownerKey: ownerKey || "anon:unknown",
    filename,
    contentType,
    status: "pending",
    createdAt: new Date().toISOString(),
    completedAt: null,
    expiresAt: Date.now() + ttlMs,
    error: null,
    filePath: null,
  };

  if (exportJobs.size >= MAX_JOBS) {
    const oldestKey = exportJobs.keys().next().value;
    removeJobFile(exportJobs.get(oldestKey));
    exportJobs.delete(oldestKey);
  }
  exportJobs.set(jobId, job);

  setImmediate(async () => {
    job.status = "processing";
    try {
      const buf = await runFn();
      fs.mkdirSync(EXPORT_TMP_DIR, { recursive: true });
      const filePath = path.join(EXPORT_TMP_DIR, `${jobId}.bin`);
      fs.writeFileSync(filePath, buf);
      job.filePath = filePath;
      job.status = "done";
      job.completedAt = new Date().toISOString();
      job.expiresAt = Date.now() + ttlMs;
    } catch (err) {
      job.status = "failed";
      job.error = err?.message || "Export failed";
      job.completedAt = new Date().toISOString();
      logger.error(`[REPORT JOB FAILED] jobId=${jobId}: ${job.error}`);
    }
  });

  return {
    jobId: job.jobId,
    status: job.status,
    filename: job.filename,
    createdAt: job.createdAt,
  };
}

function getExportJob(jobId) {
  cleanupExpiredJobs();
  return exportJobs.get(jobId) || null;
}

function getQueueStats() {
  return {
    activeRenders,
    queuedRenders: waitQueue.length,
    maxConcurrentRenders: MAX_CONCURRENT_RENDERS,
  };
}

module.exports = {
  DEFAULT_ORG_CONFIG,
  escapeHtml,
  formatUtcPlus7,
  isAllowedInternalUrl,
  getBlockedRequestCount,
  resetBlockedRequestCount,
  getOrgReportConfig,
  renderHtmlToPdf,
  closeBrowser,
  EXPORT_TMP_DIR,
  createExportJob,
  getExportJob,
  cleanupExpiredJobs,
  MAX_QUEUED_RENDERS,
  acquireSlot,
  releaseSlot,
  getQueueStats,
};
