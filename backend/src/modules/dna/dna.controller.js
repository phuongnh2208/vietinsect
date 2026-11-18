const dnaService = require("./dna.service");
const AppError = require("../../utils/appError");
const DnaError = require("./dna.errors");

function parseIdParam(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(DnaError.DNA_NOT_FOUND);
  }
  return id;
}

async function list(req, res, next) {
  try {
    const result = await dnaService.listDna(req.validatedQuery || req.query, {
      isAdmin: Boolean(req.admin),
    });
    res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    const stats = await dnaService.getStats({ isAdmin: Boolean(req.admin) });
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const item = await dnaService.getDnaById(parseIdParam(req.params.id), {
      isAdmin: Boolean(req.admin),
    });
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

async function getFasta(req, res, next) {
  try {
    const item = await dnaService.getDnaById(parseIdParam(req.params.id), {
      isAdmin: Boolean(req.admin),
    });
    if (req.query.download === "1" || req.query.format === "raw") {
      const filename = `${item.genbankAccession || item.boldProcessId || `dna-${item.id}`}.fasta`;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(item.fastaFormatted);
    }
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

async function fetchGenBank(req, res, next) {
  try {
    const result = await dnaService.lookupGenBankAccession(req.params.accession);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const created = await dnaService.createDna(req.body, req.admin.adminId);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const updated = await dnaService.updateDna(parseIdParam(req.params.id), req.body, req.admin.adminId);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function togglePublic(req, res, next) {
  try {
    const updated = await dnaService.togglePublic(
      parseIdParam(req.params.id),
      req.body.isPublic,
      req.admin.adminId,
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await dnaService.deleteDna(parseIdParam(req.params.id), req.admin.adminId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getStats,
  getById,
  getFasta,
  fetchGenBank,
  create,
  update,
  togglePublic,
  remove,
};
