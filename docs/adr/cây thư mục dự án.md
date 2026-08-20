#  Cây thư mục dự án VietInsect
 
ROOT — MONOREPO    pnpm workspaces    Docker Compose
 
vietinsect/ root workspace
 
- .editorconfig indent, charset, line ending thống nhất toàn team
- .gitignore
- .gitattributes LF line endings cho Linux server
- .nvmrc pin Node.js version (VD: 20.14.0)
pnpm-workspace.yaml khai báo packages: frontend, backend, shared
 
package.json root scripts: dev, build, test, lint toàn bộ
 
— docker-compose.yml dev: all services
 
docker-compose.prod.yml prod: replicas, healthcheck, restart policy
 
— Makefile make dev / test / build / migrate / seed / logs
 
— CHANGELOG.md semantic versioning history
 
CONTRIBUTING.md quy tắc commit, branch, PR
 
docs/ tài liệu kỹ thuật
 
SRS.md đặc tả yêu cầu hệ thống
 
— architecture.md sơ đồ kiến trúc tổng thể
 
api.md OpenAPI 3.0 spec (auto-gen từ backend)
 
database-erd.md ERD 3NF + Darwin Core mapping
 
adr/ Architecture Decision Records (001-xxx.md)
 
scripts/ automation scripts
 
db-migrate.sh
 
— db-seed.sh
 
- backup.sh PostgreSQL full backup → MinIO
packages/
 
shared/ code dùng chung frontend + backend
 
constants/ IUCN_STATUS, INSECT_ORDERS, SPECIMEN_STATUS...
 
types/ JSDoc/TS-styletypedef: Specimen, Taxon, DNA...
 
validators/ Joi schemas dùng chung cả 2 phía
 
— frontend/ → xem chi tiết bên dưới
 
— backend/ → xem chi tiết bên dưới
 
— ai-service/ → xem chi tiết bên dưới
 
$-\rightarrow$ infra/ → xem chi tiết bên dưới
 
 
 
```
— package.json react-scripts ^5, deps khai báo đầy đủ
— craco.config.js custom webpackk không cần eject: alias, bundle analyzer
— .env REACT_APP_APL_URL, REACT_APP_MAPS_KEY...
— .env.development
— .env.production
— .env.test
— .eslinrc.js rules: no-unused-vars, import/order, react-hooks
— .prettierrc
— jsonconfig.json baseUrl src → import ngân: @/modules/specimen
— public/
  | index.html bắt buộc CRA — meta SEO, font preload
  | favicon.ico
  | manifest.json
  | robots.txt
  | locales/ i18n static files
  | vi.json Tiếng Việt
  | en.json English
— src/
  | index.js CRA entry — ReactDOM.createRoot, Providers wrap
  | App.js RouterProvider + layout switch (AdminLayout / PublicLayout)
  | router.js createBrowserRouter v6, lazy() mọi page, route guards
  | reportWebVitals.js
  | setupTests.js jest-dom matchers
```
 
— Tầng 1: Shared UI primitives
— components/ pure UI, zero business logic, fully reusable
  |   |   ui/ atoms — không phụ thuộc lẫn nhau
  |  |   Button/ Button.js · Button.test.js · index.js
  |  |  Input/
  |  |  Badge/
  |  |  Modal/
  |  |  Tooltip/
  |  |  Dropdown/
  |  |  Toast/
  |  |  index.js barrel export tất cả atoms
  |  |  layout/ shells — nhận children, không biết domain
  |  |  AdminLayout.js Sidebar + Topbar + main content
  |  |  PublicLayout.js header đơn giản cho User
  |  |  Sidebar.js
```
 
```
    | Topbar.js
    | Breadcrumb.js
    | PageWrapper.js title, padding, breadcrumb chuẩn
    | table/
    | DataTable.js generic, nhận columns config + data
    | Pagination.js
    | ColumnPicker.js chọn cột hiển thị, lưu localStorage
    | SortHeader.js
    | form/
    | FormField.js label + input + error message wrapper
    | AutocompleteInput.js debounce 300ms, dropdown kết quả
    | GPSPicker.js Leaflet mini-map chọn tọa độ kéo thả
    | ImageUploadZone.js drag-and-drop, preview, progress bar
    | BarcodeScanner.js react-qr-reader, auto-fill mã mẫu
    | DateRangePicker.js
    | chart/
    | TaxonTreemap.js Recharts Treemap — kích thước $\propto$ số mẫu
    | BarChart.js
    | LineChart.js xu hướng số hóa theo thời gian
    | DonutChart.js đô phủ dữ liệu % ảnh/DNA/GPS
    | map/ Leaflet wrappers — react-leaflet v4
    | BaseMap.js container, tile layer, zoom controls
    | OccurrenceLayer.js CircleMarker, popup, màu theo bộ
    | HeatmapLayer.js leaflet-heat plugin
    | PolygonDrawTool.js leaflet-draw polygon/rectangle search
    | LayerSwitcher.js Google/OSM/VN toggle
    | PopupCard.js thông tin nhanh tại điểm mẫu
    | feedback/
    | LoadingSpinner.js
    | EmptyState.js icon + message + CTA button
    | ErrorBoundary.js class component bắt lỗi render
    | ConfirmDialog.js xác nhận xóa, toggle public/private
