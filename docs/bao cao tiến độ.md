# 📊 VietInsect BigData — Báo cáo Tổng hợp Tiến độ
> Cập nhật: 02/11/2026 · Dựa trên kiểm tra thực tế mã nguồn + docs/adr

---

## 🎯 Tổng quan Dự án

**VietInsect BigData System** — Hệ thống quản lý, phân tích và chia sẻ dữ liệu đa dạng sinh học côn trùng Việt Nam.  
Thuộc **Nhóm nội dung 3** — Phát triển phần mềm của Đề tài Viện CNTT (Viện Hàn lâm KHCNVN).

### Stack kỹ thuật đã khóa
| Tầng | Công nghệ |
|:---|:---|
| **Frontend** | React 19.2.7 + CRA (react-scripts 5) + React Router DOM 7.18.1 + Zustand + i18next |
| **Backend** | Node.js 20 + Express 5 + Knex (PostgreSQL) |
| **DB chính** | PostgreSQL 15 + PostGIS 3 (chuẩn Darwin Core / 3NF) |
| **DB phụ** | MongoDB 7.0 self-hosted (phi cấu trúc, ảnh, tài liệu) |
| **Cache / Queue** | Redis |
| **Object Storage** | MinIO (specimens, shapefiles, reports, ai-weights) |
| **Search** | Elasticsearch 8.x |
| **AI Microservice** | Python 3.11 + FastAPI + PyTorch CNN/EfficientNet-B4 + MaxEnt SDM _(do AI Engineer độc lập phụ trách)_ |
| **Infra** | Docker Compose · Nginx · GeoServer · Prometheus/Grafana · GitHub Actions |
| **Monorepo** | pnpm workspaces (`frontend/`, `backend/`, `packages/shared/`) |

---

## 📈 Tổng tiến độ theo Lộ trình CV-Phases

```
Baseline ✅  →  CV2.1 Taxonomy ✅ BE / 🟡 FE 85%
→  CV2.2 Specimen + DNA          ⬜ 0%
→  CV2.3 Search / Báo cáo        ⬜ 0%
→  CV2.4 Admin nâng cao          ⬜ 0%
→  CV2.5 WebGIS                  ⬜ 0%
→  CV2.6 Phân tích không gian    ⬜ 0%
→  CV2.7 Tích hợp sinh thái      ⬜ 0%
→  CI/CD + Testing + Docs        ⬜ 0%
```

**Tiến độ toàn dự án ước tính: ~25–30%**

---

## ✅ Những gì ĐÃ CÓ (Đã hoàn thành)

### 🔧 TASK-00: Nợ Kỹ thuật — **100% XONG** _(27/08/2026)_

| Task | Nội dung | Kết quả |
|:---|:---|:---:|
| TASK-00.1 | Thêm `recharts ^2.15.1` + `cross-env` vào `frontend/package.json` | ✅ |
| TASK-00.2 | Migrate i18n sang JSON files (`public/locales/vi/`, `en/`) + `i18next-http-backend` | ✅ |
| TASK-00.3 | Fix stale closure `useAuthStore.isAuthenticated` → boolean reactive | ✅ |
| TASK-00.4 | Tạo constants: `routes.js`, `api.js`, `app.js` cho 30 màn hình | ✅ |
| TASK-00.5 | Đồng bộ Design System v2.1 — Editorial & Scientific (GBIF-inspired) | ✅ |

---

### 🗄️ Database

| Hạng mục | Tiến độ |
|:---|:---:|
| 10 file migration đầy đủ (taxa, specimens, images, dna, bioactivity, map_layers, audit_logs, system_config...) | **95%** |
| View `mv_taxon_dwc_flat`, partition `specimens_partitioned`, partition `audit_logs` | ✅ |
| Seed `001_seed_lookups.js` — admin user, 12 sinh cảnh, 6 giai đoạn phát triển, 8 specimen_status, **34 tỉnh NQ 202/2025/QH15** | ✅ |
| `002_seed_taxa.js` (16 bộ Insecta) | ❌ Chưa có |
| `003_seed_specimens.js` (50 mẫu demo) | ❌ Chưa có |

---

### 🖥️ Backend — Module đã hoàn thiện

| Module | Files | Tiến độ |
|:---|:---|:---:|
| **Auth** | `auth.controller.js`, `.service.js`, `.repository.js`, `.validator.js`, `.routes.js`, `.errors.js` — bcrypt, JWT, brute-force lock sau 5 lần | **100%** |
| **Taxonomy** | `taxonomy.service.js` (366 dòng), `.repository.js` (239 dòng), CRUD + synonym + species_profile + bioactivity + import Excel + COL API | **100%** |
| **Middleware** | `auth.middleware.js` (requireAdmin), `errorHandler.js` | **25%** |
| **Config** | `db.js`, `logger.js`, `jwt.js` | **43%** |
| **Utils** | `AppError.js` | **25%** |

