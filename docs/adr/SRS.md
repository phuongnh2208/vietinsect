#  VIỆN HÀN LÂM KHOA HỌC VÀ CÔNG NGHỆ VIỆT NAM
VIỆN CÔNG NGHỆ THÔNG TIN
 
![](images/53e1ad2501bcf37db5ddf59ec47c6dde-image.png)
 
##  ĐẶC TẢ YÊU CẦU HỆ THỐNG
 
Software Requirements Specification (SRS)
 
#  PHẦN MỀM SỐ HÓA CÔN TRÙNG CÓ GIÁ TRỊ TÀI NGUYÊN
 
VietInsect BigData System
 
Phiên bản: 2.0 | Ngày 10 Tháng 6 năm 2025
 
 
 
#  MỤC LỤC
 
1 GIỚI THIỆU $\ldots$ 4
 
1.1 Mục đích tài liệu $\ldots$ 4
 
1.2 Phạm vi hệ thống $\ldots$ 4
 
1.3 Đinh nghĩa và từ viết tắt.................................................... 4
 
1.4 Tài liệu tham chiếu .................................................... 5
 
2. MÔ TẢ CHUNG $\ldots$ 6
2.1 Bối cảnh hệ thống $\ldots$ 6
 
2.2 Chức năng chính của sản phẩm .................................................... 6
 
2.3 Đặc điểm người dùng $\ldots$ 6
 
2.4 Các ràng buộc tổng quát $\ldots$ 7
 
2.5 Giả định và phụ thuộc $\ldots$ 7
 
3. YÊU CẦU VÈ GIAO TIẾP $\ldots$ 8
3.1 Giao diện người dùng $\ldots$ 8
 
3.1.1 Nguyên tắc thiết kế $\ldots$ 8
 
3.1.2 Danh sách màn hình giao diện .................................................................................... 8
 
3.2 Giao diện phần cứng $\ldots$ 11
 
3.3 Giao diện phần mềm $\ldots$ 11
 
3.4 Giao diện truyền thông $\ldots$ 12
 
4. YÊU CÀU CHỨC NĂNG $\ldots$ 13
4.1 Nhóm Xác thực & Bảo mật $\ldots$ 13
 
4.2 Nhóm Dashboard & Tổng quan $\ldots$ 13
 
4.3 Nhóm Quản lý Mẫu vật $\ldots$ 13
 
4.4 Nhóm Phân loại học & Hồ sơ loài .................................................................................... 15
 
4.5 Nhóm Tìm kiếm & Khai thác dữ liệu $\ldots$ 16
 
4.6 Nhóm GIS & Bản đồ $\ldots$ 16
 
4.7 Nhóm Dữ liệu DNA & GenBank $\ldots$ 17
 
4.8 Nhóm AI & Phân tích mô hình $\ldots$ 18
 
4.9 Nhóm Báo cáo & Xuất dữ liệu $\ldots$ 18
 
4.10 Nhóm Quản trị hệ thống $\ldots$ 19
 
5. YÊU CẦU PHI CHỨC NĂNG $\ldots$ 21
5.1 Yêu cầu hiệu năng $\ldots$ 21
 
5.2 Yêu cầu bảo mât $\ldots$ 21
 
5.3 Yêu cầu độ tin cậy & khả dụng $\ldots$ 22
 
5.4 Yêu cầu khả năng mở rộng .................................................... 22
 
5.5 Yêu cầu khả năng tương thích $\ldots$ 22
 
6. CÁC YÊU CÀU KHÁC $\ldots$ 23
6.1 Yêu cầu về tài liệu (Documentation) $\ldots$ 23
 
6.2 Yêu cầu pháp lý & Tuân thủ $\ldots$ 23
 
 
 
6.3 Yêu cầu Quốc tế hóa ............................................................................................................................................................................................................................................................................................................................................................................................................................................................................................
 
6.4 Yêu cầu Chuyển giao & Đào tạo .................................................... 23
 
6.5 Ràng buộc thiết kế $\ldots$ 24
 
 
 
#  1. GIỚI THIỆU
 
##  1.1 Mục đích tài liệu
 
Tài liệu này là Đặc tả Yêu cầu Hệ thống (Software Requirements Specification — SRS) cho phần mềm số hóa các loài côn trùng có giá trị tài nguyên dùng trên toàn lãnh thổ Việt Nam, tạm gọi là VietInsect BigData System. Tài liệu được xây dựng theo IEEE Std 830-1998 và định nghĩa đầy đủ các yêu cầu chức năng, phi chức năng và ràng buộc thiết kế nhằm:
 
● Làm cơ sở thống nhất giữa các bên liên quan (Viện CNTT, chuyên gia sinh học, đơn vị phát triển phần mềm).
 
● Định hướng thiết kế kiến trúc hệ thống và cơ sở dữ liệu.
 
● Làm căn cứ lập kế hoạch kiểm thử và nghiệm thu hệ thống.
 
● Phục vụ công tác bàn giao, đào tạo và bảo trì sau triển khai.
 
##  1.2 Phạm vi hệ thống
 
VietInsect BigData System là hệ thống quản lý dữ liệu tập trung, chuyên biệt đầu tiên cho côn trùng Việt Nam, được xây dựng tại Viện Công nghệ Thông tin (Viện CNTT), thuộc Viện Hàn lâm Khoa học và Công nghệ Việt Nam (VAST). Hệ thống thực hiện các chức năng cốt lõi sau:
 
● Số hóa, lưu trữ và quản lý thông tin mẫu vật côn trùng đa chiều: hình thái, sinh thái, DNA/GenBank, hoạt tính sinh/hóa học, không gian địa lý.
 
● Khai thác dữ liệu thông qua tìm kiếm toàn văn, lọc đa chiều, bản đồ phân bố và phân tích AI/Machine Learning.
 
● Chia sẻ dữ liệu theo chuẩn quốc tế Darwin Core (DwC), ABCD 2.06, tương thích với GBIF, iDigBio và BOLD.
 
● Phân quyền 2 cấp: Admin (đăng nhập, toàn quyền CRUD) và User công khai (không đăng nhập, chỉ xem dữ liệu được Admin cho phép).
 
Phạm vi không bao gồm: quản lý tài chính, quản lý nhân sự, thương mại điện tử và các hệ thống nghiệp vụ ngoài lĩnh vực đa dạng sinh học.
 
##  1.3 Định nghĩa và từ viết tất
 
 
 
| Ký hiệu | Giải nghĩa                                                                          |
| ------- | ----------------------------------------------------------------------------------- |
| SRS     | Software Requirements Specification — Đặc tả Yêu cầu Hệ thống                       |
| DwC     | Darwin Core — chuẩn trao đổi dữ liệu đa dạng sinh học của TDWG                      |
| GBIF    | Global Biodiversity Information Facility — cổng thông tin đa dạng sinh học toàn cầu |
| BOLD    | Barcode of Life Data System — cơ sở dữ liệu barcode DNA                             |
| GIS     | Geographic Information System — Hệ thống thông tin địa lý                           |
| SDM     | Species Distribution Model — Mô hình dự báo phân bố loài                            |
| API     | Application Programming Interface — Giao diện lập trình ứng dụng                    |
 
 
 
 
 
 
| AI/ML   | Artificial Intelligence / Machine Learning — Trí tuệ nhân tạo / Học máy              |
| ------- | ------------------------------------------------------------------------------------ |
| COI     | Cytochrome Oxidase I — gen barcode phân tử chuẩn cho động vật                        |
| WMS/WFS | Web Map Service / Web Feature Service — chuẩn OGC cho dữ liệu GIS                    |
| JWT     | JSON Web Token — cơ chế xác thực API không trạng thái                                |
| CRUD    | Create, Read, Update, Delete — các thao tác dữ liệu cơ bản                           |
| ERD     | Entity-Relationship Diagram — sơ đồ thực thể quan hệ                                 |
| CRA     | Create React App — bộ công cụ khởi tạo dự án React                                   |
| NCBI    | National Center for Biotechnology Information — trung tâm lưu trữ DNA quốc tế Hoa Kỳ |
| VAST    | Viện Hàn lâm Khoa học và Công nghệ Việt Nam                                          |
 
 
#  1.4 Tài liệu tham chiếu
 
● IEEE Std 830-1998: Recommended Practice for Software Requirements Specifications.
 
● Darwin Core Standard (TDWG), phiên bản 2023 — https://dwc.tdwg.org/
 
● ABCD 2.06 — Access to Biological Collection Data, TDWG.
 
● Specify 7 Documentation: https://specify.github.io/.
 
● GBIF Technical Documentation: https://techdocs.gbif.org/
 
● iDigBio Portal Documentation: https://idigbio.github.io/docs/
 
