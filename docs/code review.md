# 🔍 Code Review — Góc nhìn Senior Engineer
> VietInsect BigData · Đánh giá cấu trúc & mã nguồn thực tế · 02/11/2026

---

## Tổng quan: Nhận xét chung

**Verdict: Codebase này ở mức "Junior tốt → Mid-level"** — có kiến trúc đúng hướng, conventions nhất quán, nhưng còn nhiều quyết định thiết kế có vấn đề sẽ tích lũy thành technical debt nghiêm trọng khi scale lên.

> [!IMPORTANT]
> Điểm tích cực thực sự: Tác giả rõ ràng hiểu **tại sao** cần tách layer (repository → service → controller). Đây là nền tảng tốt hơn phần lớn codebase tương đương. Phần còn lại là những lỗi có thể học được.

---

## 🟢 Điểm MẠNH (Cần giữ nguyên)

### 1. Kiến trúc Layered — Đúng và nhất quán
```
controller.js → service.js → repository.js
```
- Controller **không bao giờ gọi thẳng repository** — đúng chuẩn.
- Service chứa toàn bộ business logic (validate parent, check duplicate, verify COL).
- Repository chỉ SQL thuần, không có if/else business.
- **Rất ít codebase ở quy mô này làm đúng điều này.**

### 2. Error handling có hệ thống
```js
// taxonomy.errors.js pattern
throw new AppError(TaxonomyError.TAXON_NOT_FOUND);
```
- Error codes tập trung (`TaxonomyError`, `AuthError`) — không hardcode string.
- `AppError` wrapper chuẩn hoá `statusCode + code + message`.
- Controller chỉ `next(err)` — đúng pattern Express error middleware.

### 3. Zustand store — Sạch và reactive đúng cách
```js
// auth.store.js — đã fix đúng
isAuthenticated: !!initialToken,
setAuth: (user, token) => set({ user, token, isAuthenticated: !!token }),
```
- Không còn getter function giả làm state (bug đã fix đúng).
- SSR-safe với `typeof localStorage !== "undefined"`.

### 4. useAuth hook — Tách biệt tốt
```js
// Hook trả về { login, logout, loading, error } — UI không biết gì về authService
async function login(username, password) { ... return { ok: true } | { ok: false, error } }
```
- Pattern `{ ok, error }` thay vì throw → UI xử lý gracefully.
- `navigate` nằm trong hook, không phải trong store — đúng.

### 5. taxonomy.service.js — Logic domain phức tạp được viết tốt
- `importChecklist` với multi-pass resolve parent dependency: đây là thuật toán non-trivial, viết đúng.
- `getTree` + `rollUp` cộng dồn specimenCount: in-memory tree build đúng.
- `getSpeciesProfile` dùng `Promise.all` thay vì sequential await: tốt.
- Comment giải thích quyết định kỹ thuật (khi nào cần chuyển sang CTE đệ quy): rất tốt.

### 6. SpeciesProfilePage — State machine pattern
```js
const [status, setStatus] = useState("loading"); // loading | success | error
```
- Dùng string enum thay vì 3 boolean riêng lẻ (`isLoading`, `isError`, `isSuccess`) → không thể ở trạng thái bất hợp lệ.
- `useCallback` + `useEffect` đúng dependency array → không vòng lặp vô hạn.

---

## 🔴 Vấn đề NGHIÊM TRỌNG (Cần sửa ngay trước khi scale)

### BUG #1: `findBySlug` — Full table scan mỗi request ⚠️ CRITICAL
```js
// taxonomy.service.js dòng 208-211
async function findBySlug(slug) {
  const taxa = await taxonomyRepository.findAll(); // ← Load TOÀN BỘ taxa vào memory
  return taxa.find((taxon) => slugify(taxon.scientific_name) === slug) || null;
}
```
**Vấn đề:** `getSpeciesProfile` được gọi mỗi khi user xem trang loài. Mỗi request load toàn bộ bảng `taxa` (có thể hàng nghìn → hàng vạn record) chỉ để tìm 1 slug. Ở quy mô production với nhiều người dùng đồng thời → **OOM + response time tăng tuyến tính theo số taxa.**