> [!WARNING]
> Các module **Specimen, Search, GIS, DNA, Reports, Admin** — thư mục **rỗng hoàn toàn (0%)**.

---

### 🎨 Frontend — Màn hình và module đã hoàn thiện

| SCR | Màn hình | Trạng thái |
|:---|:---|:---:|
| SCR-01 | Đăng nhập (`LoginPage.js`) | ✅ 90% |
| SCR-03 | Dashboard Admin | 🟡 70% (metric hardcode, chưa gọi API thật) |
| SCR-04 | Trang chủ công khai (`PublicHomePage.js`) | ✅ 100% |
| SCR-12 | Cây phân loại học (`TaxonomyTreePage.js`) | ✅ 100% |
| SCR-13 | Hồ sơ loài (`SpeciesProfilePage.js`) | 🟡 85% (tab Mẫu vật & Phân bố còn placeholder) |
| SCR-14 | Quản lý danh pháp (`TaxonEditorPage.js`) | ✅ 100% |

**Frontend Infrastructure đã có:**
- ✅ Router 30 routes + AuthGuard + dual-context pattern (`useIsAdminContext`)
- ✅ `screenRegistry.js` — 30 entries đầy đủ, 9 màn hình dualContext
- ✅ `auth.store.js` (Zustand reactive), `AuthGuard.js`
- ✅ `taxonomy.service.js`, `taxonomy.store.js`, `taxonomy.utils.js`, `taxonomy.constants.js`
- ✅ Components taxonomy: `TaxonomyTreeView`, `TaxonForm`, `SynonymManager`, `ExternalLinkBadges`, `SpeciesProfileTabs`
- ✅ `http.js`, `auth.service.js`
- ✅ Constants: `routes.js`, `api.js`, `app.js`
- ✅ i18n: `public/locales/vi/translation.json`, `en/translation.json`
- ✅ UI primitives: `Icon`, `ConfirmDialog`, `Toast`, `EmptyState`, `LoadingState`
- ✅ Design System v2.1 — `BrandLogo`, `TechnicalFrame`, `AdminChrome`, `PublicLayout`

---

### 🐳 Infra Docker
| Service | Trạng thái |
|:---|:---:|
| PostgreSQL + PostGIS | ✅ |
| MongoDB self-hosted | ✅ |
| Redis | ✅ |
| MinIO | ✅ |
| Elasticsearch | ❌ Chưa có |
| Nginx | ❌ Chưa có |
| GeoServer | ❌ Chưa có |
| Prometheus / Grafana | ❌ Chưa có |

---

## ❌ Những gì CHƯA CÓ (Còn trống)

### Backend (còn 0%)
- 🔴 `backend/src/modules/specimen/` — **Rỗng hoàn toàn**
- 🔴 `backend/src/modules/search/` — Rỗng
- 🔴 `backend/src/modules/gis/` — Rỗng
- 🔴 `backend/src/modules/dna/` — Rỗng
- 🔴 `backend/src/modules/reports/` — Rỗng
- 🔴 `backend/src/modules/admin/` — Rỗng
- 🔴 `backend/src/config/redis.js`, `minio.js`, `elasticsearch.js`, `smtp.js`
- 🔴 `backend/src/utils/asyncHandler.js`, `paginate.js`, `dwcMapper.js`
- 🔴 `backend/src/middleware/validate.js`, `rateLimiter.js`, `auditLog.js`, `upload.js`

### Frontend (còn 0%)
- 🔴 Toàn bộ **SCR-02** (Đổi mật khẩu) → placeholder
- 🔴 Toàn bộ **SCR-05~11** (7 màn hình Specimen) → placeholder
- 🔴 Toàn bộ **SCR-15~17** (Search + Media) → placeholder
- 🔴 Toàn bộ **SCR-18~19** (GIS) → placeholder
- 🔴 Toàn bộ **SCR-20~22** (DNA) → placeholder
- 🔴 Toàn bộ **SCR-23~25** (AI) → placeholder
- 🔴 Toàn bộ **SCR-26~28** (Reports) → placeholder
- 🔴 Toàn bộ **SCR-29~30** (Admin) → placeholder
- 🔴 UI Primitives: `chart/*`, `map/*`, `table/*`, `form/*` — **Rỗng**
- 🔴 Stores: `ui.store.js`, `search.store.js`
- 🔴 Services: specimen, search, gis, dna, reports, admin, ai

