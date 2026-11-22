# 02 — Danh sách lỗi (Giai đoạn 1: Stack · F-AU · F-DB · F-SP)

> Mỗi lỗi một mục. Bằng chứng = `file:dòng` (đường dẫn tính từ gốc repo). Ước lượng công: S (≤0.5 ngày) · M (1–3 ngày) · L (>3 ngày).
> Lỗi về i18n, CSRF, HTTPS/nginx, coverage… sẽ được bổ sung ở Bước 3–4.

## A. Lệch stack đã chốt (phát hiện ở Bước 0)

\n- **Trạng thái:** Chấp nhận thay đổi – có ADR (docs/adr/001-react-19.md) – commit `753b196`

\n- **Trạng thái:** Đã sửa – commit `765155f`

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 1: Puppeteer pdfGenerator + label.service QR + reports.service PDF/DOCX/XLSX + LabelCanvas, 6/6 integration tests PASS)

### DEF-004 · Critical · Build
- **Vi phạm:** SRS §6.5 "File storage: MinIO SDK".
- **Hiện trạng:** `backend/package.json` không có gói `minio`; `backend/src/config/minio.js:112-168` tự gửi HTTP request (kiểm `statusCode`) để tạo bucket/put object.
- **Kỳ vọng:** Dùng MinIO JS SDK.
- **Đề xuất:** Thay client tự viết bằng `minio` SDK, giữ nguyên interface `putObjectToMinio/deleteObjectFromMinio`.
- **Công:** M

### DEF-005 · Critical · Build
- **Vi phạm:** SRS §2.1, §3.3, §3.4, §6.5 (MongoDB, Elasticsearch 8, Socket.io, AI service, monorepo `packages/shared`, `infra`).
- **Hiện trạng:** `backend/package.json` không có `mongodb`/`mongoose`, `@elastic/elasticsearch`, `socket.io`; thư mục `packages/shared/*`, `infra/*` (elasticsearch, nginx, minio, geoserver, monitoring), `ai-service/*` **đều rỗng** (lệnh `Get-ChildItem -Recurse` chỉ trả về thư mục, không có file).
- **Kỳ vọng:** Có client kết nối và cấu hình hạ tầng tương ứng.
- **Đề xuất:** Lập kế hoạch bổ sung theo nhóm chức năng (chi tiết ở giai đoạn F-SR, F-AI, Bước 3).
- **Công:** L

## B. Xác thực & Bảo mật (F-AU)

\n- **Trạng thái:** Chấp nhận thay đổi – có ADR (docs/adr/002-jwt-two-token.md) – commit `bc3d47e`

\n- **Trạng thái:** Đã sửa – commit `fe291ac`

\n- **Trạng thái:** Đã sửa – commit `c0e8015`

\n- **Trạng thái:** Đã sửa – commit `ab01312`

\n- **Trạng thái:** Đã sửa – commit `8955e2c`

\n- **Trạng thái:** Đã sửa – commit `1c310fb`

\n- **Trạng thái:** Đã sửa – commit `c0e8015`

\n- **Trạng thái:** Đã sửa – commit `fe291ac`

\n- **Trạng thái:** Đã sửa – commit `2f898ed`

## C. Dashboard (F-DB)

### DEF-015 · Medium · Permission
- **Vi phạm:** F-DB-04 "3 số liệu dữ liệu mở (số loài/mẫu/tỉnh được Admin cho phép xem)".
- **Hiện trạng:** Số loài trên trang public lấy `stats.taxa.species` (`PublicHomePage.js:134,282`) được tính từ toàn bộ bảng `taxa` không lọc Public (`specimen.repository.js:843-851`). Ngoài ra có giá trị fallback hard-code: `"98.114"` (`PublicHomePage.js:265`), `3868` (`:134`), `"34 / 34"` (`:138,299`).
- **Kỳ vọng:** Đếm số loài có ít nhất 1 mẫu Public; không hiển thị số giả khi API lỗi.
- **Đề xuất:** Dùng `distinctBinomialSpecies`/COUNT DISTINCT taxon trên tập Public; thay fallback bằng skeleton/"—".
- **Công:** S
- **Trạng thái:** Đã sửa – commit `89be3cf`

### DEF-016 · Low · Data
- **Vi phạm:** F-DB-01 (số liệu realtime chính xác).
- **Hiện trạng:** `AdminDashboardPage.js:165` — `${stats?.provincesCovered || 34} / 34`: khi giá trị = 0 hiển thị sai thành 34.
- **Kỳ vọng:** Hiển thị đúng giá trị thật (kể cả 0).
- **Đề xuất:** Dùng `??` thay `||`, lấy tổng số tỉnh từ bảng `provinces`.
- **Công:** S
- **Trạng thái:** Đã sửa – commit `89be3cf`

## D. Quản lý Mẫu vật (F-SP)

### DEF-017 · High · Functional
- **Vi phạm:** F-SP-02, F-SP-04, SCR-06, SCR-07 "Form nhập đủ 22 trường".
- **Hiện trạng:** `SpecimenForm.js:7-35` khai báo state cho `commonNameEn, district, commune, gpsAccuracyM, statusId, catalogNumber, storageNumber, occurrenceRemarks` nhưng JSX (dòng 146-424) **không có input** cho các trường này → không thể nhập/sửa.
- **Kỳ vọng:** Có ô nhập cho cả 22 trường SRS.
- **Đề xuất:** Bổ sung input/select tương ứng (Trạng thái mẫu dùng `lookups.statuses`).
- **Công:** S

### DEF-018 · High · Data
- **Vi phạm:** F-SP-02/F-SP-03 trường "Người định loại".
- **Hiện trạng:** DB có `identifier_id` (`migrations/…005…js:12`) nhưng validator (`specimen.validator.js:56-93`), repository `create` (`specimen.repository.js:557-606`), `SPECIMEN_UPDATE_MAP` (`:617-636`), DTO (`specimen.service.js:19-59`) và form đều không xử lý. Tương tự `collector_id` (`:11`) không dùng — người thu lưu dạng text `recorded_by`.
- **Kỳ vọng:** Nhập/hiển thị/xuất được Người định loại.
- **Đề xuất:** Thêm trường `identifiedBy` (text hoặc FK `collectors`) xuyên suốt API–form–detail–export.
- **Công:** M

### DEF-019 · Medium · Functional
- **Vi phạm:** F-SP-02/F-SP-03 trường "Ngày nhập".
- **Hiện trạng:** Cột `entry_date` có (`…005…js:30`) nhưng không có trong DTO (`specimen.service.js:19-59, 61-166`) và không hiển thị ở `SpecimenDwcSections.js`.
- **Kỳ vọng:** Hiển thị Ngày nhập.
- **Đề xuất:** Map `entry_date` → `entryDate` trong DTO và UI.
- **Công:** S

### DEF-020 · Medium · Functional
- **Vi phạm:** F-SP-02 "Validation inline: báo lỗi ngay khi rời khỏi ô nhập".
- **Hiện trạng:** `SpecimenForm.js` không có handler `onBlur`/thông báo lỗi theo ô; chỉ dùng thuộc tính HTML `required` (dòng 263) và vô hiệu nút Lưu khi thiếu taxon (dòng 418); lỗi BE chỉ hiện toast tổng (`SpecimenFormPage.js:49`).
- **Kỳ vọng:** Lỗi hiển thị dưới từng ô khi blur.
- **Đề xuất:** Thêm state `errors` + `onBlur` validate theo schema dùng chung (`packages/shared/validators`).
- **Công:** M

### DEF-021 · Medium · Functional
- **Vi phạm:** SCR-06 "autocomplete tên khoa học (COL/ITIS), chọn GPS trên bản đồ, drag-and-drop ảnh, scan QR".
- **Hiện trạng:** Autocomplete chỉ gọi `taxonomyService.searchTaxa` nội bộ (`SpecimenForm.js:92-107`); không có bản đồ chọn tọa độ, vùng thả ảnh hay quét QR trong form (toàn bộ `SpecimenForm.js`).
- **Kỳ vọng:** Có đủ 4 tiện ích.
- **Đề xuất:** Gợi ý từ COL khi không có kết quả nội bộ; thêm `MapContainer` chọn điểm; dropzone ảnh gọi `/media/upload`; quét QR qua camera.
- **Công:** L

\n- **Trạng thái:** Đã sửa – commit `eb63a59`

### DEF-023 · Low · Data
- **Vi phạm:** §6.1 quy ước mã mẫu "VIN-[Tỉnh]-[Năm]-[Số thứ tự]"; F-SP-02 "tự sinh".
- **Hiện trạng:** `specimen.repository.js:559-561` sinh `VN-<năm>-<random 6 số>` — không theo quy ước, có thể trùng (UNIQUE ở `…004…js:8`) mà không retry; import dùng `VAST-IMP-…` (`:1209-1211`).
- **Kỳ vọng:** Mã theo quy ước, tuần tự, không trùng.
- **Đề xuất:** Dùng sequence theo (tỉnh, năm) để sinh mã.
- **Công:** S

\n- **Trạng thái:** Đã sửa – commit `6fa4493`

### DEF-025 · Medium · Functional
- **Vi phạm:** F-SP-03 "slideshow ảnh"; F-SP-08 "Admin download ảnh gốc độ phân giải đầy đủ".
- **Hiện trạng:** `SpecimenImageGallery.js` chỉ có thumbnail strip + lightbox (dòng 159-178), link `sourceUrl` (dòng 146); không có nút tải ảnh gốc cho Admin, không tự chạy slideshow.
- **Kỳ vọng:** Có nút download gốc (Admin) và slideshow.
- **Đề xuất:** Thêm nút tải `/api/media/:id/file?original=1` khi `isAdmin`; thêm autoplay.
- **Công:** S

### DEF-026 · High · Functional
- **Vi phạm:** F-SP-05, SCR-07 "Admin có thể khôi phục bản ghi đã xóa trong vòng 30 ngày".
- **Hiện trạng:** `specimen.routes.js:36-42` không có route khôi phục / liệt kê bản ghi đã xóa; `specimen.repository.js:731-740` chỉ set `deleted_at`; không có job dọn bản ghi >30 ngày; FE không có màn "Thùng rác".
- **Kỳ vọng:** `GET /specimens/trash`, `POST /specimens/:id/restore` (≤30 ngày) + audit log.
- **Đề xuất:** Thêm 2 endpoint + UI; kiểm `deleted_at > now() - interval '30 days'`.
- **Công:** M

\n- **Trạng thái:** Đã sửa – commit `69593aa`

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 2: bulkImportJob.service.js + Socket.io JWT Admin room + sharp 200x200 thumbnail/EXIF strip/magic bytes, 4/4 integration tests PASS)

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 2: bulkImportJob.service.js + Socket.io JWT Admin room + sharp 200x200 thumbnail/EXIF strip/magic bytes, 4/4 integration tests PASS)

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 2: bulkImportJob.service.js + Socket.io JWT Admin room + sharp 200x200 thumbnail/EXIF strip/magic bytes, 4/4 integration tests PASS)

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 2: bulkImportJob.service.js + Socket.io JWT Admin room + sharp 200x200 thumbnail/EXIF strip/magic bytes, 4/4 integration tests PASS)

### DEF-032 · Low · Performance
- **Vi phạm:** F-SP-06 (4) "Preview 20 dòng đầu".
- **Hiện trạng:** `SpecimenBatchPages.js:360` render toàn bộ `parsedRows` (tới 5.000 dòng).
- **Kỳ vọng:** Preview 20 dòng + tổng hợp lỗi.
- **Đề xuất:** `parsedRows.slice(0, 20)` + bảng thống kê lỗi theo cột.
- **Công:** S

\n- **Trạng thái:** Đã sửa – commit `1b774bb`, `de3aaa9`

\n- **Trạng thái:** Đã sửa – commit `bd8fd3e`

\n- **Trạng thái:** Đã sửa – commit `6f95733`

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 2: bulkImportJob.service.js + Socket.io JWT Admin room + sharp 200x200 thumbnail/EXIF strip/magic bytes, 4/4 integration tests PASS)

### DEF-037 · High · Functional
- **Vi phạm:** F-SP-07 "Xem preview số bản ghi sẽ bị ảnh hưởng → Xác nhận áp dụng. Ghi audit log cho từng bản ghi".
- **Hiện trạng:** `SpecimenBatchPages.js:481-502` áp dụng ngay khi bấm, không có bước preview/xác nhận; `specimen.repository.js:1140` chỉ ghi lịch sử cho `specimenIds.slice(0, 200)` và `old_value = "Batch Edit"` (`:1144`) — mất giá trị cũ.
- **Kỳ vọng:** Preview + ConfirmDialog; lịch sử đầy đủ cũ→mới cho mọi bản ghi.
- **Đề xuất:** Đọc giá trị cũ trước khi update, insert lịch sử cho tất cả id; thêm bước xác nhận.
- **Công:** M

