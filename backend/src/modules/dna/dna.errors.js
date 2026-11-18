const DnaError = {
  DNA_NOT_FOUND: {
    code: "DNA.NOT_FOUND",
    message: "Không tìm thấy bản ghi chuỗi DNA",
    statusCode: 404,
  },
  DUPLICATE_ACCESSION: {
    code: "DNA.DUPLICATE_ACCESSION",
    message: "Mã GenBank Accession này đã tồn tại trong cơ sở dữ liệu",
    statusCode: 409,
  },
  DUPLICATE_BOLD_ID: {
    code: "DNA.DUPLICATE_BOLD_ID",
    message: "Mã BOLD Process ID này đã tồn tại trong cơ sở dữ liệu",
    statusCode: 409,
  },
  TAXON_NOT_FOUND: {
    code: "DNA.TAXON_NOT_FOUND",
    message: "Không tìm thấy taxon tương ứng để gắn chuỗi DNA",
    statusCode: 400,
  },
  SPECIMEN_NOT_FOUND: {
    code: "DNA.SPECIMEN_NOT_FOUND",
    message: "Không tìm thấy mẫu vật liên kết tương ứng",
    statusCode: 400,
  },
  INVALID_FASTA_SEQUENCE: {
    code: "DNA.INVALID_FASTA_SEQUENCE",
    message: "Chuỗi nucleotide không hợp lệ (chỉ chấp nhận ký tự chuẩn IUPAC A, T, G, C, N...)",
    statusCode: 400,
  },
  NCBI_LOOKUP_FAILED: {
    code: "DNA.NCBI_LOOKUP_FAILED",
    message: "Không tìm thấy mã Accession trên NCBI GenBank hoặc dịch vụ phản hồi chậm",
    statusCode: 404,
  },
};

module.exports = DnaError;
