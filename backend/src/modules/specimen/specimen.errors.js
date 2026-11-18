const SpecimenError = {
  SPECIMEN_NOT_FOUND: {
    code: "SPECIMEN.NOT_FOUND",
    message: "Không tìm thấy bản ghi mẫu vật",
    statusCode: 404,
  },
  DUPLICATE_SPECIMEN_CODE: {
    code: "SPECIMEN.DUPLICATE_CODE",
    message: "Mã mẫu vật (specimen_code) đã tồn tại trong hệ thống",
    statusCode: 409,
  },
  TAXON_NOT_FOUND: {
    code: "SPECIMEN.TAXON_NOT_FOUND",
    message: "Không tìm thấy taxon tương ứng",
    statusCode: 400,
  },
  PROVINCE_NOT_FOUND: {
    code: "SPECIMEN.PROVINCE_NOT_FOUND",
    message: "Tỉnh/thành phố không tồn tại trong danh mục",
    statusCode: 400,
  },
  INVALID_COLLECTION_DATE: {
    code: "SPECIMEN.INVALID_COLLECTION_DATE",
    message: "Ngày thu mẫu phải nằm trong khoảng năm phân vùng (1800–2050)",
    statusCode: 400,
  },
  COORDINATES_INCOMPLETE: {
    code: "SPECIMEN.COORDINATES_INCOMPLETE",
    message: "Vĩ độ (latitude) và kinh độ (longitude) phải được cung cấp đồng thời",
    statusCode: 400,
  },
};

module.exports = SpecimenError;