\n- **Trạng thái:** Đã sửa – commit `6b662cf`

### DEF-039 · Medium · Functional
- **Vi phạm:** SCR-05 "checkbox chọn lô để batch edit hoặc xuất"; SCR-10.
- **Hiện trạng:** Checkbox ở `SpecimenListPage.js:726-761` chỉ dùng cho toggle Public (`:664-690`); link Batch Edit không truyền id (`:331`); xuất không dùng `selectedIds` (`:239-248`). Trang Batch Edit chỉ chọn trong 25 bản ghi của 1 trang (`SpecimenBatchPages.js:433`), không phân trang.
- **Kỳ vọng:** Chọn ở SCR-05 → batch edit/xuất đúng tập chọn.
- **Đề xuất:** Truyền `ids` qua state/query; export hỗ trợ `ids[]`.
- **Công:** S

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 2: bulkImportJob.service.js + Socket.io JWT Admin room + sharp 200x200 thumbnail/EXIF strip/magic bytes, 4/4 integration tests PASS)

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 2: bulkImportJob.service.js + Socket.io JWT Admin room + sharp 200x200 thumbnail/EXIF strip/magic bytes, 4/4 integration tests PASS)

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 1: Puppeteer pdfGenerator + label.service QR + reports.service PDF/DOCX/XLSX + LabelCanvas, 6/6 integration tests PASS)

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 1: Puppeteer pdfGenerator + label.service QR + reports.service PDF/DOCX/XLSX + LabelCanvas, 6/6 integration tests PASS)

### DEF-044 · Medium · Functional
- **Vi phạm:** F-SP-10 "file Excel mẫu chuẩn 22 cột, header Việt + Anh, ghi chú định dạng, phiên bản trong tên file".
- **Hiện trạng:** `SpecimenBatchPages.js:174-180` sinh `.csv` tên `vietinsect-import-template-22cols-dwc.csv` (không có phiên bản); header chỉ tiếng Anh (`:24-47`); không có hàng ghi chú định dạng; danh sách cột khác 22 trường SRS (thiếu Tên thường EN, Người định loại, Sinh cảnh, Giai đoạn, Trạng thái mẫu, Số hiệu lưu trữ).
- **Kỳ vọng:** `.xlsx` song ngữ, có hướng dẫn, ví dụ, phiên bản.
- **Đề xuất:** Sinh template phía server bằng `exceljs`, ví dụ `VietInsect_Template_v1.0.xlsx`.
- **Công:** S

### DEF-045 · High · Functional
- **Vi phạm:** F-SP-11 "Xuất toàn bộ hoặc kết quả đang lọc (không giới hạn số bản ghi) … Excel/CSV"; §5.1 (background job).
- **Hiện trạng:** `dwcaExport.service.js:15` `MAX_EXPORT_ROWS = 10000`, `:62` mặc định 5.000; FE không truyền `maxRows` (`SpecimenListPage.js:239-248`) → luôn cắt ở 5.000; xử lý đồng bộ (`specimen.controller.js:158-184`); không có định dạng CSV (`dwcaExport.service.js:457-465`).
- **Kỳ vọng:** Không giới hạn, chạy nền, có CSV.
- **Đề xuất:** Stream theo cursor/batch, job nền + email khi xong; thêm `format=csv`.
- **Công:** M

### DEF-046 · Medium · Permission
- **Vi phạm:** F-SP-11 / §2.3 "Admin: Xuất toàn bộ dữ liệu".
- **Hiện trạng:** `dwcaExport.service.js:64-67` chỉ bao gồm Private khi `includePrivate=true`; FE không bao giờ gửi tham số này (`SpecimenListPage.js:239-248`) → Admin xuất ra thiếu bản ghi Private mà không được báo.
- **Kỳ vọng:** Admin xuất được toàn bộ (hoặc có tùy chọn rõ ràng trên UI).
- **Đề xuất:** Thêm checkbox "Bao gồm Private" cho Admin (mặc định theo bộ lọc `isPublic`).
- **Công:** S

### DEF-047 · Medium · Data
- **Vi phạm:** F-SP-11 "Excel/CSV (22 trường đầy đủ)".
- **Hiện trạng:** `dwcaExport.service.js:354-377` không có cột Người định loại, Ngày nhập; gộp "Số hiệu lưu trữ / Ghi chú" vào 1 cột (`:376, 404`).
- **Kỳ vọng:** 22 cột tách biệt khớp F-SP-02.
- **Đề xuất:** Tách cột, bổ sung trường thiếu.
- **Công:** S

### DEF-048 · Medium · Functional
- **Vi phạm:** F-SP-01, SCR-05 "Chọn cột … lưu cấu hình theo session. Sắp xếp đa cột. Phân trang 50 dòng/trang với điều hướng nhanh".
- **Hiện trạng:** Mặc định 25 dòng (`specimen.constants.js:21`, `SpecimenListPage.js:40`); cột tùy chọn chỉ 3 và giữ trong `useState` (`:58-62`) — mất khi tải lại; `sortBy` đơn (`specimen.validator.js:34-35`, `specimen.repository.js:223-225`); chỉ nút Trước/Sau (`SpecimenListPage.js:941-959`).
- **Kỳ vọng:** 50 dòng mặc định, lưu `sessionStorage`, multi-sort, nhảy trang nhanh.
- **Đề xuất:** Đổi default 50; lưu cấu hình cột vào `sessionStorage`; hỗ trợ `sort=a:asc,b:desc`; thêm ô nhập số trang.
- **Công:** M

### DEF-049 · Medium · Functional
- **Vi phạm:** F-SP-04 "Xem timeline lịch sử", F-SP-12 "toàn bộ lịch sử … Có thể lọc theo khoảng thời gian".
- **Hiện trạng:** `specimen.repository.js:420` `.limit(30)`; `SpecimenAuditTimeline.js:4-55` không có bộ lọc ngày.
- **Kỳ vọng:** Toàn bộ lịch sử (phân trang) + lọc khoảng thời gian.
- **Đề xuất:** Endpoint `GET /specimens/:id/history?from&to&page`.
- **Công:** S

### DEF-050 · Low · Data
- **Vi phạm:** F-SP-04 tracked changes chính xác; §5.5 ngày tháng.
- **Hiện trạng:** `specimen.repository.js:665-667` so sánh `collection_date` bằng `prevVal.toISOString().slice(0,10)` — với server UTC+7, DATE trả về 00:00 local sẽ thành ngày hôm trước ở UTC → ghi lịch sử sai/ghi thừa. Trong khi `specimen.service.js:7-17` dùng giờ local. **CẦN XÁC MINH** (phụ thuộc type parser `pg` và TZ máy chủ).
- **Kỳ vọng:** So sánh chuỗi `YYYY-MM-DD` nhất quán.
- **Đề xuất:** Dùng chung `formatDateOnly` hoặc cấu hình `pg.types.setTypeParser(1082, v => v)`.
- **Công:** S

### DEF-051 · Medium · Permission
- **Vi phạm:** §2.3 (User chỉ xem Public), F-SP-01/F-SP-03 (User view).
- **Hiện trạng:** `frontend/src/services/http.js:13-18` gắn Bearer token cho **mọi** request, kể cả trang public; `auth.middleware.js:38-53` (`optionalAdmin`) cấp quyền admin theo token, không theo ngữ cảnh → Admin đã đăng nhập mở `/specimens/search` hoặc `/specimens/:id` sẽ thấy cả bản ghi Private trên giao diện "công khai" (UI dùng `useIsAdminContext` theo URL, `hooks/useIsAdminContext.js`), dễ gây chia sẻ nhầm/preview sai.
- **Kỳ vọng:** Trang public luôn hiển thị đúng dữ liệu User thấy.
- **Đề xuất:** Không gửi token trên route public (hoặc gửi header `X-View-As: public`) và BE tôn trọng.
- **Công:** S
- **Trạng thái:** Đã sửa – commit `14b9d12`

## E. Phân loại học & Hồ sơ loài (F-TX)

### DEF-052 · Medium · Functional
- **Vi phạm:** F-TX-01, SCR-12 "Tìm kiếm nhanh tên bậc phân loại với highlight kết quả. Nhấn nút để xem danh sách mẫu thuộc bậc đó".
- **Hiện trạng:** `TaxonomyTreeView.js:99-123` chỉ hiển thị dropdown gợi ý và khi bấm chỉ gọi `onSelectNode(node)` mà không tự mở các nhánh cha nếu node thuộc Genus/Species chưa lazy-load, không highlight trên cây; `TaxonomyTreePage.js:88-96` chỉ hiện nút xem hồ sơ loài cho `Species`/`Subspecies`, còn các bậc `Kingdom` → `Genus` không có nút mở danh sách mẫu vật thuộc bậc đó.
- **Kỳ vọng:** Tự mở nhánh & highlight kết quả trên cây; mọi bậc đều có nút xem danh sách mẫu vật (`/specimens/search?taxonId=...`).
- **Đề xuất:** Trả về chuỗi ancestor IDs khi search taxon để tự expand; thêm nút "Xem mẫu vật thuộc bậc này" trong `TaxonomyTreePage.js:84-97`.
- **Công:** S

### DEF-053 · High · Functional
- **Vi phạm:** F-TX-02, SCR-14 "Xác thực tên khoa học trực tiếp qua Catalogue of Life API và ITIS trước khi lưu. Hiển thị kết quả so khớp và đề xuất sửa chính tả".
- **Hiện trạng:** `catalogueOfLife.service.js:11-30` chỉ gọi COL API, không tích hợp ITIS API; `taxonomy.service.js:196-217` (`updateTaxon`) không gọi xác thực COL; `TaxonEditorPage.js:50-54` chỉ hiện toast cảnh báo, không hiển thị danh sách `colSuggestions` để chọn sửa chính tả; `TaxonForm.js:29-31,102-113` xóa trắng và ẩn `colId/itisTsn/gbifTaxonKey` khi ở chế độ sửa; `TaxonEditorPage.js:33,36` dùng `fetchTree()` (chỉ tải Kingdom→Family) nên danh sách bên trái không có 114k+ Genus/Species để sửa/xóa; `taxonomy.controller.js:44-87` không gọi `logAudit`.
- **Kỳ vọng:** Xác thực cả COL và ITIS trước khi lưu (create + update), hiển thị danh sách gợi ý so khớp trên UI, tìm kiếm/chỉnh sửa được mọi bậc taxon và ghi Audit Log.
- **Đề xuất:** Thêm endpoint `/taxonomy/verify-name` (COL + ITIS) + bảng gợi ý trong `TaxonForm`; dùng server-side search cho danh sách taxon ở `TaxonEditorPage`; bổ sung `logAudit`.
- **Công:** M

### DEF-054 · High · Functional
- **Vi phạm:** F-TX-03 "Khi tìm kiếm theo synonym hệ thống tự động điều hướng sang accepted name kèm thông báo. Hiển thị cả hai trong kết quả tìm kiếm".
- **Hiện trạng:** `taxonomy.service.js:160-164,260-292` và `specimen.repository.js:55-98` hoàn toàn không xử lý `taxonomic_status === 'synonym'` hay `accepted_taxon_id`. Truy cập `/species/:slug` của một synonym không điều hướng sang accepted name; tìm kiếm mẫu vật theo tên synonym không trả về mẫu vật của accepted name và không hiển thị thông báo đồng danh pháp.
- **Kỳ vọng:** Tự động điều hướng sang accepted name kèm banner thông báo; tìm kiếm hiển thị cả synonym và accepted name.
- **Đề xuất:** Trong `getSpeciesProfile` và `findMany`, nếu taxon là synonym (`accepted_taxon_id != null`) thì resolve sang accepted taxon, trả kèm `synonymRedirectFrom` để FE điều hướng + hiện thông báo.
- **Công:** M

