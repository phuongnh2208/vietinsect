# ADR-006: PostgreSQL Transactional Outbox cho đồng bộ Elasticsearch (DEF-112)

- **Ngày:** 2026-11-21
- **Trạng thái:** Đã chấp nhận (Accepted)
- **Liên quan:** `DEF-112`, `DEF-059`, `backend/database/migrations/20261121000001_021_create_es_sync_outbox.js`, `backend/src/modules/search/esOutbox.service.js`

## 1. Bối cảnh
Ở Sprint B (`DEF-059`), hàng đợi retry ưu tiên (`priorityRetryQueue`) và cờ `needsReindex` nằm trong bộ nhớ tiến trình Node.js. Nếu Elasticsearch tạm ngừng và tiến trình backend khởi động lại trước khi retry thành công, các sự kiện đồng bộ bị mất — đặc biệt nguy hiểm nếu thao tác `is_public = false` hoặc `soft_delete` chưa kịp tới ES, dẫn đến rò rỉ mẫu Private trong kết quả tìm kiếm Public.

## 2. Quyết định
Sử dụng mô hình **PostgreSQL Transactional Outbox** với bảng `es_sync_outbox` thay vì Redis Stream hoặc Debezium CDC:
- Mọi thao tác ghi mẫu vật (`create`, `update`, `soft_delete`, `restore`, `toggle_public`, `batch_update`, `bulk_import`) ghi bản ghi vào `es_sync_outbox` **trong cùng transaction PostgreSQL** với thay đổi bảng `specimens`.
- Thao tác nhạy cảm (`toggle_public`, `soft_delete`, `restore`) có `priority = 10` (thường = `0`), vẫn thử cập nhật ES tức thì sau commit; nếu thành công thì đánh dấu `done`, nếu lỗi thì bản ghi `pending` vẫn bền vững trong PostgreSQL.
- Background worker (`esOutbox.service.js`) định kỳ lấy lô bằng `SELECT ... FOR UPDATE SKIP LOCKED` (chống xử lý trùng khi chạy nhiều worker song song), gộp (`coalesce`) nhiều sự kiện cùng `entity_id`, index idempotent theo `_id`, và áp dụng exponential backoff (`baseDelayMs * 2^(attempts-1)`). Vượt quá `maxAttempts` (mặc định 5) → chuyển `status = 'dead'` và ghi `logger.error`.

## 3. So sánh PostgreSQL Outbox vs Redis Stream
| Tiêu chí | PostgreSQL Outbox (Chọn) | Redis Stream |
|---|---|---|
| Tính nguyên tử với DB | **100% ACID** (cùng transaction `knex.transaction`) | Dual-write (có thể mất sự kiện nếu crash giữa PG commit và Redis XADD) |
| Hạ tầng bổ sung | Không cần thêm thành phần mới | Cần cấu hình Redis AOF/persistence + consumer group |
| Truy vấn & vận hành | SQL chuẩn (`pending`/`dead`/tuổi bản ghi cũ nhất) | Cần công cụ CLI riêng (`XPENDING`, `XCLAIM`) |
| Độ trễ | Thấp (priority sync tức thì + poll 5s) | Rất thấp (~ms) |

## 4. Hệ quả
- **Tích cực:** Không bao giờ mất sự kiện đồng bộ khi backend restart hoặc ES downtime; không cần thêm hạ tầng; dễ giám sát qua `/api/health` (`services.esOutbox`).
- **Đánh đổi:** Tăng nhẹ số lệnh `INSERT` trong transaction ghi mẫu vật; cần dọn định kỳ các bản ghi `status = 'done'` cũ nếu lưu lượng rất lớn.

## 5. Runbook vận hành
1. **Kiểm tra tình trạng outbox:**
   - Công khai (health): `GET /api/health` → trường `services.esOutbox` (`pending`, `processing`, `dead`, `oldestPendingAgeSeconds`).
   - Admin chi tiết: `GET /api/search/outbox/status` (yêu cầu Bearer Admin).
2. **Xử lý bản ghi `dead` sau khi khắc phục sự cố ES:**
   - Gọi `POST /api/search/outbox/retry-dead` (Admin) để đưa tối đa 100 bản ghi `dead` về `pending` (`attempts = 0`).
3. **Biện pháp cuối cùng (khi lệch dữ liệu diện rộng):**
   - Chạy `make reindex` để đồng bộ lại toàn bộ index `specimens` từ PostgreSQL.
