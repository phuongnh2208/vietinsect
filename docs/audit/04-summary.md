# 04 — Tổng hợp Báo cáo Kiểm toán (Executive Audit Summary)

> **Hệ thống:** VietInsect BigData System (Phần mềm số hóa côn trùng có giá trị tài nguyên)
> **Tài liệu chuẩn đối chiếu:** `docs/adr/SRS.md` (SRS v2.0 — Viện CNTT / VAST)
> **Ngày hoàn tất kiểm toán:** 2026-11-20
> **Phạm vi:** 58 yêu cầu chức năng (`F-AU-01` → `F-AD-04`), 30 màn hình (`SCR-01` → `SCR-30`), Phân quyền & Rò rỉ dữ liệu, Yêu cầu phi chức năng (§5, §6), Chất lượng kỹ thuật (chạy thật build/test/coverage/migration/docker), và Schema CSDL.

---

## 1. Tỷ lệ Hoàn thành theo 10 Nhóm Chức năng (58 F-xx)

> **Cách tính % hoàn thành quy đổi:** `✅ Đạt đầy đủ = 100%` · `🟡 Đạt một phần = 50%` · `⚠️ Có nhưng sai đặc tả = 25%` · `❌ Chưa có (hoặc giả lập hoàn toàn) = 0%`.

| STT | Nhóm chức năng | Số CN | ✅ Đạt đủ | 🟡 Một phần | ⚠️ Sai đặc tả | ❌ Chưa có | % Hoàn thành quy đổi | Nhận định cốt lõi |
|---:|---|---:|---:|---:|---:|---:|---:|---|
| 1 | **Xác thực & Bảo mật (`F-AU`)** | 3 | 0 | 1 | 2 | 0 | **33.3%** | Có bcrypt cost 12, khóa 5 lần sai/30', HttpOnly refresh cookie; nhưng thiếu kiểm tra 4 loại ký tự mật khẩu, thiếu timeout 60', thiếu blacklist JWT và API/UI đăng xuất mọi thiết bị. |
| 2 | **Dashboard & Tổng quan (`F-DB`)** | 4 | 2 | 2 | 0 | 0 | **75.0%** | Polling 30s, Recharts Treemap 2D, Minimap Leaflet hoạt động tốt; cần lọc số loài Public trên trang chủ mở. |
| 3 | **Quản lý Mẫu vật (`F-SP`)** | 12 | 0 | 10 | 2 | 0 | **45.8%** | CRUD + PostGIS + tracked changes + DwC-A/Excel/GeoJSON có; nhưng form thiếu ô nhập nhiều trường, chưa có khôi phục xóa mềm 30 ngày, chưa resize thumbnail 200×200, mã QR nhãn đang là chữ giả `"|||| ||| |||| QR"`, bulk import chưa có WebSocket/background job. |
| 4 | **Phân loại học & Hồ sơ loài (`F-TX`)** | 7 | 0 | 7 | 0 | 0 | **50.0%** | Cây 8 bậc lazy-load, COL verify, synonym CRUD có; nhưng chưa tự điều hướng synonym → accepted name, thiếu ITIS verify, Tab Hoạt tính chưa có UI thêm/sửa/xóa, Hồ sơ loài thiếu widget AI/SDM bên phải. |
| 5 | **Tìm kiếm & Khai thác (`F-SR`)** | 7 | 0 | 5 | 2 | 0 | **42.9%** | **Chưa có Elasticsearch 8 + Vietnamese analyzer** (đang dùng `ILIKE` Postgres); thiếu 5/8 chiều lọc Faceted & facet count; chỉ có 1/5 chế độ xem; Query Builder làm mất logic `OR`, thiếu SQL mode; không có vẽ polygon `leaflet-draw`. |
| 6 | **GIS & Bản đồ (`F-GI`)** | 6 | 0 | 2 | 4 | 0 | **33.3%** | Điểm mẫu Canvas + bán kính PostGIS tốt; nhưng dùng 4 lớp nền Esri thay vì Google/OSM/Cục Đo đạc VN; Quản lý lớp bản đồ (`SCR-19`) chưa có API backend (chỉ đọc tạm Point trên trình duyệt); chưa có Choropleth & xuất PDF A4/A3, PNG 300DPI, Shapefile. |
| 7 | **Dữ liệu DNA & GenBank (`F-DN`)** | 5 | 1 | 1 | 3 | 0 | **45.0%** | FASTA viewer (`F-DN-04`) đạt đủ; nhưng đồng bộ đang gọi DDBJ thay vì NCBI E-utilities (`esearch+efetch`) và không dùng `ncbi_api_key`; xóa mẫu vật chưa tự chuyển DNA sang `is_orphaned = true` (FK lại đặt `ON DELETE CASCADE`). |
| 8 | **AI & Phân tích mô hình (`F-AI`)** | 4 | 0 | 2 | 0 | 2 | **25.0%** | **`F-AI-01` (CNN) và `F-AI-02` (MaxEnt SDM) giả lập 100% ở client-side**, thư mục `ai-service/` rỗng, không có cổng kết nối Node.js → FastAPI. |
| 9 | **Báo cáo & Xuất dữ liệu (`F-RP`)** | 6 | 0 | 4 | 2 | 0 | **41.7%** | Xuất DwC-A/Excel/CSV có; nhưng thiếu Puppeteer sinh PDF đóng dấu Header/Footer số trang/Watermark Viện, thiếu xuất `.docx`, Báo cáo KPI thiếu lọc thời gian & bảng tháng, Báo cáo tùy chỉnh khi xuất Excel bỏ qua các cột đã chọn. |
| 10 | **Quản trị hệ thống (`F-AD`)** | 4 | 1 | 3 | 0 | 0 | **62.5%** | Kiểm soát chia sẻ Public/Private (`F-AD-01`) và mã hóa AES-256-GCM đạt tốt; nhưng SCR-30 thiếu cấu hình SMTP/Google Maps/Backup/Logo & CRUD danh mục dropdown; >95% chuỗi UI hard-code tiếng Việt, trang Public thiếu nút đổi ngôn ngữ. |
| **TỔNG** | **10 Nhóm chức năng** | **58** | **4** | **37** | **15** | **2** | **45.3%** | **30/30 màn hình đều đã có route & giao diện, nhưng nhiều tính năng chiều sâu theo SRS v2.0 mới dừng ở mức khung UI hoặc rút gọn.** |

