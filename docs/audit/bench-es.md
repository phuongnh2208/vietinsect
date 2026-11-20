# Benchmark Elasticsearch 8 (specimens_bench)

- **Ngày chạy:** 2026-11-20T13:16:32.175Z
- **Script:** `backend/scripts/bench-es.js`
- **Tổng số document reindex từ DB dev:** **100,134**
- **Thời gian reindex:** **20.55s** (batch 2.000 doc/lần)
- **Kích thước index (`specimens_bench`):** **5.05 MB**
- **Truy vấn Cold (lần đầu trước warm-up):** ES `took` = **78 ms**, End-to-End API = **131.82 ms**
- **Ngưỡng SRS (§5.1):** P95 < 1.000 ms → **ĐẠT**

## Kết quả 200 truy vấn đa dạng (sau 10 warm-up)

| Vai trò | Lớp đo | Số truy vấn | Min (ms) | P50 (ms) | P95 (ms) | P99 (ms) | Max (ms) |
|---|---|---:|---:|---:|---:|---:|---:|
| **User (Public)** | ES `took` | 200 | 1 | 5 | **13** | 23 | 74 |
| **User (Public)** | API End-to-End | 200 | 17.74 | 26.88 | **68.86** | 132.36 | 2429.01 |
| **Admin** | ES `took` | 200 | 1 | 3 | **6** | 10 | 17 |
| **Admin** | API End-to-End | 200 | 16.56 | 22.79 | **36** | 59.74 | 71.09 |

> Index tạm `specimens_bench` đã được xóa sạch sau khi kết thúc benchmark.