### DEF-055 · Medium · Functional
- **Vi phạm:** F-TX-04 "Import danh lục từ file Excel/CSV theo template chuẩn".
- **Hiện trạng:** `ImportChecklistPanel.js:37` cho phép chọn `.xlsx,.csv`, nhưng `taxonomy.service.js:353-354` luôn gọi `workbook.xlsx.load(fileBuffer)` — với file `.csv` sẽ ném lỗi Zip/XLSX parse; ngoài ra không có nút tải file template mẫu trên giao diện.
- **Kỳ vọng:** Import được cả `.xlsx` và `.csv`, có nút tải template chuẩn.
- **Đề xuất:** Kiểm tra định dạng/magic bytes để gọi `workbook.csv.read` khi là CSV; thêm nút tải template 3 cột.
- **Công:** S

### DEF-056 · High · Functional
- **Vi phạm:** F-TX-05, SCR-13 "5 tab: (1) Hình thái & Sinh thái — 22 trường dạng lưới 2 cột Việt/Anh; (2) Mẫu vật — danh sách phân trang 50 dòng ... Panel phải: widget AI nhận dạng ảnh + widget SDM".
- **Hiện trạng:** `SpeciesProfileTabs.js:127-163` Tab 1 chỉ có bảng 6 dòng (tên khoa học, bậc, tên thường, trạng thái, IUCN, tổng mẫu) thay vì lưới 22 trường song ngữ Việt/Anh; Tab 2 (`:50`) chỉ gọi `limit: 25` và không có thanh phân trang 50 dòng; `SpeciesProfilePage.js:189-191` **không có Panel phải chứa widget AI nhận dạng ảnh + widget SDM**; nút "Sửa hồ sơ loài" (`:180`) chỉ chuyển sang `/admin/taxonomy/editor` mà không có form gọi `upsertSpeciesProfile` (`frontend/src/modules/taxonomy/taxonomy.service.js:52-55` là dead code).
- **Kỳ vọng:** Tab 1 đủ 22 trường lưới 2 cột Việt/Anh + form chỉnh sửa cho Admin; Tab 2 phân trang 50 dòng/trang; có Panel phải tích hợp widget AI & SDM.
- **Đề xuất:** Mở rộng `SpeciesProfileTabs` (22 trường + pagination 50 dòng + modal sửa profile) và thêm cột phải chứa widget AI/SDM trong `SpeciesProfilePage`.
- **Công:** M

### DEF-057 · Medium · Functional
- **Vi phạm:** F-TX-06, SCR-13 "Tự động sinh hyperlink sang 5 nguồn quốc tế cho từng loài: GBIF Species page, BOLD TaxID, ITIS TSN, Catalogue of Life, IUCN Red List".
- **Hiện trạng:** `taxonomy.service.js:13-21` và `ExternalLinkBadges.js:26-34` chỉ hỗ trợ 4 nguồn (`gbif`, `itis`, `catalogueOfLife`, `iucnRedList`), **bỏ hẳn nguồn BOLD TaxID** khỏi header hồ sơ loài; đồng thời nếu các cột `gbif_taxon_key`, `itis_tsn`, `col_id` đang NULL thì không tự sinh link tra cứu theo tên khoa học nên hầu hết loài không hiển thị đủ 5 liên kết.
- **Kỳ vọng:** Luôn sinh đủ 5 hyperlink quốc tế (GBIF, BOLD, ITIS, COL, IUCN) cho từng loài.
- **Đề xuất:** Bổ sung `bold` vào `toExternalLinks` và `LINK_LABELS`; fallback sang URL tìm kiếm theo `scientific_name` khi mã ID chuyên biệt chưa có.
- **Công:** S

### DEF-058 · High · Functional
- **Vi phạm:** F-TX-07 "Thêm/sửa/xóa mô tả hoạt tính sinh học và hóa học cho từng loài ... Upload hình ảnh kết quả thử nghiệm. Gắn tài liệu tham khảo DOI/tên bài báo".
- **Hiện trạng:** BE (`taxonomy.routes.js:36-37`) chỉ có POST và DELETE, thiếu PUT/PATCH để sửa hoạt tính và không xử lý upload file ảnh lên MinIO; FE (`SpeciesProfileTabs.js:331-359`) chỉ hiển thị danh sách chỉ-đọc (không hiển thị ảnh `imageObjectKey`), **hoàn toàn không có nút/form Thêm, Sửa, Xóa hoạt tính** (2 hàm `addBioactivity`, `removeBioactivity` trong `frontend/src/modules/taxonomy/taxonomy.service.js:57-64` không được gọi ở đâu).
- **Kỳ vọng:** Admin thêm/sửa/xóa được hoạt tính sinh/hóa học kèm upload ảnh kết quả thử nghiệm ngay trên Tab Hoạt tính.
- **Đề xuất:** Thêm `PUT /api/taxonomy/bioactivity/:bioactivityId` + upload ảnh MinIO; bổ sung form CRUD + hiển thị ảnh trong Tab 4 của `SpeciesProfileTabs.js`.
- **Công:** M

## F. Tìm kiếm & Khai thác dữ liệu (F-SR)

\n- **Trạng thái:** Đã sửa (ES 8 + analysis-icu + sync + GET /api/search/specimens) – commit `2154d95`

\n- **Trạng thái:** Đã sửa (8 facet GBIF disjunctive + elevation_m C-11) – commit `45594ae`

### DEF-061 · High · Functional
- **Vi phạm:** F-SR-03, SCR-15 "Chuyển đổi liền mạch giữa 5 chế độ: (1) List view; (2) Label view; (3) Gallery view; (4) Map view; (5) Treemap view. Trạng thái chế độ xem và bộ lọc được lưu trong URL query params".
- **Hiện trạng:** `SpecimenListPage.js:722-914` chỉ hiển thị duy nhất bảng List view; không có thanh chuyển đổi sang Label view, Gallery view, Map view, Treemap view. Dòng 120-127 chỉ lưu 3 tham số (`q`, `order`, `provinceId`) lên URL query params, bỏ sót các bộ lọc khác và `viewMode`.
- **Kỳ vọng:** Có ViewSwitcher chuyển đổi liền mạch 5 chế độ xem trên cùng tập kết quả lọc và đồng bộ toàn bộ filter + `view` vào URL query params.
- **Đề xuất:** Thêm state `viewMode` (`list|label|gallery|map|treemap`) vào `SpecimenListPage.js` và đồng bộ đầy đủ params qua `useSearchParams`.
- **Công:** M
- **Trạng thái:** Đã sửa – commit `3296ea8` (Sprint C – Nhóm 2: SCR-15 Search Workbench tại `/search/advanced` & `/admin/search/advanced` với 8 facet, 5 chế độ hiển thị, URL query sync, debounce 300ms, banner 503 khi ES down, 5/5 Jest component tests PASS).

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 3: SCR-16 QueryBuilderPage + advancedSearch.service.js AND/OR/NOT/between + saved_filters + Admin Read-Only SQL mode)

### DEF-063 · High · Functional
- **Vi phạm:** F-SR-05, SCR-18 "Vẽ polygon tự do hoặc hình chữ nhật trên bản đồ (leaflet-draw) để lọc tất cả mẫu vật có tọa độ GPS nằm trong vùng đó. Hiện số lượng mẫu trong vùng realtime khi điều chỉnh polygon".
- **Hiện trạng:** `frontend/package.json` không có `leaflet-draw`; `OccurrenceMapPage.js:292-315` và `specimen.repository.js:100-120` chỉ hỗ trợ tìm theo bán kính hình tròn (`ST_DWithin`) hoặc bbox 4 cạnh, không thể vẽ polygon trên bản đồ.
- **Kỳ vọng:** Công cụ vẽ polygon/rectangle trên bản đồ SCR-18, gọi PostGIS `ST_Within`/`ST_Intersects(s.collection_point::geometry, ST_GeomFromGeoJSON(?))` và cập nhật số mẫu realtime.
- **Đề xuất:** Tích hợp `leaflet-draw` trên `OccurrenceMapPage.js` và thêm tham số `polygon` (GeoJSON/WKT) vào `/api/specimens/map` & `/api/specimens`.
- **Công:** M

### DEF-064 · Medium · Functional
- **Vi phạm:** F-SR-06, §5.1 "Xuất toàn bộ kết quả hiện tại (không giới hạn số bản ghi, xử lý background) ... Gửi email thông báo khi file xuất lớn đã sẵn sàng tải về".
- **Hiện trạng:** Xuất đồng bộ trực tiếp trong HTTP request, giới hạn 5.000/10.000 dòng (`dwcaExport.service.js:15,62`); không có hàng đợi background job và không có module gửi email SMTP (`nodemailer` chưa có trong `backend/package.json`).
- **Kỳ vọng:** Job xuất chạy nền, lưu file lên MinIO và gửi email kèm link tải khi hoàn tất.
- **Đề xuất:** Thêm queue xuất dữ liệu + `nodemailer` đọc cấu hình SMTP từ `system_config` để gửi thông báo.
- **Công:** M

### DEF-065 · Low · Functional
- **Vi phạm:** F-SR-07, SCR-17 "Lọc theo taxon/tỉnh/năm ... Admin download ảnh gốc độ phân giải đầy đủ".
- **Hiện trạng:** `MediaGalleryPage.js:18-27,234-288` chỉ có ô lọc từ khóa, Bộ, Tỉnh, Giấy phép — **thiếu ô lọc theo Năm thu mẫu** (dù BE `media.repository.js:33-38` đã hỗ trợ `filters.year`); trong Lightbox (`MediaGalleryPage.js:518-536`) không có nút "Tải ảnh gốc" cho Admin.
- **Kỳ vọng:** Có dropdown/input lọc Năm trên SCR-17 và nút download ảnh gốc cho Admin.
- **Đề xuất:** Thêm trường `year` vào `filters` trong `MediaGalleryPage.js` và nút `<a href={lightboxItem.url} download>` khi `isAdmin`.
- **Công:** S

## G. GIS & Bản đồ (F-GI)

### DEF-066 · Medium · Functional
- **Vi phạm:** F-GI-01 "Nhấn điểm mở popup thông tin nhanh: tên khoa học, địa điểm, ngày thu, ảnh thumbnail ... Cluster tự động khi zoom out".
- **Hiện trạng:** `OccurrenceMapPage.js:374-393` popup chỉ có tên khoa học, tỉnh, ngày thu, nguồn — **không có ảnh thumbnail** (BE `findMapData` tại `specimen.repository.js:288-314` cũng chưa lấy thumbnail); ở chế độ Điểm thu mẫu, khi zoom out các điểm không tự động gom cụm (marker clustering) mà người dùng phải bấm chuyển tab thủ công.
- **Kỳ vọng:** Popup hiển thị thumbnail mẫu vật; tự động gom cụm điểm theo mức zoom.
- **Đề xuất:** Bổ sung `thumbnail_image_id` vào query `findMapData` để hiển thị ảnh trong popup; tự động bật/tắt lớp cluster theo sự kiện `zoomend` của Leaflet.
- **Công:** M

### DEF-067 · Medium · Functional
- **Vi phạm:** F-GI-02 "Lớp nhiệt (leaflet-heat plugin) thể hiện mật độ mẫu vật ... Toggle bật/tắt không làm mất bộ lọc đang áp dụng".
- **Hiện trạng:** `frontend/package.json` không có `leaflet.heat`; `OccurrenceMapPage.js:317-335` vẽ các chấm tròn rời rạc `L.circleMarker` cho từng ô lưới 0.25° thay vì bề mặt nhiệt liên tục, và khi bật chế độ `heatmap` thì xóa mất lớp điểm mẫu vật thay vì cho phép bật/tắt lớp nhiệt độc lập.
- **Kỳ vọng:** Dùng `leaflet.heat` (hoặc canvas heatmap) làm lớp overlay bật/tắt độc lập.
- **Đề xuất:** Thêm `leaflet.heat` và tách Heatmap thành checkbox toggle overlay riêng biệt với lớp điểm.
- **Công:** S

### DEF-068 · High · Functional
- **Vi phạm:** F-GI-03, SCR-18, §2.4, §3.3 "Chuyển đổi realtime giữa 3 [4] lớp nền: Google Maps, Google Satellite/Hybrid, OpenStreetMap, Bản đồ hành chính VN (Cục Đo đạc)".
- **Hiện trạng:** `OccurrenceMapPage.js:21-46` sử dụng 4 lớp nền của Esri ArcGIS (`World_Street_Map`, `World_Topo_Map`, `World_Imagery`, `World_Light_Gray_Base`). **Không có Google Maps, không có OpenStreetMap (`tile.openstreetmap.org`), và không có lớp Bản đồ hành chính Việt Nam từ Cục Đo đạc Bản đồ**.
- **Kỳ vọng:** Có đủ 4 lớp nền theo SRS: Google Maps, Google Satellite/Hybrid (dùng API key cấu hình ở SCR-30, fallback OSM khi chưa có key), OpenStreetMap và Bản đồ hành chính VN.
- **Đề xuất:** Cấu hình danh sách `BASEMAPS` gồm OSM, Google Roadmap/Hybrid (đọc key từ config) và lớp WMS/GeoJSON ranh giới hành chính Cục Đo đạc VN.
- **Công:** M

