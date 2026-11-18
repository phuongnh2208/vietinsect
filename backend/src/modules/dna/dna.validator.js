const Joi = require("joi");
const {
  DNA_SOURCES,
  SORTABLE_DNA_FIELDS,
  GENBANK_ACCESSION_REGEX,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} = require("./dna.constants");

const dateIsoPattern = /^\d{4}-\d{2}-\d{2}$/;

const listDnaQuerySchema = Joi.object({
  q: Joi.string().trim().max(120).allow(""),
  marker: Joi.string().trim().max(50).allow(""),
  order: Joi.string().trim().max(80).allow(""),
  taxonId: Joi.number().integer().positive(),
  specimenId: Joi.number().integer().positive(),
  sourceDb: Joi.string().valid(...DNA_SOURCES).allow(""),
  isPublic: Joi.boolean(),
  isOrphaned: Joi.boolean(),
  minLength: Joi.number().integer().min(1).max(100000),
  maxLength: Joi.number().integer().min(1).max(100000),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  sortBy: Joi.string().valid(...SORTABLE_DNA_FIELDS).default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

const createDnaSchema = Joi.object({
  taxonId: Joi.number().integer().positive().required(),
  specimenId: Joi.number().integer().positive().allow(null),
  genbankAccession: Joi.string()
    .trim()
    .max(40)
    .pattern(GENBANK_ACCESSION_REGEX)
    .allow(null, "")
    .messages({
      "string.pattern.base":
        "Mã GenBank Accession không đúng định dạng chuẩn SRS (VD: KX894504.1, PQ032517, NC_045512.2)",
    }),
  boldProcessId: Joi.string().trim().max(50).allow(null, ""),
  binUri: Joi.string().trim().max(30).allow(null, ""),
  geneMarker: Joi.string().trim().min(1).max(50).default("COI"),
  scientificNameVerbatim: Joi.string().trim().max(300).allow(null, ""),
  fastaSequence: Joi.string().trim().max(200000).allow(null, ""),
  sequenceLengthBp: Joi.number().integer().min(1).max(200000).allow(null),
  primersInfo: Joi.string().trim().max(2000).allow(null, ""),
  pcrConditions: Joi.string().trim().max(4000).allow(null, ""),
  submissionDate: Joi.string().pattern(dateIsoPattern).allow(null, ""),
  authorName: Joi.string().trim().max(255).allow(null, ""),
  sourceDb: Joi.string().valid(...DNA_SOURCES).default("INTERNAL"),
  notes: Joi.string().trim().max(5000).allow(null, ""),
  isPublic: Joi.boolean().default(true),
});

const updateDnaSchema = createDnaSchema
  .fork(["taxonId", "geneMarker", "sourceDb", "isPublic"], (field) => field.optional())
  .min(1);

const togglePublicSchema = Joi.object({
  isPublic: Joi.boolean().required(),
});

function makeBodyValidator(schema) {
  return function validateBody(req, res, next) {
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

function makeQueryValidator(schema) {
  return function validateQuery(req, res, next) {
    const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.details.map((d) => d.message).join("; "),
      });
    }
    req.validatedQuery = value;
    next();
  };
}

module.exports = {
  validateListDna: makeQueryValidator(listDnaQuerySchema),
  validateCreateDna: makeBodyValidator(createDnaSchema),
  validateUpdateDna: makeBodyValidator(updateDnaSchema),
  validateTogglePublic: makeBodyValidator(togglePublicSchema),
};
