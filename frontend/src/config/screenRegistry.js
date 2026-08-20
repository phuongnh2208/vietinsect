const screens = [
  { id: "SCR-01", title: "Đăng nhập", englishTitle: "Admin Login", group: "Xác thực Admin", path: "/login", layout: "auth", role: "Admin", icon: "shield", description: "Đăng nhập an toàn cho quản trị viên." },
  { id: "SCR-02", title: "Đổi mật khẩu", englishTitle: "Change Password", group: "Xác thực Admin", path: "/admin/change-password", layout: "admin", role: "Admin", icon: "key", description: "Cập nhật mật khẩu và kiểm tra độ mạnh." },
  { id: "SCR-03", title: "Dashboard Admin", englishTitle: "Admin Dashboard", group: "Dashboard & Tổng quan", path: "/admin/dashboard", layout: "admin", role: "Admin", icon: "dashboard", description: "Tổng quan mẫu vật, loài, ảnh, DNA và cảnh báo dữ liệu." },
  { id: "SCR-04", title: "Trang chủ công khai", englishTitle: "Public Home", group: "Dashboard & Tổng quan", path: "/", layout: "public", role: "User", icon: "home", description: "Khám phá dữ liệu côn trùng công khai của Việt Nam." },
  { id: "SCR-05", title: "Danh sách mẫu vật", englishTitle: "Specimen List", group: "Quản lý Mẫu vật", path: "/admin/specimens", layout: "admin", role: "Admin", icon: "database", description: "Bảng quản lý tập trung toàn bộ mẫu vật." },
  { id: "SCR-06", title: "Thêm mới mẫu vật", englishTitle: "Specimen Creation Form", group: "Quản lý Mẫu vật", path: "/admin/specimens/new", layout: "admin", role: "Admin", icon: "plus", description: "Tạo bản ghi mẫu vật mới với dữ liệu định danh, thu mẫu và GPS." },
  { id: "SCR-07", title: "Chỉnh sửa mẫu vật", englishTitle: "Specimen Edit Form", group: "Quản lý Mẫu vật", path: "/admin/specimens/edit", layout: "admin", role: "Admin", icon: "edit", description: "Chỉnh sửa dữ liệu và theo dõi lịch sử thay đổi mẫu vật." },
  { id: "SCR-08", title: "Chi tiết mẫu vật", englishTitle: "Specimen Detail", group: "Quản lý Mẫu vật", path: "/specimens/:id", adminPath: "/admin/specimens/:id", dualContext: true, layout: "public", role: "Admin / User", icon: "bug", description: "Xem hình ảnh, thông tin định danh và chuỗi DNA liên kết." },
  { id: "SCR-09", title: "Nhập dữ liệu hàng loạt", englishTitle: "Bulk Import Workbench", group: "Quản lý Mẫu vật", path: "/admin/specimens/import", layout: "admin", role: "Admin", icon: "upload", description: "Tải template, map cột và kiểm tra dữ liệu trước khi nhập." },
  { id: "SCR-10", title: "Chỉnh sửa hàng loạt", englishTitle: "Batch Edit", group: "Quản lý Mẫu vật", path: "/admin/specimens/batch-edit", layout: "admin", role: "Admin", icon: "layers", description: "Cập nhật nhiều bản ghi theo một trường dữ liệu." },
  { id: "SCR-11", title: "Định dạng và in nhãn", englishTitle: "Label Printing", group: "Quản lý Mẫu vật", path: "/admin/specimens/labels", layout: "admin", role: "Admin", icon: "tag", description: "Thiết kế nhãn, tạo QR và xuất PDF in hàng loạt." },
  { id: "SCR-12", title: "Cây phân loại học", englishTitle: "Taxonomy Tree", group: "Phân loại học & Hồ sơ loài", path: "/taxonomy", adminPath: "/admin/taxonomy", dualContext: true, layout: "public", role: "Admin / User", icon: "tree", description: "Duyệt cấu trúc phân loại từ Kingdom đến Species." },
  { id: "SCR-13", title: "Trang hồ sơ loài", englishTitle: "Species Profile Page", group: "Phân loại học & Hồ sơ loài", path: "/species/:slug", adminPath: "/admin/species/:slug", dualContext: true, layout: "public", role: "Admin / User", icon: "leaf", description: "Hồ sơ loài với các tab hình thái, mẫu vật, DNA và phân bố." },
  { id: "SCR-14", title: "Quản lý danh pháp", englishTitle: "Taxon Editor", group: "Phân loại học & Hồ sơ loài", path: "/admin/taxonomy/editor", layout: "admin", role: "Admin", icon: "edit", description: "Quản lý accepted name, synonym và xác thực tên khoa học." },
  { id: "SCR-15", title: "Tìm kiếm mẫu vật", englishTitle: "Specimen Search", group: "Tìm kiếm & Khai thác", path: "/specimens/search", layout: "public", role: "Admin / User", icon: "search", description: "Tìm kiếm toàn văn và lọc đa chiều dữ liệu mẫu vật." },
  { id: "SCR-16", title: "Tìm kiếm nâng cao", englishTitle: "Advanced Search", group: "Tìm kiếm & Khai thác", path: "/search/advanced", layout: "public", role: "Admin / User", icon: "filter", description: "Xây dựng truy vấn AND/OR/NOT và lưu bộ lọc." },
  { id: "SCR-17", title: "Thư viện hình ảnh", englishTitle: "Media Gallery", group: "Tìm kiếm & Khai thác", path: "/media", adminPath: "/admin/media", dualContext: true, layout: "public", role: "Admin / User", icon: "image", description: "Duyệt bộ sưu tập hình ảnh độ phân giải cao." },
  { id: "SCR-18", title: "Bản đồ phân bố", englishTitle: "Occurrence Map", group: "GIS & Bản đồ", path: "/map", adminPath: "/admin/map", dualContext: true, layout: "public", role: "Admin / User", icon: "map", description: "Phân tích điểm thu mẫu, heatmap và các lớp bản đồ." },
  { id: "SCR-19", title: "Quản lý lớp bản đồ", englishTitle: "Layer Manager", group: "GIS & Bản đồ", path: "/admin/map/layers", layout: "admin", role: "Admin", icon: "layers", description: "Tải lên, bật tắt và định kiểu các lớp GIS chuyên đề." },
  { id: "SCR-20", title: "Danh sách chuỗi DNA", englishTitle: "DNA Records List", group: "Dữ liệu DNA & GenBank", path: "/dna", adminPath: "/admin/dna", dualContext: true, layout: "public", role: "Admin / User", icon: "dna", description: "Tra cứu các bản ghi phân tử và marker gene." },
  { id: "SCR-21", title: "Form Thêm/Sửa DNA", englishTitle: "DNA Entry & Edit Form", group: "Dữ liệu DNA & GenBank", path: "/admin/dna/new", layout: "admin", role: "Admin", icon: "dna", description: "Nhập accession code và metadata chuỗi DNA." },
  { id: "SCR-22", title: "Chi tiết chuỗi FASTA", englishTitle: "DNA Detail / FASTA View", group: "Dữ liệu DNA & GenBank", path: "/dna/:id/fasta", adminPath: "/admin/dna/:id/fasta", dualContext: true, layout: "public", role: "Admin / User", icon: "file", description: "Hiển thị chuỗi nucleotide và metadata FASTA." },
  { id: "SCR-23", title: "Nhận dạng loài qua ảnh", englishTitle: "AI Species Identification", group: "AI & Phân tích mô hình", path: "/ai/species-identification", adminPath: "/admin/ai/species-identification", dualContext: true, layout: "public", role: "Admin / User", icon: "sparkles", description: "Tải ảnh và nhận gợi ý top-5 loài từ mô hình AI." },
  { id: "SCR-24", title: "Dự báo phân bố (SDM)", englishTitle: "SDM Prediction Portal", group: "AI & Phân tích mô hình", path: "/admin/ai/sdm", layout: "admin", role: "Admin", icon: "map", description: "Chạy mô hình MaxEnt với biến khí hậu để dự báo phân bố." },
  { id: "SCR-25", title: "Dashboard phân tích", englishTitle: "Analytics Dashboard", group: "AI & Phân tích mô hình", path: "/admin/analytics", layout: "admin", role: "Admin", icon: "chart", description: "Theo dõi xu hướng số hóa, độ phủ dữ liệu và cảnh báo." },
  { id: "SCR-26", title: "Báo cáo danh lục & Thống kê", englishTitle: "Reports & Checklists", group: "Báo cáo & Xuất dữ liệu", path: "/reports", adminPath: "/admin/reports", dualContext: true, layout: "public", role: "Admin / User", icon: "file", description: "Xuất danh lục loài và thống kê dữ liệu mở." },
  { id: "SCR-27", title: "Báo cáo KPI số hóa", englishTitle: "Digitization KPI Report", group: "Báo cáo & Xuất dữ liệu", path: "/admin/reports/kpi", layout: "admin", role: "Admin", icon: "chart", description: "Theo dõi hiệu suất nhập mới, chỉnh sửa, ảnh và DNA." },
  { id: "SCR-28", title: "Bộ dựng báo cáo tùy chỉnh", englishTitle: "Custom Report Builder", group: "Báo cáo & Xuất dữ liệu", path: "/admin/reports/custom", layout: "admin", role: "Admin", icon: "settings", description: "Chọn trường, xem trước và xuất báo cáo tùy biến." },
  { id: "SCR-29", title: "Kiểm soát chia sẻ công khai", englishTitle: "Public / Private Control", group: "Quản trị hệ thống", path: "/admin/sharing", layout: "admin", role: "Admin", icon: "shield", description: "Quản lý trạng thái Public/Private cho từng bản ghi." },
  { id: "SCR-30", title: "Nhật ký & Cấu hình hệ thống", englishTitle: "System Audit Log & Config", group: "Quản trị hệ thống", path: "/admin/system", layout: "admin", role: "Admin", icon: "settings", description: "Xem audit log và cấu hình tích hợp hệ thống." },
];

export const screenRegistry = Object.freeze(screens);
export const screenById = Object.freeze(Object.fromEntries(screens.map((screen) => [screen.id, screen])));
export const screenByPath = Object.freeze(Object.fromEntries(screens.map((screen) => [screen.path, screen])));
export const adminScreens = screens.filter((screen) => screen.layout === "admin");
export const publicScreens = screens.filter((screen) => screen.layout === "public");
export const screenGroups = [...new Set(screens.map((screen) => screen.group))];

export function getScreen(screenId) {
  return screenById[screenId] || screenById["SCR-04"];
}

export default screenRegistry;
