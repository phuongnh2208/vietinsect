const express = require("express");
const multer = require("multer");
const router = express.Router();
const mediaService = require("./media.service");
const { logAudit } = require("../system/system.service");
const { requireAdmin, optionalAdmin } = require("../../middleware/auth.middleware");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB / ảnh
});

router.get("/stats", optionalAdmin, async (req, res, next) => {
  try {
    const stats = await mediaService.getStats({ isAdmin: Boolean(req.admin) });
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

router.get("/", optionalAdmin, async (req, res, next) => {
  try {
    const result = await mediaService.listMedia(req.query, { isAdmin: Boolean(req.admin) });
    res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
});

router.post("/upload", requireAdmin, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: "MEDIA.FILE_REQUIRED",
        message: "Vui lòng chọn tệp hình ảnh để tải lên MinIO",
      });
    }
    const created = await mediaService.uploadMedia({
      file: req.file,
      body: req.body,
      adminId: req.admin.adminId,
    });

    await logAudit({
      adminId: req.admin.adminId,
      actionType: "UPLOAD_MEDIA",
      targetTable: "specimen_images",
      targetId: created.id,
      ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
      details: {
        specimenId: created.specimenId,
        objectKey: created.objectKey,
        licenseCode: created.licenseCode,
      },
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/file", optionalAdmin, async (req, res, next) => {
  try {
    const result = await mediaService.getMediaFile(Number(req.params.id), {
      isAdmin: Boolean(req.admin),
      exp: req.query.exp,
      sig: req.query.sig,
    });
    if (result.redirect) {
      return res.redirect(result.redirect);
    }
    res.set("Content-Type", result.contentType);
    res.set(
      "Cache-Control",
      result.isPublic ? "public, max-age=300" : "private, no-store",
    );
    res.send(result.buffer);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const imageId = Number(req.params.id);
    await mediaService.deleteMedia(imageId);

    await logAudit({
      adminId: req.admin.adminId,
      actionType: "DELETE_MEDIA",
      targetTable: "specimen_images",
      targetId: imageId,
      ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
      details: {},
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
