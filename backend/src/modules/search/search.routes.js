"use strict";

const express = require("express");
const Joi = require("joi");
const router = express.Router();
const { optionalAdmin, requireAdmin } = require("../../middleware/auth.middleware");
const esService = require("./elasticsearch.service");
const esOutbox = require("./esOutbox.service");
const advancedSearch = require("./advancedSearch.service");

const MAX_RESULT_WINDOW = 10000;

const searchQuerySchema = Joi.object({
  q: Joi.string().trim().max(200).allow(""),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  sortBy: Joi.string()
    .valid("relevance", "collectionDate", "createdAt", "specimenId", "scientificName")
    .default("relevance"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  isPublic: Joi.boolean(),
  includeDeleted: Joi.boolean().default(false),
  // 8 chiều facet (DEF-060)
  order: Joi.string().trim().max(128).allow(""),
  family: Joi.string().trim().max(128).allow(""),
  genus: Joi.string().trim().max(128).allow(""),
  species: Joi.string().trim().max(256).allow(""),
  province: Joi.string().trim().max(128).allow(""),
  provinceId: Joi.number().integer().positive(),
  yearFrom: Joi.number().integer().min(1800).max(2050),
  yearTo: Joi.number().integer().min(1800).max(2050),
  mediaType: Joi.alternatives().try(
    Joi.string().trim().max(100).allow(""),
    Joi.array().items(Joi.string().valid("image", "dna", "bioactivity")),
  ),
  iucnStatus: Joi.string().trim().valid("LC", "NT", "VU", "EN", "CR", "EW", "EX", "DD", "NE").allow(""),
  elevationMin: Joi.number().min(-500).max(9000),
  elevationMax: Joi.number().min(-500).max(9000),
  recordedBy: Joi.string().trim().max(256).allow(""),
  hasGps: Joi.boolean(),
}).custom((val, helpers) => {
  if (val.page * val.limit > MAX_RESULT_WINDOW) {
    return helpers.message(
      `Vượt quá giới hạn phân trang (page * limit <= ${MAX_RESULT_WINDOW})`,
    );
  }
  return val;
});

router.get("/specimens", optionalAdmin, async (req, res, next) => {
  try {
    const { error, value } = searchQuerySchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.details.map((d) => d.message).join("; "),
      });
    }

    const result = await esService.searchSpecimens(value, { isAdmin: Boolean(req.admin) });
    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
      facets: result.facets,
      synonymNotice: result.synonymNotice,
      tookMs: result.tookMs,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/outbox/status", requireAdmin, async (req, res, next) => {
  try {
    const stats = await esOutbox.getOutboxStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

router.post("/outbox/retry-dead", requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.body?.limit) || 100));
    const requeued = await esOutbox.retryDeadOutbox(limit);
    res.json({ success: true, data: { requeued } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/search/advanced — SCR-16 Visual Query Builder (AND/OR/NOT, khoảng số/ngày).
 * Mở cho cả Admin và User (theo C-04); User bị ép is_public = true ở tầng SQL.
 */
router.post("/advanced", optionalAdmin, async (req, res, next) => {
  try {
    const isAdmin = Boolean(req.admin);
    const result = await advancedSearch.executeQueryBuilder(req.body || {}, { isAdmin });
    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET/POST/DELETE /api/search/filters — Lưu/tải bộ lọc theo tài khoản Admin (saved_filters).
 */
router.get("/filters", requireAdmin, async (req, res, next) => {
  try {
    const items = await advancedSearch.listSavedFilters(req.admin.adminId);
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

router.post("/filters", requireAdmin, async (req, res, next) => {
  try {
    const created = await advancedSearch.createSavedFilter(req.admin.adminId, {
      name: req.body?.name,
      filterJson: req.body?.filterJson || req.body?.rules || {},
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

router.delete("/filters/:id", requireAdmin, async (req, res, next) => {
  try {
    await advancedSearch.deleteSavedFilter(req.admin.adminId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/search/sql — Chế độ SQL trực tiếp CHỈ dành cho Admin (SCR-16, F-SR-04).
 * User (chưa đăng nhập hoặc role !== 'admin') gọi endpoint này → 403 FORBIDDEN.
 */
router.post("/sql", optionalAdmin, async (req, res, next) => {
  try {
    if (!req.admin || req.admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "Chỉ Admin mới được phép truy cập chế độ truy vấn SQL trực tiếp",
      });
    }
    const result = await advancedSearch.executeAdminSql(req.body?.sql, {
      adminId: req.admin.adminId,
      ipAddress: req.ip || req.socket?.remoteAddress,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
