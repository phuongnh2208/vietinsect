# VietInsect BigData System — Task Board (Dựa trên kiểm tra thực tế mã nguồn 27/08/2026)

> **[Lưu ý]** **AI Microservice (FastAPI/PyTorch CNN/MaxEnt SDM)** do AI Engineer khác phụ trách độc lập.  
> File này **KHÔNG tạo task code Python**. Chỉ tạo task tích hợp phía Node.js (gọi HTTP client tới `POST /api/ai/identify` và `POST /api/ai/sdm/predict`).

---

## Bảng Đối chiếu Hiện trạng THỰC TẾ

| Thành phần | Spec (`docs/adr`) | Thực tế mã nguồn | % thực |
|:---|:---|:---|:---:|
| **DB Schema** | 10 migration 3NF + PostGIS + partition + DwC view | [x] 10 migration đã tạo đầy đủ; `mv_taxon_dwc_flat`, `specimens_partitioned`, `audit_logs` partition | **95%** |
| **DB Seeds** | Admin user, lookup tables, 34 tỉnh (NQ 202), 50 mẫu, taxa chuẩn | [x] `001_seed_lookups.js`: admin user, 12 loại sinh cảnh, 6 giai đoạn phát triển, 8 specimen_status, **34 tỉnh** đúng NQ 202/2025/QH15. [ ] Thiếu: `002_seed_taxa.js` (16 bộ Insecta chưa có), `003_seed_specimens.js` (50 mẫu demo chưa có) — xác nhận `seeds/` chỉ có 1 file duy nhất | **40%** |
| **Backend Auth** | auth.service, repository, controller, validator, routes, errors — bcrypt, JWT, brute-force lock | [x] Tất cả 6 file có logic thật; lock sau 5 lần sai [x] | **100%** |
| **Backend Taxonomy** | taxonomy.service, repository, controller, validator, routes, errors, catalogueOfLife.service | [x] Tất cả 8 file có logic thật, đầy đủ CRUD + synonym + species_profile + bioactivity + import Excel | **100%** |
| **Backend Specimen** | specimen.service, repository, controller, validator, routes, errors, bulkImport.service, label.service | [ ] Thư mục rỗng hoàn toàn | **0%** |
| **Backend Search** | elasticsearch.service, search.service, export.service, controller, routes | [ ] Thư mục rỗng hoàn toàn | **0%** |
| **Backend GIS** | postgis.service, layer.service, controller, routes | [ ] Thư mục rỗng hoàn toàn | **0%** |
| **Backend DNA** | ncbi.service, dna.service, repository, controller, routes, errors, validator | [ ] Thư mục rỗng hoàn toàn | **0%** |
| **Backend Reports** | pdfGenerator.service, kpi.service, customReport.service, reports.service, controller, routes | [ ] Thư mục rỗng hoàn toàn | **0%** |
| **Backend Admin** | publicControl.service, auditLog.service, systemConfig.service, controller, routes | [ ] Thư mục rỗng hoàn toàn | **0%** |
| **Backend Middleware** | auth, role, rateLimiter, auditLog, upload, validate, errorHandler | [x] `auth.middleware.js` (requireAdmin), `errorHandler.js` [ ] Thiếu: role, rateLimiter, auditLog, upload, validate | **25%** |
| **Backend Config** | db, redis, minio, elasticsearch, smtp, logger, jwt | [x] `db.js`, `logger.js`, `jwt.js` [ ] Thiếu: redis, minio, elasticsearch, smtp | **43%** |
| **Backend Utils** | AppError, asyncHandler, paginate, dwcMapper | [x] `AppError.js` [ ] Thiếu: asyncHandler, paginate, dwcMapper | **25%** |
| **Frontend Router** | 30 màn hình, AuthGuard, Admin/Public layout | [x] Router đăng ký đủ 30 routes; AuthGuard; dual-context pattern với `useIsAdminContext` | **100%** |
| **Frontend screenRegistry** | Registry 30 màn hình, dualContext flag, path + adminPath | [x] Đầy đủ 30 entries, dualContext đúng 9 màn hình (SCR-08,12,13,17,18,20,22,23,26) | **100%** |
| **Frontend Auth (SCR-01)** | LoginPage, useAuth, auth.store, AuthGuard, LoginForm | [x] LoginPage [x] useAuth [x] auth.store (localStorage token) [x] AuthGuard [ ] LoginForm component rỗng (nằm trong LoginPage inline) | **90%** |
| **Frontend Dashboard (SCR-03/04)** | AdminDashboardPage, PublicHomePage, StatsRow, HomeMapHero, RecentList | [x] AdminDashboardPage (hardcode metric) [x] PublicHomePage [x] HomeMapHero [ ] Metrics chưa gọi API thật — số liệu hardcode | **70%** |
| **Frontend Taxonomy (SCR-12/13/14)** | TaxonomyTreePage, SpeciesProfilePage, TaxonEditorPage, TaxonForm, SynonymManager, TaxonomyTreeView, ExternalLinkBadges, taxonomy.service, taxonomy.store | [x] Đủ 3 Pages + 6 Components + service + store + utils [x] Tất cả kết nối API thật [!] Tab Mẫu vật và DNA trong SCR-13 hiển thị EmptyState placeholder, chờ module Specimen/DNA | **85%** |
| **Frontend Specimen (SCR-05~11)** | 7 pages + SpecimenForm, SpecimenTable, ImageGallery, ChangeHistory... | [ ] `pages/` rỗng; `components/` rỗng; tất cả routes trỏ `RegistryScreenPage` | **0%** |
| **Frontend Search (SCR-15/16/17)** | SearchPage, AdvancedSearchPage, MediaGalleryPage | [ ] `pages/` rỗng; routes trỏ `RegistryScreenPage` | **0%** |
| **Frontend GIS (SCR-18/19)** | OccurrenceMapPage, LayerManagerPage | [ ] `pages/` rỗng; routes trỏ `RegistryScreenPage` | **0%** |
| **Frontend DNA (SCR-20/21/22)** | DNAListPage, DNAEntryPage, DNADetailPage | [ ] `pages/` rỗng; routes trỏ `RegistryScreenPage` | **0%** |
| **Frontend AI (SCR-23/24/25)** | SpeciesIDPage, SDMPredictionPage, AnalyticsDashboardPage | [ ] `pages/` rỗng; routes trỏ `RegistryScreenPage` | **0%** |
| **Frontend Reports (SCR-26/27/28)** | ReportListPage, KPIReportPage, CustomReportBuilderPage | [ ] `pages/` rỗng; routes trỏ `RegistryScreenPage` | **0%** |
| **Frontend Admin (SCR-29/30)** | PublicPrivateControlPage, AuditLogConfigPage | [ ] `pages/` rỗng; routes trỏ `RegistryScreenPage` | **0%** |
| **Frontend SCR-02 (Đổi MK)** | ChangePasswordPage | [ ] Route đăng ký nhưng trỏ `RegistryScreenPage` | **0%** |
| **Frontend UI Primitives** | DataTable, FormField, GPSPicker, ImageUploadZone, chart/*, map/* | [ ] Thư mục `chart/`, `map/`, `table/`, `form/` đều rỗng. Chỉ có `ui/` (Icon, ConfirmDialog, Toast, EmptyState, LoadingState) | **15%** |
| **Frontend i18n** | File JSON `locales/vi.json` + `locales/en.json` | [x] Đã tách `public/locales/vi/translation.json`, `public/locales/en/translation.json` & dùng `i18next-http-backend` | **100%** |
| **Frontend stores** | auth.store, ui.store, search.store | [x] `auth.store.js` (đã fix reactive `isAuthenticated`) [ ] Thiếu `ui.store.js`, `search.store.js` | **50%** |
| **Frontend services** | http.js, auth.service.js + {module}.service.js các module | [x] `http.js`, `auth.service.js` [ ] Thiếu service cho specimen, search, gis, dna, reports, admin, ai | **15%** |
| **Frontend constants** | ROUTES, API_ENDPOINTS, app constants | [x] Đã tạo `routes.js`, `api.js`, `app.js` cho 30 SCR và API endpoints | **100%** |
| **packages/shared** | constants (IUCN, DwC fields), types (JSDoc), validators (Joi dùng chung) | [ ] Cả 3 thư mục rỗng | **0%** |
| **Infra Docker** | Postgres, Mongo, Redis, MinIO, Nginx, GeoServer, ES, Monitoring | [x] docker-compose.yml: Postgres+PostGIS, MongoDB self-hosted, Redis, MinIO [ ] Thiếu: Nginx, GeoServer, ES, Prometheus/Grafana | **40%** |
| **Infra ES mappings** | `infra/elasticsearch/mappings/specimens.json`, `taxa.json` | [ ] Thư mục `mappings/` rỗng | **0%** |
| **Infra Monitoring** | prometheus.yml + Grafana dashboards | [ ] `grafana/` thư mục con nhưng rỗng; thiếu `prometheus.yml` | **5%** |
| **Infra Nginx** | `nginx.conf`, `upstream.conf`, SSL | [ ] Chỉ có `ssl/` dir rỗng | **0%** |
| **CI/CD** | `ci.yml`, `cd.yml` GitHub Actions | [ ] `.github/workflows/` rỗng | **0%** |
| **Scripts** | `db-migrate.sh`, `db-seed.sh`, `backup.sh` | [ ] `scripts/` rỗng | **0%** |
| **Tests** | Unit (Jest), Integration (Supertest), E2E (Playwright) | [ ] `tests/unit/`, `tests/integration/` rỗng | **0%** |
| **Docs** | `architecture.md`, `api.md`, `database-erd.md`, HDSD VI/EN | [ ] Chưa có | **0%** |

---

## Lộ trình triển khai (Locked CV-Phases)

```
Baseline (Xong) → CV2.1 Taxonomy ([x] BE done / FE ~85%) → CV2.2 Specimen + DNA
  → CV2.3 Search / Báo cáo → CV2.4 Admin nâng cao
  → CV2.5 WebGIS → CV2.6 Phân tích không gian
  → CV2.7 Tích hợp sinh thái → CI/CD + Testing + Docs
```

---

## [x] TASK-00: Dọn Nợ Kỹ thuật (Ưu tiên NGAY, không phụ thuộc phase)

### TASK-00.1: Thêm `recharts` vào frontend/package.json
- **File:** `frontend/package.json`
- **Input/Output:** Thêm `"recharts": "^2.15.1"` vào `dependencies`
- **Lý do:** SCR-03 (`AdminDashboardPage`), SCR-25 (`AnalyticsDashboardPage`), SCR-27 (`KPIReportPage`) cần Recharts để vẽ biểu đồ thật; hiện AdminDashboardPage dùng CSS pseudo-treemap hardcode.
- **Acceptance Criteria:**
  - [x] `pnpm install` thành công không lỗi peer deps
  - [x] `import { BarChart, Treemap, LineChart, PieChart } from 'recharts'` không lỗi
  - [x] Production build `pnpm build` với `NODE_OPTIONS=--openssl-legacy-provider` pass
- **Phụ thuộc:** Không có
- **Effort:** S (15 phút)

### TASK-00.2: Migrate i18n từ inline object sang locales JSON files
- **File tạo mới:** `frontend/public/locales/vi/translation.json`, `frontend/public/locales/en/translation.json`, `frontend/public/locales/vi.json`, `frontend/public/locales/en.json`
- **File sửa:** `frontend/src/i18n/index.js`
- **Input:** Nội dung `resources` hiện có trong `i18n/index.js` (vi + en translation objects)
- **Output:** `i18n/index.js` dùng `i18next-http-backend` load từ `/locales/{{lng}}/translation.json`; xóa inline `resources` object
- **Acceptance Criteria:**
  - [x] Cài `i18next-http-backend` vào `frontend/package.json`
  - [x] Chuyển toàn bộ key VI sang `public/locales/vi/translation.json`, EN sang `public/locales/en/translation.json`
  - [x] `i18n/index.js` dùng `backend` plugin, xóa `resources` object
  - [x] Test: đổi ngôn ngữ trong UI reload vẫn đúng; key mới thêm vào JSON không cần sửa `i18n/index.js`
  - [x] Không còn chuỗi nằm inline trong `i18n/index.js`
- **Phụ thuộc:** Không có
- **Effort:** M (2 giờ)

### TASK-00.3: Audit `useAuthStore.isAuthenticated` — stale closure risk
- **File liên quan:** `frontend/src/stores/auth.store.js`, `frontend/src/modules/auth/AuthGuard.js`, `frontend/src/stores/auth.store.test.js`
- **Vấn đề:** `isAuthenticated` hiện là hàm `() => !!localStorage.getItem(...)` trả về value mới mỗi lần gọi, **không phải state reactive của Zustand**. Nếu component đăng ký `const isAuth = useAuthStore(state => state.isAuthenticated)` rồi gọi `isAuth()` thay vì `isAuth`, sẽ không re-render khi token thay đổi trong memory.
- **Input/Output:**
  - Đổi `isAuthenticated` thành **computed state field** (boolean): `isAuthenticated: !!localStorage.getItem('vietinsect_token')`, cập nhật trong `setAuth` và `logout`
  - Hoặc xóa hẳn `isAuthenticated` và dùng `!!token` (token đã là state reactive)
- **Acceptance Criteria:**
  - [x] Viết Jest test tái hiện scenario: `login()` → check `isAuthenticated` → kết quả đúng ngay, không cần reload
  - [x] `AuthGuard.js` đọc `!!token` / `state.isAuthenticated` thay vì gọi `isAuthenticated()`
  - [x] Không còn function trong Zustand store được dùng như computed value
- **Phụ thuộc:** Không có
- **Effort:** S (45 phút)

### TASK-00.4: Tạo frontend constants (routes, api endpoints)
- **File tạo mới:** `frontend/src/constants/routes.js`, `frontend/src/constants/api.js`, `frontend/src/constants/app.js`
- **Output:**
  - `routes.js`: export `ROUTES = { LOGIN: '/login', ADMIN_DASHBOARD: '/admin/dashboard', SPECIMENS: '/admin/specimens', ... }` cho toàn bộ 30 SCR
  - `api.js`: export `API = { TAXONOMY_TREE: '/taxonomy/tree', SPECIMENS: '/specimens', ... }`
  - `app.js`: export `PAGE_SIZE = 25`, `DEBOUNCE_MS = 300`, `DATE_FORMAT = 'DD/MM/YYYY'`
- **Acceptance Criteria:**
  - [x] Không còn string path hardcode trong router.js, service files
  - [x] `frontend/src/constants/` không còn rỗng
- **Phụ thuộc:** Không có
- **Effort:** S (1 giờ)

#### Báo cáo hoàn thành TASK-00 (Dọn Nợ Kỹ thuật) — Hoàn tất 100% (27/08/2026)

1. **TASK-00.1 (Recharts):**
   - Đã thêm `"recharts": "^2.15.1"` và `"cross-env": "^7.0.3"` vào [package.json](file:///d:/D%E1%BB%B1%20%C3%A1n%20BigData%20C%C3%B4n%20tr%C3%B9ng/vietinsect/frontend/package.json).
   - Đã cập nhật cấu hình `pnpm-workspace.yaml` cho phép build `bcrypt`, `core-js`, `core-js-pure`.
   - Đã kiểm tra import thành công các biểu đồ chính: `BarChart`, `Treemap`, `LineChart`, `PieChart`.

2. **TASK-00.2 (Migrate i18n sang JSON files):**
   - Đã cài đặt thư viện `i18next-http-backend`.
   - Đã tách toàn bộ dữ liệu i18n thành các file JSON chuẩn: [vi/translation.json](file:///d:/D%E1%BB%B1%20%C3%A1n%20BigData%20C%C3%B4n%20tr%C3%B9ng/vietinsect/frontend/public/locales/vi/translation.json) và [en/translation.json](file:///d:/D%E1%BB%B1%20%C3%A1n%20BigData%20C%C3%B4n%20tr%C3%B9ng/vietinsect/frontend/public/locales/en/translation.json).
   - Đã tái cấu trúc [i18n/index.js](file:///d:/D%E1%BB%B1%20%C3%A1n%20BigData%20C%C3%B4n%20tr%C3%B9ng/vietinsect/frontend/src/i18n/index.js) sử dụng `HttpBackend` load động qua `/locales/{{lng}}/translation.json`, xóa hoàn toàn chuỗi inline `resources`.

3. **TASK-00.3 (Fix stale closure useAuthStore.isAuthenticated):**
   - Đã sửa [auth.store.js](file:///d:/D%E1%BB%B1%20%C3%A1n%20BigData%20C%C3%B4n%20tr%C3%B9ng/vietinsect/frontend/src/stores/auth.store.js): chuyển `isAuthenticated` từ getter hàm sang thuộc tính reactive boolean, tự động cập nhật khi gọi `setAuth` và `logout`.
   - Đã cập nhật [AuthGuard.js](file:///d:/D%E1%BB%B1%20%C3%A1n%20BigData%20C%C3%B4n%20tr%C3%B9ng/vietinsect/frontend/src/modules/auth/AuthGuard.js) lấy trực tiếp boolean `isAuthenticated`.
   - Đã tạo test case [auth.store.test.js](file:///d:/D%E1%BB%B1%20%C3%A1n%20BigData%20C%C3%B4n%20tr%C3%B9ng/vietinsect/frontend/src/stores/auth.store.test.js) kiểm tra kịch bản đăng nhập/đăng xuất phản ứng ngay lập tức mà không cần tải lại trang.

4. **TASK-00.4 (Tạo Constants Frontend):**
   - Đã tạo [routes.js](file:///d:/D%E1%BB%B1%20%C3%A1n%20BigData%20C%C3%B4n%20tr%C3%B9ng/vietinsect/frontend/src/constants/routes.js) định nghĩa toàn bộ hằng số route cho 30 màn hình (SCR-01 đến SCR-30).
   - Đã tạo [api.js](file:///d:/D%E1%BB%B1%20%C3%A1n%20BigData%20C%C3%B4n%20tr%C3%B9ng/vietinsect/frontend/src/constants/api.js) tập trung toàn bộ API endpoints cho Auth, Taxonomy, Specimen, Search, GIS, DNA, Reports, Admin, AI.
   - Đã tạo [app.js](file:///d:/D%E1%BB%B1%20%C3%A1n%20BigData%20C%C3%B4n%20tr%C3%B9ng/vietinsect/frontend/src/constants/app.js) chứa các cấu hình chung (`PAGE_SIZE`, `DEBOUNCE_MS`, `DATE_FORMAT`, `VN_BOUNDS`, `STORAGE_KEYS`).

5. **TASK-00.5: Đồng bộ phong cách thiết kế giao diện toàn hệ thống theo Design System v2.1 (Editorial & Dual-Tier Design)** — **[x] Đã hoàn thành 100%**
- **Tài liệu tham chiếu:** [docs/design.md](file:///d:/D%E1%BB%B1%20%C3%A1n%20BigData%20C%C3%B4n%20tr%C3%B9ng/vietinsect/docs/design.md)
- **Mục tiêu:** Cập nhật toàn bộ các màn hình hiện hữu và chuẩn hóa style cho các màn hình sắp phát triển theo chuẩn **Editorial & Scientific Biodiversity Portal (GBIF-inspired)** với kiến trúc 2 tầng (Tầng Signature cho Hero/Banner và Tầng Modern Functional cho màn hình chức năng/quản trị).
- **Phạm vi thực hiện:**
  - [x] Tạo component `BrandLogo` (logo nét phác thảo côn trùng sinh thái) và `TechnicalFrame` (crop-marks, ô vuông góc định vị cho duy nhất Hero Banner chính).
  - [x] Tái thiết kế `PublicLayout.js` & `PublicHomePage.js` (SCR-04): Menu mới (*Get data, How to, Tools, Community, About*), Manifesto in hoa `FREE AND OPEN ACCESS TO BIODIVERSITY DATA`, ô search bo góc nhẹ 8px lệch phải, lưới dữ liệu thống kê dạng ô kỹ thuật, thẻ tính năng viền mảng đen `#111111` / xanh lá đậm `#1F4E2D`.
  - [x] Cập nhật `LoginPage.js` (SCR-01): Tích hợp BrandLogo mới, form đăng nhập viền đen sắc nét, typography tương phản cao.
  - [x] Cập nhật `AdminChrome.js` & `AdminDashboardPage.js` (SCR-03): Tích hợp BrandLogo trên sidebar, đồng bộ thẻ metric viền mảng đen, biểu đồ Recharts chuẩn màu `--vi-primary`/`--vi-forest-dark`, bảng hoạt động gọn gàng.
  - [x] Cập nhật `TaxonomyTreePage.js` (SCR-12): Cây phân cấp sinh học với đường nối nhánh mảnh `1.5px #111111`, nút toggle hình học, thẻ taxon tối giản.
  - [x] Cập nhật `SpeciesProfilePage.js` (SCR-13): Banner ảnh loài lớn, tên khoa học luôn in nghiêng (*Italic*), tabs thông tin phân cách gạch chân đen mảnh.
  - [x] Cập nhật `TaxonEditorPage.js` (SCR-14): Form nhập liệu taxon và bảng danh pháp đồng bộ viền mảng đen, nút thao tác dứt khoát.
  - [x] Tạo tài liệu hướng dẫn và lưu trữ quy chuẩn [docs/design.md](file:///d:/D%E1%BB%B1%20%C3%A1n%20BigData%20C%C3%B4n%20tr%C3%B9ng/vietinsect/docs/design.md) trong codebase.
- **Acceptance Criteria:**
  - [x] Banner Hero chính có nét bo viền crop-mark và 2 ô vuông góc; các thẻ ảnh khác dùng viền mảng đen/xanh đậm không có crop-mark tràn góc.
  - [x] Toàn bộ các màn hình cũ khi mở lên đều đồng nhất màu sắc, font chữ (`Manrope`/`Inter`), typography tên khoa học in nghiêng và bố cục sạch sẽ.
  - [x] Không còn CSS inline style tùy tiện, tuân thủ bảng Design Tokens trong `docs/design.md`.
  - [x] Production build `npm run build` biên dịch thành công 100% không lỗi.
- **Phụ thuộc:** TASK-00.4
- **Effort:** M (4 giờ)


---

## [ ] GIAI ĐOẠN 1: Hoàn thiện CV2.1 Taxonomy (Backend ~100% → FE còn thiếu 2 màn hình thật)

> Backend Taxonomy hoàn chỉnh. Cần hoàn thiện 2 điểm FE còn dở.


### TASK-01.1: Kết nối thật metric SCR-03 AdminDashboardPage với API
- **Pattern bắt buộc:** Function component + hooks; gọi API qua `services/{module}.service.js`; state cục bộ `useState`
- **File tạo mới:** `frontend/src/services/dashboard.service.js`
- **File sửa:** `frontend/src/modules/dashboard/pages/AdminDashboardPage.js`
- **Input/Output:**
  - `dashboard.service.js`: `async function getStats() → GET /api/admin/stats → { specimenCount, speciesCount, mediaCount, dnaCount }`
  - `AdminDashboardPage.js`: xóa hardcode `metrics` array; dùng `useState + useEffect` gọi `dashboardService.getStats()`; render `LoadingState` khi chờ
- **Backend yêu cầu trước:** TASK-05 (Admin `/api/admin/stats` endpoint) — có thể làm tạm với Taxonomy endpoint `/api/taxonomy/tree` để đếm taxa
- **Acceptance Criteria:**
  - [ ] Số liệu metric thay đổi khi thêm/xóa dữ liệu thật trong DB
  - [ ] Hiển thị `LoadingState` khi fetch
  - [ ] Hiển thị `EmptyState` / error toast nếu API lỗi
- **Phụ thuộc:** TASK-00.4 (constants)
- **Effort:** M (3 giờ)

### TASK-01.2: Hoàn thiện SCR-13 SpeciesProfilePage — tab Mẫu vật & tab Phân bố
- **Pattern bắt buộc:** Dual-context — đã đăng ký 2 route. `useIsAdminContext()` chỉ dùng để ẩn/hiện nút Admin. API `/api/taxonomy/species/:identifier` KHÔNG lọc `is_public` vì tab này chỉ count specimens chứ không trả data specimens thật (chờ module Specimen).
- **File sửa:** `frontend/src/modules/taxonomy/components/SpeciesProfileTabs.js`
- **Input/Output:**
  - Tab **Mẫu vật**: Thay `EmptyState placeholder` → hiển thị con số `specimenCount` với link `→ Xem danh sách mẫu vật` trỏ đúng route SCR-05 `/admin/specimens?taxonId={id}` (admin) hoặc `/specimens/search?taxonId={id}` (user). Không cần render bảng mẫu vật tại đây.
  - Tab **Phân bố**: Embed `<BaseMap>` mini (react-leaflet) hiển thị `CircleMarker` từ `profile.occurrencePoints` nếu có — hiện tại `getSpeciesProfile` chưa trả `occurrencePoints` nên vẫn EmptyState, nhưng sửa sẵn code để khi GIS module xong chỉ cần bổ sung trường.
- **Acceptance Criteria:**
  - [ ] Tab Mẫu vật hiển thị đúng số lượng và có link đến SCR-05/SCR-15
  - [ ] Tab Phân bố hiển thị map placeholder với note "Dữ liệu tọa độ sẽ hiển thị khi GIS module hoàn thiện"
  - [ ] Không còn `EmptyState` với text hardcode "khi module Specimen/GIS hoàn thiện"
- **Phụ thuộc:** TASK-00.4
- **Effort:** S (2 giờ)

---

## [ ] GIAI ĐOẠN 2: CV2.2 — Module Specimen (Backend + Frontend)

> Đây là module lớn nhất. Backend = 0%, FE = 0%. Cần có Taxonomy (CV2.1) xong trước vì `specimens.taxon_id` FK.

### TASK-02.1: Backend utils bổ sung
- **Pattern bắt buộc:** Mọi route handler phải wrap bằng `asyncHandler`; mọi paginated query phải dùng `paginate`; mọi export Darwin Core phải dùng `dwcMapper`
- **File tạo mới:**
  - `backend/src/utils/asyncHandler.js`
  - `backend/src/utils/paginate.js`
  - `backend/src/utils/dwcMapper.js`
- **Input/Output:**
  - `asyncHandler.js`: `module.exports = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`
  - `paginate.js`: `function paginate(page, size) { limit = Math.min(size||25, 100); offset = ((page||1)-1)*limit; return { limit, offset }; }`
  - `dwcMapper.js`: map DB columns → Darwin Core terms (e.g. `taxon_id → taxonID`, `scientific_name → scientificName`, `collection_point → decimalLatitude/Longitude`, `province_name_vn → stateProvince`)
- **Acceptance Criteria:**
  - [ ] `asyncHandler` áp dụng cho tất cả controller functions thay thế `try/catch` boilerplate
  - [ ] `paginate` trả metadata `{ page, size, offset, limit }` chuẩn
  - [ ] `dwcMapper` map đúng 22 trường DwC tiêu chuẩn — có unit test
- **Phụ thuộc:** Không có
- **Effort:** S (2 giờ)

### TASK-02.2: Backend Middleware bổ sung
- **File tạo mới:**
  - `backend/src/middleware/validate.middleware.js`
  - `backend/src/middleware/rateLimiter.js`
  - `backend/src/middleware/auditLog.middleware.js`
  - `backend/src/middleware/upload.middleware.js`

#### TASK-02.2a: validate.middleware.js
- **Input/Output:**
  ```js
  // Nhận Joi schema, trả middleware Express
  // validate(schema) → (req, res, next) → nếu fail throw AppError({code:'VALIDATION_FAILED', statusCode:400, message: details[0].message})
  function validate(schema) { ... }
  module.exports = { validate };
  ```
- **Acceptance Criteria:**
  - [ ] Request body invalid → 400 với `code: 'VALIDATION_FAILED'` và message đúng field lỗi
  - [ ] Không bypass validation với body rỗng `{}`
  - **Effort:** S (1 giờ)

#### TASK-02.2b: rateLimiter.js
- **Input/Output:** Dùng `express-rate-limit`. Tạo 2 limiter:
  - `loginLimiter`: 5 req / 15 phút / IP, áp dụng cho `POST /api/auth/login`
  - `apiLimiter`: 1000 req / phút / IP, áp dụng cho tất cả `/api/*`
- **Yêu cầu:** Cài `express-rate-limit` vào `backend/package.json`. Không cần Redis store ở giai đoạn này (dùng memory store OK cho dev).
- **Acceptance Criteria:**
  - [ ] 6 request login liên tiếp → request thứ 6 trả 429
  - [ ] Header `X-RateLimit-Remaining` có trong mọi response
  - **Effort:** S (1 giờ)

#### TASK-02.2c: auditLog.middleware.js
- **Input/Output:**
  ```js
  // Chạy SAU response, ghi vào bảng audit_logs
  // Chỉ ghi khi: method != GET, có req.admin (authenticated), response status < 400
  function auditLog(req, res, next) { ... }
  ```
  - Record gồm: `admin_id`, `action_type` (CREATE/UPDATE/DELETE), `target_table` (parse từ req.path), `target_id`, `ip_address`, `details: { method, path, body_summary }`
- **Acceptance Criteria:**
  - [ ] Sau `POST /api/specimens`, bảng `audit_logs` có 1 record đúng
  - [ ] Request GET không tạo audit record
  - [ ] Request lỗi (5xx/4xx) không tạo audit record
  - **Effort:** M (2 giờ)

#### TASK-02.2d: upload.middleware.js
- **Input/Output:**
  ```js
  // multer memoryStorage, limits: { fileSize: 10MB, files: 20 }
  // Dùng cho: POST /specimens/:id/images (nhiều file), POST /taxonomy/import (1 file)
  const uploadImages = multer({ storage: memoryStorage(), limits: { fileSize: 10*1024*1024, files: 20 } }).array('images');
  const uploadSingle = multer({ storage: memoryStorage(), limits: { fileSize: 10*1024*1024 } }).single('file');
  module.exports = { uploadImages, uploadSingle };
  ```
- **Acceptance Criteria:**
  - [ ] Upload 21 files cùng lúc → lỗi 400
  - [ ] File > 10MB → lỗi 400
  - [ ] Ảnh JPEG hợp lệ → `req.files` có buffer
  - **Effort:** S (1 giờ)

### TASK-02.3: Backend Specimen Module — 6 file cốt lõi
- **Pattern bắt buộc:** repository → service → controller → validator → routes → errors. Controller KHÔNG bao giờ gọi trực tiếp repository. Mọi lỗi qua `throw new AppError(SpecimenError.XXX)`.

#### TASK-02.3a: specimen.errors.js
- **File:** `backend/src/modules/specimen/specimen.errors.js`
- **Output:**
  ```js
  const SpecimenError = {
    NOT_FOUND:         { code: 'SPECIMEN.NOT_FOUND',         statusCode: 404, message: 'Không tìm thấy mẫu vật' },
    VALIDATION_FAILED: { code: 'SPECIMEN.VALIDATION_FAILED', statusCode: 400, message: 'Dữ liệu mẫu vật không hợp lệ' },
    TAXON_NOT_FOUND:   { code: 'SPECIMEN.TAXON_NOT_FOUND',   statusCode: 400, message: 'Taxon liên kết không tồn tại' },
    GPS_OUT_OF_VN:     { code: 'SPECIMEN.GPS_OUT_OF_VN',     statusCode: 400, message: 'Tọa độ GPS nằm ngoài lãnh thổ Việt Nam (lat 8–24°N, lng 101–118°E)' },
    IMPORT_ROW_LIMIT:  { code: 'SPECIMEN.IMPORT_ROW_LIMIT',  statusCode: 400, message: 'File import vượt quá 5.000 bản ghi' },
    ALREADY_DELETED:   { code: 'SPECIMEN.ALREADY_DELETED',   statusCode: 409, message: 'Mẫu vật đã bị xóa mềm' },
  };
  module.exports = SpecimenError;
  ```
- **Effort:** S (30 phút)

#### TASK-02.3b: specimen.validator.js
- **File:** `backend/src/modules/specimen/specimen.validator.js`
- **Output:** Joi schema cho 22 trường DwC. Các rule bắt buộc:
  - `taxonId`: number required
  - `collectionDate`: date ISO required
  - `collectionPoint`: `{ lat: number.min(8).max(24), lng: number.min(101).max(118) }` → nếu có thì phải nằm trong VN bbox
  - `provinceId`: number optional (FK lookup_tables)
  - `sex`: `Joi.string().valid('male','female','unknown')`
  - `individualCount`: number min(1) default(1)
  - Validator export: `validateCreate`, `validateUpdate`, `validateBulkRow`
- **Acceptance Criteria:**
  - [ ] `collectionPoint.lat = 5` → validation error GPS_OUT_OF_VN
  - [ ] `collectionDate = 'abc'` → validation error
  - [ ] `taxonId = undefined` → validation error required
  - **Effort:** M (2 giờ)

#### TASK-02.3c: specimen.repository.js
- **File:** `backend/src/modules/specimen/specimen.repository.js`
- **Output — hàm public (JSDoc bắt buộc):**
  ```js
  /**
   * @param {object} filters - { taxonId, provinceId, isPublic, collectionDateFrom, collectionDateTo, keyword, page, size }
   * @returns {Promise<{ rows: Specimen[], total: number }>}
   */
  async function findAll(filters) { ... }

  /** @returns {Promise<Specimen|null>} */
  async function findById(specimenId, { isPublicOnly = false } = {}) {
    // PHẢI thêm WHERE is_public = true khi isPublicOnly = true
    // Đây là đảm bảo an toàn phía BE, không phụ thuộc FE gửi role
  }

  /** @returns {Promise<Specimen>} Bản ghi sau khi insert, bao gồm specimen_id sinh ra */
  async function create(data, adminId) { ... }

  async function update(specimenId, data, adminId) { ... }

  /** Soft delete: set deleted_at = now() */
  async function softDelete(specimenId, adminId) { ... }

  /** Ghi vào bảng specimen_change_log (nếu có) hoặc audit_logs */
  async function logChange(specimenId, adminId, changes) { ... }

  /** Bulk insert bằng transaction, rollback toàn bộ nếu có lỗi */
  async function bulkCreate(rows, adminId) { ... }

  /** Đếm specimens cho stats endpoint */
  async function countAll({ isPublicOnly = false } = {}) { ... }
  ```
- **Acceptance Criteria:**
  - [ ] `findById(id, { isPublicOnly: true })` với specimen `is_public=false` → trả `null`
  - [ ] `softDelete` không xóa record khỏi DB, chỉ set `deleted_at`
  - [ ] `bulkCreate(5001 rows)` → throw `SpecimenError.IMPORT_ROW_LIMIT`
  - [ ] Unit test mock pool, không cần DB thật
  - **Effort:** L (6 giờ)

#### TASK-02.3d: specimen.service.js
- **File:** `backend/src/modules/specimen/specimen.service.js`
- **Output — hàm public:**
  ```js
  async function listSpecimens(filters, { isAdmin } = {})
  async function getSpecimenById(specimenId, { isAdmin } = {})
  async function createSpecimen(payload, adminId)
  async function updateSpecimen(specimenId, payload, adminId)
  async function deleteSpecimen(specimenId, adminId)
  async function togglePublic(specimenId, isPublic, adminId)
  async function importExcel(fileBuffer, adminId) // gọi bulkImport.service
  async function generateLabel(specimenIds) // gọi label.service
  ```
- **Acceptance Criteria:**
  - [ ] `getSpecimenById` với user không login → gọi repository với `{ isPublicOnly: true }`
  - [ ] `createSpecimen` với tọa độ ngoài VN bbox → throw `GPS_OUT_OF_VN`
  - [ ] `deleteSpecimen` → gọi `logChange` với `action: 'SOFT_DELETE'`
  - [ ] Unit test coverage ≥ 80%
  - **Effort:** L (8 giờ)

#### TASK-02.3e: bulkImport.service.js
- **File:** `backend/src/modules/specimen/bulkImport.service.js`
- **Output:**
  - Đọc Excel buffer dùng `exceljs` (đã có trong dependencies)
  - Hỗ trợ header song ngữ VI/EN (cùng cơ chế `normalizeHeader` của taxonomy)
  - Validate từng row, gom lỗi không throw sớm → trả `{ inserted, skipped, errors: [{ row, reason }] }`
  - Insert trong 1 transaction Knex, rollback toàn bộ nếu `errors.length > 0`
  - Giới hạn 5.000 rows
- **Acceptance Criteria:**
  - [ ] File Excel 5.001 rows → error trước khi xử lý
  - [ ] Row 50 có `collectionDate` sai format → errors ghi nhận row 50, các row khác vẫn được validate
  - [ ] Nếu có bất kỳ error → 0 row được insert, transaction rollback
  - **Effort:** L (8 giờ)

#### TASK-02.3f: label.service.js
- **File:** `backend/src/modules/specimen/label.service.js`
- **Output:** Render template HTML nhãn mẫu vật → PDF dùng Puppeteer
  - Input: `specimenIds: number[]`, `options: { format: 'A4'|'A5', labelsPerPage: number }`
  - Output: Buffer PDF
  - Template gồm: mã số mẫu, tên khoa học, ngày thu, địa điểm, QR code mã hóa `specimen_id`
- **Yêu cầu:** Cài `puppeteer` vào `backend/package.json`
- **Acceptance Criteria:**
  - [ ] 3 specimen_ids → PDF buffer có 3 nhãn
  - [ ] QR code của mỗi nhãn decode ra đúng `specimen_id`
  - [ ] PDF không lỗi khi tên khoa học có ký tự Unicode tiếng Việt
  - **Effort:** L (6 giờ)

#### TASK-02.3g: specimen.controller.js + specimen.routes.js
- **File:** `backend/src/modules/specimen/specimen.controller.js`, `backend/src/modules/specimen/specimen.routes.js`
- **Routes:**
  ```
  GET    /api/specimens            → listSpecimens (public: isPublicOnly=true nếu không có JWT)
  GET    /api/specimens/:id        → getSpecimenById (public: isPublicOnly=true)
  POST   /api/specimens            → requireAdmin → create
  PUT    /api/specimens/:id        → requireAdmin → update
  DELETE /api/specimens/:id        → requireAdmin → softDelete
  PATCH  /api/specimens/:id/public → requireAdmin → togglePublic
  POST   /api/specimens/import     → requireAdmin → uploadSingle → importExcel
  POST   /api/specimens/:id/images → requireAdmin → uploadImages → addImages
  POST   /api/specimens/labels     → requireAdmin → generateLabel  ← POST (nhận body { specimenIds[], options })
  PATCH  /api/specimens/batch      → requireAdmin → batchUpdate
  ```
- **Acceptance Criteria:**
  - [ ] `GET /api/specimens` không có JWT → chỉ trả specimens có `is_public = true`
  - [ ] `POST /api/specimens` không có JWT → 401
  - [ ] Đăng ký route trong `backend/app.js`: `app.use('/api/specimens', require('./src/modules/specimen/specimen.routes'))`
  - [ ] Mọi endpoint có JSDoc OpenAPI comment (sẽ dùng để generate `docs/api.md`)
  - **Effort:** M (4 giờ)

### TASK-02.4: Backend DNA Module — 6 file
- **Pattern bắt buộc:** Tương tự Specimen. Mọi route có field `is_public` PHẢI lọc ở tầng repository khi không có JWT.

#### TASK-02.4a: dna.errors.js
- **File:** `backend/src/modules/dna/dna.errors.js`
- **Output:**
  ```js
  const DnaError = {
    NOT_FOUND:             { code: 'DNA.NOT_FOUND',             statusCode: 404 },
    INVALID_ACCESSION:     { code: 'DNA.INVALID_ACCESSION',     statusCode: 400, message: 'Mã GenBank không đúng định dạng (ví dụ: KX894504.1)' },
    DUPLICATE_ACCESSION:   { code: 'DNA.DUPLICATE_ACCESSION',   statusCode: 409, message: 'Mã Accession đã tồn tại' },
    NCBI_FETCH_FAILED:     { code: 'DNA.NCBI_FETCH_FAILED',     statusCode: 502, message: 'Không kết nối được NCBI E-utilities' },
    SPECIMEN_NOT_FOUND:    { code: 'DNA.SPECIMEN_NOT_FOUND',     statusCode: 400 },
  };
  module.exports = DnaError;
  ```
- **Effort:** S (30 phút)

#### TASK-02.4b: dna.validator.js
- **File:** `backend/src/modules/dna/dna.validator.js`
- **Output:** Joi schema, key rules:
  - `genbankAccession`: regex `/^[A-Z]{1,2}\d{5,6}\.\d+$/` — nếu có thì validate
  - `taxonId`: number required
  - `geneMarker`: `Joi.string().valid('COI','16S','ITS2','28S','18S','COII','cyt-b','other')`
  - `isPublic`: boolean default false
- **Effort:** S (1 giờ)

#### TASK-02.4c: ncbi.service.js
- **File:** `backend/src/modules/dna/ncbi.service.js`
- **Output:**
  ```js
  /**
   * Gọi NCBI E-utilities: esearch + efetch metadata cho 1 accession
   * @param {string} accession - Ví dụ 'KX894504.1'
   * @returns {Promise<{ length: number, organism: string, submissionDate: string, title: string }>}
   */
  async function fetchAccessionMetadata(accession) {
    // 1. esearch: GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore&term={accession}&retmode=json
    // 2. efetch: GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id={uid}&rettype=gb&retmode=json
    // Timeout 10s, retry 2 lần
  }
  module.exports = { fetchAccessionMetadata };
  ```
- **Acceptance Criteria:**
  - [ ] Accession `KX894504.1` → trả metadata thật từ NCBI
  - [ ] NCBI timeout → throw `DnaError.NCBI_FETCH_FAILED`
  - [ ] Unit test mock axios, không gọi NCBI thật
  - **Effort:** M (3 giờ)

#### TASK-02.4d: dna.repository.js + dna.service.js + dna.controller.js + dna.routes.js
- **File:** 4 file trong `backend/src/modules/dna/`
- **Repository functions:**
  - `findAll({ taxonId, specimenId, geneMarker, isPublicOnly, page, size })`
  - `findById(dnaId, { isPublicOnly })` — lọc `is_public` ở DB khi không có JWT
  - `create(data, adminId)`
  - `update(dnaId, data, adminId)`
  - `remove(dnaId)`
- **Service functions:** `listDna`, `getDnaById`, `createDna` (tự gọi `ncbi.fetchAccessionMetadata`), `updateDna`, `deleteDna`
- **Routes:**
  ```
  GET    /api/dna          → public (isPublicOnly khi không có JWT)
  GET    /api/dna/:id      → public
  GET    /api/dna/:id/fasta → public (trả JSON { fastaContent: string })
  POST   /api/dna          → requireAdmin
  PUT    /api/dna/:id      → requireAdmin
  DELETE /api/dna/:id      → requireAdmin
  ```
- **Acceptance Criteria:**
  - [ ] `POST /api/dna` với accession hợp lệ → tự động fetch và điền metadata NCBI
  - [ ] `GET /api/dna` không có JWT → chỉ trả `is_public = true`
  - [ ] Unit test service coverage ≥ 80%
  - **Effort:** L (8 giờ)

### TASK-02.5: Database Seed bổ sung
- **File tạo mới:**
  - `backend/database/seeds/002_seed_taxa.js`
  - `backend/database/seeds/003_seed_specimens.js`

#### TASK-02.5a: 002_seed_taxa.js
- **Output:** Insert danh lục taxa chuẩn phân cấp Kingdom → Order (không cần xuống Species):
  - Kingdom: Animalia
  - Phylum: Arthropoda
  - Class: Insecta
  - Order (16 bộ chính): Coleoptera, Lepidoptera, Hymenoptera, Diptera, Hemiptera, Orthoptera, Odonata, Blattodea, Mantodea, Phasmatodea, Neuroptera, Trichoptera, Ephemeroptera, Plecoptera, Thysanoptera, Dermaptera
- **Acceptance Criteria:**
  - [ ] Chạy `knex seed:run --specific=002_seed_taxa.js` không lỗi
  - [ ] `SELECT COUNT(*) FROM taxa` ≥ 19 rows
  - [ ] Cấu trúc cha-con đúng (Insecta.parent_id = Arthropoda.taxon_id)
  - **Effort:** M (2 giờ)

#### TASK-02.5b: 003_seed_specimens.js
- **Output:** Insert 50 mẫu vật demo với đầy đủ:
  - Rải đều 20+ tỉnh trong 34 tỉnh (NQ 202)
  - Mix `is_public = true` (30 mẫu) và `is_public = false` (20 mẫu)
  - Tọa độ WGS84 thật trong phạm vi VN
  - Liên kết đúng `taxon_id` từ 16 bộ seed ở TASK-02.5a
  - `collection_date` phân bố từ 2015–2026
- **Acceptance Criteria:**
  - [ ] Chạy seed không lỗi FK
  - [ ] `SELECT COUNT(*) FROM specimens WHERE is_public = true` = 30
  - [ ] `SELECT DISTINCT province_id FROM specimens` ≥ 15 provinces
  - **Effort:** M (3 giờ)

---

## [ ] GIAI ĐOẠN 3: CV2.3 — Module Search + Elasticsearch

### TASK-03.1: Cấu hình Elasticsearch
- **File tạo mới:** `backend/src/config/elasticsearch.js`
- **Output:**
  ```js
  const { Client } = require('@elastic/elasticsearch');
  const esClient = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200' });
  module.exports = esClient;
  ```
- **File tạo mới:** `infra/elasticsearch/mappings/specimens.json`, `infra/elasticsearch/mappings/taxa.json`
- **specimens.json mapping:** `specimen_id` (keyword), `scientific_name` (text + keyword), `province_name_vn` (keyword), `collection_date` (date), `is_public` (boolean), `taxon_rank` (keyword), `iucn_status` (keyword)
- **Cài:** `@elastic/elasticsearch` vào `backend/package.json`
- **Acceptance Criteria:**
  - [ ] `backend/src/config/elasticsearch.js` ping ES thành công trong `app.js` startup
  - [ ] Mapping JSON hợp lệ theo ES 8.x syntax
  - **Effort:** M (2 giờ)

### TASK-03.2: Backend Search Module
- **File tạo mới:** 4 file trong `backend/src/modules/search/`

#### TASK-03.2a: elasticsearch.service.js
- **Output — hàm public:**
  ```js
  /** Sync 1 specimen document vào ES index */
  async function indexSpecimen(specimen)
  /** Sync batch specimens */
  async function bulkIndexSpecimens(specimens)
  /** Xóa document khỏi ES khi soft-delete */
  async function deleteSpecimen(specimenId)
  /**
   * Full-text + faceted search
   * @param {object} params - { q, province, yearFrom, yearTo, order, family, iucnStatus, page, size }
   * @returns {{ hits: [], total: number, facets: { provinces: [], orders: [], iucnStatuses: [] } }}
   */
  async function searchSpecimens(params)
  /** Advanced query builder: AND/OR/NOT conditions */
  async function advancedSearch({ conditions, page, size })
  ```
- **Acceptance Criteria:**
  - [ ] `indexSpecimen` tạo document trong ES với mapping đúng
  - [ ] `searchSpecimens({ q: 'Lepidoptera', province: 'HN' })` trả facets đúng
  - [ ] `advancedSearch` với condition `{ field: 'collection_date', op: 'between', from: '2020-01-01', to: '2025-12-31' }` hoạt động
  - **Effort:** L (8 giờ)

#### TASK-03.2b: export.service.js
- **Output:**
  ```js
  /** Stream kết xuất Darwin Core Archive zip */
  async function exportDwcA(filters) → ReadableStream (.zip)
  /** Kết xuất Excel .xlsx */
  async function exportExcel(filters) → Buffer
  /** Kết xuất GeoJSON FeatureCollection */
  async function exportGeoJson(filters) → object
  ```
- **Acceptance Criteria:**
  - [ ] DwC-A zip chứa `occurrence.csv` và `meta.xml` đúng chuẩn Darwin Core
  - [ ] Excel xuất đúng 22 cột header song ngữ
  - [ ] GeoJSON hợp lệ (validate bằng `@turf/turf` hoặc jest schema test)
  - **Effort:** L (6 giờ)

#### TASK-03.2c: search.controller.js + search.routes.js
- **Routes:**
  ```
  GET /api/search?q=&province=&taxon=&iucn=&page=&size=   → searchSpecimens (public)
  POST /api/search/advanced                                → advancedSearch (public)
  GET /api/search/media?taxon=&province=                   → searchMedia (public)
  GET /api/export/dwca                                     → exportDwcA (public User được xuất dữ liệu mở)
  GET /api/export/excel                                    → requireAdmin → exportExcel
  GET /api/export/geojson                                  → public
  ```
- **Acceptance Criteria:**
  - [ ] `GET /api/search` không JWT → kết quả chỉ có `is_public = true`
  - [ ] `GET /api/export/dwca` stream file zip không buffer toàn bộ vào memory
  - **Effort:** M (3 giờ)

---

## [ ] GIAI ĐOẠN 4: CV2.4 — Module Reports + Admin

### TASK-04.1: Backend Config bổ sung (cần cho Reports)
- **File tạo mới:** `backend/src/config/minio.js`
- **Output:**
  ```js
  const Minio = require('minio');
  const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT) || 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
  });
  // 3 bucket cố định:
  const BUCKETS = { SPECIMENS: 'specimens', MAP_LAYERS: 'map-layers', REPORTS: 'reports' };
  module.exports = { minioClient, BUCKETS };
  ```
- **Cài:** `minio` vào `backend/package.json`
- **Acceptance Criteria:**
  - [ ] `minioClient.bucketExists('specimens')` không throw khi MinIO đang chạy
  - **Effort:** S (1 giờ)

### TASK-04.2: Backend Reports Module
- **File tạo mới:** 5 file trong `backend/src/modules/reports/`

#### TASK-04.2a: pdfGenerator.service.js
- **Output:**
  ```js
  /**
   * Render HTML template → PDF Buffer dùng Puppeteer
   * @param {string} templateHtml - HTML có sẵn style
   * @param {object} options - { format: 'A4'|'A5', margin, headerHtml, footerHtml }
   * @returns {Promise<Buffer>}
   */
  async function renderPdf(templateHtml, options)
  ```
  - Template header phải chứa logo Viện Hàn lâm KHCNVN và tên Viện CNTT
  - Footer có watermark, số trang, ngày xuất
- **Cài:** `puppeteer` vào `backend/package.json`
- **Acceptance Criteria:**
  - [ ] PDF Buffer có content-type `application/pdf`
  - [ ] Header/footer hiển thị đúng trên mọi trang
  - [ ] PDF mở được trong Adobe Reader
  - **Effort:** M (4 giờ)

#### TASK-04.2b: kpi.service.js
- **Output:**
  ```js
  /**
   * @param {{ from: string, to: string, groupBy: 'month'|'quarter' }} params
   * @returns {{ periods: string[], newSpecimens: number[], newImages: number[], newDna: number[] }}
   */
  async function getDigitizationKpi(params)
  async function getDataCoverageStats() // % specimens có ảnh, có DNA, có GPS
  ```
- **Acceptance Criteria:**
  - [ ] `getDigitizationKpi({ from:'2026-01-01', to:'2026-08-31', groupBy:'month' })` trả 8 periods
  - **Effort:** M (3 giờ)

#### TASK-04.2c: reports.service.js + reports.controller.js + reports.routes.js
- **Routes:**
  ```
  GET  /api/reports/species-checklist → PDF/Excel danh lục loài (public User: chỉ data mở)
  GET  /api/reports/kpi               → requireAdmin → JSON stats
  POST /api/reports/custom            → requireAdmin → { fields, filters } → Excel/CSV stream
  ```
- **Effort:** M (4 giờ)

### TASK-04.3: Backend Admin Module
- **File tạo mới:** 5 file trong `backend/src/modules/admin/`

#### TASK-04.3a: publicControl.service.js + admin.routes.js
- **Output:**
  ```js
  async function getSystemStats() // { specimenCount, speciesCount, mediaCount, dnaCount, userCount }
  async function batchTogglePublic(specimenIds, isPublic, adminId)
  async function getAuditLogs({ from, to, adminId, actionType, page, size })
  async function getSystemConfig(category)
  async function setSystemConfig(key, value, adminId)
  ```
- **Routes:**
  ```
  GET    /api/admin/stats                   → requireAdmin
  PATCH  /api/admin/specimens/batch-public  → requireAdmin
  GET    /api/admin/audit-logs              → requireAdmin
  GET    /api/admin/config                  → requireAdmin
  PUT    /api/admin/config/:key             → requireAdmin
  ```
- **Acceptance Criteria:**
  - [ ] `PATCH /api/admin/specimens/batch-public` với 100 specimenIds → update đúng 100 records
  - [ ] Mỗi thao tác `batchTogglePublic` ghi 1 audit_log entry với `details.count = N`
  - **Effort:** M (4 giờ)

---

## [ ] GIAI ĐOẠN 5: CV2.5 — Module GIS

### TASK-05.1: Backend GIS Module
- **File tạo mới:** 4 file trong `backend/src/modules/gis/`

#### TASK-05.1a: postgis.service.js
- **Output:**
  ```js
  /**
   * Trả GeoJSON points của specimens (phân trang)
   * @param {{ taxonId, provinceId, bbox, isPublicOnly, page, size }} params
   * @returns {{ type: 'FeatureCollection', features: [], total: number }}
   */
  async function getOccurrencePoints(params)

  /**
   * Trả heatmap clusters bằng ST_ClusterKMeans
   * @param {{ taxonId, zoom, isPublicOnly }} params
   * @returns {{ clusters: [{ lat, lng, count }] }}
   */
  async function getHeatmapClusters(params)

  /**
   * Species Richness Index theo tỉnh/thành (34 tỉnh NQ 202)
   * @returns {{ province_code: string, richness: number }[]}
   */
  async function getSpeciesRichnessByProvince()

  /** Upload shapefile → parse → insert vào map_layer_features */
  async function importShapefileLayer(fileBuffer, layerId)
  ```
- **Acceptance Criteria:**
  - [ ] `getOccurrencePoints({ isPublicOnly: true })` chỉ trả specimens `is_public = true`
  - [ ] `getSpeciesRichnessByProvince()` trả đúng 34 province entries
  - [ ] PostGIS `ST_Within`, `ST_DWithin` được dùng đúng (không raw string build SQL)
  - **Effort:** L (8 giờ)

#### TASK-05.1b: layer.service.js + gis.controller.js + gis.routes.js
- **Routes:**
  ```
  GET  /api/gis/occurrences          → public (isPublicOnly khi không JWT)
  GET  /api/gis/heatmap              → public
  GET  /api/gis/richness             → public
  GET  /api/gis/layers               → public
  POST /api/gis/layers               → requireAdmin → upload shapefile/GeoJSON/GeoTIFF
  DELETE /api/gis/layers/:id         → requireAdmin
  PATCH  /api/gis/layers/:id/style   → requireAdmin
  ```
- **Effort:** M (4 giờ)

---

## [ ] GIAI ĐOẠN 6: Frontend UI Primitives (song song với Giai đoạn 2–5 BE)

### TASK-06.1: Tầng Table
- **File tạo mới (tất cả đều rỗng hoàn toàn — cần tạo từ đầu):**
  - `frontend/src/components/table/DataTable.js`
  - `frontend/src/components/table/Pagination.js`
  - `frontend/src/components/table/ColumnPicker.js`
  - `frontend/src/components/table/SortHeader.js`
- **Pattern bắt buộc:** Function component + hooks; style dùng Bootstrap 5 classes (`table`, `table-hover`, `table-sm`); không tự viết CSS table từ đầu.
- **DataTable props:** `columns: [{ key, label, sortable, render }]`, `data: []`, `loading`, `onSort`, `selectedIds`, `onSelectAll`, `onSelectRow`
- **ColumnPicker:** persist selection vào `localStorage`
- **Acceptance Criteria:**
  - [ ] Sort click → gọi `onSort(key, 'asc'|'desc')`
  - [ ] Select all → `onSelectAll(allIds)`
  - [ ] ColumnPicker persist qua refresh trang
  - [ ] Loading state hiển thị spinner
  - **Effort:** L (6 giờ)

### TASK-06.2: Tầng Form
- **File tạo mới:**
  - `frontend/src/components/form/FormField.js` — `label + input + error wrapper`
  - `frontend/src/components/form/AutocompleteInput.js` — debounce 300ms, dropdown Bootstrap
  - `frontend/src/components/form/GPSPicker.js` — Leaflet mini-map + manual input lat/lng
  - `frontend/src/components/form/ImageUploadZone.js` — drag-drop, preview, progress bar
  - `frontend/src/components/form/DateRangePicker.js`
- **Pattern:** Dùng `react-leaflet` (đã có dependency) cho GPSPicker, không import thư viện mới.
- **AutocompleteInput props:** `onSearch: async (q) => options`, `onSelect: (value) => void`, `debounceMs = 300`
- **GPSPicker props:** `lat, lng, onChange: ({ lat, lng }) => void`
  - Map center tại Hà Nội mặc định; drag marker → cập nhật lat/lng
  - Manual input lat/lng cũng update marker
- **Acceptance Criteria:**
  - [ ] AutocompleteInput không gọi API khi `q.length < 2`
  - [ ] GPSPicker lat=10.5, lng=105.3 → marker xuất hiện đúng vị trí
  - [ ] ImageUploadZone reject file > 10MB
  - **Effort:** L (8 giờ)

### TASK-06.3: Tầng Chart (Recharts)
- **File tạo mới:**
  - `frontend/src/components/chart/TaxonTreemap.js`
  - `frontend/src/components/chart/DigitizationLineChart.js`
  - `frontend/src/components/chart/DataCoverageDonutChart.js`
  - `frontend/src/components/chart/StatsBarChart.js`
- **Pattern:** Dùng `recharts` (TASK-00.1 cài); responsive container; màu sắc theo CSS tokens `var(--color-primary)`.
- **Acceptance Criteria:**
  - [ ] `TaxonTreemap` render đúng khi `data = []` (EmptyState)
  - [ ] `DigitizationLineChart` render đúng nhiều series
  - **Effort:** M (4 giờ)

### TASK-06.4: Tầng Map (react-leaflet wrappers)
- **File tạo mới:**
  - `frontend/src/components/map/BaseMap.js`
  - `frontend/src/components/map/OccurrenceLayer.js`
  - `frontend/src/components/map/HeatmapLayer.js`
  - `frontend/src/components/map/LayerSwitcher.js`
  - `frontend/src/components/map/PopupCard.js`
- **Pattern:** Dùng `react-leaflet` (đã có). Cài `leaflet-heatmap` hoặc `leaflet.heat` cho HeatmapLayer.
- **BaseMap props:** `center, zoom, height, children`; tile layer mặc định OpenStreetMap; `LayerSwitcher` toggle sang Google Satellite bằng URL `https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`.
- **Acceptance Criteria:**
  - [ ] `BaseMap` render không lỗi CSS height missing
  - [ ] `OccurrenceLayer` với 1000 points render trong < 2s
  - [ ] `LayerSwitcher` toggle thay đổi tile layer ngay lập tức
  - **Effort:** L (6 giờ)

---

## [ ] GIAI ĐOẠN 7: Frontend Pages — 24 màn hình (từ Stitch HTML sang React)

> Mỗi màn hình dưới đây: tham chiếu HTML tương ứng tại `frontend/stitch-export/SCR-XX-*.html` để lấy layout.

### TASK-07.1: SCR-02 — Đổi mật khẩu
- **File:** `frontend/src/modules/auth/pages/ChangePasswordPage.js`
- **Pattern:** Function component + hooks; gọi `authService.changePassword()`; form validation Joi-style client-side.
- **Input/Output:** Form 3 field: mật khẩu cũ, mật khẩu mới (≥12 ký tự, có chữ hoa+số+ký tự đặc biệt), xác nhận mật khẩu mới.
- **Backend endpoint cần:** `POST /api/auth/change-password` (thêm vào `auth.routes.js`)
- **Acceptance Criteria:**
  - [ ] Mật khẩu mới < 12 ký tự → inline error
  - [ ] Xác nhận không khớp → inline error
  - [ ] Thành công → toast success + redirect `/admin/dashboard`
  - [ ] Thêm route `POST /api/auth/change-password` vào `auth.routes.js` + `auth.service.js`
- **Effort:** M (3 giờ)

### TASK-07.2: SCR-05 đến SCR-11 — Specimen Module Frontend

#### TASK-07.2a: SpecimenListPage.js (SCR-05)
- **File:** `frontend/src/modules/specimen/pages/SpecimenListPage.js`
- **File tạo mới:** `frontend/src/services/specimen.service.js`
- **Pattern:** Dùng `DataTable` (TASK-06.1); gọi `specimen.service.listSpecimens(filters)`; route `/admin/specimens`.
- **specimen.service.js functions:** `listSpecimens(params)`, `getSpecimenById(id)`, `createSpecimen(data)`, `updateSpecimen(id, data)`, `deleteSpecimen(id)`, `togglePublic(id, isPublic)`, `importExcel(file)`, `generateLabels(ids)`, `batchUpdate(ids, data)`
- **Acceptance Criteria:**
  - [ ] Sort theo `collection_date` → gọi API với `?sortBy=collection_date&order=desc`
  - [ ] Select 5 rows → batch edit button active
  - [ ] Toggle public/private từng row → PATCH API ngay không reload bảng
  - **Effort:** L (6 giờ)

#### TASK-07.2b: SpecimenCreatePage.js + SpecimenEditPage.js (SCR-06/07) + SpecimenForm.js
- **File:** `frontend/src/modules/specimen/pages/SpecimenCreatePage.js`, `SpecimenEditPage.js`
- **File:** `frontend/src/modules/specimen/components/SpecimenForm.js`
- **Pattern:** Dùng chung `SpecimenForm` component cho cả create và edit.
- **SpecimenForm props:** `initialValues`, `onSubmit(data)`, `submitting`
- **SpecimenForm fields (22 trường):**
  - Autocomplete taxon (gọi `GET /api/taxonomy/search?q=`)
  - `GPSPicker` cho tọa độ
  - Dropdown tỉnh/thành (34 tỉnh từ `GET /api/admin/config` hoặc hardcode từ seed)
  - Dropdown collector (người thu mẫu)
  - `ImageUploadZone` đa file
  - `collection_date` DatePicker
  - Các text field: `locality_detail`, `sex`, `individual_count`, `notes`, `storage_number`
- **Acceptance Criteria:**
  - [ ] AutocompleteInput gọi `GET /api/taxonomy/search?q=Lepi` → dropdown kết quả
  - [ ] GPSPicker kéo marker → cập nhật lat/lng form
  - [ ] Submit form không đủ `taxonId` → inline error không submit
  - [ ] SCR-07 edit: load giá trị cũ vào form
  - **Effort:** L (10 giờ)

#### TASK-07.2c: SpecimenDetailPage.js (SCR-08)
- **File:** `frontend/src/modules/specimen/pages/SpecimenDetailPage.js`
- **Pattern bắt buộc (dual-context):** Đăng ký 2 route `/specimens/:id` (public) và `/admin/specimens/:id` (admin) qua `screenRegistry.js` và `router.js`. Dùng `useIsAdminContext()` để ẩn/hiện nút Sửa/Xóa. API `GET /api/specimens/:id` phía sau lọc `is_public` ở tầng repository khi không có JWT — không lọc ở FE.
- **Output:** Tabs: Thông tin định danh, Hình ảnh (`ImageGallery`), DNA liên kết, Lịch sử thay đổi (admin only)
- **Acceptance Criteria:**
  - [ ] User vào `/specimens/123` với specimen `is_public=false` → API trả 404 (repository lọc đúng)
  - [ ] Admin vào `/admin/specimens/123` → thấy nút Sửa/Xóa, thấy ChangeHistory
  - **Effort:** L (6 giờ)

#### TASK-07.2d: BulkImportPage.js (SCR-09)
- **File:** `frontend/src/modules/specimen/pages/BulkImportPage.js`
- **Output:** 3 bước: (1) Tải template Excel, (2) Upload + preview lỗi highlight đỏ/vàng, (3) Confirm submit
- **Acceptance Criteria:**
  - [ ] File > 5000 rows → error message trước khi submit
  - [ ] Preview bảng hiển thị đúng màu đỏ cho row lỗi, vàng cho warning
  - **Effort:** L (6 giờ)

#### TASK-07.2e: BatchEditPage.js (SCR-10) + LabelPrintPage.js (SCR-11)
- **File:** `frontend/src/modules/specimen/pages/BatchEditPage.js`, `LabelPrintPage.js`
- **BatchEdit:** Nhận `specimenIds` từ URL params; form chỉ các trường cho phép batch update (province, collector, sex, status)
- **LabelPrint:** Chọn template (A4/A5, số nhãn/trang); preview nhãn trong iframe; Download PDF
- **Acceptance Criteria:**
  - [ ] `BatchEditPage` load danh sách 5 specimens đã chọn
  - [ ] `LabelPrintPage` hiển thị preview và `<a download>` link PDF
  - **Effort:** L (8 giờ)

### TASK-07.3: SCR-15/16/17 — Search + Media Frontend

#### TASK-07.3a: SpecimenSearchPage.js (SCR-15)
- **File:** `frontend/src/modules/search/pages/SpecimenSearchPage.js`
- **File tạo mới:** `frontend/src/services/search.service.js`
- **Pattern bắt buộc (dual-context SCR-15 là public-only):** Route `/specimens/search` không có `adminPath`. Public và Admin đều dùng cùng route.
- **Output:** SearchBar (debounce 300ms) + FacetPanel trái (tỉnh, năm, bộ côn trùng, IUCN) + 5 chế độ xem (List/Grid/Map/Table/Card)
- **Acceptance Criteria:**
  - [ ] Không có JWT → kết quả chỉ có `is_public = true`
  - [ ] FacetPanel hiển thị count mỗi bucket
  - [ ] URL sync: filter thay đổi → URL query params cập nhật
  - **Effort:** L (8 giờ)

#### TASK-07.3b: AdvancedSearchPage.js (SCR-16) + MediaGalleryPage.js (SCR-17)
- **SCR-16:** Query Builder component: thêm/xóa điều kiện AND/OR/NOT; dropdown field, operator, value
- **SCR-17 (dual-context):** Grid ảnh dùng `react-virtualized` hoặc CSS grid; Lightbox; filter theo taxon/province
- **Acceptance Criteria:**
  - [ ] SCR-16 Submit với 3 conditions → gọi `POST /api/search/advanced` đúng payload
  - [ ] SCR-17 infinite scroll hoặc pagination
  - **Effort:** L (8 giờ)

### TASK-07.4: SCR-18/19 — GIS Frontend

#### TASK-07.4a: OccurrenceMapPage.js (SCR-18)
- **File:** `frontend/src/modules/gis/pages/OccurrenceMapPage.js`
- **Pattern bắt buộc (dual-context):** 2 routes `/map` (public) và `/admin/map` (admin). `useIsAdminContext()` dùng để ẩn/hiện layer upload tool.
- **File tạo mới:** `frontend/src/services/gis.service.js`
- **Output:** `BaseMap` full-screen + `OccurrenceLayer` + `HeatmapLayer` + `LayerSwitcher` + bộ lọc nhanh theo taxon/province
- **Acceptance Criteria:**
  - [ ] Toggle Điểm/Mật độ → switch giữa OccurrenceLayer và HeatmapLayer
  - [ ] Không JWT → chỉ hiển thị specimens `is_public = true`
  - **Effort:** L (6 giờ)

#### TASK-07.4b: LayerManagerPage.js (SCR-19)
- **File:** `frontend/src/modules/gis/pages/LayerManagerPage.js`
- **Output:** Bảng danh sách layers + Upload modal (Shapefile zip/GeoJSON/GeoTIFF) + toggle hiển thị + drag reorder
- **Acceptance Criteria:**
  - [ ] Upload Shapefile zip → gọi `POST /api/gis/layers` với multipart/form-data
  - [ ] Toggle visibility → PATCH API
  - **Effort:** M (4 giờ)

### TASK-07.5: SCR-20/21/22 — DNA Frontend

#### TASK-07.5a: DNAListPage.js (SCR-20) + DNA pages
- **File:** `frontend/src/modules/dna/pages/DNAListPage.js`, `DNAEntryPage.js`, `DNADetailPage.js`
- **Pattern (SCR-20, 22 dual-context):** 2 routes public và admin. Repository lọc `is_public` phía BE.
- **File tạo mới:** `frontend/src/services/dna.service.js`
- **DNAEntryPage:** Input GenBank accession → blur → auto-fetch metadata từ `POST /api/dna` (BE gọi NCBI)
- **DNADetailPage:** Hiển thị FASTA sequence với highlight màu `A/T/G/C`; copy + download `.fasta`
- **Acceptance Criteria:**
  - [ ] SCR-20 không JWT → chỉ DNA `is_public = true`
  - [ ] SCR-21 nhập `KX894504.1` → sau 2s điền tự động organism, length, date
  - [ ] SCR-22 sequence highlight đúng màu 4 base pairs
  - **Effort:** L (8 giờ)

### TASK-07.6: SCR-23/24/25 — AI Integration Frontend

> **[Lưu ý]** AI service do AI Engineer khác phụ trách. Task này chỉ code HTTP client call từ FE → BE → AI Service.

#### TASK-07.6a: SpeciesIDPage.js (SCR-23)
- **File:** `frontend/src/modules/ai/pages/SpeciesIDPage.js`
- **File tạo mới:** `frontend/src/services/ai.service.js`
- **Pattern (dual-context SCR-23):** 2 routes public và admin.
- **ai.service.js:**
  ```js
  async function identifySpecies(imageFile) → POST /api/ai/identify (multipart) → { suggestions: [{ taxonId, scientificName, confidence }] }
  async function predictSdm(taxonId, climateLayerIds) → POST /api/ai/sdm/predict → { rasterUrl, confidenceMap }
  ```
- **Backend endpoint cần tạo:** `POST /api/ai/identify` và `POST /api/ai/sdm/predict` trong `backend/src/modules/` — proxy tới AI service `http://ai-service:8000`
- **Output SCR-23:** `ImageUploadZone` → spinner "AI đang phân tích" → bảng Top-5 loài kèm % confidence + ảnh thumbnail + link hồ sơ loài
- **Acceptance Criteria:**
  - [ ] Upload ảnh → loading state → hiển thị kết quả trong < 10s
  - [ ] Mỗi suggestion có link đến `SCR-13 /species/:slug`
  - [ ] Backend `/api/ai/identify` proxy đúng sang AI service
  - **Effort:** M (4 giờ)