### Hạ tầng & DevOps (0%)
- 🔴 `infra/elasticsearch/mappings/` — Rỗng
- 🔴 `infra/nginx/` — Chỉ có `ssl/` dir rỗng
- 🔴 `infra/monitoring/prometheus.yml`, `grafana/` dashboards — Rỗng
- 🔴 `.github/workflows/ci.yml`, `cd.yml` — Rỗng
- 🔴 `scripts/db-migrate.sh`, `db-seed.sh`, `backup.sh` — Rỗng
- 🔴 `packages/shared/constants/`, `types/`, `validators/` — **Rỗng hoàn toàn**

### Tài liệu (0%)
- 🔴 `docs/architecture.md`, `docs/api.md`, `docs/database-erd.md`
- 🔴 `docs/user-guide-vi.md`, `docs/user-guide-en.md`, `docs/admin-guide-vi.md`
- 🔴 Tests: Unit (Jest), Integration (Supertest), E2E (Playwright) — 0%

---

## 🗺️ Bảng 30 Màn hình — Trạng thái hiện tại

| Mã | Màn hình | FE | BE | Ưu tiên |
|:---|:---|:---:|:---:|:---:|
| SCR-01 | Đăng nhập | ✅ | ✅ | — |
| SCR-02 | Đổi mật khẩu | 🔴 | 🟡 | TASK-07.1 |
| SCR-03 | Dashboard Admin | 🟡 | 🟡 | TASK-01.1 |
| SCR-04 | Trang chủ công khai | ✅ | — | — |
| SCR-05 | Danh sách mẫu vật | 🔴 | 🔴 | **GIAI ĐOẠN 2** |
| SCR-06 | Thêm mới mẫu vật | 🔴 | 🔴 | **GIAI ĐOẠN 2** |
| SCR-07 | Chỉnh sửa mẫu vật | 🔴 | 🔴 | **GIAI ĐOẠN 2** |
| SCR-08 | Chi tiết mẫu vật | 🔴 | 🔴 | **GIAI ĐOẠN 2** |
| SCR-09 | Nhập hàng loạt | 🔴 | 🔴 | **GIAI ĐOẠN 2** |
| SCR-10 | Chỉnh sửa hàng loạt | 🔴 | 🔴 | **GIAI ĐOẠN 2** |
| SCR-11 | In nhãn QR | 🔴 | 🔴 | **GIAI ĐOẠN 2** |
| SCR-12 | Cây phân loại học | ✅ | ✅ | — |
| SCR-13 | Hồ sơ loài | 🟡 | ✅ | TASK-01.2 |
| SCR-14 | Quản lý danh pháp | ✅ | ✅ | — |
| SCR-15 | Tìm kiếm mẫu vật | 🔴 | 🔴 | **GIAI ĐOẠN 3** |
| SCR-16 | Tìm kiếm nâng cao | 🔴 | 🔴 | **GIAI ĐOẠN 3** |
| SCR-17 | Thư viện hình ảnh | 🔴 | 🔴 | **GIAI ĐOẠN 3** |
| SCR-18 | Bản đồ phân bố | 🔴 | 🔴 | **GIAI ĐOẠN 5** |
| SCR-19 | Quản lý lớp bản đồ | 🔴 | 🔴 | **GIAI ĐOẠN 5** |
| SCR-20 | Danh sách DNA | 🔴 | 🔴 | **GIAI ĐOẠN 2** |
| SCR-21 | Form Thêm/Sửa DNA | 🔴 | 🔴 | **GIAI ĐOẠN 2** |
| SCR-22 | Chi tiết FASTA | 🔴 | 🔴 | **GIAI ĐOẠN 2** |
| SCR-23 | AI nhận dạng loài | 🔴 | 🔴 | **GIAI ĐOẠN 8** |
| SCR-24 | SDM Dự báo phân bố | 🔴 | 🔴 | **GIAI ĐOẠN 8** |
| SCR-25 | Analytics Dashboard | 🔴 | 🔴 | **GIAI ĐOẠN 4** |
| SCR-26 | Báo cáo danh lục | 🔴 | 🔴 | **GIAI ĐOẠN 4** |
| SCR-27 | Báo cáo KPI | 🔴 | 🔴 | **GIAI ĐOẠN 4** |
| SCR-28 | Bộ dựng báo cáo | 🔴 | 🔴 | **GIAI ĐOẠN 4** |
| SCR-29 | Kiểm soát chia sẻ | 🔴 | 🔴 | **GIAI ĐOẠN 4** |
| SCR-30 | Nhật ký & Cấu hình | 🔴 | 🔴 | **GIAI ĐOẠN 4** |

**Tổng: 4 màn hình ✅ · 2 màn hình 🟡 · 24 màn hình 🔴**

---

## 🔢 Bảng Tỷ lệ % Theo Thành phần