### DEF-069 · High · Functional
- **Vi phạm:** F-GI-04, SCR-19 "Admin upload các lớp dữ liệu không gian: Shapefile (.zip), GeoJSON (point/polygon/polyline), GeoTIFF raster (sinh cảnh, độ cao DEM, biến đổi khí hậu). Đặt tên, màu sắc style cho từng lớp. Sắp xếp thứ tự hiển thị. Bật/tắt lớp. Admin quyết định lớp nào User được xem".
- **Hiện trạng:** Bảng DB `map_layers` và `map_layer_features` (`008_create_gis_tables.js:17-39`) đã tạo nhưng **backend hoàn toàn không có route/controller/service nào cho `map_layers`**. Trên FE, `LayerManagerPage` (`GisAndAiPages.js:59-330`) chỉ đọc file `.geojson` cục bộ bằng `FileReader`, chỉ lọc lấy `Point` (`:90` `f.geometry?.type === "Point"` — **bỏ qua hoàn toàn Polygon và LineString**), không lưu vào DB nên F5 mất sạch; **không hỗ trợ Shapefile (.zip) và GeoTIFF**; **không đặt tên lớp, không sắp xếp thứ tự hiển thị (`display_order`), không có nút bật/tắt `is_visible_to_user`**.
- **Kỳ vọng:** Hệ thống CRUD đầy đủ cho `map_layers` lưu vào PostGIS/MinIO, hỗ trợ Shapefile/GeoJSON (Point/Polygon/LineString)/GeoTIFF, reorder lớp và phân quyền hiển thị cho User trên SCR-18.
- **Đề xuất:** Xây dựng module backend `gis` (`/api/gis/layers`) lưu vector vào `map_layer_features` và raster vào MinIO; cập nhật `LayerManagerPage` dùng `L.geoJSON` render mọi hình học, hỗ trợ reorder và toggle `isVisibleToUser`.
- **Công:** L

### DEF-070 · Medium · Functional
- **Vi phạm:** F-GI-05, SCR-19 "Xuất snapshot bản đồ hiện tại (bao gồm các lớp đang bật, bộ lọc đang áp dụng) ra PDF A4/A3 có legend, thanh tỷ lệ, tiêu đề và thông tin ngày xuất. Định dạng PNG độ phân giải 300 DPI".
- **Hiện trạng:** `OccurrenceMapPage.js:436-438` chỉ gọi `window.print()`, còn `LayerManagerPage` (`GisAndAiPages.js:59-330`) thậm chí không có nút xuất bản đồ; không có chọn khổ A4/A3, không có thanh tỷ lệ (`L.control.scale`), không xuất được file PNG 300 DPI.
- **Kỳ vọng:** Xuất PDF A4/A3 có đủ tiêu đề/legend/thanh tỷ lệ/ngày xuất và xuất ảnh PNG 300 DPI.
- **Đề xuất:** Thêm `L.control.scale().addTo(map)`; dùng Puppeteer phía server (hoặc canvas export ở 300 DPI) để kết xuất PDF A4/A3 và PNG.
- **Công:** M

### DEF-071 · High · Functional
- **Vi phạm:** F-GI-06 "Công cụ PostGIS tính toán và hiển thị choropleth map: mỗi tỉnh/huyện được tô màu theo số loài ghi nhận (species richness). Xác định vùng có loài đặc hữu và loài quý hiếm (IUCN NT/VU/EN/CR). Kết quả có thể xuất ra shapefile".
- **Hiện trạng:** `specimen.repository.js:986-1002` mới tính số loài theo tỉnh và `AnalyticsDashboardPage.js:395-415` chỉ vẽ biểu đồ cột ngang (`BarChart`); **không có bản đồ choropleth tô màu ranh giới tỉnh/huyện trên bản đồ**, **không lọc/xác định vùng tập trung loài đặc hữu và loài quý hiếm (IUCN NT/VU/EN/CR)**, và **không có chức năng xuất kết quả ra Shapefile**.
- **Kỳ vọng:** Hiển thị bản đồ Choropleth tô màu đa giác tỉnh/huyện theo số loài & số loài nguy cấp IUCN, cho phép tải về Shapefile.
- **Đề xuất:** Bổ sung chỉ số `threatened_species_count` (`iucn_status IN ('NT','VU','EN','CR')`) + geometry tỉnh từ PostGIS để vẽ lớp `L.geoJSON` choropleth và endpoint xuất Shapefile (.zip).
- **Công:** L

## H. Dữ liệu DNA & GenBank (F-DN)

### DEF-072 · Low · Functional
- **Vi phạm:** F-DN-01 "Lọc theo loài, gen marker (COI, 16S rRNA, ITS2, 28S, CYTB), năm đăng, trạng thái Public/Private".
- **Hiện trạng:** `dna.validator.js:12-27`, `dna.repository.js:12-83` và `DnaListPage.js:20-31,288-375` không có bộ lọc theo **năm đăng** (`submission_date`).
- **Kỳ vọng:** Lọc được danh sách chuỗi DNA theo năm đăng.
- **Đề xuất:** Thêm tham số `year` vào `listDnaQuerySchema`, `dna.repository.js` (`EXTRACT(YEAR FROM d.submission_date) = ?`) và dropdown năm trên `DnaListPage.js`.
- **Công:** S

### DEF-073 · High · Functional
- **Vi phạm:** F-DN-02, SCR-21, §3.3 "validation regex: `/^[A-Z]{1,2}\d{5,8}\.\d+$/` ... hệ thống tự động gọi NCBI E-utilities (esearch + efetch) lấy metadata: tên loài, độ dài trình tự (bp), ngày đăng, tên tác giả, abstract".
- **Hiện trạng:** (1) `dna.constants.js:25` và `frontend/src/modules/dna/dna.service.js:4` đặt regex `/^[A-Z]{1,2}_?\d{5,8}(\.\d+)?$/i` — cho phép **không có phần `.version`** (khác regex bắt buộc `.\d+` của SRS); (2) `ncbi.service.js:97-113` **không gọi NCBI E-utilities (`eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi` + `efetch.fcgi`)** và cũng **không sử dụng `ncbi_api_key`** đã cấu hình trong `system_config` (`system.service.js:36`), mà gọi thẳng `https://getentry.ddbj.nig.ac.jp/getentry/na/...` sau khi cắt bỏ hậu tố `.version` (`:99` `.split(".")[0]`); (3) `parseGenBankFlatEntry` (`:35-92`) **không trích xuất trường `abstract`**; (4) `dna.controller.js:70-108` không ghi `logAudit` khi thêm/sửa/xóa/toggle DNA.
- **Kỳ vọng:** Regex khớp chuẩn SRS `/^[A-Z]{1,2}\d{5,8}\.\d+$/`; gọi NCBI E-utilities (`esearch` + `efetch`) kèm `ncbi_api_key` từ `system_config`, lấy cả `abstract`; ghi Audit Log cho mọi thao tác CRUD DNA.
- **Đề xuất:** Chuẩn hóa regex; cập nhật `ncbi.service.js` gọi NCBI E-utilities với `getDecryptedSecret("ncbi_api_key")` (có thể giữ DDBJ làm fallback), parse thêm `abstract`/`JOURNAL`, và gọi `logAudit` trong `dna.controller.js`.
- **Công:** M

### DEF-074 · Low · Functional
- **Vi phạm:** F-DN-03 "Sinh hyperlink sang `https://boldsystems.org/index.php/Taxbrowser_Taxonpage?taxid=[ID]`. Hiển thị badge BOLD màu xanh tại trang chi tiết mẫu và hồ sơ loài".
- **Hiện trạng:** `dna.service.js:106` sinh link `https://portal.boldsystems.org/record/${encodeURIComponent(row.bold_process_id)}` (được dùng ở `DnaListPage.js:533` và `DnaFastaDetailPage.js:320`), không khớp mẫu URL quy định trong F-DN-03; ngoài ra header trang Hồ sơ loài (`SpeciesProfilePage.js:147-150`) chưa hiển thị badge BOLD màu xanh.
- **Kỳ vọng:** Thống nhất URL BOLD theo đúng đặc tả F-DN-03 và hiển thị badge BOLD màu xanh ở cả trang chi tiết mẫu và hồ sơ loài.
- **Đề xuất:** Cập nhật `buildExternalLinks` trong `dna.service.js:106` và hiển thị badge BOLD trên `SpeciesProfilePage.js`.
- **Công:** S

\n- **Trạng thái:** Đã sửa – commit `a942edc`

## I. AI & Phân tích mô hình (F-AI)

### DEF-076 · Critical · Functional
- **Vi phạm:** F-AI-01, SCR-23, §2.1, §5.1, §6.5 "Upload ảnh côn trùng (JPG/PNG, tối đa 10 MB) → Gọi AI Service (Python FastAPI) → Model CNN EfficientNet-B4 ... Trả về top-5 loài + xác suất (%) trong < 5 giây. Admin xem kết quả, chọn xác nhận hoặc điều chỉnh và gắn vào mẫu vật đang nhập".
- **Hiện trạng:** Thư mục `ai-service/` hoàn toàn rỗng và backend Node.js không có bất kỳ route/service nào kết nối sang AI Service. Trang `AiSpeciesIdPage` (`GisAndAiPages.js:335-588`) **giả lập hoàn toàn trên trình duyệt**: (1) không kiểm tra file JPG/PNG ≤ 10MB (`:396-402`); (2) hàm `runVisualIdentification` (`:355-394`) dùng `setTimeout(..., 350)` băm chuỗi tên file + kích thước file (`seedStr`) để lấy 5 loài từ danh sách 80 loài phổ biến và gán cứng mảng xác suất `const confidences = [94.8, 86.4, 78.2, 69.5, 61.0]`; (3) **không có nút/luồng cho Admin xác nhận hoặc điều chỉnh kết quả để gắn vào mẫu vật đang nhập**.
- **Kỳ vọng:** Có cổng kết nối Node.js (`/api/ai/identify`, validate JPG/PNG ≤ 10MB, timeout/queue) gọi sang container FastAPI (EfficientNet-B4) và cho phép Admin xác nhận gắn `taxonId` vào hồ sơ mẫu vật.
- **Đề xuất:** Xây dựng module gateway `/api/ai/identify` ở backend + FastAPI inference service trong `ai-service/`; bổ sung nút "Xác nhận & Gắn vào mẫu vật" trên `AiSpeciesIdPage` và trong `SpecimenForm`.
- **Công:** L

### DEF-077 · Critical · Functional
- **Vi phạm:** F-AI-02, SCR-24, §6.5 "Giao diện chọn loài + tích hợp các lớp biến khí hậu (WorldClim 2.1: 19 biến BIO, CHELSA v2) → Gửi yêu cầu sang AI Service → Chạy mô hình MaxEnt → Xuất bản đồ phân bố tiềm năng dạng raster GeoTIFF + PNG preview ... Cho phép download kết quả".
- **Hiện trạng:** Trang `SdmPredictionPage` (`GisAndAiPages.js:593-828`) **giả lập hoàn toàn trên trình duyệt**: (1) chỉ có 4 biến BIO + DEM (`BIOCLIM_VARS` dòng 593-599) thay vì 19 biến BIO WorldClim 2.1 và CHELSA v2 (bấm chọn biến cũng không ảnh hưởng gì tới kết quả tính toán ở dòng 640-662); (2) không gọi backend hay AI Service chạy MaxEnt mà tự tính `suitability = Math.min(0.98, Math.max(0.28, 0.35 + ratio * 0.62))` từ số điểm mẫu của tỉnh, dịch chuyển vĩ độ `+0.25/+0.52` và hard-code `AUC-ROC: 0.914`, `BIO1 (42.5%)` (`:752,758`); (3) chỉ vẽ các vòng tròn `Circle` quanh tâm tỉnh, **không có lớp raster GeoTIFF overlay và không có nút download GeoTIFF hay PNG preview**.
- **Kỳ vọng:** Đủ 19 biến BIO WorldClim 2.1 + CHELSA v2; gọi qua cổng Node.js (`/api/ai/sdm`) sang FastAPI MaxEnt service; hiển thị raster overlay trên Leaflet và cho phép tải về file GeoTIFF + PNG.
- **Đề xuất:** Xây dựng endpoint `/api/ai/sdm/predict` kết nối FastAPI MaxEnt worker, lưu GeoTIFF + PNG preview vào MinIO và trả URL hiển thị `ImageOverlay` + nút tải file.
- **Công:** L