#### TASK-07.6b: SDMPredictionPage.js (SCR-24) + AnalyticsDashboardPage.js (SCR-25)
- **SCR-24:** Dropdown chọn loài + MultiSelect biến khí hậu + Run prediction → `SDMResultMap` (raster overlay)
- **SCR-25:** 4 Recharts biểu đồ thật (sau TASK-00.1): DigitizationLine, TaxonTreemap, DataCoverageDonut, StatsBar; gọi `GET /api/admin/stats`
- **Acceptance Criteria:**
  - [ ] SCR-25 metrics từ API thật không còn hardcode
  - [ ] SCR-24 loading state khi chạy model (có thể tới 30s)
  - **Effort:** L (6 giờ)

### TASK-07.7: SCR-26/27/28 — Reports Frontend

- **File:** `frontend/src/modules/reports/pages/ReportListPage.js`, `KPIReportPage.js`, `CustomReportBuilderPage.js`
- **File tạo mới:** `frontend/src/services/reports.service.js`
- **Pattern (SCR-26 dual-context):** 2 routes. User chỉ xuất dữ liệu mở.
- **Acceptance Criteria:**
  - [ ] SCR-26: `<a href="/api/export/dwca" download>` hoạt động không buffer toàn bộ
  - [ ] SCR-27 biểu đồ Recharts từ KPI API thật
  - [ ] SCR-28 kéo thả fields → preview bảng trước khi xuất
  - **Effort:** L (8 giờ)

