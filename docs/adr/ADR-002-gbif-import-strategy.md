# ADR-002: Chiến lược tải dữ liệu GBIF (Search API Slicing vs Download API)

## Trạng thái
Accepted (2026-11-22)

## Bối cảnh
Hệ thống VietInsect cần đồng bộ dữ liệu mẫu vật côn trùng tại Việt Nam (`country=VN`, `classKey=216` / `Insecta`) từ GBIF.
GBIF Occurrence Search API (`/v1/occurrence/search`) áp dụng giới hạn cứng `offset + limit <= 100,000` (và thực tế có thể timeout ở deep-paging > 9,000 bản ghi/truy vấn).

## Quyết định
1. **Khi chưa cấu hình `GBIF_USERNAME` / `GBIF_PASSWORD` trong `.env`:**
   - Sử dụng GBIF Occurrence Search API với:
     - `User-Agent` nhận diện rõ (`VietInsect-GBIF-Importer/2.0 (vietinsect.vast.vn)`).
     - Throttle mặc định (`>= 400ms`/request) + exponential backoff khi gặp HTTP 429/5xx.
     - Chia nhỏ truy vấn theo lát `order` → `year` → `basisOfRecord` → `datasetKey` (mỗi lát `< 9,000` bản ghi) để không chạm ngưỡng `offset = 100,000`.
   - Lưu toàn bộ JSON gốc vào MongoDB collection `gbif_raw` (`_id = gbifID`) theo C-10 để tránh gọi lại API khi cần trích xuất thêm trường.
2. **Khi tải số lượng lớn (toàn quốc > 100.000 bản ghi) và đã có `GBIF_USERNAME` / `GBIF_PASSWORD`:**
   - Chuyển sang **GBIF Asynchronous Download API** (`/v1/occurrence/download/request`, định dạng `DWCA`) để nhận file `.zip` chuẩn Darwin Core Archive không bị giới hạn offset và có DOI trích dẫn chính thức.

## Hệ quả
- Không cần lưu credential GBIF trong repo; chạy an toàn trong môi trường dev/test.
- Giới hạn của Search API (tối đa 100.000 bản ghi/lát, không tự cấp DOI download) được kiểm soát hoàn toàn bằng cơ chế chia lát.


## Chính sách giấy phép bản ghi (Occurrence License)
- **Dữ liệu mới:** `CC0`, `CC BY`, `CC BY-SA`, `CC BY-NC`, `CC BY-NC-SA` → `is_public = true`, lưu và hiển thị `license` theo từng bản ghi.
- **Giấy phép trống / `UNKNOWN` / `All rights reserved` / `ND`:** → `is_public = false` chờ Admin duyệt.
- **Xuất DwC-A / GBIF:** Giữ nguyên `license` của từng bản ghi trong `occurrence.txt` (không gán cứng `CC BY` chung); bản ghi có giấy phép `NC` bị loại khỏi gói DwC-A xuất bản dưới giấy phép `CC BY`.

## Dữ liệu cá nhân & Quyền riêng tư (SRS §6.2 / Nghị định 13/2023/NĐ-CP)
- Các trường `identified_by`, `rights_holder`, `recorded_by` chứa tên/tài khoản người đóng góp (VD tài khoản iNaturalist) được giữ lại và hiển thị công khai nhằm tuân thủ nghĩa vụ ghi nguồn bắt buộc của giấy phép Creative Commons (CC BY / CC BY-SA / CC BY-NC).
- Hệ thống yêu cầu bổ sung cơ chế cho phép Admin ẩn/che tên người đóng góp theo yêu cầu chính đáng (theo Nghị định 13/2023/NĐ-CP) — đã ghi nhận thành `DEF-120` trong `docs/audit/02-defects.md`.