### DEF-078 · Medium · Functional
- **Vi phạm:** F-AI-03, SCR-25 "(1) Đường xu hướng số hóa: số bản ghi mới theo tuần/tháng/năm; (2) Donut chart độ phủ dữ liệu: tỉ lệ mẫu có ảnh/DNA/GPS/hoạt tính; (3) Bar chart phân bố theo taxon; (4) Choropleth mini: số mẫu theo tỉnh. Bộ lọc thời gian: 7 ngày / 30 ngày / 12 tháng / tùy chọn".
- **Hiện trạng:** `AnalyticsDashboardPage.js` thiếu các thành phần sau: (1) chỉ thống kê theo năm và tháng thu mẫu (`collection_date`), không thống kê xu hướng số hóa bản ghi mới theo tuần/tháng/năm và **không có bộ lọc thời gian 7 ngày / 30 ngày / 12 tháng / tùy chọn**; (2) Donut chart (`:65-81,332-350`) chỉ vẽ tỷ lệ mẫu định danh bậc Loài vs bậc cao, **không hiển thị tỷ lệ độ phủ mẫu có ảnh / DNA / GPS / hoạt tính**; (3) không có Bar chart phân bố theo taxon trên trang này; (4) chỉ có BarChart ngang cho tỉnh, không có Choropleth mini map.
- **Kỳ vọng:** Đủ 4 biểu đồ đúng nội dung F-AI-03 và bộ lọc khoảng thời gian (7 ngày / 30 ngày / 12 tháng / tùy chọn).
- **Đề xuất:** Bổ sung bộ lọc thời gian + các chỉ số độ phủ (ảnh/DNA/GPS/hoạt tính), BarChart theo Bộ và bản đồ Choropleth mini vào `getAnalytics` & `AnalyticsDashboardPage.js`.
- **Công:** M

### DEF-079 · High · Functional
- **Vi phạm:** F-AI-04 "Tự động quét và cảnh báo các vấn đề chất lượng dữ liệu: (1) Tọa độ GPS nằm ngoài lãnh thổ Việt Nam ... (2) Tên khoa học không tìm thấy trong Catalogue of Life; (3) Mã GenBank không khớp định dạng chuẩn; (4) Ngày thu mẫu trong tương lai. Hiển thị danh sách cảnh báo với link trực tiếp đến bản ghi cần sửa".
- **Hiện trạng:** `specimen.repository.js:798-806` và `AnalyticsDashboardPage.js:114-158` mới đếm số lượng tổng cho quy tắc (1) ngoài bbox VN và (4) ngày thu trong tương lai. **Thiếu hoàn toàn quy tắc (2) Tên khoa học chưa xác thực trong Catalogue of Life (`taxa.is_verified = false`) và quy tắc (3) Mã GenBank không khớp định dạng chuẩn**. Ngoài ra bảng kiểm định chỉ hiển thị con số tổng (`affected`) và link chung tới `/admin/map` hoặc `/admin/specimens`, **không hiển thị danh sách các bản ghi vi phạm kèm link trực tiếp tới từng bản ghi cần sửa**.
- **Kỳ vọng:** Quét đủ 4 quy tắc F-AI-04 và liệt kê danh sách từng bản ghi lỗi kèm link mở thẳng trang sửa bản ghi đó.
- **Đề xuất:** Thêm endpoint `GET /api/specimens/data-quality-alerts` trả về cả số đếm và danh sách bản ghi vi phạm cho 4 quy tắc (ngoài bbox VN, `is_verified = false`, accession sai regex, `collection_date > CURRENT_DATE`).
- **Công:** M

## J. Báo cáo & Xuất dữ liệu (F-RP)

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 1: Puppeteer pdfGenerator + label.service QR + reports.service PDF/DOCX/XLSX + LabelCanvas, 6/6 integration tests PASS)

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 1: Puppeteer pdfGenerator + label.service QR + reports.service PDF/DOCX/XLSX + LabelCanvas, 6/6 integration tests PASS)

### DEF-082 · High · Functional
- **Vi phạm:** F-RP-03, SCR-27 "Thống kê hiệu suất theo khoảng thời gian tùy chọn: số bản ghi nhập mới, số bản ghi chỉnh sửa, số ảnh bổ sung, số chuỗi DNA bổ sung. Bảng tổng hợp theo từng tháng. Biểu đồ đường xu hướng. Xuất Excel".
- **Hiện trạng:** `DigitizationKpiPage` (`ReportsPages.js:381-564`) chỉ hiển thị 4 dòng chỉ tiêu tổng cố định (`90000`, `3500`, `90000`, `100`) và biểu đồ cột theo Bộ. **Thiếu toàn bộ các yêu cầu của F-RP-03**: (1) không có bộ lọc chọn khoảng thời gian; (2) không thống kê số bản ghi chỉnh sửa, số ảnh bổ sung theo thời gian; (3) không có bảng tổng hợp theo từng tháng; (4) không có biểu đồ đường xu hướng; (5) **không có nút Xuất Excel** (chỉ có nút `window.print()` ở dòng 462).
- **Kỳ vọng:** Lọc theo khoảng ngày, thống kê đủ 4 chỉ số (nhập mới, chỉnh sửa từ `specimen_change_history`, ảnh mới từ `specimen_images.uploaded_at`, DNA mới từ `dna_sequences.created_at`) theo từng tháng, vẽ biểu đồ đường xu hướng và xuất file Excel.
- **Đề xuất:** Thêm endpoint `GET /api/specimens/kpi?dateFrom=&dateTo=` tổng hợp theo tháng cho 4 chỉ số, vẽ `LineChart` và thêm nút xuất `.xlsx` trên `DigitizationKpiPage`.
- **Công:** M

### DEF-083 · High · Functional
- **Vi phạm:** F-RP-04, SCR-28 "Giao diện kéo thả chọn các trường dữ liệu cần đưa vào báo cáo ... Lưu cấu hình báo cáo với tên để tái sử dụng. Xuất Excel/CSV".
- **Hiện trạng:** Trong `CustomReportBuilderPage` (`ReportsPages.js:569-890`): (1) chỉ là danh sách checkbox cố định, **không hỗ trợ kéo thả (drag-and-drop) để chọn và sắp xếp thứ tự cột**; (2) **không có chức năng lưu/tải cấu hình báo cáo với tên** (bảng `report_configs` trong migration `009_create_audit_and_config.js:79-88` hoàn toàn không được sử dụng); (3) nút "Xuất các cột đã chọn (.CSV)" (`:646-660`) chỉ xuất mảng `rows` đang preview trên trình duyệt (tối đa 50 dòng, `:604`); (4) nút "Xuất Toàn bộ Khớp lọc (.XLSX)" (`:662-671`) lại gọi `/specimens/export?format=xlsx` mà **không truyền `selectedCols`, nên file Excel xuất ra luôn là 22 cột cố định, bỏ qua các cột người dùng đã chọn**.
- **Kỳ vọng:** Kéo thả chọn & sắp xếp cột; lưu/tải cấu hình vào `report_configs`; xuất CSV và Excel trên toàn bộ tập kết quả lọc theo đúng danh sách và thứ tự cột đã chọn.
- **Đề xuất:** Thêm CRUD `/api/system/report-configs`; truyền tham số `columns=col1,col2,...` vào `/api/specimens/export` để server sinh cả `.xlsx` và `.csv` theo đúng cột đã chọn; bổ sung kéo thả sắp xếp cột.
- **Công:** M

\n- **Trạng thái:** Đã sửa (Sprint D – Nhóm 1: Puppeteer pdfGenerator + label.service QR + reports.service PDF/DOCX/XLSX + LabelCanvas, 6/6 integration tests PASS)

### DEF-085 · Medium · Functional
- **Vi phạm:** F-RP-06, §5.5 "Tạo và export Darwin Core Archive (.zip): mapping trường CSDL sang DwC terms, file meta.xml, eml.xml (metadata dataset). Kết nối GBIF Integrated Publishing Toolkit (IPT). Theo dõi trạng thái sync và lịch sử xuất bản. Sinh DOI cho mỗi dataset version".
- **Hiện trạng:** `dwcaExport.service.js:194` sinh `eml.xml` theo namespace `eml://ecoinformatics.org/eml-2.1.1` (SRS §5.5 yêu cầu EML 2.2); khi xuất DwC-A, hệ thống **không ghi bản ghi vào bảng `gbif_export_logs`** (`009_create_audit_and_config.js:66-77`), **không sinh mã version/DOI, không kết nối GBIF IPT và trên UI không có nơi nào xem lịch sử xuất bản hay trạng thái sync GBIF**.
- **Kỳ vọng:** `eml.xml` chuẩn EML 2.2; mỗi lần xuất bản DwC-A lưu lịch sử vào `gbif_export_logs` kèm version, DOI/IPT sync status và hiển thị bảng lịch sử xuất bản trên giao diện.
- **Đề xuất:** Nâng cấp template `eml.xml` lên EML 2.2; ghi log vào `gbif_export_logs` mỗi khi xuất bản dataset và thêm bảng Lịch sử xuất bản GBIF/IPT trên trang SCR-26.
- **Công:** M

## K. Quản trị hệ thống (F-AD)

### DEF-086 · Medium · Functional
- **Vi phạm:** F-AD-02, SCR-30 "Ghi nhận toàn bộ thao tác Admin: đăng nhập/đăng xuất, tạo/sửa/xóa mẫu vật, toggle Public/Private, xuất dữ liệu, cấu hình hệ thống. Mỗi bản ghi log gồm: timestamp (UTC+7), tài khoản, loại thao tác, đối tượng bị tác động, IP địa chỉ. Lọc theo thời gian và loại thao tác. Xuất CSV".
- **Hiện trạng:** (1) `SystemAdminPage.js:149-292` và `system.routes.js:16-23` **không có nút và endpoint Xuất CSV cho nhật ký Audit Log**; (2) Toàn bộ thao tác CRUD trong `taxonomy.controller.js` và `dna.controller.js` **không gọi `logAudit`**; (3) Dropdown lọc loại thao tác (`SystemAdminPage.js:169-178`) thiếu `BATCH_PUBLIC`, `BATCH_UPDATE`, `BULK_IMPORT`, `EXPORT_DATA`, `CHANGE_PASSWORD`, `DELETE_MEDIA`; (4) `system.repository.js:45-50` lọc `dateFrom`/`dateTo` nối cứng hậu tố `T00:00:00Z` / `T23:59:59Z` (UTC) thay vì múi giờ UTC+7 (`+07:00`).
- **Kỳ vọng:** Ghi audit log đầy đủ cho mọi module, lọc đúng múi giờ UTC+7, đủ loại thao tác và xuất được file CSV nhật ký.
- **Đề xuất:** Bổ sung `logAudit` vào `taxonomy.controller.js` và `dna.controller.js`; sửa filter ngày sang `+07:00`; thêm nút Xuất CSV trên `SystemAdminPage.js`.
- **Công:** S

### DEF-087 · High · Functional
- **Vi phạm:** F-AD-03, SCR-30 "Giao diện cấu hình: (1) Email SMTP (host, port, user, password, from); (2) Google Maps API key; (3) NCBI API key; (4) Danh mục dropdown: sinh cảnh, trạng thái mẫu, giai đoạn phát triển (thêm/sửa/xóa giá trị); (5) Backup schedule (cron expression); (6) Logo và thông tin tổ chức cho báo cáo PDF".
- **Hiện trạng:** `system.service.js:6-49` chỉ khởi tạo 6 khóa (`default_public_license`, `dwca_exclude_nc_nd_media`, `minio_media_bucket`, `ncbi_rate_limit_rps`, `ncbi_api_key`, `gbif_download_credentials`). **Thiếu 5/6 nhóm cấu hình bắt buộc của F-AD-03**: (1) không có các khóa cấu hình Email SMTP (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `smtp_from`); (2) không có `google_maps_api_key`; (4) **không có API và giao diện thêm/sửa/xóa giá trị cho 3 bảng danh mục dropdown** (`habitat_types`, `specimen_status_types`, `life_stages`); (5) không có `backup_schedule_cron`; (6) không có cấu hình logo và thông tin tổ chức cho báo cáo PDF.
- **Kỳ vọng:** SCR-30 cung cấp đầy đủ 6 nhóm cấu hình, bao gồm CRUD danh mục dropdown và upload logo Viện.
- **Đề xuất:** Bổ sung các khóa cấu hình SMTP, Google Maps API Key, Backup cron, Tổ chức/Logo vào `DEFAULT_SYSTEM_CONFIGS`; thêm các endpoint CRUD cho `habitat_types`, `life_stages`, `specimen_status_types` và tab quản trị danh mục trong `SystemAdminPage.js`.
- **Công:** M

