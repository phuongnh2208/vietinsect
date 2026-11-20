"use strict";

const express = require("express");
const Joi = require("joi");
const router = express.Router();
const { optionalAdmin } = require("../../middleware/auth.middleware");
const esService = require("./elasticsearch.service");

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

module.exports = router;