● BOLD Systems API Documentation: https://www.boldsystems.org/index.php/api_home
 
● NCBI E-utilities API: https://www.ncbi.nlm.nih.gov/books/NBK25497/
 
● Catalogue of Life API v1: https://api.catalogue.life/
 
● Nghị định 73/2017/ND-CP về thu thập, quản lý, khai thác và sử dụng thông tin, dữ liệu tài nguyên và môi trường.
 
● Nghị định 13/2023/ND-CP về bảo vệ dữ liệu cá nhân.
 
● Nagoya Protocol on Access and Benefit-sharing, CBD 2010.
 
 
 
#  2. MÔ TẢ CHUNG
 
##  2.1 Bối cảnh hệ thống
 
VietInsect BigData System là một hệ thống web độc lập (standalone web application), chạy hoàn toàn trên nền tảng web — không yêu cầu cài đặt phần mềm phía người dùng. Hệ thống được triển khai theo kiến trúc client-server nhiều tầng (multi-tier), bao gồm ba thành phần chính:
 
● Frontend: Single Page Application (SPA) xây dựng bằng React 19 + CRA 5 (craco), react-leaflet 5, giao tiếp với backend qua REST API.
 
● Backend: Node.js + Express, cung cấp REST API chuẩn OpenAPI 3.0, kết nối cơ sở dữ liệu PostgreSQL/PostGIS, MongoDB, Elasticsearch, MinIO và Redis.
 
● AI Service: Python 3.11 + FastAPI chạy như microservice độc lập, xử lý nhận dạng loài từ ảnh (CNN) và dự báo phân bố loài (MaxEnt/SDM).
 
Hệ thống tích hợp với các dịch vụ bên ngoài qua API chuẩn: NCBI GenBank (dữ liệu DNA), BOLD Systems (barcode phân tử), GBIF (trao đổi dữ liệu đa dạng sinh học), Catalogue of Life (xác thực tên khoa học) và Google Maps/OpenStreetMap (bản đồ nền). Toàn bộ dữ liệu lưu trữ trên máy chủ đặt tại Việt Nam, đảm bảo chủ quyền dữ liệu quốc gia.
 
##  2.2 Chức năng chính của sản phẩm
 
Hệ thống thực hiện 10 nhóm chức năng, tổng cộng 58 chức năng chi tiết được phân bổ như sau:
 
 
 
| STT | Nhóm chức năng             | Màn hình tương ứng     | Số CN |
| --- | -------------------------- | ---------------------- | ----- |
| 1   | Xác thực & Bảo mật         | SCR-01, SCR-02         | 3     |
| 2   | Dashboard & Tổng quan      | SCR-03, SCR-04         | 4     |
| 3   | Quản lý Mẫu vật            | SCR-05 đến SCR-11      | 12    |
| 4   | Phân loại học & Hồ sơ loài | SCR-12, SCR-13, SCR-14 | 7     |
| 5   | Tìm kiếm & Khai thác       | SCR-15, SCR-16, SCR-17 | 7     |
| 6   | GIS & Bản đồ               | SCR-18, SCR-19         | 6     |
| 7   | Dữ liệu DNA & GenBank      | SCR-20, SCR-21, SCR-22 | 5     |
| 8   | AI & Phân tích mô hình     | SCR-23, SCR-24, SCR-25 | 4     |
| 9   | Báo cáo & Xuất dữ liệu     | SCR-26, SCR-27, SCR-28 | 6     |
| 10  | Quản trị hệ thống          | SCR-29, SCR-30         | 4     |
 
 
###  2.3 Đặc điểm người dùng
 
Hệ thống phục vụ 2 nhóm người dùng với quyền hạn và luồng truy cập hoàn toàn tách biệt:
 
 
 
| Vai trò | Mô tả | Quyền truy cập chi tiết | Ví dụ người dùng |
| ------- | ----- | ----------------------- | ---------------- |
 
 
 
 
 
 
| Admin | Quản trị viên hệ thống — phải đăng nhập bằng tài khoản và mật khẩu. | Toàn quyền CRUD dữ liệu mẫu vật, phân loại học, DNA, GIS. Kiểm soát toggle Public/Private từng bản ghi. Xem audit log. Cấu hình hệ thống. Xuất toàn bộ dữ liệu. Chạy mô hình AI/SDM. | Cán bộ quản lý dữ liệu, chuyên gia phân loại học, cán bộ IT Viện CNTT. |
| ----- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| User  | Người dùng công khai — không cần đăng nhập, truy cập tự do.         | Chỉ xem, tìm kiếm và xuất dữ liệu mà Admin đã bật trạng thái Public. Không thể xem dữ liệu Private. Không có quyền chỉnh sửa bất kỳ thông tin nào.                                   | Nhà nghiên cứu quốc tế, nghiên cứu sinh, sinh viên, độc giả phổ thông. |
 
 
#  2.4 Các ràng buộc tổng quát
 
● Hệ thống phải hoạt động trên nền tảng web, tương thích với Chrome 110+, Firefox 110+, Edge 110+, Safari 15+. Không hỗ trợ Internet Explorer.
 
● Toàn bộ dữ liệu lưu trữ trên máy chủ đặt tại Việt Nam, tuân thủ Nghị định 73/2017/ND-CP và Luật An toàn thông tin mạng 2015.
 
● Giao diện hỗ trợ song ngữ Tiếng Việt và Tiếng Anh, chuyển đổi bằng một nút bẩm, dựa trên i18n JSON.
 
● Dữ liệu bản đồ nền hành chính sử dụng nguồn chính thức từ Cục Đo đạc và Bản đồ Việt Nam.
 
● Thiết kế responsive, hoạt động tốt trên desktop (≥1280px) và tablet (≥768px).
 
● Hệ thống phải tương thích với chuẩn WCAG 2.1 mức AA về khả năng tiếp cận (accessibility).
 
#  2.5 Giả định và phụ thuộc
 
● Hạ tầng máy chủ MVP: Windows Server 2019/2022 hoặc Windows 10/11 Pro với tối thiểu 4–8 vCPU, 16–32 GB RAM, 500 GB–1 TB SSD. Về lâu dài, khuyến nghị chuyển sang Linux Ubuntu 22.04 LTS để tối ưu hiệu năng Docker.
 
● Kết nối Internet ổn định (tối thiểu 50 Mbps) để tích hợp với NCBI GenBank, GBIF, BOLD, Catalogue of Life và Google Maps API.
 
● Dữ liệu bản đồ hành chính Việt Nam được Cục Đo đạc Bản đồ cung cấp dưới dạng Shapefile hoặc GeoJSON.
 
● Cán bộ nhập liệu được đào tạo cơ bản về phân loại học côn trùng và quy trình nhập liệu phần mềm trước khi vận hành chính thức.
 
● Google Maps API key hợp lệ được cung cấp bởi Viện CNTT; nếu không có, OpenStreetMap được dùng làm lớp nền thay thế miễn phí.
 
 
 
#  3. YÊU CẦU VỀ GIAO TIẾP
 
##  3.1 Giao diện người dùng
 
###  3.1.1 Nguyên tắc thiết kế
 
● Giao diện thân thiện, trực quan, tham chiếu theo 3 phần mềm chuẩn quốc tế:
 