### TASK-07.8: SCR-29/30 — Admin Control Frontend

- **File:** `frontend/src/modules/admin/pages/PublicPrivateControlPage.js`, `AuditLogConfigPage.js`
- **File tạo mới:** `frontend/src/services/admin.service.js`
- **SCR-29:** Bảng `DataTable` với toggle switch mỗi row; bulk toggle chọn nhiều
- **SCR-30:** Tab 1: Audit log với filter by date/action/admin; Tab 2: Config form (SMTP, API keys)
- **Acceptance Criteria:**
  - [ ] SCR-29 toggle 1 record → PATCH API ngay không reload trang
  - [ ] SCR-30 audit log pagination hoạt động
  - [ ] SCR-30 save config → PUT API với confirm dialog
  - **Effort:** L (6 giờ)

---

## [ ] GIAI ĐOẠN 8: Backend AI Proxy + packages/shared

### TASK-08.1: Backend AI Proxy Endpoints
- **File tạo mới:** `backend/src/modules/aiProxy/aiProxy.routes.js`, `aiProxy.controller.js`, `aiProxy.service.js`
- **Output:**
  ```js
  // aiProxy.service.js
  async function proxyIdentify(imageBuffer, mimetype) {
    // POST http://ai-service:8000/api/ai/identify với multipart
    // Timeout: 30s (AI inference có thể chậm)
    // Retry: 0 lần (không retry AI requests)
  }
  async function proxySdmPredict(taxonId, climateLayerIds) { ... }
  ```
