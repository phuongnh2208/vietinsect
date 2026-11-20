# ADR-005: Ghi nhận cảnh báo `Cannot find ESLint plugin (ESLintWebpackPlugin)` của CRACO trên CRA 5

- **Trạng thái:** Accepted (Cảnh báo đã biết, không xử lý thêm)
- **Ngày:** 2026-11-20
- **Liên quan:** `DEF-104`, `frontend/craco.config.js`

## 1. Bối cảnh
Khi chạy `pnpm --filter frontend build` với `@craco/craco@7.1.0` trên `react-scripts@5.0.1` và `eslint: { enable: false }` trong `frontend/craco.config.js`, CRACO in 1 dòng cảnh báo `Cannot find ESLint plugin (ESLintWebpackPlugin)` do cách `pnpm` hoist dependency khác với `npm`.

## 2. Quyết định
- **Chấp nhận là cảnh báo đã biết**, không can thiệp patch nội bộ `node_modules` hay đổi bundler khỏi CRA 5.
- Kiểm tra tĩnh được chạy trực tiếp, độc lập và chính xác thông qua lệnh `pnpm lint` (`eslint src --max-warnings=999`), hiện đạt **0 errors**.
