# ADR-007: Puppeteer PDF Hardening & Container Runtime

- **Ngày:** 2026-11-21
- **Trạng thái:** Đã chấp nhận (Accepted)
- **Liên quan:** `DEF-003`, `DEF-042`, `DEF-043`, `DEF-080`, `DEF-081`, `DEF-084`, `backend/Dockerfile`, `backend/src/modules/reports/pdfGenerator.service.js`

## 1. Bối cảnh
Hệ thống sử dụng Puppeteer/Chromium phía server để xuất báo cáo khoa học (F-RP-01/02/05) và nhãn mẫu vật kèm QR (F-SP-09). Việc render HTML động bằng trình duyệt headless tiềm ẩn rủi ro SSRF, HTML/JS injection, cạn kiệt tài nguyên (OOM/CPU) và rò rỉ dữ liệu chủ quyền nếu trình duyệt gọi ra internet.

## 2. Quyết định bảo mật
1. **Chống SSRF & HTML/JS Injection:**
   - Mọi trường dữ liệu người dùng đều đi qua `escapeHtml()`.
   - Tắt hoàn toàn JavaScript trong trang render (`page.setJavaScriptEnabled(false)`).
   - Request interception chỉ cho phép `about:blank` và `data:image/*` (QR/logo nhúng); chặn toàn bộ `http://`, `https://`, `file://`, `localhost`, `127.0.0.1`, `::1`, mạng nội bộ và redirect.
2. **Giới hạn tài nguyên & chống DoS:**
   - Giới hạn số trang render đồng thời (`PDF_MAX_CONCURRENCY`, mặc định 2) và độ dài hàng đợi (`PDF_MAX_QUEUE`, mặc định 10; vượt → `503 PDF.QUEUE_OVERFLOW`).
   - Timeout mỗi lần render (`PDF_TIMEOUT_MS`, mặc định 30s) và luôn đóng `page` trong `finally`.
   - Giới hạn tối đa 500 nhãn/lần, tối đa 2.000 dòng báo cáo, và rate limit riêng cho User trên `/api/reports` (`429`).
3. **Job nền & File tạm:**
   - `jobId` là UUID v4, gắn chặt với `ownerKey` (`admin:<id>` hoặc `anon:<sha256(ip|ua)>`); chủ thể khác truy cập trả `403`.
   - File tạm lưu tại `os.tmpdir()/vietinsect-reports` (ngoài webroot), tự động xóa sau TTL (mặc định 15 phút).
4. **Docker & Non-Root Sandbox:**
   - `backend/Dockerfile` dùng `node:20-bookworm-slim`, cài sẵn `chromium`, `fonts-dejavu-core`, `fonts-liberation`, `fonts-noto-core` (hiển thị đầy đủ tiếng Việt có dấu) và đặt `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.
   - Container chạy dưới user không phải root (`USER node`). Cờ `--no-sandbox` chỉ được bật khi tiến trình chạy dưới user non-root (hoặc container không có user namespace) — tuyệt đối không chạy Chromium với `--no-sandbox` dưới `root`.

## 3. Hệ quả
- Không phụ thuộc CDN/internet khi xuất PDF; đảm bảo dữ liệu chủ quyền.
- Image backend tăng kích thước do Chromium (~300MB) nhưng ổn định và tái lập được 100% font tiếng Việt trên Linux prod.
