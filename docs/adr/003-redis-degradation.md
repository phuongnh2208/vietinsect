# ADR-003: Hành vi suy giảm khi Redis không khả dụng (Token Blacklist vs Rate Limiter)

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-20
- **Liên quan:** `DEF-009`, `backend/src/modules/auth/tokenBlacklist.js`, `backend/src/middleware/rateLimiter.js`

## 1. Bối cảnh
Hệ thống sử dụng Redis 7 cho hai chức năng bảo mật khác nhau:
1. **JWT Token Blacklist (`tokenBlacklist.js`):** kiểm tra token đã bị thu hồi (`logout` / `logout-all` / đổi mật khẩu) trên các endpoint quản trị (`requireAdmin` / `optionalAdmin`).
2. **Rate Limiter (`rateLimiter.js`):** giới hạn 1.000 req/phút/IP toàn cục và 10 req/phút/IP cho `/login`.

## 2. Quyết định
- **Khu vực Admin (`tokenBlacklist.js`) — Fail-Closed (`HTTP 503`):** Trong môi trường `production` (hoặc khi bật `REDIS_FAIL_CLOSED=true`), nếu Redis gián đoạn thì `isTokenBlacklisted` / `isUserTokenRevoked` từ chối yêu cầu với mã `503 AUTH.REDIS_UNAVAILABLE`, đảm bảo token đã thu hồi tuyệt đối không bị lọt qua. Ở môi trường dev/test cục bộ, cho phép fallback bộ nhớ tiến trình để tiện phát triển.
- **Rate Limiter (`rateLimiter.js`) — Fail-Open có cảnh báo:** Khi Redis gián đoạn, `ResilientRedisStore` ghi `logger.warn` và fallback sang bộ đếm in-memory theo từng tiến trình để không làm sập cổng tra cứu công khai.