**Fix đúng:**
```js
// Option 1: Thêm cột slug vào DB + index
ALTER TABLE taxa ADD COLUMN slug VARCHAR(255) GENERATED ALWAYS AS (
  lower(regexp_replace(scientific_name, '[^a-zA-Z0-9]+', '-', 'g'))
) STORED;
CREATE INDEX idx_taxa_slug ON taxa(slug);

// Option 2: Tối thiểu — query thẳng với ILIKE hoặc computed expression
async function findBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT ${TAXON_COLUMNS} FROM taxa
     WHERE lower(regexp_replace(scientific_name, '[^a-zA-Z0-9]+', '-', 'g')) = $1`,
    [slug]
  );
  return rows[0] || null;
}
```

---

### BUG #2: `http.js` — 401 handler bypass Zustand, gây state desync ⚠️ HIGH
```js
// http.js dòng 19-22
if (error.response?.status === 401) {
  localStorage.removeItem("vietinsect_token");
  window.location.href = "/login"; // ← Bypass React Router + Zustand hoàn toàn
}
```
**Vấn đề:**
1. `useAuthStore` vẫn còn `user`, `token`, `isAuthenticated = true` trong memory — state lệch localStorage.
2. `window.location.href` = hard reload, mất toàn bộ React state, không gọi cleanup.
3. Không có thông báo cho user tại sao bị redirect.

**Fix đúng:**
```js
// Inject store reference vào interceptor (tránh circular import)
let _logoutFn = null;
export function setLogoutHandler(fn) { _logoutFn = fn; }

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && _logoutFn) {
      _logoutFn(); // gọi store.logout() → clear state + navigate('/login')
    }
    return Promise.reject(error);
  }
);

// Trong App.js hoặc root component:
setLogoutHandler(useAuthStore.getState().logout);
```

---

### BUG #3: `taxonomy.repository.js update()` — COALESCE anti-pattern ⚠️ HIGH
```js
// repository dòng 91-106: COALESCE($2, parent_id)
```
**Vấn đề:** Không thể set field về `NULL` — nếu user muốn xoá `parent_id` (di chuyển taxon lên root), truyền `null` sẽ giữ nguyên giá trị cũ thay vì clear. Tương tự `iucn_status`, `taxon_notes`.

**Fix đúng:** Dùng partial update với dynamic SQL, hoặc sentinel value, hoặc tách endpoint clear field riêng.

```js
// Cách chuẩn: build dynamic SET clause
async function update(taxonId, data) {
  const fields = [];
  const values = [taxonId];
  let idx = 2;
  const allowed = ['parent_id', 'taxon_rank', 'scientific_name', ...];
  // Build SET dynamically, cho phép explicit null
}
```

---

### BUG #4: `SpeciesProfilePage` — Không cancel fetch khi unmount ⚠️ MEDIUM
```js
const load = useCallback(async () => {
  setStatus("loading");
  try {
    const data = await taxonomyService.getSpeciesProfile(slug);
    setProfile(data); // ← Có thể gọi sau khi component đã unmount
    setStatus("success");
  }
}, [slug]);
```
**Vấn đề:** Nếu user navigate nhanh (click loài A → click loài B trước khi A load xong), response của A về sau B sẽ overwrite state → UI hiển thị sai loài. Cũng gây warning "Can't setState on unmounted component".

**Fix:**
```js
useEffect(() => {
  let cancelled = false;
  async function load() {
    setStatus("loading");
    try {
      const data = await taxonomyService.getSpeciesProfile(slug);
      if (!cancelled) { setProfile(data); setStatus("success"); }
    } catch (err) {
      if (!cancelled) { setError(...); setStatus("error"); }
    }
  }
  load();
  return () => { cancelled = true; }; // cleanup
}, [slug]);
```

---

### BUG #5: `AdminChrome.js` — Language state không sync với i18n ⚠️ MEDIUM
```js
// Topbar dòng 77-78
<button className={i18n.language === "vi" ? "active" : ""} onClick={() => changeLanguage("vi")}>VI</button>
```
**Vấn đề:** `i18n.language` là reference trực tiếp — component sẽ không re-render khi ngôn ngữ thay đổi vì React không track mutation của object ngoài state. Button "active" sẽ không cập nhật đúng.

**Fix:**
```js
const { i18n } = useTranslation(); // hook này subscribe đúng vào i18n state changes
```
(Cần dùng `i18n` từ `useTranslation()` thay vì import trực tiếp từ `../../i18n`.)

---

## 🟡 Vấn đề THIẾT KẾ (Technical debt tích lũy)

### D1: `AdminChrome.js` — Module-level side effect ⚠️
```js
// Dòng 10-25: Chạy khi module load, không phải khi component mount
const navItems = navScreenIds.map((screenId) => {
  const screen = screenById[screenId]; // Có thể undefined nếu registry chưa load
  return { ...screen.adminPath || screen.path }; // Crash nếu screen = undefined
});
```
Nếu `screenById` chưa populated khi module load (lazy loading, code splitting) → `screen.adminPath` throw. Nên move vào `useMemo` bên trong component.

### D2: `LoginPage` — Inline style lẫn với className
```jsx
// Dòng 39-41
<div className="hero-editorial-footer" style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "14px" }}>
  <span className="hero-kicker" style={{ color: "#DCE8D2" }}>...</span>