### DEF-088 · High · i18n
- **Vi phạm:** F-AD-04, §2.4, §3.1.1, §6.3 "Chuyển đổi ngôn ngữ giao diện Tiếng Việt / Tiếng Anh cho toàn bộ hệ thống. i18n dựa trên file JSON (vi.json / en.json)".
- **Hiện trạng:** (1) `PublicLayout.js:13-88` (giao diện dành cho User công khai — bao gồm nhà nghiên cứu quốc tế theo §2.3) **không có nút chuyển đổi ngôn ngữ VI/EN** (nút này chỉ có trong `AdminChrome.js:137-150`); (2) `frontend/src/i18n/index.js:12` nạp `/locales/{{lng}}/translation.json` (chỉ có 96 dòng) trong khi 2 file `/locales/vi.json` và `/locales/en.json` (58 dòng) bị bỏ thừa không dùng; (3) **22/25 trang và hầu hết component (`SpecimenListPage`, `SpecimenForm`, `SpecimenBatchPages`, `TaxonomyTreePage`, `TaxonEditorPage`, `SpeciesProfileTabs`, `AdvancedSearchPage`, `MediaGalleryPage`, `OccurrenceMapPage`, `GisAndAiPages`, `DnaListPage`, `DnaFormPage`, `DnaFastaDetailPage`, `AnalyticsDashboardPage`, `ReportsPages`, `PublicPrivateControlPage`, `SystemAdminPage`, `PublicHomePage`...) hard-code trực tiếp chuỗi Tiếng Việt, không gọi `useTranslation()`**, dẫn tới khi bấm nút `EN` thì >95% giao diện vẫn hiển thị Tiếng Việt.
- **Kỳ vọng:** Có nút chuyển đổi VI/EN trên cả `PublicLayout` và `AdminChrome`; toàn bộ chuỗi giao diện được trích xuất ra `vi.json`/`en.json` và chuyển đổi hoàn chỉnh.
- **Đề xuất:** Thống nhất đường dẫn `vi.json`/`en.json`, thêm bộ chuyển đổi ngôn ngữ + theme lên `PublicLayout.js`, và thay các chuỗi hard-code bằng key `t(...)`.
- **Công:** L

## L. Phân quyền & Rò rỉ dữ liệu (Bước 2)

### DEF-089 · High · Permission
- **Vi phạm:** §2.3 "User: Chỉ xem, tìm kiếm và xuất dữ liệu mà Admin đã bật trạng thái Public. Không thể xem dữ liệu Private"; F-AD-01.
- **Hiện trạng:** Trong `dna.repository.js:12-17,99-103` (`findMany`), `dna.repository.js:167-205` (`findById`) và `dna.repository.js:336-378` (`getStats`), truy vấn chỉ lọc `d.is_public = true` mà **không kiểm tra trạng thái `s.is_public = true AND s.deleted_at IS NULL` của mẫu vật (`specimens`) liên kết**. Khi một mẫu vật có `dna_sequences` liên kết (`d.is_public = true` theo mặc định ở `dna.validator.js:53`), nếu Admin chuyển mẫu vật đó sang **Private** (`specimens.is_public = false`, thông qua `specimen.repository.js:708-728`) hoặc **xóa mềm** mẫu vật (`specimens.deleted_at = now()`, `:731-740`), thì bảng `dna_sequences` không được cập nhật và `dna.repository.js` chỉ `leftJoin` với `specimen_registry` (`:101,173`), dẫn tới **User công khai vẫn xem được bản ghi DNA, mã mẫu vật `specimen_code`, `basis_of_record` và `recorded_by` của mẫu vật đang ở trạng thái Private hoặc đã xóa mềm** qua `GET /api/dna` và `GET /api/dna/:id`.
- **Kỳ vọng:** Khi mẫu vật là Private hoặc đã bị xóa mềm, User công khai tuyệt đối không được thấy mã mẫu vật/thông tin mẫu vật đó trên danh sách và chi tiết DNA (hoặc bản ghi DNA gắn với mẫu vật Private cũng phải bị ẩn đối với User).
- **Đề xuất:** Trong `dna.repository.js` (`findMany`, `findById`, `getStats`), `LEFT JOIN specimens s ON d.specimen_id = s.specimen_id AND s.deleted_at IS NULL` và khi `!includePrivate` bắt buộc thêm điều kiện `(d.specimen_id IS NULL OR (s.specimen_id IS NOT NULL AND s.is_public = true))`.
- **Công:** S
- **Trạng thái:** Đã sửa – commit `9a3f415`

### DEF-090 · Medium · Permission
- **Vi phạm:** §2.3, F-SP-03, F-TX-05 (nhất quán trạng thái hiển thị Admin/User).
- **Hiện trạng:** `frontend/src/router.js:43-53` dùng chung component cho 9 màn hình dual-context, và cả 9 component này xác định quyền Admin bằng `useIsAdminContext()` (`frontend/src/hooks/useIsAdminContext.js:3-5` chỉ kiểm tra `pathname.startsWith("/admin")`), trong khi `frontend/src/services/http.js:13-18` luôn đính kèm `Authorization: Bearer <token>` nếu Admin đã đăng nhập. Hệ quả: (1) Nếu Admin mở các trang Public (`/`, `/specimens/search`, `/taxonomy`, `/dna`, `/media`, `/map`, `/reports`), giao diện ẩn nút Sửa/Xóa như User nhưng dữ liệu bên dưới lại bao gồm cả dữ liệu **Private** (mở rộng của DEF-051 trên toàn bộ 9 màn hình dual-context); (2) Tại `AiSpeciesIdPage` (`GisAndAiPages.js:337-339`) và `ReportsChecklistPage` (`ReportsPages.js:37-39`), code tự kết hợp `location.pathname.startsWith("/admin") && isAuthenticated` thay vì dùng hook thống nhất.
- **Kỳ vọng:** Ngữ cảnh hiển thị dữ liệu (Public vs Admin) trên API phải khớp 100% với ngữ cảnh giao diện (Public route vs `/admin` route).
- **Đề xuất:** Trong `http.js`, chỉ đính kèm header `Authorization` cho các request gọi từ trang `/admin/*` (hoặc gửi kèm header `X-Public-Preview: 1` khi `window.location.pathname` không bắt đầu bằng `/admin` để `optionalAdmin` bỏ qua quyền Admin).
- **Công:** S
- **Trạng thái:** Đã sửa – commit `14b9d12`

## M. Yêu cầu phi chức năng — Mục 5 & Mục 6 SRS (Bước 3)

### DEF-091 · High · Security
- **Vi phạm:** SRS §5.2 "Helmet.js để set security headers (CSP, X-Frame-Options, X-XSS-Protection) ... HTTP Strict Transport Security (HSTS) header bắt buộc".
- **Hiện trạng:** `backend/app.js:19-23` chỉ gọi `helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })` mà không cấu hình tường minh Content-Security-Policy (CSP) cho các nguồn bản đồ/ảnh của hệ thống, không cấu hình HSTS (`maxAge`, `includeSubDomains`, `preload`), và trong Helmet v8 header `X-XSS-Protection` mặc định bị đặt thành `0`.
- **Kỳ vọng:** Cấu hình tường minh CSP whitelist, `hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }` và `frameguard: { action: "deny" }`.
- **Đề xuất:** Bổ sung cấu hình `contentSecurityPolicy`, `hsts`, `frameguard` rõ ràng trong `app.js` và trên Nginx reverse proxy.
- **Công:** S

### DEF-092 · High · Security
- **Vi phạm:** SRS §5.2 "CORS whitelist chỉ chấp nhận domain chính thức".
- **Hiện trạng:** `backend/app.js:24-29` đặt `origin: process.env.CORS_ORIGIN || "http://localhost:3000"` chỉ nhận **1 chuỗi đơn lẻ**, không parse danh sách nhiều domain whitelist (ví dụ domain chính thức + domain nội bộ VAST) và không kiểm tra callback `origin` chống domain lạ khi cấu hình nhiều origin.
- **Kỳ vọng:** Hỗ trợ mảng whitelist domain từ `CORS_ORIGIN` (tách bằng dấu phẩy) và từ chối mọi origin ngoài danh sách.
- **Đề xuất:** Parse `const whitelist = (process.env.CORS_ORIGIN || "http://localhost:3000").split(",").map(s => s.trim())` và kiểm tra trong hàm `origin(reqOrigin, cb)`.
- **Công:** S

### DEF-093 · High · Security
- **Vi phạm:** SRS §5.2 "OWASP Top 10: ... CSRF token cho form POST".
- **Hiện trạng:** Hệ thống sử dụng HttpOnly cookie cho `/api/auth/refresh` và `/api/auth/logout` (`auth.controller.js:19,45,62`) với `withCredentials: true` (`frontend/src/services/http.js:9`), nhưng **hoàn toàn không có cơ chế CSRF token** (không có middleware tạo/kiểm tra `X-CSRF-Token` hay double-submit cookie trên backend và frontend).
- **Kỳ vọng:** Mọi request POST/PUT/PATCH/DELETE (đặc biệt các endpoint dùng cookie xác thực) phải được bảo vệ bằng CSRF token.
- **Đề xuất:** Bổ sung endpoint/cookie cấp CSRF token (Double-Submit Cookie hoặc Synchronizer Token Pattern) và kiểm tra header `X-CSRF-Token` ở middleware backend.
- **Công:** S

### DEF-094 · Medium · Security
- **Vi phạm:** SRS §5.2 "OWASP Top 10: ... Sanitize input DOMPurify chống XSS".
- **Hiện trạng:** Không có thư viện `dompurify` / `isomorphic-dompurify` hoặc `sanitize-html` trong cả `frontend/package.json` và `backend/package.json`. Các trường văn bản tự do (`notes`, `occurrenceRemarks`, `morphologyDescription`, `ecologyDescription`, `description`, `localityDetail`) khi lưu vào DB chỉ được `.trim()` qua Joi mà không strip thẻ HTML/script độc hại.
- **Kỳ vọng:** Sanitize dữ liệu đầu vào/hiển thị bằng DOMPurify theo đúng đặc tả §5.2.
- **Đề xuất:** Cài đặt `dompurify` ở FE và `isomorphic-dompurify`/`sanitize-html` ở BE middleware để làm sạch các trường text trước khi lưu DB.
- **Công:** S

### DEF-095 · High · Security
- **Vi phạm:** SRS §3.4, §5.2 "Toàn bộ giao tiếp giữa client và server qua HTTPS/TLS 1.3; nghiêm cấm HTTP thuần ... HSTS header bắt buộc"; `docs/adr/cây thư mục dự án.md:440-446`.
- **Hiện trạng:** Thư mục `infra/nginx/` và `infra/nginx/ssl/` **hoàn toàn rỗng** (không có `nginx.conf`, `upstream.conf`); `docker-compose.yml` không có service `nginx`; `docker-compose.prod.yml` **rỗng 0 byte**; `backend/src/modules/media/mediaUrl.util.js:22` và `frontend/src/services/http.js:4` đều fallback về `http://localhost:5000`.
- **Kỳ vọng:** Có cấu hình Nginx reverse proxy hoàn chỉnh bắt buộc `ssl_protocols TLSv1.3;`, redirect HTTP → HTTPS, gắn HSTS header và khai báo trong `docker-compose.prod.yml`.
- **Đề xuất:** Bổ sung `infra/nginx/nginx.conf` (TLS 1.3, HSTS, reverse proxy FE/BE/AI) và hoàn thiện `docker-compose.prod.yml`.
- **Công:** M

