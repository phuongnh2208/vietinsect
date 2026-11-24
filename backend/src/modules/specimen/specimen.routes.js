const express = require("express");
const multer = require("multer");
const router = express.Router();
const specimenController = require("./specimen.controller");
const bulkImportJob = require("./bulkImportJob.service");
const { requireAdmin, optionalAdmin } = require("../../middleware/auth.middleware");

const importFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});
const {
  validateListSpecimens,
  validateMapQuery,
  validateCreateSpecimen,
  validateUpdateSpecimen,
  validateTogglePublic,
  validateBatchPublic,
  validateBatchUpdate,
  validateBulkImport,
} = require("./specimen.validator");

// Danh mục dùng chung (tỉnh/thành, bộ côn trùng, sinh cảnh, giai đoạn sống, trạng thái mẫu)
router.get("/lookups", specimenController.getLookups);

// Thống kê tổng hợp dữ liệu mẫu vật thực tế
router.get("/stats", optionalAdmin, specimenController.getStats);

// Phân tích xu hướng, độ giàu loài theo tỉnh & danh mục loài chuẩn hóa (SCR-25, SCR-26, SCR-27)
router.get("/analytics", optionalAdmin, specimenController.getAnalytics);

// Xuất gói Darwin Core Archive (.zip chuẩn GBIF), Excel (.xlsx) và GeoJSON (F-SP-11, F-SR-06, F-RP-06)
router.get("/export", optionalAdmin, specimenController.exportSpecimens);

// Dữ liệu tọa độ, cụm mật độ tỉnh và lưới nhiệt cho Bản đồ phân bố GIS (SCR-18)
router.get("/map", optionalAdmin, validateMapQuery, specimenController.getMapOccurrences);

// Tìm kiếm & phân trang danh sách mẫu vật (SCR-05 Admin / SCR-15 Public)
router.get("/", optionalAdmin, validateListSpecimens, specimenController.list);

// Chi tiết 1 mẫu vật (SCR-08) & Lịch sử chỉnh sửa có lọc thời gian (F-SP-12)
router.get("/:id/history", requireAdmin, specimenController.getHistory);
router.get("/:id", optionalAdmin, specimenController.getById);

// Quản trị: tạo mới, nhập hàng loạt, chỉnh sửa hàng loạt, cập nhật, đổi trạng thái công khai đơn lẻ / hàng loạt, xóa mềm
router.post("/", requireAdmin, validateCreateSpecimen, specimenController.create);
router.post(
  "/bulk-import/parse-file",
  requireAdmin,
  importFileUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: "Vui lòng chọn tệp Excel (.xlsx) để tải lên",
        });
      }
      const parsed = await bulkImportJob.parseImportExcelBuffer(req.file.buffer);
      return res.json({ success: true, data: parsed });
    } catch (err) {
      next(err);
    }
  },
);
router.get("/bulk-import/template", optionalAdmin, async (_req, res, next) => {
  try {
    const buffer = await bulkImportJob.generateImportTemplateExcel();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="vietinsect-import-template-22cols-v1.0.xlsx"',
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});
router.post(
  "/bulk-import/preview",
  requireAdmin,
  express.json({ limit: "10mb" }),
  (req, res, next) => {
    try {
      const result = bulkImportJob.previewImportRows(req.body?.rows || []);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);
router.post(
  "/bulk-import/async",
  requireAdmin,
  express.json({ limit: "10mb" }),
  (req, res, next) => {
    try {
      const job = bulkImportJob.startBulkImportJob({
        rows: req.body?.rows || [],
        adminId: req.admin.adminId,
        ipAddress: req.ip || req.socket?.remoteAddress,
      });
      res.status(202).json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  },
);
router.get("/bulk-import/jobs/:jobId", requireAdmin, (req, res) => {
  const job = bulkImportJob.getImportJob(req.params.jobId);
  if (!job || job.adminId !== Number(req.admin.adminId)) {
    return res.status(404).json({ success: false, code: "JOB_NOT_FOUND", message: "Không tìm thấy tiến trình import" });
  }
  return res.json({ success: true, data: job });
});
router.post(
  "/bulk-import",
  requireAdmin,
  express.json({ limit: "10mb" }),
  validateBulkImport,
  specimenController.bulkImport,
);
router.patch("/batch-update", requireAdmin, validateBatchUpdate, specimenController.batchUpdate);
router.patch("/batch-public", requireAdmin, validateBatchPublic, specimenController.batchTogglePublic);
router.put("/:id", requireAdmin, validateUpdateSpecimen, specimenController.update);
router.patch("/:id/public", requireAdmin, validateTogglePublic, specimenController.togglePublic);
router.post("/:id/restore", requireAdmin, specimenController.restore);
router.delete("/:id", requireAdmin, specimenController.remove);

module.exports = router;
