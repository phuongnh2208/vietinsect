const express = require("express");
const router = express.Router();
const specimenController = require("./specimen.controller");
const { requireAdmin, optionalAdmin } = require("../../middleware/auth.middleware");
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

// Chi tiết 1 mẫu vật (SCR-08)
router.get("/:id", optionalAdmin, specimenController.getById);

// Quản trị: tạo mới, nhập hàng loạt, chỉnh sửa hàng loạt, cập nhật, đổi trạng thái công khai đơn lẻ / hàng loạt, xóa mềm
router.post("/", requireAdmin, validateCreateSpecimen, specimenController.create);
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