### DEF-096 · High · Reliability
- **Vi phạm:** SRS §5.3 "Full backup PostgreSQL tự động lúc 01:00 sáng hàng ngày bằng pg_dump. Lưu backup xoay vòng 30 ngày (gần nhất) + 12 bản backup cuối tháng. Backup hình ảnh (MinIO) đồng bộ hàng tuần"; `docs/adr/cây thư mục dự án.md:37-43`.
- **Hiện trạng:** Không tồn tại thư mục `scripts/` ở gốc repo (`scripts/backup.sh`, `scripts/db-migrate.sh`, `scripts/db-seed.sh` đều chưa có); không có cron job hay script chạy `pg_dump` lúc 01:00 sáng, xoay vòng 30 ngày + 12 bản cuối tháng hay đồng bộ MinIO hàng tuần.
- **Kỳ vọng:** Có script tự động hóa sao lưu PostgreSQL (`pg_dump`) + MinIO theo đúng chính sách 30 ngày + 12 tháng và tích hợp lịch chạy tự động.
- **Đề xuất:** Viết `scripts/backup.sh` thực hiện `pg_dump -Fc`, xoay vòng 30 bản ngày + 12 bản cuối tháng, đồng bộ MinIO (`mc mirror`) và đăng ký cron 01:00.
- **Công:** M

### DEF-097 · Medium · Reliability
- **Vi phạm:** SRS §5.3 "Lỗi Critical tự động gửi email cảnh báo. Log rotate hàng ngày, lưu tối thiểu 90 ngày".
- **Hiện trạng:** `backend/src/config/logger.js:20-26` chỉ dùng `winston.transports.File` ghi nối vô hạn vào `logs/error.log` và `logs/combined.log` — **không có `winston-daily-rotate-file`, không xoay vòng log hàng ngày và không có cấu hình giữ 90 ngày (`maxFiles: "90d"`)**; khi xảy ra lỗi 500/Critical ở `errorHandler.js:4-14`, hệ thống chỉ ghi file log chứ **không gửi email cảnh báo**.
- **Kỳ vọng:** Xoay vòng log hàng ngày lưu tối thiểu 90 ngày; tự động gửi email cảnh báo qua SMTP khi có lỗi Critical.
- **Đề xuất:** Thêm `winston-daily-rotate-file` (`datePattern: "YYYY-MM-DD"`, `maxFiles: "90d"`) và hook gửi email cảnh báo trong `errorHandler.js` khi `statusCode >= 500`.
- **Công:** S

### DEF-098 · High · Build
- **Vi phạm:** SRS §5.3, §5.4, §6.4 "docker-compose.yml production-ready"; `docs/adr/cây thư mục dự án.md:15-17,468-474`.
- **Hiện trạng:** (1) `docker-compose.prod.yml` **rỗng 0 byte**; (2) Trong `docker-compose.yml:23-63`, chỉ có `postgres` có `healthcheck`, còn 3 service **`mongodb`, `redis`, `minio` đều không có `healthcheck`**, và file này cũng thiếu hẳn các container `elasticsearch`, `backend`, `frontend`, `ai-service`, `nginx`, `geoserver`; (3) Không tồn tại thư mục `.github/workflows/` (hoặc `.gitlab-ci.yml`) cho CI/CD pipeline (`lint → test → build → deploy`) như yêu cầu tại SRS §5.2 & §5.4.
- **Kỳ vọng:** `docker-compose.yml` và `docker-compose.prod.yml` khai báo đầy đủ các service kèm `healthcheck` và `restart: unless-stopped`; có cấu hình CI/CD pipeline kèm dependency audit.
- **Đề xuất:** Bổ sung `healthcheck` cho `mongodb`, `redis`, `minio`, `elasticsearch` trong `docker-compose.yml`; hoàn thiện `docker-compose.prod.yml` và `.github/workflows/ci.yml`.
- **Công:** M

### DEF-099 · Medium · Functional
- **Vi phạm:** SRS §3.4, §5.4, §6.1 "REST API nội bộ theo chuẩn OpenAPI 3.0; tài liệu Swagger UI tự động sinh tại `/api/docs`".
- **Hiện trạng:** `backend/app.js:50-64` không có route `/api/docs`; `backend/package.json` không có `swagger-jsdoc` hay `swagger-ui-express`; file `docs/api.md` cũng không tồn tại. Gọi `GET /api/docs` trả về 404 (`NOT_FOUND`).
- **Kỳ vọng:** Truy cập `/api/docs` hiển thị Swagger UI chuẩn OpenAPI 3.0 cho toàn bộ endpoint.
- **Đề xuất:** Tích hợp `swagger-jsdoc` + `swagger-ui-express` và mount tại `app.use("/api/docs", ...)` trong `backend/app.js`.
- **Công:** M

### DEF-100 · Medium · Functional
- **Vi phạm:** SRS §5.5, §6.3 "Hệ tọa độ: Lưu trữ WGS84 (EPSG:4326); hỗ trợ hiển thị VN-2000 (EPSG:4756) ... hỗ trợ chuyển đổi sang VN-2000 (EPSG:4756) khi hiển thị tại các trường GPS".
- **Hiện trạng:** Grep toàn bộ codebase cho `4756`, `VN-2000`, `VN2000`, `geoUtils` trả về **0 kết quả**. Tại `SpecimenDwcSections.js:179-196`, `SpecimenListPage.js:840-842`, `OccurrenceMapPage.js:382`, tọa độ chỉ hiển thị duy nhất hệ WGS84, không có hàm chuyển đổi hay tùy chọn hiển thị tọa độ VN-2000 (EPSG:4756).
- **Kỳ vọng:** Hỗ trợ chuyển đổi và hiển thị tọa độ theo hệ quy chiếu VN-2000 (EPSG:4756) bên cạnh WGS84 tại các màn hình chi tiết mẫu, danh sách và bản đồ.
- **Đề xuất:** Thêm tiện ích `geoUtils.js` (hoặc dùng PostGIS `ST_Transform(collection_point::geometry, 4756)`) và nút chuyển đổi hiển thị WGS84 ⇄ VN-2000 tại các trường GPS.
- **Công:** S

### DEF-101 · Medium · Functional
- **Vi phạm:** SRS §3.1.1 "Hỗ trợ Light mode và Dark mode theo tùy chọn người dùng, lưu vào localStorage".
- **Hiện trạng:** `AdminChrome.js:105-113,154-160` có nút bấm mặt trăng/mặt trời bật class `document.documentElement.classList.toggle("dark", theme === "dark")` và lưu `localStorage`, nhưng trong `frontend/src/index.css:28-39`, khối `:root.dark` lại khai báo **màu nền và màu chữ y hệt Light mode** (`--vi-bg: #FFFFFF; --vi-surface: #FFFFFF; --vi-ink: #111111;`), đồng thời hàng trăm selector bên dưới (`.topbar`, `.admin-content`, `.card`, `.public-shell`...) gán cứng `background: #FFFFFF; color: #111111;`. Do đó **bấm chuyển sang Dark mode giao diện hoàn toàn không đổi sang nền tối**; ngoài ra `PublicLayout.js` cũng không có nút chuyển Dark/Light mode.
- **Kỳ vọng:** Bật Dark mode phải chuyển toàn bộ bảng màu nền/chữ/card sang giao diện tối đạt độ tương phản WCAG 2.1 AA, hoạt động trên cả Admin và Public layout.
- **Đề xuất:** Cập nhật bảng biến màu trong `:root.dark` (`--vi-bg: #0B1410`, `--vi-surface: #122019`, `--vi-ink: #F1F5F9`...) và thay các màu `#FFFFFF`/`#111111` hard-code trong `index.css` bằng biến CSS `var(--vi-surface)`/`var(--vi-ink)`.
- **Công:** M

### DEF-102 · Low · Functional
- **Vi phạm:** SRS §2.4, §5.5 "Hệ thống phải tương thích với chuẩn WCAG 2.1 mức AA về khả năng tiếp cận (accessibility)"; §6.3.
- **Hiện trạng:** (1) `frontend/public/index.html:2,27` để mặc định của CRA: `<html lang="en">` và `<title>React App</title>` (vi phạm WCAG 3.1.1 Language of Page và 2.4.2 Page Titled khi ngôn ngữ mặc định là Tiếng Việt); (2) Nhiều form không liên kết `<label htmlFor>` với `id` của `<input>/<select>` (ví dụ `TaxonForm.js:61-117`, `MediaGalleryPage.js:236-286,563-644`, `DnaFormPage.js:355-564`, `SystemAdminPage.js:154-200`), khiến trình đọc màn hình (screen reader) không đọc được nhãn ô nhập; (3) Các modal hộp thoại (`ConfirmDialog.js`, `SpecimenLabelModal.js:12-13`, `MediaGalleryPage.js:461,545`) chưa có `role="dialog"`, `aria-modal="true"` và chưa bẫy phím `Tab`/`Escape`.
- **Kỳ vọng:** `<html lang="vi">` (cập nhật động theo `i18n.language`), `<title>VietInsect BigData System</title>`, mọi input có label liên kết hoặc `aria-label`, mọi modal có `role="dialog"` + `aria-modal="true"`.
- **Đề xuất:** Sửa `index.html`, đồng bộ `document.documentElement.lang = i18n.language`, gắn `htmlFor`/`id` cho các form và `role="dialog" aria-modal="true"` cho modal.
- **Công:** S

### DEF-103 · Medium · Security
- **Vi phạm:** SRS §6.5 "Không phụ thuộc vào cloud nước ngoài cho chức năng cốt lõi"; §2.4 "Dữ liệu bản đồ nền hành chính sử dụng nguồn chính thức từ Cục Đo đạc và Bản đồ Việt Nam".
- **Hiện trạng:** (1) `frontend/src/index.css:1` tải font trực tiếp từ CDN Google (`@import url('https://fonts.googleapis.com/css2?family=Inter...&family=Manrope...')`) — khi triển khai trong mạng nội bộ VAST hoặc mất kết nối quốc tế sẽ không tải được font; (2) Toàn bộ bản đồ trên mọi màn hình (`OccurrenceMapPage.js:21-46`, `HomeMapHero.js:9-11`, `AdminDashboardPage.js:22`, `SpeciesProfileTabs.js:20-23`, `GisAndAiPages.js:246-249,798`, `SpecimenMapSidebar.js:41`) đều phụ thuộc cứng vào tile server cloud nước ngoài của Esri (`https://server.arcgisonline.com/ArcGIS/rest/services/...`).
- **Kỳ vọng:** Self-host font chữ trong `frontend/public/fonts/` và cấu hình tile server bản đồ có thể trỏ về GeoServer/tile nội bộ hoặc nguồn bản đồ hành chính Cục Đo đạc Bản đồ VN qua biến môi trường.
- **Đề xuất:** Đóng gói font `Inter` & `Manrope` vào `public/fonts/`; đưa URL tile bản đồ ra cấu hình môi trường/GeoServer nội bộ.
- **Công:** S

## N. Chất lượng kỹ thuật & Build / Test / Coverage (Bước 4)

\n- **Trạng thái:** Đã sửa – commit `f759b4c`

\n- **Trạng thái:** Đã sửa – commit `f182881`

### DEF-106 · Low · Build
- **Vi phạm:** SRS §5.4 (Codebase sạch, chuẩn hóa cấu trúc và biến môi trường).
- **Hiện trạng:** (1) `docker-compose.env.example:1-13` chỉ khai báo 9 biến cho Docker (`POSTGRES_*`, `MONGO_*`, `MINIO_ROOT_*`), **thiếu hầu hết các biến môi trường bắt buộc để chạy Backend & Frontend**: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CONFIG_ENCRYPTION_KEY_FILE` (hoặc `CONFIG_ENCRYPTION_SECRET`), `REDIS_HOST`, `REDIS_PORT`, `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `CORS_ORIGIN`, `SEED_ADMIN_PASSWORD`, `REACT_APP_API_URL`; (2) Các file dead code không được sử dụng ở bất kỳ đâu: `frontend/src/pages/RegistryScreenPage.js` (122 dòng), `frontend/src/components/ui/TechnicalFrame.js` (63 dòng), `frontend/src/constants/api.js` (71 dòng — khai báo 37 hằng số endpoint hoàn toàn lệch với route backend thực tế như `/gis/occurrences`, `/admin/config`, `/search/media`), `frontend/src/constants/routes.js` (44 dòng), `frontend/src/constants/app.js` (31 dòng — chứa `VN_BOUNDS` sai `8.0–24.0, 101.0–118.0` và `STORAGE_KEYS.TOKEN = "vietinsect_token"` trái đặc tả); (3) `backend/src/config/db.js:19` dùng `console.error` thay vì `logger.error`; (4) `.gitignore` gốc chưa ignore `backend/.env` và `coverage/`.
- **Kỳ vọng:** File `.env.example` đầy đủ cho cả Docker, Backend, Frontend; dọn sạch dead code và đồng bộ hằng số.
- **Đề xuất:** Bổ sung `backend/.env.example`, `frontend/.env.example`; xóa hoặc đồng bộ các file dead code `RegistryScreenPage.js`, `TechnicalFrame.js`, `constants/api.js`, `constants/app.js`; thay `console.error` bằng `logger.error`.
- **Công:** S