---

## 2. Thống kê Lỗi theo Mức độ & Phân loại (`DEF-001` → `DEF-107`)

### 2.1. Theo mức độ nghiêm trọng (Severity)

| Mức độ | Số lượng | Tỷ lệ | Các mã lỗi tiêu biểu |
|---|---:|---:|---|
| 🔴 **Critical** | **8** | 7.5% | `DEF-001`..`005` (Lệch stack React 19 / Router v7, thiếu Puppeteer, thiếu MinIO SDK, rỗng `ai-service`/`infra`/`packages/shared`), `DEF-059` (Thiếu Elasticsearch Vietnamese analyzer), `DEF-076` (AI CNN giả lập client-side), `DEF-077` (MaxEnt SDM giả lập client-side). |
| 🟠 **High** | **47** | 43.9% | `DEF-006`..`010` (Auth/Session/Password complexity/JWT blacklist), `DEF-017`..`018` (Thiếu trường mẫu vật), `DEF-024` (Hiển thị dữ liệu giả khi NULL), `DEF-026` (Thiếu khôi phục xóa mềm 30 ngày), `DEF-028`..`030` (Bulk import), `DEF-040` (Thiếu thumbnail 200×200), `DEF-042`..`043` (QR giả & thiếu PDF nhãn), `DEF-053`..`058` (Taxonomy/Synonym/Bioactivity), `DEF-060`..`063` (8 Facets/5 Views/Query Builder OR-NOT/Polygon draw), `DEF-068`..`071` (GIS basemaps/Layer manager backend/Choropleth), `DEF-073`, `DEF-075` (DNA orphan & FK CASCADE), `DEF-081`..`084` (Reports PDF/DOCX/KPI/Custom), `DEF-087`..`089` (**Rò rỉ mẫu vật Private qua DNA**, Config, i18n), `DEF-091`..`098` (CSP/HSTS/CSRF/Nginx TLS 1.3/Backup/Docker), `DEF-104`..`105` (Test FE fail & BE coverage 44.72% < 70%). |
| 🟡 **Medium** | **42** | 39.3% | `DEF-011`, `DEF-012`, `DEF-014`, `DEF-015`, `DEF-019`..`022`, `DEF-025`, `DEF-027`, `DEF-031`, `DEF-033`, `DEF-035`, `DEF-036`, `DEF-039`, `DEF-041`, `DEF-044`, `DEF-046`..`049`, `DEF-051`, `DEF-052`, `DEF-055`, `DEF-057`, `DEF-064`, `DEF-066`, `DEF-067`, `DEF-070`, `DEF-078`, `DEF-080`, `DEF-085`, `DEF-086`, `DEF-090`, `DEF-094`, `DEF-097`, `DEF-099`..`101`, `DEF-103`, `DEF-107`. |
| 🔵 **Low** | **10** | 9.3% | `DEF-013`, `DEF-016`, `DEF-023`, `DEF-032`, `DEF-050`, `DEF-065`, `DEF-072`, `DEF-074`, `DEF-102`, `DEF-106`. |
| **TỔNG CỘNG** | **107** | **100%** | Chi tiết từng lỗi xem tại `docs/audit/02-defects.md`. |

