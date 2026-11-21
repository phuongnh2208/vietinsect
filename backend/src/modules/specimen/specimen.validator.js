const Joi = require("joi");
const {
  SEX_VALUES,
  BASIS_OF_RECORD_VALUES,
  SORTABLE_FIELDS,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  DEFAULT_MAP_LIMIT,
  MAX_MAP_LIMIT,
  MIN_PARTITION_YEAR,
  MAX_PARTITION_YEAR,
} = require("./specimen.constants");

const dateIsoPattern = /^\d{4}-\d{2}-\d{2}$/;

const listSpecimensQuerySchema = Joi.object({
  q: Joi.string().trim().max(120).allow(""),
  order: Joi.string().trim().max(80).allow(""),
  taxonId: Joi.number().integer().positive(),
  provinceId: Joi.number().integer().positive(),
  habitatId: Joi.number().integer().positive(),
  lifeStageId: Joi.number().integer().positive(),
  statusId: Joi.number().integer().positive(),
  basisOfRecord: Joi.string().trim().max(50).allow(""),
  sex: Joi.string().valid(...SEX_VALUES).allow(""),
  isPublic: Joi.boolean(),
  hasCoordinates: Joi.boolean(),
  dateFrom: Joi.string().pattern(dateIsoPattern).allow(""),
  dateTo: Joi.string().pattern(dateIsoPattern).allow(""),
  lat: Joi.number().min(-90).max(90),
  lon: Joi.number().min(-180).max(180),
  radiusKm: Joi.number().min(0.1).max(1000).default(25),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  sortBy: Joi.string().valid(...SORTABLE_FIELDS).default("collectionDate"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

const mapQuerySchema = Joi.object({
  q: Joi.string().trim().max(120).allow(""),
  order: Joi.string().trim().max(80).allow(""),
  family: Joi.string().trim().max(80).allow(""),
  genus: Joi.string().trim().max(80).allow(""),
  species: Joi.string().trim().max(120).allow(""),
  taxonId: Joi.number().integer().positive(),
  provinceId: Joi.number().integer().positive(),
  district: Joi.string().trim().max(100).allow(""),
  region: Joi.string().trim().max(100).allow(""),
  habitatId: Joi.number().integer().positive(),
  basisOfRecord: Joi.string().trim().max(50).allow(""),
  institutionCode: Joi.string().trim().max(60).allow(""),
  dateFrom: Joi.string().pattern(dateIsoPattern).allow(""),
  dateTo: Joi.string().pattern(dateIsoPattern).allow(""),
  minElevation: Joi.number().min(-500).max(9000),
  maxElevation: Joi.number().min(-500).max(9000),
  minLat: Joi.number().min(-90).max(90),
  maxLat: Joi.number().min(-90).max(90),
  minLon: Joi.number().min(-180).max(180),
  maxLon: Joi.number().min(-180).max(180),
  lat: Joi.number().min(-90).max(90),
  lon: Joi.number().min(-180).max(180),
  radiusKm: Joi.number().min(0.1).max(1000),
  limit: Joi.number().integer().min(50).max(MAX_MAP_LIMIT).default(DEFAULT_MAP_LIMIT),
});

const createSpecimenSchema = Joi.object({
  specimenCode: Joi.string().trim().min(2).max(50).optional().allow(null, ""),
  taxonId: Joi.number().integer().positive().required(),
  provinceId: Joi.number().integer().positive().allow(null),
  habitatId: Joi.number().integer().positive().allow(null),
  lifeStageId: Joi.number().integer().positive().allow(null),
  statusId: Joi.number().integer().positive().allow(null),
  commonNameVn: Joi.string().trim().max(255).allow(null, ""),
  commonNameEn: Joi.string().trim().max(255).allow(null, ""),
  gbifScientificName: Joi.string().trim().max(300).allow(null, ""),
  district: Joi.string().trim().max(100).allow(null, ""),
  commune: Joi.string().trim().max(100).allow(null, ""),
  localityDetail: Joi.string().trim().max(500).allow(null, ""),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  gpsAccuracyM: Joi.number().min(0).max(9999.99).allow(null),
  elevationM: Joi.number().min(-500).max(9000).allow(null),
  collectionDate: Joi.string()
    .pattern(dateIsoPattern)
    .required()
    .custom((val, helpers) => {
      const year = Number(val.slice(0, 4));
      if (year < MIN_PARTITION_YEAR || year > MAX_PARTITION_YEAR) {
        return helpers.error("any.invalid");
      }
      const todayIso = new Date().toISOString().slice(0, 10);
      if (val > todayIso) {
        return helpers.message("Ngày thu mẫu không được nằm trong tương lai");
      }
      return val;
    }),
  sex: Joi.string().valid(...SEX_VALUES).allow(null, ""),
  individualCount: Joi.number().integer().min(1).max(100000).default(1),
  storageNumber: Joi.string().trim().max(100).allow(null, ""),
  notes: Joi.string().trim().max(5000).allow(null, ""),
  isPublic: Joi.boolean().default(true),
  // Registry metadata
  basisOfRecord: Joi.string().valid(...BASIS_OF_RECORD_VALUES).allow(null, ""),
  catalogNumber: Joi.string().trim().max(100).allow(null, ""),
  institutionCode: Joi.string().trim().max(50).allow(null, ""),
  recordedBy: Joi.string().trim().max(500).allow(null, ""),
  occurrenceRemarks: Joi.string().trim().max(1000).allow(null, ""),
});

const updateSpecimenSchema = createSpecimenSchema
  .fork(["taxonId", "collectionDate", "individualCount", "isPublic"], (field) => field.optional())
  .min(1);

const togglePublicSchema = Joi.object({
  isPublic: Joi.boolean().required(),
});

const batchPublicSchema = Joi.object({
  specimenIds: Joi.array().items(Joi.number().integer().positive()).min(1).max(500).required(),
  isPublic: Joi.boolean().required(),
});

const batchUpdateSchema = Joi.object({
  specimenIds: Joi.array().items(Joi.number().integer().positive()).min(1).max(500).required(),
  updates: Joi.object({
    provinceId: Joi.number().integer().positive().allow(null, ""),
    habitatId: Joi.number().integer().positive().allow(null, ""),
    lifeStageId: Joi.number().integer().positive().allow(null, ""),
    statusId: Joi.number().integer().positive().allow(null, ""),
    sex: Joi.string().valid(...SEX_VALUES).allow(null, ""),
    isPublic: Joi.boolean(),
    district: Joi.string().trim().max(100).allow(null, ""),
    localityDetail: Joi.string().trim().max(500).allow(null, ""),
    recordedBy: Joi.string().trim().max(500).allow(null, ""),
    institutionCode: Joi.string().trim().max(50).allow(null, ""),
    basisOfRecord: Joi.string().valid(...BASIS_OF_RECORD_VALUES).allow(null, ""),
  })
    .min(1)
    .required(),
});

const bulkImportRowSchema = Joi.object({
  specimenCode: Joi.string().trim().max(50).allow(null, ""),
  taxonId: Joi.number().integer().positive().allow(null, ""),
  scientificName: Joi.string().trim().max(300).allow(null, ""),
  gbifScientificName: Joi.string().trim().max(300).allow(null, ""),
  orderName: Joi.string().trim().max(100).allow(null, ""),
  commonNameVn: Joi.string().trim().max(255).allow(null, ""),
  provinceId: Joi.number().integer().positive().allow(null, ""),
  provinceName: Joi.string().trim().max(120).allow(null, ""),
  district: Joi.string().trim().max(100).allow(null, ""),
  commune: Joi.string().trim().max(100).allow(null, ""),
  localityDetail: Joi.string().trim().max(500).allow(null, ""),
  latitude: Joi.alternatives().try(Joi.number().min(-90).max(90), Joi.string().allow("")).allow(null),
  longitude: Joi.alternatives().try(Joi.number().min(-180).max(180), Joi.string().allow("")).allow(null),
  collectionDate: Joi.string().trim().max(20).allow(null, ""),
  sex: Joi.string().valid(...SEX_VALUES).allow(null, ""),
  individualCount: Joi.alternatives().try(Joi.number().integer().min(1).max(100000), Joi.string().allow("")).allow(null),
  basisOfRecord: Joi.string().valid(...BASIS_OF_RECORD_VALUES).allow(null, ""),
  catalogNumber: Joi.string().trim().max(100).allow(null, ""),
  institutionCode: Joi.string().trim().max(50).allow(null, ""),
  recordedBy: Joi.string().trim().max(500).allow(null, ""),
  occurrenceRemarks: Joi.string().trim().max(1000).allow(null, ""),
  notes: Joi.string().trim().max(5000).allow(null, ""),
  isPublic: Joi.boolean(),
}).unknown(true);

const bulkImportSchema = Joi.object({
  rows: Joi.array().items(bulkImportRowSchema).min(1).max(5000).required().messages({
    "array.max": "Tệp nhập liệu vượt quá giới hạn tối đa 5.000 dòng",
  }),
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

// Express 5: req.query là getter-only, nên gán vào req.validatedQuery
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
  validateListSpecimens: makeQueryValidator(listSpecimensQuerySchema),
  validateMapQuery: makeQueryValidator(mapQuerySchema),
  validateCreateSpecimen: makeBodyValidator(createSpecimenSchema),
  validateUpdateSpecimen: makeBodyValidator(updateSpecimenSchema),
  validateTogglePublic: makeBodyValidator(togglePublicSchema),
  validateBatchPublic: makeBodyValidator(batchPublicSchema),
  validateBatchUpdate: makeBodyValidator(batchUpdateSchema),
  validateBulkImport: makeBodyValidator(bulkImportSchema),
};