- **Routes:**
  ```
  POST /api/ai/identify    → upload.single('image') → proxyIdentify (public + admin)
  POST /api/ai/sdm/predict → requireAdmin → proxySdmPredict
  ```
- **Đăng ký trong app.js:** `app.use('/api/ai', require('./src/modules/aiProxy/aiProxy.routes'))`
- **Acceptance Criteria:**
  - [ ] `POST /api/ai/identify` forward đúng image sang AI service
  - [ ] AI service down → trả 502 với message rõ ràng
  - [ ] Response trả về frontend giữ nguyên format `{ suggestions: [...] }` của AI service
  - **Effort:** M (3 giờ)

### TASK-08.2: packages/shared — Constants, Types, Validators

#### TASK-08.2a: shared/constants
- **File tạo mới:** `packages/shared/constants/iucn.js`, `packages/shared/constants/dwcFields.js`, `packages/shared/constants/roles.js`, `packages/shared/constants/specimenStatus.js`, `packages/shared/constants/index.js`
- **Output:**
  - `iucn.js`: `IUCN_STATUS = { EX: 'EX', EW: 'EW', CR: 'CR', EN: 'EN', VU: 'VU', NT: 'NT', LC: 'LC', DD: 'DD', NE: 'NE' }`
  - `dwcFields.js`: 22 trường DwC với `key`, `labelVn`, `labelEn`, `type`, `required`
  - `roles.js`: `ROLES = { ADMIN: 'admin', USER: 'user' }`