```
Tầng 2: Feature modules — 1 folder = 1 domain
modules/ mỗi module: pages + components + hooks + constants
-- auth/ SCR-01/02 - F-AU-01~03
-- pages/
-- LoginPage.js
-- ChangePasswordPage.js
```
 
```
        — components/
        — LoginForm.js
        — useAuth.js login(), logout(), isAuthenticated
        — auth.store.js Zustand: user, token, role
        — AuthGuard.js HOC bảo vệ route Admin
        — index.js barrel export
        — dashboard/ SCR-03/04 · F-DB-01~04
        — pages/
        — AdminDashboardPage.js
        — PublicHomePage.js
        — components/
        — StatsRow.js 4 stat cards: mẫu/loài/ảnh/DNA
        — RecentSpecimenList.js
        — DigitizationProgress.js thanh tiến độ số hóa
        — AlertBanner.js cảnh báo dữ liệu bất thường
        — useDashboard.js
        — index.js
        — specimen/ SCR-05~11 · F-SP-01~12 — module lớn nhất
        — pages/
        — SpecimenListPage.js
        — SpecimenDetailPage.js
        — SpecimenCreatePage.js
        — SpecimenEditPage.js
        — BulkImportPage.js WorkBench 5.000 bản ghi
        — BatchEditPage.js
        — LabelPrintPage.js in nhãn QR hàng loạt
        — components/
        — SpecimenForm.js form 22 trường, dùng chung create + edit
        — SpecimenTable.js extends DataTable với columns config riêng
        — ImageGallery.js slideshow + upload zone
        — ChangeHistory.js timeline tracked changes
        — ColumnMapperModal.js drag-and-drop map cột Excel
        — ImportPreviewTable.js highlight lỗi đó/vàng trước khi nhập
        — LabelCanvas.js render nhãn QR preview trước khi in
        — useSpecimen.js CRUD, pagination, filter
        — useBulkImport.js upload → parse → validate → submit
        — specimen.constants.js FORM_FIELDS (22 trường), STATUS_OPTIONS...
        — index.js
        — taxonomy/ SCR-12~14 · F-TX-01~07
```
 
```
   — pages/
   — TaxonomyTreePage.js
   — SpeciesProfilePage.js 6 tabs
   — TaxonEditorPage.js
   — components/
   — TaxonTree.js recursive tree với expand/collapse
   — TaxonNode.js single node: tên + số mẫu + actions
   — SynonymManager.js accepted / synonym table
   — ExternalLinkBadges.js GBIF/BOLD/ITIS/COL/IUCN chips
   — SpeciesTabPanel.js container 6 tabs với lazy load
   — useTaxonomy.js
   — index.js
   — search/ SCR-15~17 F-SR-01~07
   — pages/
   — SearchPage.js full-text + faceted
   — AdvancedSearchPage.js
  — MediaGalleryPage.js
  — components/
  — SearchBar.js full-text + debounce 300ms
  — FacetPanel.js bộ lọc trái, hiển thị count/filter
  — ActiveFilters.js chips hiển thị filter đang bật, x để xóa
  — ViewSwitcher.js toggle 5 chế độ xem
  — views/ 5 chế độ xem kết quả
  — ListView.js
  |   | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | |
 
```
|     LayerList.js drag-reorder, toggle, delete lớp
|     LayerUploadModal.js Shapefile/GeoJSON/GeoTIFF
|     RichnessMap.js choropleth vùng giàu loài
|     useGIS.js
|     index.js
|     dna/ SCR-20~22 · F-DN-01~05
|     pages/
|     DNAlistPage.js
|     DNAEntryPage.js nhập mã GenBank → auto-fetch NCBI
|     DNADetailPage.js
|     components/
|     FASTAViewer.js nucleotide display + copy + download
|     GenBankInput.js validate accession regex, fetch on blur
|     DNAMetaCard.js gene/length/date/author/BOLD Link
|     useDNA.js
|     index.js
|     ai/ SCR-23~25 · F-AI-01~04
|     pages/
|     SpeciesIDPage.js upload → CNN → top-5 confirm
|     SDMPredictionPage.js MaxEnt dự báo phân bố
|     AnalyticsDashboardPage.js
|     components/
|     ImageDropzone.js upload + preview cho AI identify
|     PredictionResultCard.js top-5 loài + xác suất + confirm btn
|     SDMResultMap.js raster overlay kết quả MaxEnt
|     DataQualityAlerts.js GPS lõi, tên sai, GenBank invalid
|     useAI.js
|     index.js
|     reports/ SCR-26~28 · F-RP-01~06
|     pages/
|     ReportListPage.js chọn loại báo cáo
|     KPIReportPage.js
|     CustomReportBuilderPage.js
|     components/
|     ReportPreview.js PDF preview với header/footer/watermark Viện
|     FieldSelector.js kéo thả chọn trưởng cho Custom Report
|     ExportFormatPicker.js PDF / Excel / CSV / Word
|     useReports.js
```
 
```
    — admin/ SCR-29/30 · F-AD-01~04
       pages/
     |   | PublicPrivateControlPage.js toggle hàng loạt
     |   | AuditLogPage.js
     |   | SystemConfigPage.js SMTP, API keys, backup
     | components/
     |   | PublicToggleTable.js bảng switch Public/Private
     |   | AuditLogTable.js
     |   | ConfigForm.js
     |   | useAdmin.js
     | index.js
 
