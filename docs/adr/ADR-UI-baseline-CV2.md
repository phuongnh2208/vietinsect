# ADR — Baseline UI và quyết định trước CV2.1

**Trạng thái:** Đã chốt cho bước tách component nghiệp vụ  
**Phạm vi:** SCR-01, SCR-03, SCR-04, route registry, layout dùng chung và frontend stack

## Quyết định

Public Home tại `/` **không hiển thị nút Login/Admin**. Quản trị viên truy cập trực tiếp `/admin/dashboard`; route này vẫn được bảo vệ bởi `AuthGuard` và chuyển hướng người chưa xác thực về `/login`.

SCR-04 sử dụng `HomeMapHero` làm component riêng. Component phải giữ các thành phần đã duyệt: silhouette Việt Nam, các cluster điểm/mật độ theo tỉnh/thành, thanh tìm kiếm dạng glassmorphism, legend, chuyển đổi `Điểm/Mật độ`, nút zoom và tooltip điểm được chọn. Prototype hiện tại dùng dữ liệu minh họa cục bộ; khi sang component nghiệp vụ sẽ thay bằng API/GeoJSON thật.

Số liệu hiển thị trên Public Home dùng **34 tỉnh/thành** theo baseline dữ liệu hiện tại của dự án, không dùng 63 tỉnh/thành.

Luồng lỗi đăng nhập trả về kết quả trực tiếp từ `useAuth.login()`. `LoginPage` kiểm tra `outcome.ok` và hiển thị toast ngay trong cùng lần submit, không đọc state `error` cũ từ closure React.

Sidebar Admin giữ menu rút gọn gồm 7 mục để bảo đảm UX. Tuy nhiên, mọi mục trong menu được resolve từ `screenRegistry` thông qua danh sách mã SCR được chọn; 16 màn hình admin còn lại vẫn tồn tại trong registry và route trực tiếp.

## Xác nhận frontend stack

Không có bằng chứng cho thấy React 19 hoặc React Router 7 được thêm ngẫu nhiên trong thay đổi hiện tại. Cả hai phiên bản đã có trong hai commit trước đó của repository (`928cd39` và `1c291ac`):

| Package | Phiên bản hiện tại | Kết luận |
| --- | --- | --- |
| React | `^19.2.7` | Stack hiện hữu trước đợt đồng bộ UI; chưa tự ý hạ xuống React 18. |
| React DOM | `^19.2.7` | Đồng bộ với React hiện tại. |
| React Router DOM | `^7.18.1` | Stack hiện hữu trước đợt đồng bộ UI; router hiện tại đã build thành công. |
| React Scripts | `5.0.1` | CRA/CRACO hiện hữu; build production đã chạy thành công. |

Do yêu cầu dự án gốc có ghi nhận React 18 + CRA nhưng repository hiện tại đã khóa React 19 + React Router 7 từ trước, quyết định ở bước này là **không thay đổi dependency** để tránh tạo thêm phạm vi migration. Việc hạ về React 18 hoặc chuyển bundler sẽ được coi là một ADR riêng, cần kiểm thử toàn bộ frontend và được phê duyệt trước.

## Tiêu chí hoàn thành trước CV2.1

Baseline UI phải có đủ route `SCR-01` đến `SCR-30`, PublicLayout không có CTA đăng nhập, SCR-04 có HomeMapHero, số liệu tỉnh/thành là 34, login error toast hoạt động ở lần submit sai đầu tiên, menu Admin được mô tả đúng là menu rút gọn từ registry, và production build phải hoàn tất không có lỗi compile.