- **Effort:** S (2 giờ)

#### TASK-08.2b: shared/validators
- **File tạo mới:** `packages/shared/validators/specimen.validator.js`, `packages/shared/validators/taxon.validator.js`, `packages/shared/validators/dna.validator.js`
- **Mục đích:** Schema Joi dùng chung giữa FE và BE (import trực tiếp từ monorepo workspace)
- **Yêu cầu:** Cấu hình `packages/shared/package.json` với `"name": "@vietinsect/shared"` và khai báo trong `pnpm-workspace.yaml`
- **Acceptance Criteria:**
  - [ ] `import { specimenSchema } from '@vietinsect/shared/validators/specimen'` hoạt động trong cả FE và BE
  - [ ] Xóa schema duplicate trong `backend/src/modules/specimen/specimen.validator.js` và thay bằng import
  - **Effort:** M (4 giờ)

---

## [ ] GIAI ĐOẠN 9: Hạ tầng & CI/CD

### TASK-09.1: Hoàn thiện docker-compose.yml thêm các services còn thiếu
- **File sửa:** `docker-compose.yml`
- **Thêm services:**
  - `elasticsearch`: image `elasticsearch:8.13.0`, env `discovery.type=single-node`, `ES_JAVA_OPTS=-Xms512m -Xmx512m`
  - `backend`: Node.js service, port 5000, `depends_on: [postgres, redis, minio]`
  - `frontend`: Node.js dev server, port 3000
  - `ai-service` (stub): placeholder `python:3.11-slim` chờ AI team
