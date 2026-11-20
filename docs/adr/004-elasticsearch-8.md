# ADR-004: Triển khai Elasticsearch 8.17 Single-Node + analysis-icu

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-20
- **Liên quan:** `DEF-005`, `DEF-059`, `DEF-095`, `docker-compose.yml`, `docker-compose.prod.yml`

## 1. Bối cảnh
SRS v2.0 (F-SR-01, §6.5) yêu cầu tìm kiếm toàn văn tiếng Việt (có dấu/không dấu, mã mẫu, địa danh, ghi chú) sử dụng Elasticsearch 8 với Vietnamese analyzer (`analysis-icu` / `icu_folding` + `asciifolding` + `edge_ngram`).

## 2. Quyết định
1. **Docker image tùy chỉnh (`infra/elasticsearch/Dockerfile`):** dựa trên `docker.elastic.co/elasticsearch/elasticsearch:8.17.0`, cài sẵn plugin `analysis-icu`.
2. **Cấu hình tài nguyên & mạng:**
   - Chạy chế độ `discovery.type=single-node`, heap cố định `ES_JAVA_OPTS=-Xms1g -Xmx1g`.
   - Port `9200` chỉ bind về **`127.0.0.1:9200:9200`** (không mở ra ngoài internet).
3. **Bảo mật `xpack.security`:**
   - **Dev (`docker-compose.yml`):** đặt `xpack.security.enabled=false` vì container chỉ bind `127.0.0.1` cục bộ, giúp developer & CI/CD chạy test mà không cần quản lý chứng chỉ TLS tự ký.
   - **Prod (`docker-compose.prod.yml`):** bật `xpack.security.enabled=true` với `ELASTIC_PASSWORD` từ biến môi trường và chỉ giao tiếp nội bộ trong Docker network.
4. **Nguồn chuẩn (Source of Truth):** PostgreSQL 15 là nguồn chuẩn. Lỗi ghi ES không làm fail giao dịch DB; sử dụng retry có exponential backoff và hàng đợi retry ưu tiên cho các thao tác nhạy cảm (`is_public`, `soft-delete`, `restore`). Khi truy vấn tìm kiếm mà ES gián đoạn, API trả `HTTP 503` rõ ràng (không im lặng chuyển sang SQL).
