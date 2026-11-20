# Changelog

## [2.0.1] - 2026-11-20
### Changed
- **ADR-001 (`DEF-001`):** Chính thức ghi nhận stack Frontend là **React 19 + CRA 5 (craco), react-leaflet 5** trong `docs/adr/SRS.md` (§2.1, §6.5) và `docs/adr/001-react-19.md`.
- **Routing (`DEF-002`):** Pin `react-router-dom@6` tương thích React 19 & CRA 5 Jest 27.

### Fixed
- **Nhóm 1 – Bảo mật & Phân quyền:** `DEF-089` (lọc DNA gắn mẫu Private/xóa mềm), `DEF-051` + `DEF-090` (gỡ Bearer token ở route public, tôn trọng `X-View-As: public`, thêm CORS `allowedHeaders`), `DEF-015` + `DEF-016` (bỏ số fallback hard-code, dùng `??`, lấy tổng tỉnh từ DB).
- **Nhóm 2 – Toàn vẹn dữ liệu:** `DEF-075` (FK `ON DELETE SET NULL` + orphan DNA khi xóa mềm/khôi phục), `DEF-024` (bỏ giá trị khoa học giả lập), `DEF-027` + `DEF-034` (bulk-import không tự điền mặc định / không fallback taxon), `DEF-035` + `DEF-038` (Joi validator cho bulk-import/batch-update, `basisOfRecord` UPPER_SNAKE, `sex: "unknown"`), `DEF-022` (chặn ngày thu tương lai), `DEF-033` + `DEF-109` (giới hạn 5.000 dòng trả 400, giới hạn 10MB riêng cho `/bulk-import`), `DEF-107` (sửa `mv_taxon_dwc_flat`), `DEF-108` (`COUNT(s.specimen_id)`).