- **Acceptance Criteria:**
  - [ ] `docker-compose up` khởi động tất cả services không lỗi
  - [ ] `curl http://localhost:9200` → Elasticsearch healthy
  - **Effort:** M (3 giờ)

### TASK-09.2: Nginx + GeoServer infra
- **File tạo mới:** `infra/nginx/nginx.conf`, `infra/nginx/upstream.conf`
- **nginx.conf:** TLS 1.3, gzip, rate limit, reverse proxy:
  - `/` → `frontend:3000`
  - `/api` → `backend:5000`
  - `/api/ai` → `ai-service:8000`
  - `/geoserver` → `geoserver:8080`
- **Acceptance Criteria:**
  - [ ] `curl https://localhost/api/health` → 200 qua Nginx
  - [ ] `curl http://localhost/api` → redirect HTTPS
  - **Effort:** M (3 giờ)

### TASK-09.3: Elasticsearch Index Mappings
- **File tạo mới:** `infra/elasticsearch/mappings/specimens.json`, `infra/elasticsearch/mappings/taxa.json`
- **specimens.json:** field types chính xác theo ES 8.x syntax
- **Script init:** Thêm vào `scripts/` script tạo index khi ES khởi động
- **Effort:** M (2 giờ)

### TASK-09.4: Automation Scripts
- **File tạo mới:** `scripts/db-migrate.sh`, `scripts/db-seed.sh`, `scripts/backup.sh`
- **db-migrate.sh:** `cd backend && pnpm exec knex migrate:latest`
- **db-seed.sh:** `cd backend && pnpm exec knex seed:run`
- **backup.sh:** `pg_dump vietinsect_db | gzip > backup_$(date +%Y%m%d).sql.gz`
- **Effort:** S (1 giờ)

