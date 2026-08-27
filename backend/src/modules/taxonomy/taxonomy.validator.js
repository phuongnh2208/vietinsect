const Joi = require("joi");
const { TAXON_RANKS, IUCN_STATUSES } = require("./taxonomy.constants");

const createTaxonSchema = Joi.object({
  parentId: Joi.number().integer().positive().allow(null),
  taxonRank: Joi.string().valid(...TAXON_RANKS).required(),
  scientificName: Joi.string().trim().min(2).max(255).required(),
  specificEpithet: Joi.string().trim().max(100).allow(null, ""),
  infraspecificEpithet: Joi.string().trim().max(100).allow(null, ""),
  scientificNameAuthorship: Joi.string().trim().max(255).allow(null, ""),
  yearDescribed: Joi.number().integer().min(1750).max(new Date().getFullYear()).allow(null),
  vernacularNameVn: Joi.string().trim().max(255).allow(null, ""),
  vernacularNameEn: Joi.string().trim().max(255).allow(null, ""),
  colId: Joi.string().trim().max(50).allow(null, ""),
  itisTsn: Joi.string().trim().max(50).allow(null, ""),
  gbifTaxonKey: Joi.string().trim().max(50).allow(null, ""),
  iucnStatus: Joi.string().valid(...IUCN_STATUSES).allow(null, ""),
  taxonNotes: Joi.string().trim().max(2000).allow(null, ""),
});

const updateTaxonSchema = createTaxonSchema.fork(["taxonRank", "scientificName"], (field) => field.optional()).min(1);

const synonymSchema = Joi.object({
  acceptedTaxonId: Joi.number().integer().positive().required(),
});

const speciesProfileSchema = Joi.object({
  morphologyDescription: Joi.string().trim().max(5000).allow(null, ""),
  ecologyDescription: Joi.string().trim().max(5000).allow(null, ""),
  distributionSummary: Joi.string().trim().max(5000).allow(null, ""),
  economicValueDescription: Joi.string().trim().max(5000).allow(null, ""),
});

const bioactivitySchema = Joi.object({
  activityType: Joi.string().trim().min(2).max(100).required(),
  activityLevel: Joi.string().trim().max(100).allow(null, ""),
  testCondition: Joi.string().trim().max(2000).allow(null, ""),
  description: Joi.string().trim().max(5000).allow(null, ""),
  referenceDoi: Joi.string().trim().max(255).allow(null, ""),
  referenceTitle: Joi.string().trim().max(500).allow(null, ""),
  imageObjectKey: Joi.string().trim().max(500).allow(null, ""),
});

function makeValidator(schema) {
  return function validate(req, res, next) {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.details.map((d) => d.message).join("; "),
      });
    }
    req.body = value;
    next();
  };
}

module.exports = {
  validateCreateTaxon: makeValidator(createTaxonSchema),
  validateUpdateTaxon: makeValidator(updateTaxonSchema),
  validateSynonym: makeValidator(synonymSchema),
  validateSpeciesProfile: makeValidator(speciesProfileSchema),
  validateBioactivity: makeValidator(bioactivitySchema),
};