```
- Magic color `#DCE8D2` không nằm trong CSS variables / design tokens → design drift khi thay màu.
- `marginTop: "auto"` lẽ ra là CSS class utility.
- **Quy tắc đã có trong `docs/design.md`** nhưng không tuân thủ.

### D3: `SpeciesProfilePage` — Hard-coded error string tiếng Việt
```js
setError(err.response?.status === 404 ? "Không tìm thấy hồ sơ loài này." : err.response?.data?.message || err.message);
```
- String tiếng Việt inline vi phạm i18n pattern đã thiết lập trong TASK-00.2.
- Nên dùng `t('taxonomy.errorNotFound')`.

### D4: `SpeciesProfileTabs` — Tab content dùng `null` thay vì `display:none`
```jsx
{active === "morphology" ? <div>...</div> : null}
{active === "specimens" ? <div>...</div> : null}
```
- Mỗi tab switch = unmount/remount component con → mất scroll position, input state, focus.
- Với tab "activity" có thể có data fetching riêng → re-fetch mỗi lần switch tab.
- Nên dùng `hidden` attribute hoặc CSS `display: none` để preserve DOM.

### D5: `auth.service.js` — Không có refresh token
```js
const token = jwt.sign(
  { adminId, username, role: "admin" },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES_IN }, // Sau khi hết hạn → 401 → force logout
);
```
- Không có refresh token flow → session hết hạn giữa chừng = UX xấu (đang edit form bị kick ra ngoài).
- Cần: `accessToken` (ngắn, 15 phút) + `refreshToken` (dài, 7 ngày, HTTP-only cookie).

### D6: `taxonomy.repository.js` — Dùng `pg` Pool trực tiếp, không phải Knex
```js
const { rows } = await pool.query(`SELECT ${TAXON_COLUMNS} FROM taxa WHERE taxon_id = $1`, [taxonId]);
```
Dự án đã có Knex (dùng cho migration) nhưng repository dùng `pg` raw. Điều này có nghĩa:
- Không có query builder → SQL string dài dễ lỗi typo.
- Không tận dụng Knex transaction API (sẽ cần khi làm bulk import Specimen).
- Phải maintain 2 cách kết nối DB.

### D7: `importChecklist` — Serial insert (N queries)
```js
for (const row of pendingRows) {
  const created = await taxonomyRepository.create({ ... }, adminId); // Mỗi row = 1 query
}
```
Với 1000 taxa → 1000 round-trips DB. Cần batch insert (`INSERT INTO ... VALUES (...),(...),(...)`) hoặc `COPY FROM`.

---

## 🟠 Vấn đề BẢO MẬT

### S1: JWT payload chứa `role: "admin"` hardcode
```js
jwt.sign({ adminId, username, role: "admin" }, ...)
```
Nếu sau này có nhiều role (editor, viewer), cần lấy role từ DB, không hardcode. Hiện tại tạm ổn vì chỉ có 1 role, nhưng cần note.

### S2: `http.js` đọc token từ localStorage mỗi request
```js
const token = localStorage.getItem("vietinsect_token");
```
localStorage dễ bị XSS đọc. Production nên dùng HTTP-only cookie cho token. Với scope nội bộ Viện CNTT thì acceptable nhưng cần document rõ threat model.