### TASK-09.5: GitHub Actions CI/CD
- **File tạo mới:** `.github/workflows/ci.yml`, `.github/workflows/cd.yml`
- **ci.yml:** On push/PR → `pnpm install` → `pnpm lint` → `pnpm test` → `pnpm build` (FE)
- **cd.yml:** On merge main → build Docker images → push registry → deploy staging
- **Effort:** M (4 giờ)

---

## [ ] GIAI ĐOẠN 10: Testing & Tài liệu Nghiệm thu

### TASK-10.1: Unit Tests — Backend Services
- **File tạo mới:** Mỗi service tạo `{module}.service.test.js` cạnh file nguồn
- **Coverage tối thiểu:** ≥ 80% cho `specimen.service`, `taxonomy.service`, `dna.service`, `bulkImport.service`
- **Pattern:** Mock repository bằng Jest `jest.mock()`; không gọi DB thật trong unit test
- **Effort:** L (16 giờ tổng)

### TASK-10.2: Integration Tests — API Endpoints
- **File tạo mới:** `backend/tests/integration/specimen.test.js`, `taxonomy.test.js`, `auth.test.js`, `search.test.js`
- **Tool:** Supertest + DB test (test DB riêng, không production)
- **Coverage:** Mỗi endpoint có ít nhất: happy path + auth fail + validation fail test case
- **Effort:** L (12 giờ tổng)

