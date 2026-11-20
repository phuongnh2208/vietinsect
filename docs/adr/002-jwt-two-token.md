# ADR-002: Mô hình xác thực 2 token (Access Token 15 phút + Refresh Token 7 ngày trong HttpOnly Cookie)

- **Trạng thái:** Accepted (Chấp nhận thay đổi – đóng DEF-006 / C-02)
- **Ngày:** 2026-11-20
- **Liên quan:** `DEF-006`, `C-02`, `docs/adr/SRS.md` (§3.4, F-AU-01, §5.2)

## 1. Bối cảnh
SRS v2.0 ban đầu ghi nhận "JWT TTL 24 giờ, lưu HttpOnly cookie" (F-AU-01, §5.2). Tuy nhiên trong quá trình triển khai thực tế, hệ thống áp dụng mô hình **2 token** chuẩn bảo mật hiện đại:
- **Access Token (JWT HS256, TTL 15 phút):** trả trong JSON body, lưu in-memory (Zustand store, không lưu `localStorage`), gửi qua header `Authorization: Bearer <token>` chỉ trên ngữ cảnh `/admin`.
- **Refresh Token (random 40 bytes, TTL 7 ngày):** lưu trong HttpOnly cookie (`vietinsect_refresh`, `SameSite=Strict`, `Path=/api/auth`, `Secure` khi production), lưu SHA-256 hash trong bảng `admin_refresh_tokens`, có cơ chế **refresh token rotation** và kiểm tra **inactivity timeout 60 phút**.

## 2. Quyết định
1. **Giữ nguyên** mô hình 2 token (Access Token 15 phút in-memory + Refresh Token 7 ngày trong HttpOnly cookie có rotation và idle timeout 60 phút).
2. Cập nhật `docs/adr/SRS.md` (F-AU-01, §3.4, §5.2) cho đồng nhất với kiến trúc thực tế.
3. Đóng `DEF-006` với trạng thái **"Chấp nhận thay đổi – có ADR"**.

## 3. Hệ quả
- **Ưu điểm:** Giảm cửa sổ rủi ro khi lộ Access Token từ 24 giờ xuống 15 phút; chống XSS đọc Refresh Token nhờ `HttpOnly`; chống CSRF nhờ `SameSite=Strict` + không lưu JWT trong `localStorage`; hỗ trợ thu hồi tức thì qua Redis blacklist (`jti`) và `logout-all`.
- **Đánh đổi:** Cần một request `/api/auth/refresh` tự động khi Access Token hết hạn sau 15 phút (đã được xử lý sẵn trong Axios interceptor `frontend/src/services/http.js`).