```
— Tăng 3: Cross-cutting concerns
----------------------------------
— hooks/ hooks dùng chung — không thuộc module nào
— useApi.js axios instance, JWT interceptor, auto-refresh
— useDebounce.js
— usePagination.js
— useQueryParams.js sync filter state  → URL search params
— useLocalStorage.js
— usePermission.js isAdmin() check
— useToast.js success/error/info notifications
— stores/ Zustand — global state không thuộc 1 module
— auth.store.js user, token, role
— ui.store.js sidebarOpen, toastQueue, activeModal
— search.store.js shared search state giữa map và list
— services/ API layer — chỉ gọi HTTP, không có state
— http.js axios instance gốc, baseURL, timeout, interceptors
— specimen.service.js
— taxonomy.service.js
— dna.service.js
— gis.service.js
— ai.service.js
— report.service.js
— admin.service.js
— constants/ magic strings / enums toàn app
— routes.js ROUTES.SPECIMEN_LIST = '/admin/specimens'...
— api.js API_ENDPOINTS object
— app.js PAGE_SIZE, DATE_FORMAT, DEBOUNCE_MS...
— utils/ pure functions — không có side effects
```
 
— formatDate.js ISO 8601 → hiển thị, UTC+7
— formatNumber.js 24.381 mẫu vật → "24,381"
— downloadFile.js blob → file save DwC-A/Excel/PDF
— validateGenBank.js regex: /^[A-Z]{1,2}\d{5,6}\}.\d+$/
— geoUtils.js WGS84 → VN-2000 (EPSG:4756), bbox check
— i18n.js react-i18next init, namespace: common/specimen/taxonomy...
— errorMessages.js map HTTP status → message Tiếng Việt/Anh
 
```
  BACKEND — NODE.JS 20 + EXPRESS 5 + POSTGRESQL 15/POSTGIS 3     REST API·OpenAPI 3.0
backend/
— package.json
  — server.js    khởi động HTTP server, graceful shutdown
  — app.js    Express app factory, đăng ký middleware, routes
  — .env
  — .eslintrc.js
  — jsonconfig.json
  — src/
  — config/     kết nối dịch vụ — singleton pattern
  |    — db.js    pg Pool + PostGIS, connection retry
  |    — redis.js    ioredis — session cache, rate limit store
  |    — minio.js    MinIO client — buckets: specimens/shapefiles/reports
  |    — elasticsearch.js    @elastic/elasticsearch client
  |    — smtp.js    nodemailer transport
  |    — logger.js    Winston: level, format, daily rotate file
  |    — middleware/
  |    — auth.middleware.js    verify JWT → attach req.user
  |    — role.middleware.js    requireAdmin guard
  |    — rateLimiter.js    express-rate-limit + Redis store, 1000 req/min/IP
  |    — auditLog.middleware.js    ghi mọi CRUD vào bảng audit_logs
  |    — upload.middleware.js    multer → stream thẳng lên MinIO
  |    — validate.middleware.js    Joi schema validation factory
  |    — errorHandler.js    global error → chuẩn hóa response {code, message}
  |    — requestLogger.js    Morgan: method, url, status, ms
  |    — modules/    mirror với frontend — routes → controller → service → repository
  |    — auth/
  |    — auth.routes.js    POST /login, /logout, /change-password
  |    — auth.controller.js
  |    — auth.service.js    bcrypt compare, JWT sign/verify, session
  |    — auth.validator.js    Joi schema login/change-password
```
 