### 2.2. Theo loại lỗi (Category)

| Loại lỗi | Số lượng | Ghi chú |
|---|---:|---|
| **Functional** | 64 | Chức năng thiếu, làm rút gọn hoặc sai luồng nghiệp vụ SRS. |
| **Data** | 13 | Toàn vẹn dữ liệu, FK CASCADE sai, gán dữ liệu giả khi NULL, thiếu trường 22 cột, MV rỗng. |
| **Security** | 12 | JWT/Session timeout/Password policy/Blacklist, CSP/HSTS, CORS, CSRF, DOMPurify, TLS 1.3. |
| **Build / DevOps** | 9 | Lệch version stack, lockfile out-of-sync, FE test fail, BE coverage < 70%, thiếu `Makefile`/Docker/CI. |
| **Permission** | 5 | Rò rỉ thông tin mẫu vật Private/đã xóa qua DNA (`DEF-089`), lộ token Admin trên route Public (`DEF-051`, `DEF-090`). |
| **Reliability / Performance** | 3 | Thiếu script backup `pg_dump` 01:00 (`DEF-096`), log rotate 90 ngày (`DEF-097`), preview 5.000 dòng (`DEF-032`). |
| **i18n** | 1 | `DEF-088` (>95% chuỗi giao diện hard-code tiếng Việt, thiếu nút đổi ngôn ngữ ở `PublicLayout`). |

---

## 3. Kết quả Chạy Kiểm thử Kỹ thuật Thực tế (Bước 4 & Bước 5)

