const express = require("express");
const router = express.Router();
const dnaController = require("./dna.controller");
const { requireAdmin, optionalAdmin } = require("../../middleware/auth.middleware");
const {
  validateListDna,
  validateCreateDna,
  validateUpdateDna,
  validateTogglePublic,
} = require("./dna.validator");

// Thống kê tổng quan phân hệ DNA
router.get("/stats", optionalAdmin, dnaController.getStats);

// Đồng bộ trực tiếp metadata + chuỗi FASTA từ NCBI GenBank cho form SCR-21
router.get("/fetch-genbank/:accession", requireAdmin, dnaController.fetchGenBank);

// Danh sách & bộ lọc chuỗi DNA (SCR-20)
router.get("/", optionalAdmin, validateListDna, dnaController.list);

// Chi tiết chuỗi & xuất FASTA (SCR-22)
router.get("/:id/fasta", optionalAdmin, dnaController.getFasta);
router.get("/:id", optionalAdmin, dnaController.getById);

// Quản trị CRUD (SCR-21)
router.post("/", requireAdmin, validateCreateDna, dnaController.create);
router.put("/:id", requireAdmin, validateUpdateDna, dnaController.update);
router.patch("/:id/public", requireAdmin, validateTogglePublic, dnaController.togglePublic);
router.delete("/:id", requireAdmin, dnaController.remove);

module.exports = router;