```
— specimen/
— specimen.routes.js
— specimen.controller.js
— specimen.service.js CRUD, soft delete, tracked changes
— specimen.repository.js SQL queries — tách khỏi business logic
— bulkImport.service.js parse xlsx, validate, batch insert pg
— label.service.js Puppeteer render HTML → PDF nhãn QR
— specimen.validator.js Joi 22 trưởng
— taxonomy/
— taxonomy.routes.js
— taxonomy.controller.js
— taxonomy.service.js
— taxonomy.repository.js
— catalogueOfLife.service.js gọi COL API xác thực tên khoa học
— search/
— search.routes.js
— search.controller.js
— elasticsearch.service.js index, query DSL, facet aggregation
— export.service.js sinh DwC-A.zip / Excel / GeoJSON stream
— gis/
— gis.routes.js
— gis.controller.js
— postgis.service.js ST_Within, ST_DWithin, species richness
— layer.service.js import shapefile → PostGIS, GeoTIFF → MinIO
— dna/
— dna.routes.js
— dna.controller.js
— dna.service.js
— dna.repository.js
— ncbi.service.js NCBI E-utilities: esearch + efetch metadata
— reports/
— reports.routes.js
— reports.controller.js
— reports.service.js
— pdfGenerator.service.js Puppeteer: header/footer/watermark Viện
— admin/
— admin.routes.js
— admin.controller.js
— publicControl.service.js batch toggle is_public field
```
 
```
    — systemConfig.service.js đọc/ghi bảng system_config
     database/
     — migrations/ Knex — đánh số, không bao giờ sửa file đã chay
     | — 20240601_001_create_taxa.js
     | — 20240601_002_create_specimens.js 22 fields + geo-
     | — 20240601_003_create_images.js
     | — 20240601_004_create_dna.js
     | — 20240601_005_create_bioactivity.js
     | — 20240601_006_create_map_layers.js
     | — 20240601_007_create_audit_logs.js
     | — 20240601_008_create_system_config.js
     | — seeds/ dữ liệu mẫu: taxa chuẩn, 50 specimens test
     | — schemas/ ERD diagram, Darwin Core field mapping
     | utils/
    — AppError.js custom error class: statusCode + code + message
    |  asyncHandler.js wrap async route → tự catch lỗi
    |  paginate.js helper: LIMIT/OFFSET từ page + size
    | dwcMapper.js map DB fields → Darwin Core terms
   tests/
   | unit/ Jest — service + utils, mock DB
   | integration/ Supertest — API endpoint + real DB test
  | e2e/ Playwright — happy paths 30 màn hình
```
 
NI-SERVICE — PYTHON 3.11 + FASTAPI (MICROSERVICE ĐỘC LẬP)     CNN
-service/
   main.py FastAPI app, CORS, docs /api/docs
   requirements.txt
   Dockerfile
   .env
   app/
   routers/
   |  species_id.py POST /identify → top-5 loài <5s · F-AI-01
  |  sdm.py POST /sdm/predict → MaxEnt map · F-AI-02
  | services/
  |  cnn_service.py load model, preprocess, inference
  |  sdm_service.py MaxEnt wrapper, WorldClim/CHELSA vars
  | models/
  |  cnn_model.py EfficientNet-B4 PyTorch
  |  sdm_model.py
```
 
schemas/ Pydantic request/response models
 
weights/ *.pt checkpoints — gitignored, lưu MinIO
 
- tests/ pytest
 
INFRA — DOCKER · NGINX · GEOSERVER · CI/CD     production-ready
 
infra/
 
- nginx/
 
— nginx.conf reverse proxy, HTTPS TLS 1.3, gzip, rate limit
 
-- upstream.conf backend:3000, ai-service:8000, geoserver:8080
 
— ssl/ cert.pem, key.pem — gitignored
 
geoserver/
 
| Dockerfile|
 
data/ WMS/WFS workspace config, style SLD
 
- minio/
 
init-buckets.sh tạo: specimens, shapefiles, reports, ai-weights
 
- elasticsearch/
 
mappings/ specimens.json, taxa.json — index mapping
 
- monitoring/
 
| — prometheus.yml scrape: backend, pg, redis, nginx
 
grafana/ dashboards: API latency, DB connections, uptime
 
.github/
 
workflows/
 
ci.yml push → lint → test → build → deploy staging
 
cd.yml merge main → build image → push registry → deploy prod