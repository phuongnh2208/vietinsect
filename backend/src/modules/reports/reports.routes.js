"use strict";

const express = require("express");
const router = express.Router();
const { optionalAdmin } = require("../../middleware/auth.middleware");
const reportsService = require("./reports.service");
const labelService = require("../specimen/label.service");
const { createExportJob, getExportJob } = require("./pdfGenerator.service");

const LARGE_LABEL_THRESHOLD = 50;

/**
 * GET /api/reports/summary?format=pdf|xlsx&async=true|false
 * F-RP-01 & F-RP-05: Báo cáo thống kê tổng hợp (User chỉ nhận Public)
 */
router.get("/summary", optionalAdmin, async (req, res, next) => {
  try {
    const isAdmin = Boolean(req.admin);
    const format = String(req.query.format || "pdf").toLowerCase();
    const isAsync = req.query.async === "true";
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "xlsx" || format === "excel") {
      if (isAsync) {
        const job = createExportJob({
          ownerKey: isAdmin ? `admin:${req.admin.adminId}` : "public",
          filename: `vietinsect-summary-${stamp}.xlsx`,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          runFn: () => reportsService.generateSummaryExcel({ isAdmin }),
        });
        return res.status(202).json({ success: true, data: job });
      }
      const buffer = await reportsService.generateSummaryExcel({ isAdmin });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="vietinsect-summary-${stamp}.xlsx"`);
      return res.send(buffer);
    }

    if (isAsync) {
      const job = createExportJob({
        ownerKey: isAdmin ? `admin:${req.admin.adminId}` : "public",
        filename: `vietinsect-summary-${stamp}.pdf`,
        contentType: "application/pdf",
        runFn: () => reportsService.generateSummaryPdf({ isAdmin }),
      });
      return res.status(202).json({ success: true, data: job });
    }

    const buffer = await reportsService.generateSummaryPdf({ isAdmin });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="vietinsect-summary-${stamp}.pdf"`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/checklist?format=pdf|docx&provinceId=&dateFrom=&dateTo=&order=
 * F-RP-02 & F-RP-05: Danh lục loài Bộ → Họ → Loài (User chỉ nhận Public)
 */
router.get("/checklist", optionalAdmin, async (req, res, next) => {
  try {
    const isAdmin = Boolean(req.admin);
    const format = String(req.query.format || "pdf").toLowerCase();
    const isAsync = req.query.async === "true";
    const filters = {
      provinceId: req.query.provinceId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      order: req.query.order,
      limit: req.query.limit,
    };
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "docx") {
      if (isAsync) {
        const job = createExportJob({
          ownerKey: isAdmin ? `admin:${req.admin.adminId}` : "public",
          filename: `vietinsect-checklist-${stamp}.docx`,
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          runFn: () => reportsService.generateChecklistDocx(filters, { isAdmin }),
        });
        return res.status(202).json({ success: true, data: job });
      }
      const buffer = await reportsService.generateChecklistDocx(filters, { isAdmin });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="vietinsect-checklist-${stamp}.docx"`,
      );
      return res.send(buffer);
    }

    if (isAsync) {
      const job = createExportJob({
        ownerKey: isAdmin ? `admin:${req.admin.adminId}` : "public",
        filename: `vietinsect-checklist-${stamp}.pdf`,
        contentType: "application/pdf",
        runFn: () => reportsService.generateChecklistPdf(filters, { isAdmin }),
      });
      return res.status(202).json({ success: true, data: job });
    }

    const buffer = await reportsService.generateChecklistPdf(filters, { isAdmin });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="vietinsect-checklist-${stamp}.pdf"`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reports/labels/pdf
 * F-SP-09 / SCR-11: Xuất PDF nhãn mẫu vật hàng loạt chuẩn Specify 7 kèm QR code
 */
router.post("/labels/pdf", optionalAdmin, async (req, res, next) => {
  try {
    const isAdmin = Boolean(req.admin);
    const { specimenIds, async: forceAsync, ...options } = req.body || {};
    if (!Array.isArray(specimenIds) || specimenIds.length === 0) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Vui lòng chọn ít nhất 1 mẫu vật để in nhãn",
      });
    }

    const stamp = new Date().toISOString().slice(0, 10);
    if (forceAsync || specimenIds.length > LARGE_LABEL_THRESHOLD) {
      const job = createExportJob({
        ownerKey: isAdmin ? `admin:${req.admin.adminId}` : "public",
        filename: `vietinsect-labels-${stamp}.pdf`,
        contentType: "application/pdf",
        runFn: async () => {
          const { buffer } = await labelService.generateLabelsPdf(specimenIds, options, { isAdmin });
          return buffer;
        },
      });
      return res.status(202).json({ success: true, data: job });
    }

    const { buffer } = await labelService.generateLabelsPdf(specimenIds, options, { isAdmin });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="vietinsect-labels-${stamp}.pdf"`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/jobs/:jobId — kiểm tra trạng thái job xuất nền
 */
router.get("/jobs/:jobId", optionalAdmin, (req, res) => {
  const job = getExportJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, code: "JOB_NOT_FOUND", message: "Không tìm thấy tiến trình xuất" });
  }
  const callerKey = req.admin ? `admin:${req.admin.adminId}` : "public";
  if (job.ownerKey !== callerKey && !req.admin) {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Không có quyền truy cập" });
  }
  return res.json({
    success: true,
    data: {
      jobId: job.jobId,
      status: job.status,
      filename: job.filename,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      error: job.error,
    },
  });
});

/**
 * GET /api/reports/jobs/:jobId/download — tải file sau khi job nền hoàn tất
 */
router.get("/jobs/:jobId/download", optionalAdmin, (req, res) => {
  const job = getExportJob(req.params.jobId);
  if (!job || job.status !== "done" || !job.buffer) {
    return res.status(404).json({ success: false, code: "JOB_NOT_READY", message: "File chưa sẵn sàng" });
  }
  const callerKey = req.admin ? `admin:${req.admin.adminId}` : "public";
  if (job.ownerKey !== callerKey && !req.admin) {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Không có quyền truy cập" });
  }
  res.setHeader("Content-Type", job.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${job.filename}"`);
  return res.send(job.buffer);
});

module.exports = router;