| Lệnh / Hạng mục kiểm tra | Kết quả thực tế | Bằng chứng Output |
|---|---|---|
| `pnpm install --frozen-lockfile` | ❌ **FAIL** | `ERR_PNPM_OUTDATED_LOCKFILE`: `pnpm-lock.yaml` chưa cập nhật 5 gói mới trong `backend/package.json` (`jest`, `supertest`, `cookie-parser`, `express-rate-limit`, `ioredis`) (`DEF-104`). |
| `pnpm lint` | ❌ **FAIL** | `ERR_PNPM_NO_SCRIPT Missing script: lint` ở cả root, backend và frontend (`DEF-104`). |
| `pnpm --filter backend test -- --coverage` | 🟡 **26/26 PASS — Coverage 44.72% (< 70%)** | `Test Suites: 2 passed, 2 total (26 passed)`. Nhưng Statement Coverage chỉ đạt **44.72%** (`auth.service` 21.81%, `dna.service` 16.32%, `specimen.service` 35.92%, `taxonomy.service` 22.46%, `system.service` 13.79%) — không đạt ngưỡng ≥ 70% của SRS §5.4 (`DEF-105`). |
| `pnpm --filter frontend test -- --watchAll=false` | ❌ **FAIL (1 failed, 1 passed)** | `PASS src/stores/auth.store.test.js` · `FAIL src/App.test.js`: `Cannot find module 'react-router/dom'` do cài `react-router-dom@7.18.1` trên Jest 27 của CRA 5 (`DEF-002`, `DEF-105`). |
| `pnpm --filter frontend build` | ✅ **PASS** | `Compiled successfully. build\static\js\main.1071fb9e.js (387.58 kB gzip)`. Có cảnh báo `Cannot find ESLint plugin (ESLintWebpackPlugin)`. |
| `make migrate` vs `knex migrate:status` | 🟡 **`Makefile` rỗng / Knex 16/16 Completed** | `Makefile` 0 byte nên không dùng được `make`; chạy `pnpm --filter backend exec knex migrate:status` xác nhận **16/16 migration đã chạy hoàn tất**, không có pending migration. |
| `docker compose config` | 🟡 **Dev OK / Prod FAIL** | `docker-compose.yml` hợp lệ (4 services: `postgres`, `mongodb`, `redis`, `minio`); `docker-compose -f docker-compose.prod.yml config` báo lỗi `empty compose file` (`DEF-098`). |
| Đối khớp Schema CSDL (Bước 5) | 🟡 **Đạt ~85%** | Đủ các bảng `admin_users`, `admin_refresh_tokens`, `provinces` (34 tỉnh), `habitat_types`, `life_stages`, `specimen_status_types`, `collectors`, `taxa`, `species_profiles`, `bioactivity_records`, `specimen_registry`, `specimens` (partition 1800–2050 + PostGIS GiST), `specimen_images`, `specimen_change_history`, `dna_sequences`, `ecological_zones`, `map_layers`, `map_layer_features`, `audit_logs` (partition tháng 2025–2050), `system_config`, `saved_filters`, `gbif_export_logs`, `report_configs`. **Các lỗi schema/data:** (1) `dna_sequences.specimen_id` đặt `ON DELETE CASCADE` thay vì `SET NULL` (`DEF-075`); (2) `mv_taxon_dwc_flat` lọc `taxon_rank = 'species'` chữ thường nên luôn rỗng (`DEF-107`); (3) 5 bảng `map_layers`, `map_layer_features`, `saved_filters`, `gbif_export_logs`, `report_configs` đã tạo trong DB nhưng chưa có code backend đọc/ghi. |

---

## 4. Top 10 Việc Cần Sửa Trước (Theo Thứ tự Ưu tiên Nghiệm thu)

1. **[P0 — Bảo mật & Rò rỉ dữ liệu] Khắc phục rò rỉ mẫu vật Private/Đã xóa qua API DNA (`DEF-089`, `DEF-051`, `DEF-090`):**
   * Sửa `dna.repository.js` để `LEFT JOIN specimens s` và lọc `(d.specimen_id IS NULL OR (s.deleted_at IS NULL AND s.is_public = true))` cho User công khai; không gửi Bearer token Admin khi đang ở các route Public.
2. **[P0 — Toàn vẹn dữ liệu] Bảo vệ chuỗi DNA khi xóa mẫu vật & bỏ toàn bộ dữ liệu giả khi trường rỗng (`DEF-075`, `DEF-024`, `DEF-027`, `DEF-034`, `DEF-038`):**
   * Đổi FK `dna_sequences.specimen_id` từ `ON DELETE CASCADE` sang `ON DELETE SET NULL`; cập nhật `is_orphaned = true` + cảnh báo Admin khi soft-delete mẫu vật; xóa ngay các chuỗi fallback bịa dữ liệu trong `SpecimenDwcSections.js` và `bulkImportRows`.