Specify 7 (https://sp7demofish.specifycloud.org/) cho quản lý mẫu vật nội bộ,
 
° GBIF (https://www.gbif.org/) cho tìm kiếm và khám phá dữ liệu công khai,
 
o iDigBio (https://portal.idigbio.org/) cho khai thác và phân tích dữ liệu.
 
● Responsive design, hoạt động tốt trên desktop (≥1280px) và tablet (≥768px).
 
● Hỗ trợ Light mode và Dark mode theo tùy chọn người dùng, lưu vào localStorage.
 
● Ngôn ngữ mặc định Tiếng Việt, chuyển đổi sang Tiếng Anh bằng một nút trong Topbar.
 
● Tất cả thao tác CRUD có xác nhận (Confirm Dialog) trước khi thực hiện hành động không thể hoàn tác.
 
● Thông báo kết quả thao tác (Toast notification): thành công màu xanh, lỗi màu đỏ, cảnh báo màu vàng.
 
###  3.1.2 Danh sách màn hình giao diện
 
Bảng sau liệt kê toàn bộ 30 màn hình của hệ thống, phân theo 10 nhóm chức năng:
 
 
 
| STT | Mã MH | Tên màn hình | Tên tiếng Anh | Chức năng chính | Vai trò |
| --- | ----- | ------------ | ------------- | --------------- | ------- |
 
 
###  I. XÁC THỰC ADMIN
 
 
 
| 1   | SCR-01 | Đăng nhập    | Admin Login     | Form username/password, khóa tài khoản sau 5 lần sai, session timeout 60 phút, HTTPS/TLS 1.3, JWT 24h. | Admin |
| --- | ------ | ------------ | --------------- | ------------------------------------------------------------------------------------------------------ | ----- |
| 2   | SCR-02 | Đổi mật khẩu | Change Password | Mật khẩu mới ≥12 ký tự, kết hợp hoa/thường/số/ký tự đặc biệt. Bcrypt hash, không lưu plaintext.        | Admin |
 
 
###  II. DASHBOARD & TÔNG QUAN
 
 
 
| 3   | SCR-03 | Dashboard Admin     | Admin Dashboard | Số liệu tổng quan realtime (mẫu/loài/ảnh/DNA), treemap taxon, bản đồ mini phân bố, tiến độ số hóa, cảnh báo dữ liệu bất thường. | Admin |
| --- | ------ | ------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 4   | SCR-04 | Trang chủ công khai | Public Home     | Truy cập mở không đăng nhập. Giới thiệu hệ thống, tìm kiếm nhanh, thống kê dữ liệu mở.                                          | User  |
 
 
###  III. QUẢN LÝ MÃU VẬT
 
 
 
| 5   | SCR-05 | Danh sách | Specimen | Bảng toàn bộ mẫu, phân trang | Admin |
| --- | ------ | --------- | -------- | ---------------------------- | ----- |
 
 
 
 
 
 
|                                |                                | mẫu vật                        | List                           | 50 dòng, chọn cột, sắp xếp, checkbox chọn lố để batch edit hoặc xuất.                                                             |                                |
| ------------------------------ | ------------------------------ | ------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 6                              | SCR-06                         | Thêm mới mẫu vật               | Specimen Creation Form         | Form 22 trường, validation inline, autocomplete tên khoa học (COL/ITIS), chọn GPS trên bàn đồ, drag-and-drop ánh, scan QR.        | Admin                          |
| 7                              | SCR-07                         | Chính sữa mẫu vật              | Specimen Edit Form             | Form điển sẵn dữ liệu cũ, ghi tracked changes (ai/khi nào/thay đổi gì), soft delete có thể khôi phục 30 ngày.                     | Admin                          |
| 8                              | SCR-08                         | Chi tiết mẫu vật               | Specimen Detail                | Xem đầy đủ 22 trường, slideshow ánh, liên kết DNA. Admin thấy nút Sữa/Xóa/In nhân; User chi xem khi Admin bật Public.             | Admin/ User                    |
| 9                              | SCR-09                         | Nhập dữ liệu hàng loạt         | Bulk Import (Workbench)        | Tài template Excel, upload, map cột tương tác, preview lỗi theo dòng/cột màu đó/vàng, tối đa 5.000 bán ghi/lần.                   | Admin                          |
| 10                             | SCR-10                         | Chính sữa hàng loạt            | Batch Edit                     | Chọn nhiều mẫu → chọn trường → nhập giá trị mới → preview → xác nhận áp dụng.                                                     | Admin                          |
| 11                             | SCR-11                         | Định dạng và in nhân           | Label Printing                 | Cấu hình khung in, sinh mã QR tự động, chọn lố mẫu, xuất PDF in hàng loạt chuẩn Specify 7.                                        | Admin                          |
| IV. PHÂN LOẠI HỌC & HÒ SỢ LOÀI | IV. PHÂN LOẠI HỌC & HÒ SỢ LOÀI | IV. PHÂN LOẠI HỌC & HÒ SỢ LOÀI | IV. PHÂN LOẠI HỌC & HÒ SỢ LOÀI | IV. PHÂN LOẠI HỌC & HÒ SỢ LOÀI                                                                                                    | IV. PHÂN LOẠI HỌC & HÒ SỢ LOÀI |
| 12                             | SCR-12                         | Cây phân loại học              | Taxonomy Tree                  | Cây Kingdom→Subspecies mở rộng/thu gọn, số mẫu tại mỗi nút, tìm kiếm tên bậc phân loại. Admin sữa cây; User chi xem.              | Admin/ User                    |
| 13                             | SCR-13                         | Trang hồ sơ loài               | Species Profile Page           | 6 tabs: Hinh thái & Sinh thái · Mẫu vật · DNA · Hoạt tính · Phân bổ. Widget AI nhận dạng + SDM. Liên kết GBIF/BOLD/ITIS/COL/IUCN. | Admin/ User                    |
| 14                             | SCR-14                         | Quản lý danh pháp              | Taxon Editor                   | Thêm/sửa taxon, quản lý accepted/synonym, xác thực tên qua COL API, import danh lục Excel.                                        | Admin                          |
| V. TÌM KIÉM & KHAI THÁC        | V. TÌM KIÉM & KHAI THÁC        | V. TÌM KIÉM & KHAI THÁC        | V. TÌM KIÉM & KHAI THÁC        | V. TÌM KIÉM & KHAI THÁC                                                                                                           | V. TÌM KIÉM & KHAI THÁC        |
| 15                             | SCR-15                         | Tim kiếm mẫu vật               | Specimen Search                | Full - text + faceted filters (taxon, tinh, năm, media,                                                                           | Admin/ User                    |
 
 
 
 
 
 
|     |        |                   |                 | IUCN). 5 chế độ xem:List/Label/Gallery/Map/Treemap. Xuất DwC-A/Excel/GeoJSON.                           |             |
| --- | ------ | ----------------- | --------------- | ------------------------------------------------------------------------------------------------------- | ----------- |
| 16  | SCR-16 | Tìm kiếm nâng cao | Advanced Search | Query Builder AND/OR/NOT, khoảng giá trị số, ngày tháng, lưu/tải bộ lọc. Admin: truy vấn SQL trực tiếp. | Admin       |
| 17  | SCR-17 | Thư viện hình ảnh | Media Gallery   | Grid ảnh độ phân giải cao, lọc taxon/tinh/năm, lightbox, download ảnh gốc (Admin), link trang mẫu.      | Admin/ User |
 
 
#  VI. GIS & BẮN ĐỒ
 
 
 
| 18  | SCR-18 | Bản đồ phân bố     | Occurrence Map | Leaflet.js full screen: điểm màu theo bộ, heatmap, vẽ polygon tìm kiếm, chuyển lớp nền (Google/OSM/Cục Đo đạc VN), popup nhanh. | Admin/ User |
| --- | ------ | ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 19  | SCR-19 | Quản lý lớp bản đồ | Layer Manager  | Upload Shapefile/GeoJSON/GeoTIFF chuyên đề (sinh cảnh, độ cao, khí hậu), bật/tắt lớp, style màu, xuất PDF/PNG.                  | Admin       |
 
 
#  VII. DỮ LIỆU DNA & GENBANK
 
 
 
| 20  | SCR-20 | Danh sách chuỗi DNA  | DNA Records List        | Bảng tập trung các bản ghi phân tử, lọc theo loài/gen marker (COI, 16S rRNA, ITS2), liên kết NCBI/BOLD.  | Admin/ User |
| --- | ------ | -------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- | ----------- |
| 21  | SCR-21 | Form Thêm/Sữa DNA    | DNA Entry & Edit Form   | Nhập mã Accession GenBank (VD: KX894504.1), thông tin primers, tự động fetch metadata NCBI E-utilities.  | Admin       |
| 22  | SCR-22 | Chi tiết chuỗi FASTA | DNA Detail / FASTA View | Hiển thị nucleotide chuẩn FASTA, metadata đầy đủ, nút copy nhanh và download. fasta, liên kết NCBI/BOLD. | Admin/ User |
 
 
#  VIII. AI & PHÂN TÍCH MÔ HÌNH
 
 
 
| 23  | SCR-23 | Nhận dạng loài qua ảnh | AI Species Identification | Upload ảnh → CNN inference→ top-5 loài + xác suất <5 giây→ Admin xác nhận gắn vào mẫuvật. | Admin/User |
| --- | ------ | ---------------------- | ------------------------- | ----------------------------------------------------------------------------------------- | ---------- |
| 24  | SCR-24 | Dự báo phân bố (SDM)   | SDM Prediction Portal     | Chọn loài + biến khí hậu WorldClim/CHELSA → MaxEnt → bản đồ phân bố tiềm                  | Admin      |
 
 
 
 
 
 
|     |        |                     |                     | năng raster + PNG.                                                                                    |       |
| --- | ------ | ------------------- | ------------------- | ----------------------------------------------------------------------------------------------------- | ----- |
| 25  | SCR-25 | Dashboard phân tích | Analytics Dashboard | Biểu đồ xu hướng số hóa, độ phủ (% có ảnh/DNA/GPS), phân bố taxon/tỉnh, cảnh báo tọa độ lỗi ngoài VN. | Admin |
 
 
#  IX. BÁO CÁO & XUÁT DỮ LIỆU
 
 
 
| 26  | SCR-26 | Báo cáo danh lục & Thống kê | Reports & Checklists    | Xuất PDF/Excel danh lục loài theo bộ/họ chuẩn khoa học, thống kê mẫu. Header/footer/watermark Viện. User xuất dữ liệu mở. | Admin/ User |
| --- | ------ | --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 27  | SCR-27 | Báo cáo KPI số hóa          | Digitization KPI Report | Thống kê hiệu suất: số bản ghi nhập mới, chỉnh sửa, bổ sung ảnh/DNA theo khoảng thời gian tùy chọn. Xuất Excel.           | Admin       |
| 28  | SCR-28 | Bộ dựng báo cáo tùy chỉnh   | Custom Report Builder   | Kéo thả chọn trường dữ liệu, preview kết quả, xuất CSV/Excel tùy biến.                                                    | Admin       |
 
 
#  X. QUẢN TRỊ HỆ THỐNG
 
 
 
| 29  | SCR-29 | Kiểm soát chia sẻ công khai | Public/Private Control    | Danh sách toggle Public/Private từng bản ghi, batch update hàng loạt, preview giao diện User sẽ thấy.  | Admin |
| --- | ------ | --------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ | ----- |
| 30  | SCR-30 | Nhật ký & Cấu hình hệ thống | System Audit Log & Config | Lịch sử CRUD Admin. Cấu hình SMTP, Google Maps API key, danh mục dropdown, backup schedule, logo Viện. | Admin |
 
 
##  3.2 Giao diện phản cứng
 
● Máy chủ ứng dụng và CSDL: Windows Server 2019/2022 hoặc Windows 10/11 Pro, tối thiểu 4–8 vCPU, 16–32 GB RAM, 500 GB–1 TB SSD.
 
● Máy chủ lưu trữ file (MinIO): dung lượng khởi đầu tối thiểu 2 TB, có thể mở rộng theo module.
 
● Thiết bị người dùng: PC/laptop với trình duyệt hiện đại, màn hình tối thiểu 1280×800 pixel.
 
#  3.3 Giao diện phản mềm
 
Bảng tích hợp với các hệ thống bên ngoài:
 
 
 
| Hệ thống ngoài | Giao thức / API | Mục đích tích hợp |
| -------------- | --------------- | ----------------- |
 
 
 
 
 
 
| MongoDB                 | MongoDB Driver (Node.js)   | Lưu trữ JSON metadata phi cấu trúc từ NCBI/BOLD, dữ liệu hoạt tính sinh/hóa học |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| NCBI GenBank            | HTTPS REST (E-utilities)   | Lấy metadata và trình tự DNA theo mã accession khi Admin nhập GenBank ID        |
| BOLD Systems            | HTTPS REST API v4          | Tra cứu DNA barcode COI, similarity matching, liên kết hồ sơ loài               |
| Catalogue of Life       | COL API v1 (HTTPS)         | Xác thực tên khoa học, đồng danh pháp, tự động gợi ý khi nhập liệu              |
| GBIF                    | DwC-A / IPT 3.x            | Xuất bản dataset, đồng bộ occurrence data, sinh DOI cho dataset                 |
| Google Maps / Satellite | Google Maps JS API v3      | Lớp ảnh nền bản đồ, geocoding địa danh                                          |
| OpenStreetMap           | Tile server (HTTPS)        | Lớp nền bản đồ thay thế miễn phí khi không có Google API key                    |
| Cục Đo đạc Bản đồ VN    | Shapefile / GeoJSON import | Bản đồ hành chính Việt Nam chính thức 34 tỉnh/thành                             |
| GeoServer               | OGC WMS 1.3 / WFS 2.0      | Phục vụ tile bản đồ chuyên đề cho các lớp sinh cảnh, độ cao, khí hậu            |
 
 
#  3.4 Giao diện truyền thông
 
● Toàn bộ giao tiếp giữa client và server qua HTTPS/TLS 1.3; nghiêm cấm HTTP thuần.
 
● REST API nội bộ theo chuẩn OpenAPI 3.0; tài liệu Swagger UI tự động sinh tại /api/docs.
 
● WebSocket (Socket.io) cho tính năng real-time: tiến độ nhập hàng loạt, thông báo dữ liệu mới.
 
● Email SMTP (SSL/TLS port 465/587) cho thông báo tài khoản, reset mật khẩu, cảnh báo lỗi hệ thống.
 
● Mô hình 2 token (ADR-002): Access Token JWT (HS256, TTL 15 phút, lưu in-memory) cho xác thực API; Refresh Token (TTL 7 ngày, có rotation & idle timeout 60 phút) lưu trong HttpOnly cookie (`SameSite=Strict`, `Secure` khi production).
 
 
 
#  4. YÊU CẦU CHỨC NĂNG
 
Các yêu cầu chức năng được mã hóa theo định dạng F - [Nhóm] - [Số thứ tự].
 
##  4.1 Nhóm Xác thực & Bảo mật
 
 
 
| Mã      | Tên chức năng   | Mô tả chi tiết                                                                                                                                                                                                                             |
| ------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F-AU-01 | Đăng nhập Admin | Form nhập username/password, gửi qua HTTPS. Phát sinh Access Token JWT 15 phút (in-memory) + Refresh Token 7 ngày lưu HttpOnly cookie (ADR-002, có rotation). Tự động khóa tài khoản sau 5 lần nhập sai liên tiếp (mở khóa sau 30 phút). Session timeout 60 phút không hoạt động. Hỗ trợ đăng xuất từ tất cả thiết bị. |
| F-AU-02 | Đổi một khẩu    | Yêu cầu nhập mật khẩu cũ. Mật khẩu mới tối thiểu 12 ký tự, bắt buộc có chữ hoa, chữ thường, số và ký tự đặc biệt. Mật khẩu được băm bằng bcrypt (cost factor 12) trước khi lưu; không lưu plaintext dưới bất kỳ hình thức nào.             |
| F-AU-03 | Đăng xuất       | Hủy JWT server-side (blacklist), xóa cookie phía client. Hỗ trợ đăng xuất đồng thời từ tất cả thiết bị (xóa toàn bộ phiên của user).                                                                                                       |
 
 
##  4.2 Nhóm Dashboard & Tổng quan
 
 
 
| Mã      | Tên chức năng             | Mô tả chi tiết                                                                                                                                                                                           |
| ------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-DB-01 | Thống kê tổng quan        | Hiển thị realtime 4 chỉ số chính: tổng mẫu vật, tổng loài đã số hóa, tổng ảnh đính kèm, tổng chuỗi DNA. Số liệu cập nhật tự động khi có dữ liệu mới (polling 30 giây).                                   |
| F-DB-02 | Biểu đồ treemap phân loại | Treemap 2D tương tác: kích thước ô tỷ lệ với số mẫu vật theo bộ côn trùng, màu sắc phân biệt từng bộ. Nhấn vào ô tự động điều hướng đến trang tìm kiếm lọc theo bộ đó.                                   |
| F-DB-03 | Bản đồ mini phân bố       | Minimap Leaflet hiển thị điểm phân bố mẫu vật theo tỉnh/thành. Nhấn mở bản đồ đầy đủ SCR-18. Hiển thị số lượng mẫu theo màu (gradient từ xanh nhạt đến đậm).                                             |
| F-DB-04 | Trang chủ công khai       | Giao diện không cần đăng nhập dành cho User. Hiển thị giới thiệu hệ thống, thanh tìm kiếm nhanh, 3 số liệu dữ liệu mở (số loài/mẫu/tỉnh được Admin cho phép xem). Banner ảnh các loài côn trùng nổi bật. |
 
 
##  4.3 Nhóm Quản lý Mẫu vật
 
Đây là nhóm chức năng nghiệp vụ cốt lõi, bao gồm 12 chức năng chi tiết:
 
 
 
| Mã      | Tên chức năng         | Mô tả chi tiết                                                                                                   |
| ------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| F-SP-01 | Xem danh sách mẫu vật | Bảng hiển thị toàn bộ mẫu vật (Admin thấy tất cả, User chỉ thấy Public). Chọn cột hiển thị tùy ý và lưu cấu hình |
 
 
 
 
 
 
|         |                            | theo session. Sắp xếp đa cột. Phân trang 50 dòng/trang với điều hướng nhanh.                                                                                                                                                                                                                                                                                                                                                           |
| ------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-SP-02 | Thêm mới mẫu vật           | Form web nhập đủ 22 trường: Mã mẫu vật (tự sinh hoặc nhập thủ công), Tên khoa học, Tên thường (VN/EN), Taxon path (Bộ/Họ/Giống/Loài), Tinh/Huyện/Xã, Địa danh cụ thể, Tọa độ GPS (Lat/Lon/Độ chính xác), Ngày thu, người thu, Người định loại, Sinh cánh, Giai đoạn phát triển, Giới tính, Số lượng mẫu, Trang thái mẫu (khô/ngâm/tiêu bán), Số hiệu lưu trữ, Ghi chú, Ngày nhập. Trường bổ sung tùy chọn (C-11, không bắt buộc): Độ cao thu mẫu `elevation_m` (`minimumElevationInMeters`). Validation inline: báo lỗi ngay khi rời khỏi ô nhập. |
| F-SP-03 | Xem chi tiết mẫu vật       | Trang chi tiết hiển thị đầy đủ 22 trường, slideshow ảnh đính kèm, danh sách chuỗi DNA liên kết. Admin thấy nút Sữa/Xóa/In nhãn và thông tin Private. User chi xem thông tin Public khi Admin bật trạng thái Public.                                                                                                                                                                                                                    |
| F-SP-04 | Chính sửa mẫu vật          | Form điền sẵn dữ liệu hiện tại, cho phép sửa từng trường. Ghi tracked changes: lưu lại ai đã thay đổi, thời điểm nào, trường nào, từ giá trị gì sang giá trị gì. Xem timeline lịch sử chính sưa.                                                                                                                                                                                                                                       |
| F-SP-05 | Xóa mẫu vật (soft delete)  | Xóa mềm với hộp xác nhận bất buộc. Bản ghi bị ẩn khỏi giao diện nhưng vẫn còn trong CSDL (cột deleted_at). Admin có thể khôi phục bất kỳ bán ghi đã xóa trong vòng 30 ngày. Mọi thao tác xóa được ghi vào audit log.                                                                                                                                                                                                                   |
| F-SP-06 | Nhập hàng loạt (WorkBench) | (1) Tải template Excel chuẩn 22 cột kèm hướng dẫn. (2) Upload file Excel/CSV. (3) Map cột tương tác: kéo thả tên cột file vào đúng trường hệ thống. (4) Preview 20 dòng đầu, highlight lỗi đỏ (bắt buộc thiểu), vàng (cánh báo). (5) Xác nhận nhập — background job xử lý, hiển thị thanh tiến độ realtime qua WebSocket. Tôi đa 5.000 bản ghi/lẫn.                                                                                    |
| F-SP-07 | Chính sửa hàng loạt        | Chọn nhiều bản ghi từ danh sách (checkbox) → Chọn trường cần cập nhật → Nhập giá trị mới → Xem preview số bản ghi sẽ bị ảnh hưởng → Xác nhận áp dụng. Ghi audit log cho từng bán ghi bị thay đổi.                                                                                                                                                                                                                                      |
| F-SP-08 | Upload ảnh mẫu vật         | Drag-and-drop nhiều ảnh cùng lúc. Tự động resize và tạo thumbnail 200×200px. Gắn nhãn góc chụp (tổng thể/chi tiết đầu/chi tiết cánh/tiêu bán). Xem slideshow. Admin download ảnh góc độ phân giải đẩy đủ.                                                                                                                                                                                                                              |
| F-SP-09 | In nhãn mẫu vật            | Giao diện cấu hình khung in: chọn template nhãn, font chữ, kích thước. Tự động sinh mã QR chứa mã mẫu vật. Chọn lỗ mẫu từ danh sách. Xuất PDF in hàng loạt theo chuẩn nhãn Specify 7.                                                                                                                                                                                                                                                  |
| F-SP-10 | Tài template nhập liệu     | Tài file Excel mẫu chuẩn 22 cột, mỗi cột có header tiếng Việt + tiếng Anh, ghi chú định dạng hợp lệ, ví dụ minh họa trong hàng đầu. Phiên bàn template ghi trong tên file.                                                                                                                                                                                                                                                             |
| F-SP-11 | Xuất danh sách mẫu vật     | Xuất toàn bộ hoặc kết quả đang lọc (không giới hạn số bản ghi) ra: Excel/CSV (22 trường đẩy đủ), Darwin Core                                                                                                                                                                                                                                                                                                                           |
 
 
 
 
 
 
|         |                      | Archive (.zip — chuẩn GBIF), GeoJSON (chi các mẫu có tọa độ GPS). User chỉ xuất được dữ liệu Public.                                                                     |
| ------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F-SP-12 | Xem lịch sử thay đổi | Timeline hiển thị toàn bộ lịch sử chỉnh sửa của một mẫu vật: thời gian, tài khoản Admin, trường đã thay đổi, giá trị cũ → giá trị mới. Có thể lọc theo khoảng thời gian. |
 
 
#  4.4 Nhóm Phân loại học & Hồ sơ loài
 
 
 
| Mã      | Tên chức năng                  | Mô tả chi tiết                                                                                                                                                                                                                                                                                                                    |
| ------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-TX-01 | Xem cây phân loại học          | Cây phân cấp 8 bậc: Kingdom → Phylum → Class → Order → Family → Genus → Species → Subspecies. Mỗi nút hiển thị tên khoa học + số mẫu vật. Mở rộng/thu gọn từng nhánh. Tim kiểm nhanh tên bậc phân loại với highlight kết quả. Nhấn nút để xem danh sách mẫu thuộc bậc đó.                                                         |
| F-TX-02 | Thêm / Sữa / Xóa taxon         | CRUD đầy đủ cho các bậc phân loại: nhập tên khoa học, tên tác giả, năm công bổ, tên thương Việt/Anh, ghi chú. Xác thực tên khoa học trực tiếp qua Catalogue of Life API và ITIS trước khi lưu. Hiển thị kết quả so khớp và đề xuất sữa chính tà.                                                                                  |
| F-TX-03 | Quản lý đồng danh pháp         | Gắn danh sách synonym cho mỗi loài. Đánh dấu một tên là accepted name (tên được chấp nhận hiện tại). Khi tìm kiếm theo synonym hệ thống tự động điều hướng sang accepted name kèm thông báo. Hiển thị cả hai trong kết quả tìm kiếm.                                                                                              |
| F-TX-04 | Import danh lục loài           | Import danh lục từ file Excel/CSV theo template chuẩn: tên khoa học, bậc phân loại, taxon cha. Hệ thống tự động xây dựng cây phân loại, kiểm tra trùng lặp và cảnh báo conflict.                                                                                                                                                  |
| F-TX-05 | Xem trang hồ sơ loài           | Trang chi tiết loài với 5 tab: (1) Hình thái & Sinh thái — 22 trường dạng lưới 2 cột Việt/Anh; (2) Mẫu vật — danh sách phân trang 50 dòng; (3) DNA — các chuỗi GenBank/BOLD; (4) Hoạt tính Sinh/Hóa — mô tả + ảnh kết quả; (5) Phân bổ — bản đồ Leaflet điểm mẫu + ảnh vệ tinh. Panel phải: widget AI nhận dạng ảnh + widget SDM. |
| F-TX-06 | Liên kết CSDL quốc tế          | Tự động sinh hyperlink sang 5 nguồn quốc tế cho từng loài: GBIF Species page, BOLD TaxID, ITIS TSN, Catalogue of Life, IUCN Red List. Mỗi liên kết mở tab mới. Hiển thị trạng thái IUCN (LC/NT/VU/EN/CR) bằng màu badge.                                                                                                          |
| F-TX-07 | Quản lý hoạt tính Sinh/Hóa học | Thêm/sữa/xóa mô tả hoạt tính sinh học và hoá học cho từng loài: loại hoạt tính, mức độ, điều kiện thử nghiệm. Upload hình ảnh kết quả thử nghiệm. Gắn tài liệu tham khảo DOI/tên bài báo.                                                                                                                                         |
 
 
 
 
#  4.5 Nhóm Tìm kiếm & Khai thác dữ liệu
 
 
 
| Mã      | Tên chức năng             | Mô tả chi tiết                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-SR-01 | Tìm kiếm toàn văn         | Tìm kiếm đồng thời trên: tên khoa học (hỗ trợ Latin có dấu), tên thường (Việt có dấu/không dấu, tiếng Anh), mã mẫu vật, địa danh, ghi chú. Debounce 300ms. Elasticsearch full text với Vietnamese analyzer. Kết quả < 1 giây (P95) với tập dữ liệu 50.000 bản ghi.                                                                                                                                                           |
| F-SR-02 | Bộ lọc da chiều (Faceted) | Panel bộ lọc trái với 8 chiều: Taxon (bộ/họ/giống/loài — cascade dropdown), Tinh/Thành phô (63 tinh), Năm thu mẫu (slider khoảng), Loại media (ánh/DNA/hoạt tính — checkbox), Tinh trạng IUCN, Độ cao thu mẫu (slider khoảng), Người thu mẫu (autocomplete), Có GPS. Hiển thị số lượng bản ghi tương ứng mỗi giá trị lọc (theo GBIF facet aggregation). Kết hợp nhiều bộ lọc cùng lúc (AND logic). Nút reset toàn bộ bộ lọc. |
| F-SR-03 | 5 chế độ xem kết quả      | Chuyển đổi liền mạch giữa 5 chế độ: (1) List view — băng cột tùy chinh; (2) Label view — nhãn mẫu chuẩn Specify 7; (3) Gallery view — grid ảnh theo iDigBio; (4) Map view — bán đồ Leaflet điểm phân bổ; (5) Treemap view — biểu đồ phân loại. Trạng thái chế độ xem và bộ lọc được lưu trong URL query params để chia sẻ và bookmark.                                                                                       |
| F-SR-04 | Tìm kiếm nâng cao         | Query Builder trực quan: thêm/xóa điều kiện tùy ý với logic AND/OR/NOT. Hỗ trợ khoảng giá trị số (độ cao từ X đến Y, kích thước cơ thể từ A đến B). Khoảng ngày tháng (date range picker). Lưu bộ lọc với tên tùy chinh và tái lại sau. Admin: thêm chế độ nhập SQL trực tiếp tương tự GBIF SQL Downloads.                                                                                                                   |
| F-SR-05 | Tìm kiếm theo vùng địa lý | Vẽ polygon tự do hoặc hình chữ nhất trên bản đồ (leaflet-draw) để lọc tất cả mẫu vật có tọa độ GPS nằm trong vùng đó. Hiện số lượng mẫu trong vùng realtime khi điều chinh polygon. Tích hợp với màn hình bản đồ SCR-18.                                                                                                                                                                                                     |
| F-SR-06 | Xuất kết quả tìm kiếm     | Xuất toàn bộ kết quả hiện tại (không giới hạn số bản ghi, xử lý background): Excel/CSV đầy đủ 22 trường, Darwin Core Archive (.zip chuẩn GBIF), GeoJSON (chi bản ghi có GPS). Gửi email thông báo khi file xuất lớn đã sẵn sàng tái về. User chi xuất dữ liệu Public.                                                                                                                                                        |
| F-SR-07 | Thư viện hình ảnh         | Grid ảnh toàn bộ mẫu có ảnh. Lọc theo taxon/tinh/năm. Lightbox xem ảnh lớn kèm metadata. Admin download ảnh gốc độ phân giải đầy đủ. User xem ảnh Public. Nhân ảnh mở trang chi tiết mẫu vật tương ứng.                                                                                                                                                                                                                      |
 
 
#  4.6 Nhóm GIS & Bản đồ
 
 
 
| Mã  | Tên chức năng | Mô tả chi tiết |
| --- | ------------- | -------------- |
 
 
 
 
 
 
| F-GI-01 | Bản đồ phân bố điểm          | Leaflet.js full screen: mỗi mẫu vật có GPS hiển thị là CircleMarker, màu phân biệt theo bộ côn trùng (legend bên cạnh). Nhấn điểm mở popup thông tin nhanh: tên khoa học, địa điểm, ngày thu, ảnh thumbnail. Nhấn popup mở trang chi tiết mẫu. Cluster tự động khi zoom out. |
| ------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-GI-02 | Heatmap mật độ phân bố       | Lớp nhiệt (leaflet-heat plugin) thể hiện mật độ mẫu vật: cường độ màu tỷ lệ với số lượng mẫu tại mỗi vùng. Toggle bật/tắt không làm mất bộ lọc đang áp dụng.                                                                                                                 |
| F-GI-03 | Chuyển đổi lớp nền           | Chuyển đổi realtime giữa 3 lớp nền: Google Maps, Google Satellite/Hybrid, OpenStreetMap, Bản đồ hành chính VN (Cục Đo đạc). Tùy chọn opacity cho từng lớp.                                                                                                                   |
| F-GI-04 | Quản lý lớp bản đồ chuyên đề | Admin upload các lớp dữ liệu không gian: Shapefile (.zip), GeoJSON (point/polygon/polyline), GeoTIFF raster (sinh cảnh, độ cao DEM, biến đổi khí hậu). Đặt tên, màu sắc style cho từng lớp. Sắp xếp thứ tự hiển thị. Bật/tắt lớp. Admin quyết định lớp nào User được xem.    |
| F-GI-05 | Xuất bản đồ                  | Xuất snapshot bản đồ hiện tại (bao gồm các lớp đang bật, bộ lọc đang áp dụng) ra PDF A4/A3 có legend, thanh tỷ lệ, tiêu đề và thông tin ngày xuất. Định dạng PNG độ phân giải 300 DPI.                                                                                       |
| F-GI-06 | Phân tích vùng giàu loài     | Công cụ PostGIS tính toán và hiển thị choropleth map: mỗi tỉnh/huyện được tô màu theo số loài ghi nhận (species richness). Xác định vùng có loài đặc hữu và loài quý hiểm (IUCN NT/VU/EN/CR). Kết quả có thể xuất ra shapefile.                                              |
 
 
#  4.7 Nhóm Dữ liệu DNA & GenBank
 
 
 
| Mã      | Tên chức năng         | Mô tả chi tiết                                                                                                                                                                                                                                                                                                          |
| ------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-DN-01 | Danh sách chuỗi DNA   | Bảng tập trung toàn bộ bản ghi phân tử của hệ thống. Lọc theo loài, gen marker (COI, 16S rRNA, ITS2, 28S, CYTB), năm đăng, trạng thái Public/Private. Liên kết mỗi bản ghi sang NCBI GenBank và BOLD Systems.                                                                                                           |
| F-DN-02 | Thêm / Sữa chuỗi DNA  | Form nhập: mã Accession GenBank (validation regex: /^[A-Z]{1,2}¥d{5,8}¥.¥d+$/), gen marker, thông tin primers, ghi chú. Khi nhập mã Accession, hệ thống tự động gọi NCBI E-utilities (esearch + efetch) lấy metadata: tên loài, độ dài trình tự (bp), ngày đăng, tên tác giả, abstract. Hiển thị preview trước khi lưu. |
| F-DN-03 | Liên kết BOLD Systems | Nhập BOLD Process ID. Sinh hyperlink sang https://boldsystems.org/index.php/Taxbrowser_Taxonpage?taxid=[ID].Hiển thị badge BOLD màu xanh tại trang chi tiết mẫu và hồ sơ loài.                                                                                                                                          |
| F-DN-04 | Xem chuỗi FASTA       | Trang chi tiết DNA hiển thị trình tự nucleotide đầy đủ chuẩn FASTA (> header + sequence). Nút copy toàn bộ                                                                                                                                                                                                              |
 
 
 
 
 
 
|         |                        | chuỗi vào clipboard. Nút download file. fasta. Thông tin metadata đầy đủ bên cạnh viewer. Liên kết trực tiếp sang NCBI Nucleotide và BOLD.                                                                                              |
| ------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-DN-05 | Liên kết mẫu vật – DNA | Một mẫu vật có thể gắn nhiều chuỗi DNA (nhiều gen marker khác nhau). Mối quan hệ 1-nhiều hiển thị rõ trong trang chi tiết mẫu và trang hồ sơ loài. Khi xóa mẫu vật, chuỗi DNA liên kết không bị xóa mà chỉ bị orphan và cảnh báo Admin. |
 
 
#  4.8 Nhóm AI & Phân tích mô hình
 
 
 
| Mã      | Tên chức năng               | Mô tả chi tiết                                                                                                                                                                                                                                                                                                                                                  |
| ------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-AI-01 | Nhận dạng loài từ ảnh       | Upload ảnh côn trùng (JPG/PNG, tối đa 10 MB) → Gọi AI Service (Python FastAPI) → Model CNN EfficientNet-B4 fine-tuned trên tập ảnh côn trùng Việt Nam → Trả về top-5 loài + xác suất (%) trong < 5 giây. Admin xem kết quả, chọn xác nhận hoặc điều chỉnh và gắn vào mẫu vật đang nhập. User có thể thử tính năng nhận dạng nhưng không lưu kết quả.            |
| F-AI-02 | Dự báo phân bố loài (SDM)   | Giao diện chọn loài + tích hợp các lớp biển khí hậu (WorldClim 2.1: 19 biển BIO, CHELSA v2) → Gửi yêu cầu sang AI Service → Chạy mô hình MaxEnt → Xuất bản đồ phân bố tiềm năng dạng raster GeoTIFF + PNG preview. Hiển thị kết quả trên bản đồ Leaflet dạng overlay. Cho phép download kết quả.                                                                |
| F-AI-03 | Dashboard phân tích dữ liệu | Biểu đồ tương tác (Recharts): (1) Đường xu hướng số hóa: số bản ghi mới theo tuần/tháng/năm; (2) Donut chart độ phủ dữ liệu: tỉ lệ mẫu có ảnh/DNA/GPS/hoạt tính; (3) Bar chart phân bố theo taxon; (4) Choropleth mini: số mẫu theo tinh. Bộ lọc thời gian: 7 ngày / 30 ngày / 12 tháng / tùy chọn.                                                             |
| F-AI-04 | Cảnh báo dữ liệu bất thường | Tự động quét và cảnh báo các vấn đề chất lượng dữ liệu: (1) Tọa độ GPS nằm ngoài lãnh thổ Việt Nam (bounding box: 8.18°N–23.39°N, 102.14°E–109.46°E); (2) Tên khoa học không tìm thấy trong Catalogue of Life; (3) Mã GenBank không khớp định dạng chuẩn; (4) Ngày thu mẫu trong tương lai. Hiển thị danh sách cảnh báo với link trực tiếp đến bản ghi cần sửa. |
 
 
#  4.9 Nhóm Báo cáo & Xuất dữ liệu
 
 
 
| Mã      | Tên chức năng             | Mô tả chi tiết                                                                                                                                                         |
| ------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-RP-01 | Báo cáo thống kê tổng hợp | Xuất PDF/Excel: tổng quan số mẫu/loài/phân bố địa lý, biểu đồ thanh theo bộ côn trùng, bảng top 10 tỉnh có nhiều mẫu nhất. PDF tự động đóng dấu header (Quốc hiệu Việt |
 
 
 
 
 
 
|         |                                            | Nam, tên Viện CNTT/VAST), footer (ngày trích xuất, số trang) và watermark bảo quyền. User xuất được bán rút gọn chỉ gồm dữ liệu Public.                                                                                                                    |
| ------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-RP-02 | Báo cáo danh lục loài                      | Kết xuất danh lục loài theo định dạng chuẩn báo cáo khoa học: sắp xếp theo Bộ → Họ → Loài. Mỗi loài ghi tên khoa học, tên tác giả, tên thường VN/Anh, số mẫu, tình trạng IUCN. Xuất Word (.docx) và PDF. Tùy chọn lọc theo tỉnh hoặc khoảng thời gian.     |
| F-RP-03 | Báo cáo KPI số hóa                         | Thống kê hiệu suất theo khoảng thời gian tùy chọn: số bản ghi nhập mới, số bản ghi chỉnh sữa, số ảnh bổ sung, số chuỗi DNA bổ sung. Băng tổng hợp theo từng tháng. Biểu đồ đường xu hướng. Xuất Excel.                                                     |
| F-RP-04 | Báo cáo tùy chỉnh (Dynamic Report Builder) | Giao diện kéo thả chọn các trường dữ liệu cần đưa vào báo cáo. Áp dụng bộ lọc tùy ý. Xem preview trước khi xuất. Lưu cấu hình báo cáo với tên đề tái sử dụng. Xuất Excel/CSV.                                                                              |
| F-RP-05 | Đóng dấu thương hiệu báo cáo               | Tự động chèn vào mọi file PDF xuất ra: Header gồm Quốc hiệu Việt Nam và tên Viện CNTT — VAST; Footer gồm ngày giờ trích xuất và số trang; Watermark mờ tên hệ thống VietInsect báo vệ bản quyền. Admin cấu hình logo và thông tin tổ chức tại SCR-30.      |
| F-RP-06 | Xuất bản lên GBIF (DwC-A)                  | Tạo và export Darwin Core Archive (.zip): mapping trường CSDL sang DwC terms, file meta.xml, eml.xml (metadata dataset). Kết nối GBIF Integrated Publishing Toolkit (IPT). Theo dõi trạng thái sync và lịch sử xuất bản. Sinh DOI cho mỗi dataset version. |
 
 
#  4.10 Nhóm Quản trị hệ thống
 
 
 
| Mã      | Tên chức năng                    | Mô tả chi tiết                                                                                                                                                                                                                                                                                                  |
| ------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-AD-01 | Kiểm soát chia sẻ Public/Private | Trang danh sách tập trung trạng thái hiển thị của từng bản ghi mẫu vật. Toggle Public/Private từng bản ghi hoặc chọn lô batch update. Preview giao diện User sẽ thấy sau khi toggle. Lịch sử toggle được ghi vào audit log. Đây là cơ chế cốt lõi phân biệt 2 vai trò Admin/User.                               |
| F-AD-02 | Nhật ký hệ thống (Audit Log)     | Ghi nhận toàn bộ thao tác Admin: đăng nhập/đăng xuất, tạo/sửa/xóa mẫu vật, toggle Public/Private, xuất dữ liệu, cấu hình hệ thống. Mỗi bản ghi log gồm: timestamp (UTC+7), tài khoản, loại thao tác, đối tượng bị tác động, IP địa chỉ. Lọc theo thời gian và loại thao tác. Xuất CSV. Lưu trữ tối thiểu 2 năm. |
| F-AD-03 | Cấu hình hệ thống                | Giao diện cấu hình: (1) Email SMTP (host, port, user, password, from); (2) Google Maps API key; (3) NCBI API key; (4) Danh mục dropdown: sinh cảnh, trạng thái mẫu, giai đoạn phát triển (thêm/sửa/xóa giá trị); (5)                                                                                            |
 
 
 
 
 
 
|         |                             | Backup schedule (cron expression); (6) Logo và thông tin tổ chức cho báo cáo PDF.                                                                                                                                         |
| ------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-AD-04 | Cấu hình ngôn ngữ giao diện | Chuyển đổi ngôn ngữ giao diện Tiếng Việt / Tiếng Anh cho toàn bộ hệ thống. il8n dựa trên file JSON (vi.json / en.json). Múi giờ mặc định UTC+7. Định dạng ngày theo ISO 8601 trong CSDL, hiển thị theo locale người dùng. |
 
 
 
 
#  5. YÊU CẦU PHI CHỨC NĂNG
 
##  5.1 Yêu cầu hiệu năng
 
 
 
| Chỉ tiêu hiệu năng                    | Ngưỡng yêu cầu                | Điều kiện / Ghi chú                                      |
| ------------------------------------- | ----------------------------- | -------------------------------------------------------- |
| Thời gian phản hồi trang thông thường | < 2 giây (P95)                | Kết nối mạng 10 Mbps, không kể lần load đầu tiên         |
| Tìm kiếm toàn văn Elasticsearch       | < 1 giây (P95)                | Tập dữ liệu < 50.000 bản ghi, index đã warm              |
| Tài tile bản đồ Leaflet               | < 3 giây (P95)                | GeoServer tile cache đã được khởi tạo                    |
| Nhận dạng AI từ 1 ảnh                 | < 5 giây                      | Ảnh ≤ 10 MB, model đã load vào memory GPU/CPU            |
| Import Excel 5.000 bản ghi            | < 120 giây                    | Background job, user nhận thông báo qua WebSocket        |
| Xuất DwC-Archive 10.000 bản ghi       | < 60 giây                     | Background job, email thông báo khi hoàn thành           |
| Số người dùng đồng thời               | ≥ 200 concurrent users        | Kịch bản hỗn hợp: 80% đọc, 20% ghi                       |
| Dung lượng lưu trữ khởi đầu           | 100.000 mẫu vật + 500.000 ảnh | Giai đoạn 5 năm đầu, ảnh trung bình 2 MB/file            |
| Truy vấn MongoDB metadata             | < 500ms (P95)                 | JSON metadata NCBI/BOLD, tập dữ liệu < 100.000 documents |
 
 
##  5.2 Yêu cầu bảo mật
 
● Xác thực mạnh: Mật khẩu Admin tối thiểu 12 ký tự, bắt buộc kết hợp chữ hoa/thường/số/ký tự đặc biệt. Tự động khóa tài khoản sau 5 lần nhập sai liên tiếp (mở khóa sau 30 phút hoặc Admin reset).
 
● Quản lý phiên làm việc (ADR-002): Tự động timeout sau 60 phút không hoạt động. Access Token JWT TTL 15 phút (in-memory) + Refresh Token 7 ngày lưu HttpOnly cookie (có rotation). Hỗ trợ đăng xuất đồng thời từ tất cả thiết bị (invalidate tất cả token của user qua Redis blacklist + thu hồi refresh token).
 
● Truyền thông an toàn: Toàn bộ giao tiếp qua HTTPS/TLS 1.3. Không truyền token/mật khẩu trên URL. HTTP Strict Transport Security (HSTS) header bắt buộc.
 
- Bảo vệ API: JWT xác thực mọi endpoint Admin. Rate limiting: tối đa 1.000 request/phút/IP (Redis store). Helmet.js để set security headers (CSP, X-Frame-Options, X-XSS-Protection).
● OWASP Top 10: Parameterized queries (pg driver) chống SQL Injection. Sanitize input DOMPurify chống XSS. CSRF token cho form POST. CORS whitelist chỉ chấp nhận domain chính thức.
 
● Mã hóa dữ liệu: Mật khẩu băm bcrypt cost factor 12. Dữ liệu nhạy cảm (API keys) mã hóa AES-256-GCM trong CSDL. Không log thông tin nhạy cảm.
 
 
 
● Đánh giá an toàn: Quét OWASP ZAP và SonarQube trước khi release. Kiểm thử penetration định kỳ 6 tháng/lần. Dependency audit tự động trong CI/CD pipeline.
 
#  5.3 Yêu cầu độ tin cậy & khả dụng
 
● Uptime tối thiểu 99% (tương đương downtime tối đa 87,6 giờ/năm). Cửa sổ bảo trì định kỳ không tính vào downtime: mỗi tháng 1 lần, thứ Bảy 22:00–02:00.
 
● Backup dữ liệu: Full backup PostgreSQL tự động lúc 01:00 sáng hàng ngày bằng pg dump. Lưu backup xoay vòng 30 ngày (gần nhất) + 12 bản backup cuối tháng. Backup hình ảnh (MinIO) đồng bộ hàng tuần. Tất cả backup lưu ổ cứng ngoài hoặc NAS riêng biệt.
 
● Khôi phục thảm họa (Disaster Recovery): RTO (Recovery Time Objective) < 24 giờ, RPO (Recovery Point Objective) < 24 giờ (tính từ bản backup gần nhất).
 
● Giám sát hệ thống: Backend giám sát liên tục qua PM2 (Windows) hoặc systemd (Linux). Lỗi Critical tự động gửi email cảnh báo. Log rotate hàng ngày, lưu tối thiểu 90 ngày.
 
#  5.4 Yêu cầu khả năng mở rộng
 
● Kiến trúc container Docker + Docker Compose. Dễ dàng mở rộng horizontal (thêm backend instance sau load balancer Nginx) khi nhu cầu tăng.
 
● Codebase tổ chức theo feature-based modules. Frontend (React CRA) và Backend (Node.js/Express) tách biệt hoàn toàn giao tiếp qua REST API.
 
● Test coverage tối thiểu 70% cho business logic (Jest unit test + Supertest integration test).
 
● CI/CD pipeline: lint → test → build → deploy staging khi push code; deploy production khi merge vào main branch (GitHub Actions / GitLab CI).
 
● Tài liệu kỹ thuật: OpenAPI 3.0 spec tự sinh từ code. JSDoc comment inline chuẩn. README và CHANGELOG đầy đủ cho từng module.
 
##  5.5 Yêu cầu khả năng tương thích
 
● Trình duyệt: Chrome 110+, Firefox 110+, Edge 110+, Safari 15+. Không hỗ trợ Internet Explorer.
 
● Chuẩn dữ liệu sinh học: Darwin Core (DwC), ABCD 2.06, GGBN Data Standard, EML 2.2, FASTA format.
 
● Chuẩn GIS: OGC WMS 1.3.0, OGC WFS 2.0, GeoPackage, Shapefile (.shp), GeoTIFF, GeoJSON RFC 7946.
 
● Hệ tọa độ: Lưu trữ WGS84 (EPSG:4326); hỗ trợ hiển thị VN-2000 (EPSG:4756).
 
● Encoding: UTF-8 toàn bộ, đầy đủ ký tự Tiếng Việt có dấu và Latin mở rộng (tên khoa học côn trùng).
 
● Ngày tháng: ISO 8601 (YYYY-MM-DD) trong CSDL; lưu UTC, hiền thị UTC+7.
 
 
 
#  6. CÁC YÊU CÀU KHÁC
 
##  6.1 Yêu cầu về tài liệu (Documentation)
 
● Tài liệu hướng dẫn sử dụng bằng Tiếng Việt: đầy đủ cho vai trò Admin và User, kèm ảnh chụp màn hình và video demo tối thiểu 5 video (5–10 phút/video).
 
● Tài liệu hướng dẫn sử dụng bằng Tiếng Anh: dịch đầy đủ từ bản Tiếng Việt, thuật ngữ khoa học chính xác theo chuẩn quốc tế.
 
● Tài liệu kỹ thuật: kiến trúc hệ thống, ERD chuẩn hóa 3NF + Darwin Core mapping, OpenAPI 3.0 spec, hướng dẫn cài đặt Docker Compose từng bước.
 
● Tài liệu hướng dẫn xây dựng CSDL mẫu vật: định nghĩa chuẩn 22 trường, quy ước đặt mã mẫu (VD: VIN-[Tỉnh]-[Năm]-[Số thứ tự]), quy trình kiểm soát chất lượng dữ liệu.
 
##  6.2 Yêu cầu pháp lý & Tuân thủ
 
● Nghị định 73/2017/ND-CP về thu thập, quản lý, khai thác và sử dụng thông tin, dữ liệu tài nguyên và môi trường.
 
● Luật An toàn thông tin mạng 2015 (Luật số 86/2015/QH13) và các văn bản hướng dẫn thi hành.
 
● Nghị định 13/2023/ND-CP về bảo vệ dữ liệu cá nhân: thông tin người thu mẫu, người định loại được xử lý theo quy định.
 
● Nagoya Protocol (CBD 2010): khi chia sẻ dữ liệu di truyền ra quốc tế, gắn thông tin ABS (Access and Benefit Sharing) theo chuẩn GGBN Extension.
 
● Bản quyền dữ liệu: mỗi dataset được gắn license Creative Commons CC BY 4.0 mặc định cho dữ liệu Public; Admin có thể thay đổi sang CC BY-NC 4.0 hoặc CC BY-NC-ND 4.0.
 
##  6.3 Yêu cầu Quốc tế hóa
 
● i18n dựa trên react-i18next với file JSON (vi.json / en.json); dễ dàng thêm ngôn ngữ mới bằng cách thêm file JSON tương ứng.
 
● Ngày tháng lưu UTC trong CSDL, hiền thị UTC+7 (Hà Nội). Định dạng hiền thị tùy chỉnh theo locale (VD: 15/06/2025 cho VN, Jun 15, 2025, cho EN).
 
● Tọa độ lưu WGS84 (EPSG:4326); hỗ trợ chuyển đổi sang VN-2000 (EPSG:4756) khi hiển thị tại các trường GPS.
 
##  6.4 Yêu cầu Chuyển giao & Đào tạo
 
● Bàn giao: mã nguồn đầy đủ trên GitLab/GitHub, docker-compose.yml production-ready, script migration CSDL có thể chạy tự động, dữ liệu mẫu 100 mẫu vật để kiểm thử.
 
● Đào tạo trực tiếp: tối thiểu 2 ngày cho Admin (quản lý dữ liệu, cấu hình hệ thống, quy trình nhập liệu). Demo cho User (tìm kiếm, xem, xuất dữ liệu).
 
● Hỗ trợ kỹ thuật: 3 tháng sau bàn giao chính thức — sửa lỗi P1/P2 trong 48 giờ, tư vấn sử dụng và bổ sung chức năng nhỏ theo yêu cầu.
 
 
 
#  6.5 Ràng buộc thiết kế
 
● Frontend: React 19 + CRA 5 (craco), react-leaflet 5. State management: Zustand. Routing: React Router v6. HTTP client: Axios. Map: Leaflet + react-leaflet 5. Charts: Recharts.
 
● Backend: Node.js 20 LTS + Express 5. ORM/QueryBuilder: Knex.js. Validation: Joi. PDF: Puppeteer. File storage: MinIO SDK.
 
● CSDL chính: PostgreSQL 15 + extension PostGIS 3. Search: Elasticsearch 8. Cache/Session: Redis 7. File storage: MinIO (S3-compatible).
 
● AI Service: Python 3.11 + FastAPI + PyTorch (EfficientNet-B4) + MaxEnt wrapper. Container riêng biệt, giao tiếp qua HTTP nội bộ.
 
● Toàn bộ mã nguồn open source (MIT/Apache 2.0). Không sử dụng thư viện thương mại có phí license. Không phụ thuộc vào cloud nước ngoài cho chức năng cốt lõi.
 
