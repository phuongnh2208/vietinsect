const TaxonomyError = {
  TAXON_NOT_FOUND: {
    code: "TAXONOMY.TAXON_NOT_FOUND",
    message: "Không tìm thấy taxon",
    statusCode: 404,
  },
  PARENT_NOT_FOUND: {
    code: "TAXONOMY.PARENT_NOT_FOUND",
    message: "Không tìm thấy taxon cha",
    statusCode: 400,
  },
  DUPLICATE_SCIENTIFIC_NAME: {
    code: "TAXONOMY.DUPLICATE_SCIENTIFIC_NAME",
    message: "Tên khoa học đã tồn tại trong hệ thống",
    statusCode: 409,
  },
  TAXON_HAS_CHILDREN: {
    code: "TAXONOMY.TAXON_HAS_CHILDREN",
    message: "Không thể xóa taxon vì vẫn còn taxon con phụ thuộc",
    statusCode: 409,
  },
  TAXON_HAS_SPECIMENS: {
    code: "TAXONOMY.TAXON_HAS_SPECIMENS",
    message: "Không thể xóa taxon vì vẫn còn mẫu vật liên kết",
    statusCode: 409,
  },
  SYNONYM_SELF_REFERENCE: {
    code: "TAXONOMY.SYNONYM_SELF_REFERENCE",
    message: "Taxon không thể là synonym của chính nó",
    statusCode: 400,
  },
  ACCEPTED_TAXON_NOT_FOUND: {
    code: "TAXONOMY.ACCEPTED_TAXON_NOT_FOUND",
    message: "Không tìm thấy accepted taxon tương ứng",
    statusCode: 400,
  },
  ACCEPTED_TAXON_MUST_BE_ACCEPTED: {
    code: "TAXONOMY.ACCEPTED_TAXON_MUST_BE_ACCEPTED",
    message: "Accepted taxon phải đang ở trạng thái accepted, không được là synonym khác",
    statusCode: 400,
  },
  SPECIES_PROFILE_TAXON_NOT_SPECIES: {
    code: "TAXONOMY.SPECIES_PROFILE_TAXON_NOT_SPECIES",
    message: "Chỉ taxon bậc Species/Subspecies mới có hồ sơ loài",
    statusCode: 400,
  },
  IMPORT_FILE_REQUIRED: {
    code: "TAXONOMY.IMPORT_FILE_REQUIRED",
    message: "Vui lòng chọn file Excel/CSV để import",
    statusCode: 400,
  },
  IMPORT_FILE_EMPTY: {
    code: "TAXONOMY.IMPORT_FILE_EMPTY",
    message: "File import không có dữ liệu hợp lệ",
    statusCode: 400,
  },
};

module.exports = TaxonomyError;
