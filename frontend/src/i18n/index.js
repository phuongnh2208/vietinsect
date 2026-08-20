import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  vi: {
    translation: {
      appName: "VietInsect",
      appSubtitle: "Hệ thống dữ liệu côn trùng Việt Nam",
      nav: { dashboard: "Tổng quan", catalog: "Mẫu vật", taxonomy: "Phân loại học", map: "Bản đồ", dna: "DNA & GenBank", analytics: "Phân tích", reports: "Báo cáo", settings: "Cấu hình" },
      common: { search: "Tìm kiếm", language: "Ngôn ngữ", light: "Sáng", dark: "Tối", notifications: "Thông báo", logout: "Đăng xuất", viewAll: "Xem tất cả", comingSoon: "Tính năng đang được hoàn thiện", cancel: "Hủy", confirm: "Xác nhận", close: "Đóng", public: "Công khai", private: "Riêng tư", admin: "Quản trị viên" },
      dashboard: { eyebrow: "Không gian quản trị", title: "Tổng quan hệ thống", description: "Theo dõi nhanh dữ liệu đa dạng sinh học, tiến độ số hóa và các tín hiệu cần xử lý.", specimen: "Mẫu vật", species: "Loài đã định danh", media: "Hình ảnh", dna: "Chuỗi DNA", digitization: "Tiến độ số hóa", alerts: "Cảnh báo dữ liệu", recent: "Hoạt động gần đây" },
      auth: { loginTitle: "Đăng nhập quản trị", loginDescription: "Truy cập không gian quản lý dữ liệu VietInsect.", username: "Tên đăng nhập", password: "Mật khẩu", signIn: "Đăng nhập", signingIn: "Đang xác thực...", lockNotice: "Tài khoản sẽ tạm khóa sau 5 lần nhập sai.", passwordHint: "Mật khẩu tối thiểu 12 ký tự", welcome: "Bảo tồn dữ liệu, hiểu sâu tự nhiên." },
      toast: { success: "Thao tác thành công", error: "Có lỗi xảy ra", warning: "Cần lưu ý" },
    },
  },
  en: {
    translation: {
      appName: "VietInsect",
      appSubtitle: "Vietnam Insect Biodiversity Data System",
      nav: { dashboard: "Overview", catalog: "Specimens", taxonomy: "Taxonomy", map: "Map", dna: "DNA & GenBank", analytics: "Analytics", reports: "Reports", settings: "Settings" },
      common: { search: "Search", language: "Language", light: "Light", dark: "Dark", notifications: "Notifications", logout: "Sign out", viewAll: "View all", comingSoon: "This feature is being prepared", cancel: "Cancel", confirm: "Confirm", close: "Close", public: "Public", private: "Private", admin: "Administrator" },
      dashboard: { eyebrow: "Admin workspace", title: "System overview", description: "Monitor biodiversity data, digitization progress, and signals that need attention.", specimen: "Specimens", species: "Identified species", media: "Media assets", dna: "DNA sequences", digitization: "Digitization progress", alerts: "Data alerts", recent: "Recent activity" },
      auth: { loginTitle: "Admin sign in", loginDescription: "Enter the VietInsect data management workspace.", username: "Username", password: "Password", signIn: "Sign in", signingIn: "Authenticating...", lockNotice: "The account will be locked after 5 failed attempts.", passwordHint: "Minimum 12 characters", welcome: "Preserve data, understand nature." },
      toast: { success: "Action completed", error: "Something went wrong", warning: "Please review" },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: window.localStorage.getItem("vietinsect_language") || "vi",
  fallbackLng: "vi",
  interpolation: { escapeValue: false },
});

export default i18n;
