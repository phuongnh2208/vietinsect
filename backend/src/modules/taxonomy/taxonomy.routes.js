const express = require("express");
const multer = require("multer");
const router = express.Router();
const taxonomyController = require("./taxonomy.controller");
const { requireAdmin } = require("../../middleware/auth.middleware");
const {
  validateCreateTaxon,
  validateUpdateTaxon,
  validateSynonym,
  validateSpeciesProfile,
  validateBioactivity,
} = require("./taxonomy.validator");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB, đủ cho danh lục vài nghìn dòng
});

// F-TX-01: đọc cây phân loại / tìm kiếm nhanh — công khai cho cả Admin và User.
router.get("/tree", taxonomyController.getTree);
router.get("/search", taxonomyController.search);
router.get("/species/:identifier", taxonomyController.getSpeciesProfile);
router.get("/:id", taxonomyController.getById);

// F-TX-02 / F-TX-03 / F-TX-04: CRUD, đồng danh pháp và import — chỉ Admin.
router.post("/", requireAdmin, validateCreateTaxon, taxonomyController.create);
router.put("/:id", requireAdmin, validateUpdateTaxon, taxonomyController.update);
router.delete("/:id", requireAdmin, taxonomyController.remove);
router.patch("/:id/synonym", requireAdmin, validateSynonym, taxonomyController.setSynonym);
router.patch("/:id/clear-synonym", requireAdmin, taxonomyController.clearSynonym);
router.post("/import", requireAdmin, upload.single("file"), taxonomyController.importChecklist);

// F-TX-05 / F-TX-07: hồ sơ loài — Admin chỉnh sửa, User chỉ đọc qua /species/:identifier ở trên.
router.put("/species/:id/profile", requireAdmin, validateSpeciesProfile, taxonomyController.upsertSpeciesProfile);
router.post("/species/:id/bioactivity", requireAdmin, validateBioactivity, taxonomyController.addBioactivity);
router.delete("/bioactivity/:bioactivityId", requireAdmin, taxonomyController.removeBioactivity);

module.exports = router;