### S3: `auth.service.js` — Timing attack trên username check
```js
const user = await authRepository.findByUsername(username);
if (!user) throw new AppError(AuthError.INVALID_CREDENTIALS); // Trả lời ngay
const isMatch = await bcrypt.compare(password, user.password_hash); // Slow khi user exists
```
Attacker có thể timing-attack để biết username có tồn tại hay không (response nhanh = không có user, chậm = có user). Fix: luôn chạy `bcrypt.compare` kể cả khi user không tồn tại.

```js
const DUMMY_HASH = "$2b$12$..."; // precomputed bcrypt hash
const hash = user ? user.password_hash : DUMMY_HASH;
const isMatch = await bcrypt.compare(password, hash);
if (!user || !isMatch) throw new AppError(AuthError.INVALID_CREDENTIALS);
```

---

## 🏗️ Đánh giá Cấu trúc dự án

### Điều đúng ✅
| Quyết định | Lý do đúng |
|:---|:---|
| Monorepo pnpm workspace | Chia sẻ `packages/shared` giữa FE/BE |
| Tách `modules/` theo domain | Cohesion cao, dễ tìm file |
| `screenRegistry.js` là source of truth cho 30 routes | Không duplicate path string |
| DTO mapping trong service (không expose raw DB row) | Tách DB schema khỏi API contract |
| Darwin Core mapping chuẩn bị sẵn | Interop với GBIF/iNaturalist sau này |

### Điều đáng lo ⚠️
| Quyết định | Rủi ro |
|:---|:---|
| CRA (react-scripts 5) với React 19 | CRA đã end-of-life, Webpack 4 (CRA) không support React 19 Compiler, bundle size lớn hơn Vite 2-3x |
| Raw `pg` pool thay vì Knex query builder | Sẽ gặp khó khi làm transaction phức tạp cho Specimen bulk import |
| `findAll()` không có pagination | Khi taxa lên hàng vạn → OOM khi build tree |
| Không có request cancellation | Race conditions khi navigate nhanh |
| Không có React Query / SWR | Cache invalidation manual, loading states boilerplate mỗi component |

---

## 📊 Scorecard

| Tiêu chí | Điểm | Nhận xét |
|:---|:---:|:---|
| **Kiến trúc tổng thể** | 8/10 | Layered đúng, naming conventions nhất quán |
| **Code quality FE** | 6/10 | Tốt nhưng còn inline style, missing cleanup, i18n không nhất quán |
| **Code quality BE** | 7/10 | Service logic tốt, nhưng có 2-3 bug nghiêm trọng cần fix ngay |
| **Security** | 5/10 | JWT cơ bản đủ dùng, timing attack, localStorage token là rủi ro biết trước |
| **Performance** | 4/10 | `findBySlug` full scan, serial insert, không có pagination cho `findAll` |
| **Testability** | 5/10 | Layer tách rõ dễ mock, nhưng không có test nào |
| **Maintainability** | 7/10 | Comments đầy đủ, naming rõ ràng, errors có hệ thống |
| **Scalability** | 4/10 | In-memory tree build, full table scan — sẽ hỏng khi data lớn |

**Tổng: 46/80 — Đủ cho MVP, cần refactor trước production load thật.**

---

## 🎯 Khuyến nghị theo thứ tự ưu tiên

### Ngay lập tức (trước khi viết thêm module mới)
1. **Fix `findBySlug`** — Thêm cột `slug` vào DB + index. Đây là performance bug sẽ gây sự cố production.
2. **Fix `http.js` 401 handler** — Gọi `store.logout()` thay vì `window.location.href`.
3. **Fix timing attack** trong `auth.service.js` — 1 dòng code, rủi ro thật.
4. **Fix stale closure** trong `SpeciesProfilePage` fetch (add AbortController cleanup).

### Ngắn hạn (trước khi làm Specimen module)
5. **Unify DB access** — Chuyển repository sang Knex query builder (cần cho transaction Specimen bulk import).
6. **Thêm pagination** cho `taxonomyRepository.findAll()` — bắt buộc trước khi data lên hàng nghìn.
7. **React Query** hoặc SWR cho data fetching FE — giảm boilerplate loading/error state đáng kể.

### Trung hạn
8. **Migrate từ CRA sang Vite** — Cải thiện build time 5-10x, bundle size nhỏ hơn, actively maintained.
9. **Refresh token flow** — Trước khi release production cho user thật.
10. **Batch insert** cho `importChecklist` — Cần trước khi có dataset lớn.
