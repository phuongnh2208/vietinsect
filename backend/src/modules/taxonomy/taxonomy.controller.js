const taxonomyService = require("./taxonomy.service");

async function getTree(req, res, next) {
  try {
    const full = req.query.full === "true";
    const tree = await taxonomyService.getTree({ full, isAdmin: Boolean(req.admin) });
    res.json({ success: true, data: tree });
  } catch (err) {
    next(err);
  }
}

async function getChildren(req, res, next) {
  try {
    const children = await taxonomyService.getChildren(Number(req.params.id), {
      isAdmin: Boolean(req.admin),
    });
    res.json({ success: true, data: children });
  } catch (err) {
    next(err);
  }
}

async function search(req, res, next) {
  try {
    const results = await taxonomyService.searchTaxa(req.query.q);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const taxon = await taxonomyService.getTaxonById(Number(req.params.id), {
      isAdmin: Boolean(req.admin),
    });
    res.json({ success: true, data: taxon });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const result = await taxonomyService.createTaxon(req.body, req.admin.adminId);
    res.status(201).json({ success: true, data: result.taxon, colSuggestions: result.colSuggestions });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const taxon = await taxonomyService.updateTaxon(Number(req.params.id), req.body);
    res.json({ success: true, data: taxon });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await taxonomyService.deleteTaxon(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function setSynonym(req, res, next) {
  try {
    const taxon = await taxonomyService.setSynonym(Number(req.params.id), req.body.acceptedTaxonId);
    res.json({ success: true, data: taxon });
  } catch (err) {
    next(err);
  }
}

async function clearSynonym(req, res, next) {
  try {
    const taxon = await taxonomyService.clearSynonym(Number(req.params.id));
    res.json({ success: true, data: taxon });
  } catch (err) {
    next(err);
  }
}

async function getSpeciesProfile(req, res, next) {
  try {
    const profile = await taxonomyService.getSpeciesProfile(req.params.identifier, {
      isAdmin: Boolean(req.admin),
    });
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

async function upsertSpeciesProfile(req, res, next) {
  try {
    const profile = await taxonomyService.upsertSpeciesProfile(Number(req.params.id), req.body);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

async function addBioactivity(req, res, next) {
  try {
    const record = await taxonomyService.addBioactivity(Number(req.params.id), req.body, req.admin.adminId);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

async function removeBioactivity(req, res, next) {
  try {
    await taxonomyService.removeBioactivity(Number(req.params.bioactivityId));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function importChecklist(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, code: "TAXONOMY.IMPORT_FILE_REQUIRED", message: "Vui lòng chọn file Excel/CSV để import" });
    }
    const result = await taxonomyService.importChecklist(req.file.buffer, req.admin.adminId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTree,
  getChildren,
  search,
  getById,
  create,
  update,
  remove,
  setSynonym,
  clearSynonym,
  getSpeciesProfile,
  upsertSpeciesProfile,
  addBioactivity,
  removeBioactivity,
  importChecklist,
};
