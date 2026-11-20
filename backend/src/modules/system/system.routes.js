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
    const ip = req.ip || req.socket?.remoteAddress;
    const updated = await systemService.updateConfig(key, value, req.admin.adminId, ip);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// DEF-014: Admin mở khóa tài khoản bị khóa do đăng nhập sai 5 lần (SRS §5.2)
router.post("/admins/:id/unlock", requireAdmin, async (req, res, next) => {
  try {
    const authRepository = require("../auth/auth.repository");
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Mã tài khoản quản trị không hợp lệ",
      });
    }
    const target = await authRepository.findById(targetId);
    if (!target) {
      return res.status(404).json({
        success: false,
        code: "ADMIN.NOT_FOUND",
        message: "Không tìm thấy tài khoản quản trị",
      });
    }
    await authRepository.resetFailedAttempts(targetId);
    await systemService.logAudit({
      adminId: req.admin.adminId,
      actionType: "UNLOCK_ADMIN",
      targetTable: "admin_users",
      targetId,
      ipAddress: req.ip || req.socket?.remoteAddress,
      details: { unlockedUsername: target.username },
    });
    res.json({
      success: true,
      data: { adminId: targetId, username: target.username, unlocked: true },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
