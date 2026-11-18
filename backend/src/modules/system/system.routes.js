const express = require("express");
const Joi = require("joi");
const router = express.Router();
const systemService = require("./system.service");
const { requireAdmin } = require("../../middleware/auth.middleware");

const updateConfigSchema = Joi.object({
  value: Joi.alternatives()
    .try(Joi.string().allow(""), Joi.number(), Joi.boolean(), Joi.allow(null))
    .required(),
  category: Joi.string().trim().max(50).optional(),
  description: Joi.string().trim().max(500).allow("").optional(),
  isSecret: Joi.boolean().optional(),
});

router.get("/audit-logs", requireAdmin, async (req, res, next) => {
  try {
    const result = await systemService.listAuditLogs(req.query);
    res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
});

router.get("/configs", requireAdmin, async (req, res, next) => {
  try {
    const configs = await systemService.listConfigs();
    res.json({ success: true, data: configs });
  } catch (err) {
    next(err);
  }
});

router.put("/configs/:key", requireAdmin, async (req, res, next) => {
  try {
    const { error, value } = updateConfigSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.details[0].message,
      });
    }
    const key = String(req.params.key || "").trim().slice(0, 100);
    const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress;
    const updated = await systemService.updateConfig(key, value, req.admin.adminId, ip);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