| Thành phần | % |
|:---|:---:|
| DB Schema & Migrations | **95%** |
| DB Seeds | **40%** |
| Backend Auth | **100%** |
| Backend Taxonomy | **100%** |
| Backend Specimen | **0%** |
| Backend Search | **0%** |
| Backend GIS | **0%** |
| Backend DNA | **0%** |
| Backend Reports | **0%** |
| Backend Admin | **0%** |
| Backend Middleware | **25%** |
| Backend Config | **43%** |
| Backend Utils | **25%** |
| Frontend Router + screenRegistry | **100%** |
| Frontend Auth (SCR-01) | **90%** |
| Frontend Dashboard (SCR-03/04) | **70%** |
| Frontend Taxonomy (SCR-12/13/14) | **85%** |
| Frontend Specimen (SCR-05~11) | **0%** |
| Frontend Search (SCR-15~17) | **0%** |
| Frontend GIS (SCR-18~19) | **0%** |
| Frontend DNA (SCR-20~22) | **0%** |
| Frontend AI (SCR-23~25) | **0%** |
| Frontend Reports (SCR-26~28) | **0%** |
| Frontend Admin (SCR-29~30) | **0%** |
| Frontend UI Primitives | **15%** |
| Frontend i18n | **100%** |
| Frontend Stores | **50%** |
| Frontend Services | **15%** |
| Frontend Constants | **100%** |
| packages/shared | **0%** |
| Infra Docker | **40%** |
| Infra ES mappings | **0%** |
| Infra Monitoring | **5%** |
| Infra Nginx | **0%** |
| CI/CD GitHub Actions | **0%** |
| Scripts (migrate/seed/backup) | **0%** |
| Tests (Unit/Integration/E2E) | **0%** |
| Tài liệu kỹ thuật & HDSD | **0%** |

---

## 🚀 Task tiếp theo (Ưu tiên cao)

### Giai đoạn 1 — Hoàn thiện CV2.1 (Ngay bây giờ)
1. **TASK-01.1** — Kết nối metric thật cho SCR-03 Dashboard (tạo `dashboard.service.js`, xóa hardcode)
2. **TASK-01.2** — Hoàn thiện SCR-13 tab Mẫu vật (hiện số lượng + link) và tab Phân bố (map placeholder react-leaflet)

### Giai đoạn 2 — CV2.2 Specimen + DNA (Module lớn nhất)
3. **TASK-02.1** — Backend utils: `asyncHandler.js`, `paginate.js`, `dwcMapper.js`
4. **TASK-02.2** — Backend middleware còn thiếu: `validate`, `rateLimiter`, `auditLog`, `upload`
5. **TASK-02.3** — Toàn bộ Backend Specimen module (7 file: errors→validator→repository→service→bulkImport→label→controller+routes)
6. **TASK-02.4** — Toàn bộ Backend DNA module (errors→validator→ncbi.service→repository→service→controller+routes)
7. **TASK-02.5** — Seed taxa 16 bộ Insecta + 50 specimens demo
8. **TASK-06** — UI Primitives tầng FE: `DataTable`, `FormField`, `GPSPicker`, `ImageUploadZone`, chart/*, map/*
9. **TASK-07.2** — 7 màn hình Frontend Specimen (SCR-05~11)
10. **TASK-07.5** — 3 màn hình Frontend DNA (SCR-20~22)

> [!IMPORTANT]
> Module **Specimen** là phụ thuộc trọng tâm — hầu hết các module khác (Search, GIS, Reports, AI) đều cần Specimen data. Nên ưu tiên hoàn thiện BE + FE Specimen trước.

> [!NOTE]
> AI Microservice (FastAPI/PyTorch CNN/MaxEnt SDM) do AI Engineer khác phụ trách độc lập — chỉ cần tích hợp BE proxy (`POST /api/ai/identify`, `POST /api/ai/sdm/predict`) ở giai đoạn 8.

---

## ⚠️ Lưu ý Nghiệm thu

Theo `docs/adr/chiến lược.md`, dự án là đề tài nghiệm thu Viện CNTT — **deliverable bắt buộc** bao gồm:
- `docs/user-guide-vi.md` + `docs/user-guide-en.md` + `docs/admin-guide-vi.md`
- `docs/architecture.md`, `docs/api.md`, `docs/database-erd.md`
- Test coverage ≥ 80% cho các service chính
- Tất cả 30 màn hình chức năng hoạt động (không còn placeholder)
- Công việc 1.3 (Thiết kế mô hình CSDL) — **vẫn chưa đánh dấu hoàn thành**

**Cột mốc quan trọng còn lại: CV2.2 → CV2.7 → CI/CD → Testing → Tài liệu**