3. **[P0 — Stack & Test/CI] Đưa Frontend về đúng React 18 + React Router v6, sửa `pnpm-lock.yaml` và nâng Test Coverage ≥ 70% (`DEF-001`, `DEF-002`, `DEF-104`, `DEF-105`):**
   * Hạ `react@18`, `react-dom@18`, `react-router-dom@6`, `react-leaflet@4`; đồng bộ `pnpm-lock.yaml`; sửa `App.test.js` và viết thêm test cho 5 service backend để vượt ngưỡng 70% coverage.
4. **[P0 — AI Service] Thay thế 2 màn hình AI giả lập client-side bằng FastAPI container & cổng kết nối Node.js (`DEF-005`, `DEF-076`, `DEF-077`):**
   * Xây dựng microservice Python 3.11 + FastAPI trong `ai-service/` (CNN nhận dạng loài + MaxEnt SDM), kết nối qua gateway Node.js `/api/ai/*`, trả kết quả thật, xuất GeoTIFF/PNG và cho phép Admin xác nhận gắn loài vào mẫu vật.
5. **[P1 — Tìm kiếm & Khai thác] Tích hợp Elasticsearch 8 (Vietnamese analyzer), đủ 8 Facets + Facet Counts, 5 chế độ xem và sửa Query Builder (`DEF-059` → `DEF-063`):**
   * Cấu hình Elasticsearch 8 tìm tiếng Việt có dấu/không dấu + cột `notes`; bổ sung 5 facet còn thiếu kèm số đếm; thêm ViewSwitcher 5 chế độ xem; sửa thuật toán đánh giá `AND/OR/NOT` ở backend cho `SCR-16` và tích hợp `leaflet-draw` vẽ polygon.
6. **[P1 — Quản lý Mẫu vật] Hoàn thiện đủ 22 trường nhập/sửa, khôi phục xóa mềm 30 ngày, sinh thumbnail 200×200 và mã QR/PDF nhãn thật (`DEF-017`, `DEF-018`, `DEF-026`, `DEF-040`, `DEF-042`, `DEF-043`):**
   * Bổ sung đầy đủ các ô nhập còn thiếu vào `SpecimenForm.js` (gồm cả Người định loại); thêm API/UI khôi phục mẫu xóa mềm trong 30 ngày; dùng `sharp` tạo thumbnail 200×200; sinh mã QR SVG thật và xuất PDF nhãn bằng Puppeteer (`DEF-003`).
7. **[P1 — GIS & Bản đồ] Xây dựng Backend cho Quản lý lớp bản đồ (`SCR-19`), bản đồ Choropleth độ giàu loài và 4 lớp nền chuẩn SRS (`DEF-068` → `DEF-071`):**
   * Viết API CRUD cho bảng `map_layers` / `map_layer_features` (hỗ trợ GeoJSON Point/Polygon/LineString, Shapefile, GeoTIFF, phân quyền hiển thị User); tích hợp 4 lớp nền (Google Maps, Google Satellite, OSM, Cục Đo đạc VN) và Choropleth tỉnh/huyện.
8. **[P1 — Báo cáo & Xuất dữ liệu] Tích hợp Puppeteer đóng dấu PDF Viện CNTT/VAST, xuất `.docx`, sửa Báo cáo KPI và Báo cáo tùy chỉnh (`DEF-003`, `DEF-080` → `DEF-085`):**
   * Sinh PDF phía server có Header/Footer số trang/Watermark mờ; thêm xuất `.docx` danh lục loài sắp xếp theo `Bộ → Họ → Loài`; hoàn thiện thống kê KPI theo tháng + xuất Excel; truyền danh sách cột đã chọn khi xuất Excel ở `SCR-28` và lưu cấu hình vào bảng `report_configs`.
