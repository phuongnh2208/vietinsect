// SRS §6.2 & Chính sách Bản quyền Hình ảnh:
// - Loại bỏ hoàn toàn ảnh 'all-rights-reserved', null, và nhóm No-Derivatives ('cc-by-nd', 'cc-by-nc-nd')
//   do hệ thống cần tạo ảnh thu nhỏ thumbnail (F-SP-08).
// - Khi đóng gói Darwin Core Archive (DwC-A) mặc định CC BY 4.0 xuất sang GBIF,
//   chỉ xuất các ảnh thuộc DWCA_EXPORTABLE_LICENSES ('cc0', 'cc-by').

const ALLOWED_MEDIA_LICENSES = [
  "cc0",
  "cc-by",
  "cc-by-sa",
  "cc-by-nc",
  "cc-by-nc-sa",
];

const DWCA_EXPORTABLE_LICENSES = ["cc0", "cc-by"];

const LICENSE_LABELS = {
  cc0: "CC0 1.0 (Phạm vi công cộng)",
  "cc-by": "CC BY 4.0 (Ghi công — Xuất được GBIF)",
  "cc-by-sa": "CC BY-SA 4.0 (Chia sẻ tương tự)",
  "cc-by-nc": "CC BY-NC 4.0 (Phi thương mại)",
  "cc-by-nc-sa": "CC BY-NC-SA 4.0 (Phi thương mại · SA)",
};

const SHOT_TYPES = [
  "field",
  "dorsal",
  "lateral",
  "ventral",
  "head",
  "habitus",
];

module.exports = {
  ALLOWED_MEDIA_LICENSES,
  DWCA_EXPORTABLE_LICENSES,
  LICENSE_LABELS,
  SHOT_TYPES,
};
