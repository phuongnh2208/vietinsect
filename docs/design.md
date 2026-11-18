# VietInsect — Unified Design System & Implementation Guide (v2.1)

Tài liệu chuẩn hóa toàn bộ thiết kế giao diện của hệ thống **VietInsect BigData**, kết hợp giữa phong cách **Editorial Scientific Portal (GBIF-inspired)** với **Hệ thống phân tầng 2 lớp (Dual-Tier Architecture)** giúp cân bằng giữa điểm nhấn thương hiệu độc đáo và trải nghiệm nhập liệu/nghiên cứu thực tế.

---

## 1. Triết lý Thiết kế 2 Tầng (Dual-Tier Architecture)

Để vừa tạo ấn tượng thị giác mạnh mẽ (WOW factor), vừa đảm bảo sự thoải mái, dễ đọc khi các nhà nghiên cứu thao tác dữ liệu nhiều giờ liền, giao diện được phân bổ theo 2 tầng:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG SIGNATURE (Editorial / GBIF Technical Frame)                      │
│ - Áp dụng: Trang chủ (SCR-01/04), Banner lớn của các trang trung tâm   │
│ - Đặc trưng: Khung TechnicalFrame (đường gióng crop-mark, ô vuông góc) │
│   Logo nét phác thảo sinh thái, tiêu đề tuyên ngôn in hoa dứt khoát    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Kế thừa màu sắc, typography, badge
┌───────────────────────────────────▼────────────────────────────────────┐
│ TẦNG MODERN FUNCTIONAL (Gọn gàng, Trực quan, Tối ưu thao tác)          │
│ - Áp dụng: Tra cứu (SCR-15), Phân loại (SCR-12), GIS (SCR-18),         │
│   Hồ sơ loài (SCR-13), DNA (SCR-20), AI (SCR-23) & Toàn bộ Admin       │
│ - Đặc trưng: Viền mảng đen sắc nét (2px #111) hoặc xanh lá đậm         │
│   (#1F4E2D), bo góc nhẹ 6–8px, DataTables & Faceted filters rõ ràng    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Bảng Màu Chuẩn (Design Tokens)

| Token CSS | Mã màu Hex | Vai trò & Vị trí sử dụng |
| :--- | :--- | :--- |
| `--vi-primary` | `#2E7D32` | Nút CTA chính, active navigation, điểm nhấn sinh thái |
| `--vi-forest-dark` | `#1F4E2D` / `#0F3820` | Viền thẻ ảnh khi hover, sidebar admin, footer, dark hero banner |
| `--vi-secondary` | `#0F3820` | Nền tối chuyên biệt: Sidebar, Visual panel, Chân trang |
| `--vi-bg` | `#FFFFFF` | Nền canvas trang giấy khoa học trắng tinh khiết |
| `--vi-surface` | `#FFFFFF` | Nền các khối thẻ nội dung, panel, bảng biểu |
| `--vi-surface-2` | `#F2F7F2` | Nền khung placeholder ảnh chờ, nền lọc dữ liệu |
| `--vi-ink` | `#111111` | Màu văn bản chính, tiêu đề tuyên ngôn |
| `--vi-muted` | `#555555` | Văn bản phụ, chú thích tọa độ, nhãn mô tả |
| `--vi-accent-red` | `#B0241A` | Cảnh báo, trạng thái nguy cấp (IUCN Endangered), lỗi |
| `--vi-accent-gold` | `#9C7A1F` | Trạng thái "chưa định danh", loài cần theo dõi, chú thích |

> **Chuẩn tương phản WCAG 2.1 AA**: Tất cả văn bản trên nền tối `--vi-secondary` (`#0F3820`) sử dụng màu trắng `#FFFFFF` hoặc `#DCE8D2` để đảm bảo độ tương phản tối đa.

---

## 3. Quy chuẩn Khung & Góc Viền (Sharp Drafting Architecture)

### A. Khung Tiêu bản Kỹ thuật (`TechnicalFrame` — Tầng Signature)
- **Áp dụng duy nhất** cho:
  1. Banner chính của Trang chủ (`PublicHomePage`).
  2. Banner tiêu đề trang lớn (Hồ sơ loài SCR-13, Bản đồ GIS SCR-18).
- **Cấu trúc**:
  - Viền đen mảnh `1px solid #111111`.
  - 4 đường kẻ gióng vượt qua 4 góc (độ vươn `cropExtension = 22px ~ 26px`, độ dày 1px).
  - 2 ô vuông đen định vị góc (`corner-square: 10x10px`) ở góc **trên-phải** và **dưới-trái**.
  - Thanh tìm kiếm: **Góc vuông sắc sảo (`border-radius: 0px`)**, viền đen 1px, đặt **lệch sang bên phải** của banner.

### B. Khung Viền Thẻ, Nút Bấm & Phân hệ (Góc vuông 0px — Tầng Modern)
- **Áp dụng** cho tất cả thẻ mẫu vật, nút bấm, ô input, bảng biểu, modal, dialog, badge:
  - **Góc vuông 0px (`border-radius: 0px`)**: Không bo cong, đồng bộ góc cạnh sắc sảo kỹ thuật với khung banner chính.
  - Viền mảng đen mảnh `border: 1px solid #111111` (hoặc xanh lá đậm `#1F4E2D`).
  - Hiệu ứng hover: Nút bấm chuyển nền xanh `#2E7D32` hoặc đen `#111111`, thẻ ảnh nhấc nhẹ `transform: translateY(-2px)` và viền chuyển sang `#1F4E2D`.



---

## 4. Typography & Quy ước Định dạng Dữ liệu Sinh học

- **Tiêu đề Tuyên ngôn (Hero Title)**:
  - Font `Manrope` / `Inter`, weight `800`, in hoa toàn bộ:
  - `FREE AND OPEN ACCESS TO BIODIVERSITY DATA`
- **Tiêu đề Trang & Phân hệ**:
  - `Manrope`, weight `800`, cỡ `clamp(24px, 2.5vw, 34px)`, `letter-spacing: -0.03em`.
- **Tên khoa học loài (Scientific Name)**:
  - Luôn in nghiêng (*Italic*), viết hoa chữ cái đầu chi (*Genus*), chữ thường ở tên loài (*species*).
  - Ví dụ: *Vestalis gracilis*, *Papilio demoleus*.
- **Tên tiếng Việt / Tên thông thường**:
  - Viết đứng, font `Inter`, cỡ chữ nhỏ hơn, màu `--vi-muted` (ví dụ: Chuồn chuồn cánh biếc).
- **Mã số mẫu vật & Trình tự Gen**:
  - Dùng font Monospace hoặc Sans-serif số bảng (`font-variant-numeric: tabular-nums`).
  - Ví dụ: Mã số `VI-SPEC-2026-0012`, GenBank `MW481920.1`, Tọa độ `21.0285° N, 105.8542° E`.

---

## 5. Kế hoạch Chuyển đổi Toàn bộ các Màn hình (SCR-01 → SCR-30)

| Mã màn hình | Tên màn hình | Tầng áp dụng | Quy cách thiết kế cụ thể |
| :--- | :--- | :--- | :--- |
| **SCR-01 / SCR-04** | Trang chủ Public & Admin Dashboard | **Signature + Modern** | Banner `TechnicalFrame` crop-mark, thanh tìm kiếm lệch phải bo góc 8px, lưới thống kê ô kỹ thuật 4 cột, các thẻ tính năng `.card-solid-frame`. |
| **SCR-15 / SCR-16** | Tra cứu Mẫu vật & Tìm kiếm Nâng cao | **Modern** | Header tối giản, bộ lọc Faceted filters viền đen 2px, thẻ mẫu vật có badge mã số góc trên, lưới ảnh hiển thị vi thể. |
| **SCR-12** | Cây Phân loại Sinh học (Taxonomy Tree) | **Modern** | Sơ đồ phân nhánh Order → Family → Genus → Species với đường kẻ mảnh đen `1.5px #111`, thẻ taxon đóng khung tối giản. |
| **SCR-13** | Hồ sơ Loài (Species Profile) | **Signature + Modern** | Banner ảnh loài khung viền lớn, tiêu đề tên khoa học *in nghiêng*, tab phân tích hình thái/sinh thái/gen với gạch chân đen mảnh. |
| **SCR-18 / SCR-19** | Bản đồ GIS Phân bố & Lớp bản đồ | **Modern** | Khung bản đồ bọc trong `.map-solid-frame` viền đen 2px, hộp điều khiển lớp (Layer Control) và chú giải màu trắng viền đen sắc nét. |
| **SCR-20 / SCR-21 / SCR-22** | Dữ liệu DNA, FASTA & GenBank | **Modern** | Trình hiển thị chuỗi nucleotide dạng monospace trên nền xám nhạt `#F8FAFC`, hộp tải mã gen FASTA viền đen. |
| **SCR-23 / SCR-24** | Nhận diện Loài AI & Dự đoán SDM | **Modern** | Khung upload ảnh thực địa có vùng dropzone viền đứt nét đen, bảng dự đoán xác suất và họ/bộ chuẩn xác. |
| **SCR-05 → SCR-11** | Quản lý Mẫu vật (Thêm/Sửa/Import/Labels) | **Modern** | Form nhập liệu khoa học theo chuẩn Darwin Core (DwC), bảng DataTables viền đen tối giản, nút thao tác dứt khoát. |
| **SCR-25 → SCR-30** | Báo cáo, Phân tích, Chia sẻ & Hệ thống | **Modern** | Biểu đồ Recharts phối màu theo bảng màu chuẩn, xuất dữ liệu GBIF/Darwin Core Archive (DwC-A). |

---

## 6. Đoạn Mã Mẫu Tái Sử Dụng (Reusable Code Snippets)

### 1. Banner Hero Kỹ thuật (Trang chủ & Trang lớn):
```jsx
import TechnicalFrame from "../../../components/ui/TechnicalFrame";

<TechnicalFrame
  markers="diagonal"       // 2 ô vuông góc (trên-phải, dưới-trái)
  cropExtension={26}       // Đường gióng vượt góc 26px
  aspectRatio="21/9"
  className="hero-technical-frame"
>
  <div className="hero-image-slot">
    <img src={process.env.PUBLIC_URL + "/Hero1.png"} alt="Hero Plate" className="hero-media" />
  </div>

  <div className="hero-search-overlay">
    <form className="hero-pill-search-form" onSubmit={handleSearch}>
      <button type="submit" className="pill-search-icon-btn">🔍</button>
      <input type="text" className="pill-search-input" placeholder="Tìm kiếm..." />
    </form>
  </div>
</TechnicalFrame>
```

### 2. Thẻ Khung Hình Phân hệ & Mẫu vật (Các màn hình chức năng):
```jsx
<article className="editorial-feature-card">
  <div className="card-solid-frame">
    <div className="card-image-slot">
      <img src={item.imageSrc} alt={item.title} className="card-img" />
      <span className="card-floating-badge">{item.badge}</span>
    </div>
  </div>
  <div className="card-body">
    <h3 className="card-title">{item.title}</h3>
    <p className="card-desc">{item.desc}</p>
    <Link to={item.link} className="card-action-link">Khám phá →</Link>
  </div>
</article>
```

---
*Phiên bản 2.1 — Đồng bộ cùng dự án VietInsect.*