## O. Schema CSDL & Dữ liệu (Bước 5)

\n- **Trạng thái:** Đã sửa (mv_taxon_dwc_flat) – commit `f31816c`

### DEF-108 · Medium · Data
- **Vi phạm:** F-GI-06 / SCR-25 (thống kê độ giàu loài theo tỉnh chính xác).
- **Hiện trạng:** `backend/src/modules/specimen/specimen.repository.js:993` (`getAnalytics` → `richnessPromise`) dùng `COUNT(*)::int AS specimen_count` trên `FROM provinces p LEFT JOIN specimens s ...`, khiến tỉnh không có mẫu vật vẫn bị đếm là `1` thay vì `0`.
- **Kỳ vọng:** Tỉnh không có mẫu vật phải trả về `specimen_count = 0`.
- **Đề xuất:** Sửa `COUNT(*)::int` thành `COUNT(s.specimen_id)::int`.
- **Công:** S
- **Trạng thái:** Đã sửa – commit `862388e`

### DEF-109 · Medium · Security
- **Vi phạm:** §5.2 (chống DoS body size lớn trên toàn bộ API).
- **Hiện trạng:** `backend/app.js:31` đặt `express.json({ limit: "10mb" })` toàn cục thay vì chỉ giới hạn riêng cho `/api/specimens/bulk-import`.
- **Kỳ vọng:** Giữ giới hạn mặc định (`100kb`) cho toàn bộ API (ví dụ `POST /api/auth/login` 1MB trả `413`); chỉ áp dụng `10mb` cho `POST /api/specimens/bulk-import`.
- **Đề xuất:** Tách parser `10mb` vào route `/bulk-import`.
- **Công:** S
- **Trạng thái:** Đã sửa – commit `8aa4c33`

### DEF-110 · Medium · Data
- **Vi phạm:** F-TX / đồng bộ dữ liệu Materialized View.
- **Hiện trạng:** Kết quả grep toàn bộ `backend/src/` cho thấy không có chỗ nào gọi `REFRESH MATERIALIZED VIEW [CONCURRENTLY] mv_taxon_dwc_flat` tự động khi thêm/sửa/xóa `taxa` hoặc theo cron.
- **Kỳ vọng:** Tự động refresh `mv_taxon_dwc_flat` sau thao tác ghi `taxa` hoặc qua cron job định kỳ.
- **Đề xuất:** Thêm trigger/job `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_taxon_dwc_flat` ở sprint kế tiếp.
- **Công:** S
- **Trạng thái:** Đã sửa (debounced `REFRESH MATERIALIZED VIEW CONCURRENTLY` + `make refresh-views`) – commit `0934015`

### DEF-111 · Low · Security
- **Vi phạm:** §5.2 (chống user enumeration ở endpoint đăng nhập).
- **Hiện trạng:** `backend/src/modules/auth/auth.service.js:24-26` trả `423 AUTH.ACCOUNT_LOCKED` cho tài khoản tồn tại đang bị khóa, khác với `401 AUTH.INVALID_CREDENTIALS` cho tài khoản không tồn tại, cho phép kẻ tấn công dò username tồn tại sau 5 lần thử.
- **Kỳ vọng:** Cân nhắc thống nhất phản hồi hoặc áp dụng CAPTCHA/rate-limit bổ sung nếu yêu cầu chống enumeration nghiêm ngặt.
- **Đề xuất:** Trả cùng mã lỗi chung hoặc thông báo trung tính khi cần siết chống user enumeration.
- **Công:** S
- **Trạng thái:** Chưa đóng (ghi nhận theo yêu cầu, chưa sửa ở sprint này)

### DEF-112 · High · Reliability
- **Vi phạm:** §2.3 & §5.3 (độ tin cậy đồng bộ trạng thái Private/Public sang Elasticsearch).
- **Hiện trạng:** `backend/src/modules/search/elasticsearch.service.js:17-18` lưu `priorityRetryQueue` (`Set`) và cờ `needsReindex` trong bộ nhớ tiến trình Node.js; nếu backend restart sau sự cố ES thì hàng đợi bị mất, có nguy cơ để lộ mẫu Private trong ES nếu cập nhật `is_public` trước đó chưa tới được ES.
- **Kỳ vọng:** Hàng đợi retry ưu tiên phải bền vững qua restart (Redis list/stream hoặc bảng outbox PostgreSQL + worker đọc định kỳ).
- **Đề xuất:** Chuyển `priorityRetryQueue` sang bảng outbox PostgreSQL hoặc Redis Stream kèm background worker retry định kỳ; tạm thời vận hành theo runbook chạy `make reindex` sau mỗi lần restart hậu sự cố ES.
- **Công:** M
- **Trạng thái:** Đã sửa – commit `a7e174b` (PostgreSQL transactional outbox `es_sync_outbox` ghi cùng transaction với specimen, worker nền `SELECT ... FOR UPDATE SKIP LOCKED` + coalesce + exponential backoff + `dead` + `logger.error`, `ADR-006`, `/api/health` + `/api/search/outbox/*`, 5/5 test tích hợp `esOutbox.sprintc.test.js` PASS)

 Đã sửa (Sprint D – Nhóm 3: triển khai SCR-16 tại /search/advanced & /admin/search/advanced theo C-04, tab SQL chỉ Admin)

### DEF-114 · Medium · Infra
- **Vi phạm:** SRS §3.4 / F-SP-06 (hạ tầng reverse proxy WebSocket cho Socket.io `/socket.io`).
- **Hiện trạng:** Chưa có cấu hình `infra/nginx` với `proxy_set_header Upgrade $http_upgrade`, `proxy_set_header Connection "upgrade"` và `proxy_read_timeout` cho endpoint `/socket.io`.
- **Kỳ vọng:** Bổ sung cấu hình Nginx production hỗ trợ nâng cấp WebSocket cho `/socket.io`.
- **Công:** S
- **Trạng thái:** Chưa đóng (ghi nhận theo yêu cầu sau Nhóm 2 Sprint D, chưa sửa)

### DEF-115 · High · Security
- **Vi phạm:** F-SR-04 / SCR-16 & §5.2 (cứng hóa chế độ truy vấn SQL trực tiếp của Admin).
- **Hiện trạng:** Chế độ SQL trực tiếp ban đầu chỉ dùng `SET LOCAL ROLE` tùy chọn khi có biến môi trường `DB_READONLY_ROLE` và kiểm tra regex đơn giản, chưa bắt buộc trả 503 khi thiếu role chỉ-đọc `vietinsect_readonly` và chưa kiểm tra AST + whitelist hàm SQL.
- **Kỳ vọng:** Bắt buộc `DB_READONLY_ROLE=vietinsect_readonly` (thiếu hoặc `SET LOCAL ROLE` lỗi → trả `503`, tuyệt đối không chạy bằng role chính); migration tạo role `vietinsect_readonly` chỉ `GRANT SELECT` trên bảng khoa học cho phép; parse AST bằng `node-sql-parser` kết hợp whitelist hàm SQL, chặn comment lồng/CTE ghi/`SELECT INTO`/`pg_catalog`/`information_schema`.
- **Công:** M
- **Trạng thái:** Đã sửa (migration `022_create_readonly_sql_role.js` + bắt buộc `DB_READONLY_ROLE` 503 + AST parser `node-sql-parser` + function whitelist)

---

### Thống kê lũy kế toàn bộ cuộc kiểm toán (Bước 0 → Bước 5)

| Mức | Số lỗi | ID |
|---|---|---|
| Critical | 8 | DEF-001…005, DEF-059, DEF-076, DEF-077 |
| High | 47 | 006…010, 017, 018, 024, 026, 028…030, 034, 037, 038, 040, 042, 043, 045, 053, 054, 056, 058, 060…063, 068, 069, 071, 073, 075, 079, 081…084, 087…089, 091…093, 095, 096, 098, 104, 105 |
| Medium | 42 | 011, 012, 014, 015, 019…022, 025, 027, 031, 033, 035, 036, 039, 041, 044, 046…049, 051, 052, 055, 057, 064, 066, 067, 070, 078, 080, 085, 086, 090, 094, 097, 099…101, 103, 107 |
| Low | 10 | 013, 016, 023, 032, 050, 065, 072, 074, 102, 106 |

> **Tổng cộng toàn hệ thống: 107 lỗi (`DEF-001` → `DEF-107`).**

## Đề xuất ngoài phạm vi
- `docs/code review.md:356` đề xuất "Migrate từ CRA sang Vite" — **trái với stack đã chốt** (CRA), không áp dụng.





### DEF-116 · Medium · Data
- **Vi phạm:** Nhất quán lineage phân loại (homonym / sai Bộ tổ tiên).
- **Hiện trạng:** Mẫu vật `specimen_id=130396` đang gắn `Order = Plecoptera`, nhưng `gbif_scientific_name = Anisoptera` (là Phân bộ / Chi thuộc `Odonata`). Script relink đã chặn không tự động sửa (`homonym_order_mismatch(plecoptera!=odonata)`).
- **Kỳ vọng:** Mẫu vật được đối chiếu lại bản ghi GBIF gốc (`gbif_occurrence_id`) để xác định đúng Bộ (`Odonata` hay `Plecoptera`).
- **Đề xuất:** Kiểm tra bản ghi gốc trên GBIF và cập nhật thủ công hoặc qua pipeline Bước 2 (lưu `gbif_raw`).
- **Công:** XS

### DEF-117 · High · Data
- **Vi phạm:** Kiểm toán dữ liệu xóa mềm (`audit_logs` cho hành động xóa hàng loạt).
- **Hiện trạng:** Có **2.020** mẫu vật có `deleted_at = 2026-11-18 09:38:03.379427+00` (cùng 1 micro giây, `distinct_minutes = 1`) nhưng **không có bất kỳ bản ghi `DELETE` nào tương ứng trong `audit_logs`** tại thời điểm đó — dấu hiệu bị xóa mềm bởi một câu lệnh/script SQL bulk trực tiếp ngoài API.
- **Kỳ vọng:** Xác định rõ nguồn gốc đợt xóa mềm 2.020 mẫu vật (dọn dữ liệu rác, test hay sự cố) và ghi nhận biên bản kiểm toán.
- **Đề xuất:** Không tự động khôi phục hay chạm vào 2.020 bản ghi này; chờ chủ sở hữu dữ liệu xác nhận nguồn gốc.
- **Công:** S

### DEF-118 · Medium · Data
- **Vi phạm:** Toàn vẹn danh mục phân loại (`taxa` trùng lặp tên Chi).
- **Hiện trạng:** Bảng `taxa` có nhiều bản ghi bậc `Genus` trùng tên `Conocephalus` (nhiều nhánh/homonym), khiến 19 mẫu nhị danh sạch (`Conocephalus maculatus`, `Conocephalus melaenus`) chưa thể tạo loài tự động an toàn ở Bước 1.
- **Kỳ vọng:** Mỗi chi hợp lệ trong cùng một Bộ chỉ có duy nhất một bản ghi `accepted` chuẩn, các bản ghi trùng được hợp nhất hoặc đánh dấu `synonym` trỏ về `accepted_taxon_id`.
- **Đề xuất:** Rà soát và hợp nhất các bản ghi `Genus` trùng tên trong bảng `taxa`.
- **Công:** S

### DEF-119 · Low · Data
- **Vi phạm:** Nhất quán phân loại khi xuất Darwin Core Archive (DwC-A).
- **Hiện trạng:** Bảng `taxa` dùng Catalogue of Life (CoL) làm backbone nên một số loài có họ khác với GBIF Backbone (ví dụ *Supella longipalpa*: CoL = `Ectobiidae`, GBIF = `Pseudophyllodromiidae`).
- **Kỳ vọng:** Khi xuất DwC-A, cần ghi rõ nguồn phân loại (CoL backbone) và xử lý nhất quán giữa `family` của hệ thống với `gbif_raw`.
- **Đề xuất:** Chuẩn hóa metadata `eml.xml` và tài liệu mapping DwC-A nêu rõ CoL backbone.
- **Công:** XS