9. **[P1 — Xác thực & Bảo mật NFR] Hoàn thiện chính sách mật khẩu 4 loại ký tự, Idle timeout 60 phút, Blacklist JWT, đăng xuất mọi thiết bị, CSRF, DOMPurify và Nginx TLS 1.3 (`DEF-006` → `DEF-011`, `DEF-091` → `DEF-095`):**
   * Bắt buộc regex 4 loại ký tự khi đổi mật khẩu; thêm idle timeout 60'; lưu blacklist JWT trên Redis; mở route `/api/auth/logout-all`; thêm CSRF protection, DOMPurify và cấu hình `infra/nginx/nginx.conf` (TLS 1.3 + HSTS).
10. **[P2 — Quản trị, i18n, Dark Mode & Vận hành] Hoàn thiện cấu hình SCR-30, song ngữ VI/EN toàn hệ thống, Dark mode thật và script Backup tự động (`DEF-087`, `DEF-088`, `DEF-096`, `DEF-098`, `DEF-100`, `DEF-101`):**
    * Thêm cấu hình SMTP, Google Maps key, Backup cron, Logo Viện & CRUD 3 danh mục dropdown tại `SCR-30`; trích xuất chuỗi sang `vi.json`/`en.json` + gắn nút đổi ngôn ngữ lên `PublicLayout`; sửa bảng màu `:root.dark`; bổ sung chuyển đổi tọa độ VN-2000 (EPSG:4756) và script `scripts/backup.sh` (`pg_dump` 01:00).

---

## 5. Đánh giá Rủi ro Nghiệm thu (Acceptance Risks)

1. **Rủi ro Trượt nghiệm thu Hạng mục AI & BigData (Mức: RẤT CAO):**
   * Hai chức năng điểm nhấn của đề tài là **Nhận dạng loài bằng CNN (`F-AI-01`)** và **Dự báo phân bố loài MaxEnt SDM (`F-AI-02`)** cùng **Tìm kiếm toàn văn Elasticsearch (`F-SR-01`)** hiện chưa có backend thật (AI đang băm tên file giả lập trên giao diện; thư mục `ai-service/` và `infra/elasticsearch/` rỗng). Khi hội đồng nghiệm thu kiểm tra mã nguồn hoặc tải lên 2 bức ảnh khác nhau có cùng tên file, hệ thống sẽ lộ rõ việc trả kết quả giả lập cố định.
2. **Rủi ro Sai lệch Dữ liệu Khoa học & Rò rỉ Dữ liệu Nội bộ (Mức: CAO):**
   * Việc hiển thị chuỗi mặc định mang tính dữ liệu khoa học khi trường DB rỗng (`"Côn trùng trưởng thành (Adult)"`, `"Mẫu khô cắm kim (Pinned)"`, `"Rừng tự nhiên / Thảm thực vật nhiệt đới"` — `DEF-024`), tự gán `taxon_id = 1` khi import không khớp tên loài (`DEF-034`), xóa mẫu vật làm mất hoặc không orphan chuỗi DNA (`DEF-075`), và để lộ mã mẫu vật Private qua trang DNA (`DEF-089`) có thể dẫn đến đánh giá không đạt về độ tin cậy dữ liệu nghiên cứu của VAST.
3. **Rủi ro Không đạt Tiêu chí Kiểm thử & Hồ sơ Bàn giao (§5.4 & §6.4 — Mức: CAO):**
   * Yêu cầu bắt buộc của SRS §5.4 và §6.4 gồm: `docker-compose.yml` production-ready, test coverage ≥ 70%, OpenAPI 3.0 tại `/api/docs`, script backup tự động và song ngữ Việt/Anh hoàn chỉnh. Hiện tại `docker-compose.prod.yml` và `Makefile` đều rỗng 0 byte, test Frontend đang fail, coverage Backend mới đạt 44.72%, `/api/docs` trả về 404, và khi chuyển sang Tiếng Anh (`EN`) thì >95% giao diện vẫn là Tiếng Việt.
