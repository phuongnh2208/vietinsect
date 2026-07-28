exports.seed = async (knex) => {
  // Xóa theo thứ tự ngược FK trước khi seed lại
  await knex("specimen_status_types").del();
  await knex("life_stages").del();
  await knex("habitat_types").del();
  await knex("provinces").del();
  await knex("admin_users").del();

  // ── 1. Admin mặc định ──────────────────────────────────────────
  // password gốc: Admin@VietInsect2026
  // hash này tương ứng bcrypt cost=12 — đổi ngay sau khi login lần đầu
  await knex("admin_users").insert({
    username: "admin",
    password_hash:
      "$2b$12$TIgVQEIP3wMgg9x4CfL1F.F4K/iNqEU/9lEtN/tsTpceXNK8/F3Ou",
    full_name: "Quản trị viên VietInsect",
    email: "admin@vietinsect.vast.vn",
  });

  // ── 2. Sinh cảnh ───────────────────────────────────────────────
  await knex("habitat_types").insert([
    {
      code: "tropical_forest",
      label_vn: "Rừng nhiệt đới",
      label_en: "Tropical Forest",
      sort_order: 1,
    },
    {
      code: "subtropical_forest",
      label_vn: "Rừng cận nhiệt đới",
      label_en: "Subtropical Forest",
      sort_order: 2,
    },
    {
      code: "mangrove",
      label_vn: "Rừng ngập mặn",
      label_en: "Mangrove Forest",
      sort_order: 3,
    },
    {
      code: "wetland",
      label_vn: "Đất ngập nước",
      label_en: "Wetland",
      sort_order: 4,
    },
    {
      code: "grassland",
      label_vn: "Đồng cỏ / Trảng cỏ",
      label_en: "Grassland / Savanna",
      sort_order: 5,
    },
    {
      code: "mountain",
      label_vn: "Vùng núi cao",
      label_en: "Mountain / Highland",
      sort_order: 6,
    },
    {
      code: "agricultural",
      label_vn: "Đất nông nghiệp",
      label_en: "Agricultural Land",
      sort_order: 7,
    },
    {
      code: "urban",
      label_vn: "Đô thị",
      label_en: "Urban Area",
      sort_order: 8,
    },
    {
      code: "cave",
      label_vn: "Hang động / Karst",
      label_en: "Cave / Karst",
      sort_order: 9,
    },
    {
      code: "coastal",
      label_vn: "Ven biển / Hải đảo",
      label_en: "Coastal / Island",
      sort_order: 10,
    },
    {
      code: "freshwater",
      label_vn: "Suối / Sông / Hồ",
      label_en: "Freshwater (Stream/River/Lake)",
      sort_order: 11,
    },
    { code: "other", label_vn: "Khác", label_en: "Other", sort_order: 99 },
  ]);

  // ── 3. Giai đoạn phát triển ───────────────────────────────────
  await knex("life_stages").insert([
    { code: "egg", label_vn: "Trứng", label_en: "Egg", sort_order: 1 },
    { code: "larva", label_vn: "Ấu trùng", label_en: "Larva", sort_order: 2 },
    {
      code: "nymph",
      label_vn: "Thiếu trùng",
      label_en: "Nymph",
      sort_order: 3,
    },
    { code: "pupa", label_vn: "Nhộng", label_en: "Pupa", sort_order: 4 },
    {
      code: "adult",
      label_vn: "Trưởng thành",
      label_en: "Adult",
      sort_order: 5,
    },
    {
      code: "unknown",
      label_vn: "Không xác định",
      label_en: "Unknown",
      sort_order: 99,
    },
  ]);

  // ── 4. Trạng thái mẫu vật ────────────────────────────────────
  await knex("specimen_status_types").insert([
    {
      code: "dry",
      label_vn: "Mẫu khô",
      label_en: "Dry Specimen",
      sort_order: 1,
    },
    {
      code: "pinned",
      label_vn: "Mẫu ghim",
      label_en: "Pinned Specimen",
      sort_order: 2,
    },
    {
      code: "wet_ethanol",
      label_vn: "Ngâm cồn",
      label_en: "Ethanol Preserved",
      sort_order: 3,
    },
    {
      code: "wet_formalin",
      label_vn: "Ngâm formol",
      label_en: "Formalin Preserved",
      sort_order: 4,
    },
    {
      code: "slide",
      label_vn: "Tiêu bản",
      label_en: "Microscope Slide",
      sort_order: 5,
    },
    {
      code: "frozen",
      label_vn: "Mẫu đông lạnh",
      label_en: "Frozen Specimen",
      sort_order: 6,
    },
    {
      code: "dna_extract",
      label_vn: "Mẫu trích xuất Mô/DNA",
      label_en: "Tissue/DNA Extract",
      sort_order: 7,
    },
    {
      code: "photo_only",
      label_vn: "Chỉ có ảnh",
      label_en: "Photo Only",
      sort_order: 8,
    },
  ]);

  // ── 5. 34 tỉnh/thành phố (NQ 202/2025/QH15, hiệu lực 1/7/2025) ──
  await knex("provinces").insert([
    // 6 Thành phố trực thuộc Trung ương
    {
      province_code: "HN",
      province_name_vn: "Hà Nội",
      province_name_en: "Ha Noi",
      province_type: "city",
      region: "Bắc",
      note: "Giữ nguyên",
    },
    {
      province_code: "HCM",
      province_name_vn: "TP. Hồ Chí Minh",
      province_name_en: "Ho Chi Minh City",
      province_type: "city",
      region: "Nam",
      note: "Hợp nhất: TP.HCM + Bình Dương + Bà Rịa-Vũng Tàu",
    },
    {
      province_code: "DN",
      province_name_vn: "Đà Nẵng",
      province_name_en: "Da Nang",
      province_type: "city",
      region: "Trung",
      note: "Hợp nhất: Đà Nẵng + Quảng Nam",
    },
    {
      province_code: "HP",
      province_name_vn: "Hải Phòng",
      province_name_en: "Hai Phong",
      province_type: "city",
      region: "Bắc",
      note: "Hợp nhất: Hải Phòng + Hải Dương",
    },
    {
      province_code: "CT",
      province_name_vn: "Cần Thơ",
      province_name_en: "Can Tho",
      province_type: "city",
      region: "Nam",
      note: "Hợp nhất: Cần Thơ + Sóc Trăng + Hậu Giang",
    },
    {
      province_code: "HUE",
      province_name_vn: "Huế",
      province_name_en: "Hue",
      province_type: "city",
      region: "Trung",
      note: "Nâng cấp từ tỉnh Thừa Thiên Huế",
    },
    // 28 Tỉnh — Miền Bắc
    {
      province_code: "CB",
      province_name_vn: "Cao Bằng",
      province_name_en: "Cao Bang",
      province_type: "province",
      region: "Bắc",
      note: "Giữ nguyên",
    },
    {
      province_code: "DB",
      province_name_vn: "Điện Biên",
      province_name_en: "Dien Bien",
      province_type: "province",
      region: "Bắc",
      note: "Giữ nguyên",
    },
    {
      province_code: "LC",
      province_name_vn: "Lai Châu",
      province_name_en: "Lai Chau",
      province_type: "province",
      region: "Bắc",
      note: "Giữ nguyên",
    },
    {
      province_code: "LS",
      province_name_vn: "Lạng Sơn",
      province_name_en: "Lang Son",
      province_type: "province",
      region: "Bắc",
      note: "Giữ nguyên",
    },
    {
      province_code: "QNI",
      province_name_vn: "Quảng Ninh",
      province_name_en: "Quang Ninh",
      province_type: "province",
      region: "Bắc",
      note: "Giữ nguyên",
    },
    {
      province_code: "SL",
      province_name_vn: "Sơn La",
      province_name_en: "Son La",
      province_type: "province",
      region: "Bắc",
      note: "Giữ nguyên",
    },
    {
      province_code: "TQ",
      province_name_vn: "Tuyên Quang",
      province_name_en: "Tuyen Quang",
      province_type: "province",
      region: "Bắc",
      note: "Hợp nhất: Tuyên Quang + Hà Giang",
    },
    {
      province_code: "LCA",
      province_name_vn: "Lào Cai",
      province_name_en: "Lao Cai",
      province_type: "province",
      region: "Bắc",
      note: "Hợp nhất: Lào Cai + Yên Bái",
    },
    {
      province_code: "TN",
      province_name_vn: "Thái Nguyên",
      province_name_en: "Thai Nguyen",
      province_type: "province",
      region: "Bắc",
      note: "Hợp nhất: Thái Nguyên + Bắc Kạn",
    },
    {
      province_code: "PT",
      province_name_vn: "Phú Thọ",
      province_name_en: "Phu Tho",
      province_type: "province",
      region: "Bắc",
      note: "Hợp nhất: Phú Thọ + Vĩnh Phúc + Hoà Bình",
    },
    {
      province_code: "BN",
      province_name_vn: "Bắc Ninh",
      province_name_en: "Bac Ninh",
      province_type: "province",
      region: "Bắc",
      note: "Hợp nhất: Bắc Ninh + Bắc Giang",
    },
    {
      province_code: "HY",
      province_name_vn: "Hưng Yên",
      province_name_en: "Hung Yen",
      province_type: "province",
      region: "Bắc",
      note: "Hợp nhất: Hưng Yên + Thái Bình",
    },
    {
      province_code: "NB",
      province_name_vn: "Ninh Bình",
      province_name_en: "Ninh Binh",
      province_type: "province",
      region: "Bắc",
      note: "Hợp nhất: Ninh Bình + Hà Nam + Nam Định",
    },
    // 28 Tỉnh — Miền Trung
    {
      province_code: "TH",
      province_name_vn: "Thanh Hóa",
      province_name_en: "Thanh Hoa",
      province_type: "province",
      region: "Trung",
      note: "Giữ nguyên",
    },
    {
      province_code: "NA",
      province_name_vn: "Nghệ An",
      province_name_en: "Nghe An",
      province_type: "province",
      region: "Trung",
      note: "Giữ nguyên",
    },
    {
      province_code: "HT",
      province_name_vn: "Hà Tĩnh",
      province_name_en: "Ha Tinh",
      province_type: "province",
      region: "Trung",
      note: "Giữ nguyên",
    },
    {
      province_code: "QTR",
      province_name_vn: "Quảng Trị",
      province_name_en: "Quang Tri",
      province_type: "province",
      region: "Trung",
      note: "Hợp nhất: Quảng Trị + Quảng Bình",
    },
    {
      province_code: "QNG",
      province_name_vn: "Quảng Ngãi",
      province_name_en: "Quang Ngai",
      province_type: "province",
      region: "Trung",
      note: "Hợp nhất: Quảng Ngãi + Kon Tum",
    },
    {
      province_code: "GL",
      province_name_vn: "Gia Lai",
      province_name_en: "Gia Lai",
      province_type: "province",
      region: "Trung",
      note: "Hợp nhất: Gia Lai + Bình Định",
    },
    {
      province_code: "KH",
      province_name_vn: "Khánh Hòa",
      province_name_en: "Khanh Hoa",
      province_type: "province",
      region: "Trung",
      note: "Hợp nhất: Khánh Hòa + Ninh Thuận",
    },
    {
      province_code: "DL",
      province_name_vn: "Lâm Đồng",
      province_name_en: "Lam Dong",
      province_type: "province",
      region: "Trung",
      note: "Hợp nhất: Lâm Đồng + Đắk Nông + Bình Thuận",
    },
    {
      province_code: "DLK",
      province_name_vn: "Đắk Lắk",
      province_name_en: "Dak Lak",
      province_type: "province",
      region: "Trung",
      note: "Hợp nhất: Đắk Lắk + Phú Yên",
    },
    // 28 Tỉnh — Miền Nam
    {
      province_code: "DNI",
      province_name_vn: "Đồng Nai",
      province_name_en: "Dong Nai",
      province_type: "province",
      region: "Nam",
      note: "Hợp nhất: Đồng Nai + Bình Phước",
    },
    {
      province_code: "TAN",
      province_name_vn: "Tây Ninh",
      province_name_en: "Tay Ninh",
      province_type: "province",
      region: "Nam",
      note: "Hợp nhất: Tây Ninh + Long An",
    },
    {
      province_code: "VL",
      province_name_vn: "Vĩnh Long",
      province_name_en: "Vinh Long",
      province_type: "province",
      region: "Nam",
      note: "Hợp nhất: Vĩnh Long + Bến Tre + Trà Vinh",
    },
    {
      province_code: "DT",
      province_name_vn: "Đồng Tháp",
      province_name_en: "Dong Thap",
      province_type: "province",
      region: "Nam",
      note: "Hợp nhất: Đồng Tháp + Tiền Giang",
    },
    {
      province_code: "AG",
      province_name_vn: "An Giang",
      province_name_en: "An Giang",
      province_type: "province",
      region: "Nam",
      note: "Hợp nhất: An Giang + Kiên Giang",
    },
    {
      province_code: "CM",
      province_name_vn: "Cà Mau",
      province_name_en: "Ca Mau",
      province_type: "province",
      region: "Nam",
      note: "Hợp nhất: Cà Mau + Bạc Liêu",
    },
  ]);

  console.log("Seed hoàn tất:");
  console.log("   • 1 tài khoản admin");
  console.log("   • 12 loại sinh cảnh");
  console.log("   • 6 giai đoạn phát triển");
  console.log("   • 8 trạng thái mẫu vật");
  console.log("   • 34 tỉnh/thành phố (NQ 202/2025/QH15)");
};
