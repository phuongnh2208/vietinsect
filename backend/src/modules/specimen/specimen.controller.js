const specimenService = require("./specimen.service");
const { exportSpecimensData } = require("./dwcaExport.service");
const { logAudit } = require("../system/system.service");
const AppError = require("../../utils/appError");
const SpecimenError = require("./specimen.errors");

function parseIdParam(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(SpecimenError.SPECIMEN_NOT_FOUND);
  }
  return id;
}

async function list(req, res, next) {
  try {
    const result = await specimenService.listSpecimens(req.validatedQuery || req.query, {
      isAdmin: Boolean(req.admin),
    });
    res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

async function getMapOccurrences(req, res, next) {
  try {
    const result = await specimenService.getMapOccurrences(req.validatedQuery || req.query, {
      isAdmin: Boolean(req.admin),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getLookups(req, res, next) {
  try {
    const lookups = await specimenService.getLookups();
    res.json({ success: true, data: lookups });
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    const stats = await specimenService.getStats({ isAdmin: Boolean(req.admin) });
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const specimen = await specimenService.getSpecimenById(parseIdParam(req.params.id), {
      isAdmin: Boolean(req.admin),
    });
    res.json({ success: true, data: specimen });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const specimen = await specimenService.createSpecimen(req.body, req.admin.adminId);
    await logAudit({
      adminId: req.admin.adminId,
      actionType: "CREATE",
      targetTable: "specimens",
      targetId: specimen.id,
      ipAddress: req.ip || req.socket?.remoteAddress,
      details: { specimenCode: specimen.specimenCode, scientificName: specimen.scientificName },
    });
    res.status(201).json({ success: true, data: specimen });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseIdParam(req.params.id);
    const specimen = await specimenService.updateSpecimen(id, req.body, req.admin.adminId);
    await logAudit({
      adminId: req.admin.adminId,
      actionType: "UPDATE",
      targetTable: "specimens",
      targetId: id,
      ipAddress: req.ip || req.socket?.remoteAddress,
      details: { specimenCode: specimen.specimenCode },
    });
    res.json({ success: true, data: specimen });
  } catch (err) {
    next(err);
  }
}

async function togglePublic(req, res, next) {
  try {
    const id = parseIdParam(req.params.id);
    const specimen = await specimenService.togglePublic(id, req.body.isPublic, req.admin.adminId);
    await logAudit({
      adminId: req.admin.adminId,
      actionType: "TOGGLE_PUBLIC",
      targetTable: "specimens",
      targetId: id,
      ipAddress: req.ip || req.socket?.remoteAddress,
      details: { isPublic: specimen.isPublic },
    });
    res.json({ success: true, data: specimen });
  } catch (err) {
    next(err);
  }
}

async function batchTogglePublic(req, res, next) {
  try {
    const result = await specimenService.batchTogglePublic(
      req.body.specimenIds,
      req.body.isPublic,
      req.admin.adminId,
    );
    await logAudit({
      adminId: req.admin.adminId,
      actionType: "BATCH_PUBLIC",
      targetTable: "specimens",
      targetId: `${result.updatedCount} items`,
      ipAddress: req.ip || req.socket?.remoteAddress,
      details: { updatedCount: result.updatedCount, isPublic: result.isPublic },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parseIdParam(req.params.id);
    const result = await specimenService.deleteSpecimen(id, req.admin.adminId);
    await logAudit({
      adminId: req.admin.adminId,
      actionType: "DELETE",
      targetTable: "specimens",
      targetId: id,
      ipAddress: req.ip || req.socket?.remoteAddress,
      details: { softDelete: true, orphanedDnaCount: result.orphanedDnaCount },
    });
    res.json({ success: true, data: result, warning: result.warning });
  } catch (err) {
    next(err);
  }
}

async function restore(req, res, next) {
  try {
    const id = parseIdParam(req.params.id);
    const result = await specimenService.restoreSpecimen(id, req.admin.adminId);
    await logAudit({
      adminId: req.admin.adminId,
      actionType: "RESTORE",
      targetTable: "specimens",
      targetId: id,
      ipAddress: req.ip || req.socket?.remoteAddress,
      details: { unorphanedDnaCount: result.unorphanedDnaCount },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function exportSpecimens(req, res, next) {
  try {
    const isAdmin = Boolean(req.admin);
    const result = await exportSpecimensData(req.query || {}, { isAdmin });

    if (isAdmin) {
      await logAudit({
        adminId: req.admin.adminId,
        actionType: "EXPORT_DATA",
        targetTable: "specimens",
        targetId: `${result.recordCount} rows`,
        ipAddress: req.ip || req.socket?.remoteAddress,
        details: {
          format: req.query.format || "dwca",
          recordCount: result.recordCount,
          mediaCount: result.mediaCount ?? undefined,
        },
      });
    }

    res.set("Content-Type", result.contentType);
    res.set("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  } catch (err) {
    next(err);
  }
}

async function getAnalytics(req, res, next) {
  try {
    const analytics = await specimenService.getAnalytics(req.query || {}, {
      isAdmin: Boolean(req.admin),
    });
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
}

async function batchUpdate(req, res, next) {
  try {
    const { specimenIds, updates } = req.body || {};
    const result = await specimenService.batchUpdateSpecimens(
      specimenIds,
      updates,
      req.admin.adminId
    );
    await logAudit({
      adminId: req.admin.adminId,
      actionType: "BATCH_UPDATE",
      targetTable: "specimens",
      targetId: `${result.updatedCount} items`,
      ipAddress: req.ip || req.socket?.remoteAddress,
      details: { updatedCount: result.updatedCount, updates },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function bulkImport(req, res, next) {
  try {
    const { rows } = req.body || {};
    const result = await specimenService.bulkImportSpecimens(rows, req.admin.adminId);
    await logAudit({
      adminId: req.admin.adminId,
      actionType: "BULK_IMPORT",
      targetTable: "specimens",
      targetId: `${result.insertedCount} rows`,
      ipAddress: req.ip || req.socket?.remoteAddress,
      details: { insertedCount: result.insertedCount, errorCount: result.errors.length },
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const id = parseIdParam(req.params.id);
    const items = await specimenService.getSpecimenHistory(id, {
      dateFrom: req.query?.dateFrom,
      dateTo: req.query?.dateTo,
    });
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getMapOccurrences,
  getLookups,
  getStats,
  getAnalytics,
  exportSpecimens,
  getById,
  getHistory,
  create,
  update,
  togglePublic,
  batchTogglePublic,
  batchUpdate,
  bulkImport,
  remove,
  restore,
};