### TASK-10.3: E2E Tests — Playwright
- **File tạo mới:** `backend/tests/e2e/` — luồng nghiệp vụ chính
- **Luồng 1:** Login → Thêm Taxon → Thêm Specimen → Tải ảnh → Xuất PDF
- **Luồng 2:** Public User → Tìm kiếm → Xem hồ sơ loài → Xem bản đồ
- **Luồng 3:** Bulk Import Excel 100 rows → Preview → Confirm
- **Effort:** L (16 giờ tổng)

### TASK-10.4: Tài liệu Kỹ thuật
- **File tạo mới:** `docs/architecture.md`, `docs/api.md`, `docs/database-erd.md`
- **`docs/api.md`:** OpenAPI 3.0 spec — **phải cập nhật trong mỗi task tạo endpoint mới, không dồn về cuối**
- **`docs/database-erd.md`:** Sơ đồ ERD và bảng mapping 22 trường DwC
- **Effort:** L (12 giờ tổng)

### TASK-10.5: Tài liệu HDSD tiếng Việt & tiếng Anh (Nghiệm thu)
- **File tạo mới:** `docs/user-guide-vi.md`, `docs/user-guide-en.md`, `docs/admin-guide-vi.md`
- **Phục vụ:** Nghiệm thu đề tài Viện CNTT — đây là deliverable bắt buộc theo `docs/adr/chiến lược.md`
- **Effort:** L (16 giờ tổng)

---

## Bảng Trạng thái 30 Màn hình — Đối chiếu Thực tế

| Mã | Tên | Trạng thái FE | Trạng thái BE | Task cần |
|:---|:---|:---:|:---:|:---|
| **SCR-01** | Đăng nhập | [x] Đầy đủ | [x] Đầy đủ | TASK-00.3 (audit auth store) |
| **SCR-02** | Đổi mật khẩu | [ ] Placeholder | [x] (cần thêm endpoint) | TASK-07.1 |
| **SCR-03** | Dashboard Admin | [!] Hardcode metric | [x] (cần stats endpoint) | TASK-01.1, TASK-04.3 |
| **SCR-04** | Trang chủ công khai | [x] Đầy đủ | — | — |
| **SCR-05** | Danh sách mẫu vật | [ ] Placeholder | [ ] Cần TASK-02.3 | TASK-02.3g, TASK-07.2a |
| **SCR-06** | Thêm mới mẫu vật | [ ] Placeholder | [ ] Cần TASK-02.3 | TASK-02.3g, TASK-07.2b |
| **SCR-07** | Chỉnh sửa mẫu vật | [ ] Placeholder | [ ] Cần TASK-02.3 | TASK-02.3g, TASK-07.2b |
| **SCR-08** | Chi tiết mẫu vật | [ ] Placeholder | [ ] Cần TASK-02.3 | TASK-02.3g, TASK-07.2c |
| **SCR-09** | Nhập hàng loạt | [ ] Placeholder | [ ] Cần TASK-02.3e | TASK-02.3e, TASK-07.2d |
| **SCR-10** | Chỉnh sửa hàng loạt | [ ] Placeholder | [ ] Cần TASK-02.3g | TASK-07.2e |
| **SCR-11** | In nhãn | [ ] Placeholder | [ ] Cần TASK-02.3f | TASK-02.3f, TASK-07.2e |
| **SCR-12** | Cây phân loại học | [x] Đầy đủ | [x] Đầy đủ | — |
| **SCR-13** | Hồ sơ loài | [!] 3/5 tab | [x] Đầy đủ | TASK-01.2 |
| **SCR-14** | Quản lý danh pháp | [x] Đầy đủ | [x] Đầy đủ | — |
| **SCR-15** | Tìm kiếm mẫu vật | [ ] Placeholder | [ ] Cần TASK-03.2 | TASK-03.2, TASK-07.3a |
| **SCR-16** | Tìm kiếm nâng cao | [ ] Placeholder | [ ] Cần TASK-03.2 | TASK-03.2, TASK-07.3b |
| **SCR-17** | Thư viện hình ảnh | [ ] Placeholder | [ ] Cần TASK-03.2c | TASK-07.3b |
| **SCR-18** | Bản đồ phân bố | [ ] Placeholder | [ ] Cần TASK-05.1 | TASK-05.1, TASK-07.4a |
| **SCR-19** | Quản lý lớp bản đồ | [ ] Placeholder | [ ] Cần TASK-05.1b | TASK-07.4b |
| **SCR-20** | Danh sách DNA | [ ] Placeholder | [ ] Cần TASK-02.4 | TASK-02.4, TASK-07.5 |
| **SCR-21** | Form Thêm/Sửa DNA | [ ] Placeholder | [ ] Cần TASK-02.4 | TASK-02.4, TASK-07.5 |
| **SCR-22** | Chi tiết FASTA | [ ] Placeholder | [ ] Cần TASK-02.4 | TASK-02.4, TASK-07.5 |
| **SCR-23** | AI nhận dạng loài | [ ] Placeholder | [ ] Cần TASK-08.1 | TASK-08.1, TASK-07.6a |
| **SCR-24** | SDM Dự báo phân bố | [ ] Placeholder | [ ] Cần TASK-08.1 | TASK-07.6b |
| **SCR-25** | Analytics Dashboard | [ ] Placeholder | [ ] Cần TASK-04.3 | TASK-04.3, TASK-07.6b |
| **SCR-26** | Báo cáo danh lục | [ ] Placeholder | [ ] Cần TASK-04.2 | TASK-04.2, TASK-07.7 |
| **SCR-27** | Báo cáo KPI | [ ] Placeholder | [ ] Cần TASK-04.2b | TASK-07.7 |
| **SCR-28** | Bộ dựng báo cáo | [ ] Placeholder | [ ] Cần TASK-04.2c | TASK-07.7 |
| **SCR-29** | Kiểm soát chia sẻ | [ ] Placeholder | [ ] Cần TASK-04.3 | TASK-04.3, TASK-07.8 |
| **SCR-30** | Nhật ký & Cấu hình | [ ] Placeholder | [ ] Cần TASK-04.3 | TASK-04.3, TASK-07.8 |

---

## Quy tắc Nghiệm thu Task

1. Task chỉ được đánh `[x]` khi: code chạy được + unit test pass + ESLint clean + kiểm tra thủ công bằng Postman/trình duyệt
2. Mọi endpoint mới phải cập nhật `docs/api.md` trong cùng commit — không tách sang sau
3. Commit message: `feat(specimen): add specimen.repository.js CRUD queries [TASK-02.3c]`
4. 1 task con tương ứng tối đa 2 commit

---

## Chênh lệch Phát hiện so với task.md cũ (27/08/2026)

| Mục | task.md cũ ghi | Thực tế |
|:---|:---|:---|
| DB Seeds | "thiếu Seed dữ liệu chuẩn" — 70% | Đã có `001_seed_lookups.js` với **34 tỉnh NQ 202 đúng chuẩn**, admin user, 8 habitat, 8 life_stage — thực tế 50% |
| Backend Auth | "30%" | [x] Auth module hoàn thiện 100% — 6 file có logic thật đầy đủ |
| Backend Taxonomy | Gộp chung "30%" với các module khác | [x] Taxonomy module **100% đầy đủ** — service 366 dòng, repository 239 dòng, tất cả CRUD + synonym + import Excel + species_profile + bioactivity |
| SCR-12/13/14 Taxonomy | "Đã hoàn thành Component" + "Đã kết nối API" | **Chính xác** — nhưng SCR-13 tab Mẫu vật và tab Phân bố có EmptyState placeholder chưa kết nối thật |
| Frontend i18n | Không đề cập vấn đề | [ ] **Nợ kỹ thuật nghiêm trọng** — i18n dùng inline object trong code, vi phạm SRS 6.3 yêu cầu file JSON |
| auth.store.js `isAuthenticated` | Không đề cập | [ ] **Potential bug** — `isAuthenticated` là function không phải reactive state, cần TASK-00.3 |
| Frontend UI Primitives | "15%" — đề cập DataTable, Charts... | [x] `ui/` có Icon, ConfirmDialog, Toast, EmptyState, LoadingState; [ ] `chart/`, `map/`, `table/`, `form/` **rỗng hoàn toàn** |
| packages/shared | "10%" | [ ] **0%** — cả 3 thư mục `constants/`, `types/`, `validators/` rỗng hoàn toàn |
| Infra Monitoring | "40%" tổng | `grafana/` dir tồn tại nhưng rỗng; `prometheus.yml` không có — thực tế ~5% |
| CI/CD | Không đề cập chi tiết | `.github/workflows/` rỗng — 0% |
| scripts/ | Không đề cập | `scripts/` gốc repo rỗng — 0% |

---

## Mâu thuẫn giữa `docs/adr/` và Kiến trúc Khóa

| Tài liệu | Ghi gì | Thực tế/Quyết định |
|:---|:---|:---|
| `cây thư mục dự án.md` | Đề xuất `craco.config.js` custom webpack — đúng | [x] `frontend/` đang dùng CRACO + CRA 5, giữ nguyên |
| `cây thư mục dự án.md` | Đề xuất `react-scripts ^5` — đúng | [x] Đang dùng `react-scripts 5.0.1`, giữ nguyên |
| `chiến lược.md` mục 12.2.13 | Đề cập "ReactJS" không ghi version cụ thể | → **Stack thực tế đã khóa cứng: React 19.2.7 + React Router DOM 7.18.1 + CRA (react-scripts 5.0.1)** — xác nhận tại `frontend/package.json` và ghi rõ trong [ADR-UI-baseline-CV2.md](file:///d:/Dự án BigData Côn trùng/vietinsect/docs/adr/ADR-UI-baseline-CV2.md) dòng 20–29: repo đã ở React 19 từ commit `928cd39`/`1c291ac` trước đợt đồng bộ UI, ADR quyết định **không hạ về React 18** để tránh phạm vi migration. Đây **không phải mâu thuẫn ADR** — là thực tế đã chốt. TASK-00.1 cần xóa ghi chú "React 18" và thay bằng "React 19". |
| `SRS.md` + `cây thư mục dự án.md` | MongoDB cho dữ liệu phi cấu trúc | → **Self-hosted Docker** theo NĐ 73/2017, không Atlas. Hiện docker-compose.yml đã đúng (`mongo:7.0` self-hosted). |
| `danh sách màn hình dự kiến.md` | Ghi "63 tỉnh" ở một số chỗ mô tả | → **Bug** — phải dùng **34 tỉnh** theo NQ 202/2025/QH15. Seed `001_seed_lookups.js` đã đúng 34 tỉnh. Cần kiểm tra lại `HomeMapHero.js` và bất kỳ chỗ nào còn hardcode 63. |
