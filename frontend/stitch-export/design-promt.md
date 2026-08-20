VIỆN CÔNG NGHỆ THÔNG TIN — VAST
BỘ PROMPT THIẾT KẾ GIAO DIỆN (STITCH)
VietInsect BigData System — 30 màn hình
Bộ màu lấy cảm hứng thiên nhiên · Phong cách đơn giản – chuyên nghiệp
Dự án	VietInsect BigData System — Phần mềm số hóa côn trùng có giá trị tài nguyên
Phạm vi tài liệu	Prompt thiết kế 30 màn hình (SCR-01 → SCR-30) cho công cụ Stitch, kèm hướng dẫn sử dụng và thứ tự triển khai
Người phụ trách	Huyền Phương — Fullstack Developer (React + Node.js/Express, WebGIS)
Liên quan CV	CV1.2 (Kiến trúc), Danh sách 30 màn hình SRS v2.0
 
Mục lục
Mục lục	2
1. Hướng dẫn sử dụng để đạt hiệu quả cao nhất	4
1.1. Nguyên tắc chung	4
1.2. Quy trình thao tác từng bước	4
1.3. Lưu ý kỹ thuật khi chuyển từ Stitch sang code thật	4
2. Master Prompt — Design System (dùng cho màn hình đầu tiên)	5
3. Thứ tự sử dụng prompt (Roadmap thiết kế)	6
4. Toàn bộ Prompt chi tiết theo nhóm	8
I. Xác thực Admin	8
SCR-01 — Đăng nhập  (Admin Login)	8
SCR-02 — Đổi mật khẩu  (Change Password)	8
II. Dashboard & Tổng quan	8
SCR-03 — Dashboard Admin  (Admin Dashboard)	8
SCR-04 — Trang chủ công khai  (Public Home)	8
III. Quản lý Mẫu vật	9
SCR-05 — Danh sách mẫu vật  (Specimen List)	9
SCR-06 — Thêm mới mẫu vật  (Specimen Creation Form)	9
SCR-07 — Chỉnh sửa mẫu vật  (Specimen Edit Form)	10
SCR-08 — Chi tiết mẫu vật  (Specimen Detail)	10
SCR-09 — Nhập dữ liệu hàng loạt  (Bulk Import (Workbench))	10
SCR-10 — Chỉnh sửa hàng loạt  (Batch Edit)	10
SCR-11 — Định dạng và in nhãn  (Label Printing)	10
IV. Phân loại học & Hồ sơ loài	10
SCR-12 — Cây phân loại học  (Taxonomy Tree)	10
SCR-13 — Trang hồ sơ loài  (Species Profile Page)	10
SCR-14 — Quản lý danh pháp  (Taxon Editor)	11
V. Tìm kiếm & Khai thác dữ liệu	11
SCR-15 — Tìm kiếm mẫu vật  (Specimen Search)	11
SCR-16 — Tìm kiếm nâng cao  (Advanced Search)	11
SCR-17 — Thư viện hình ảnh  (Media Gallery)	11
VI. GIS & Bản đồ	11
SCR-18 — Bản đồ phân bố  (Occurrence Map)	11
SCR-19 — Quản lý lớp bản đồ  (Layer Manager)	12
VII. Dữ liệu DNA & GenBank	12
SCR-20 — Danh sách chuỗi DNA  (DNA Records List)	12
SCR-21 — Form Thêm/Sửa DNA  (DNA Entry & Edit Form)	12
SCR-22 — Chi tiết chuỗi FASTA  (DNA Detail / FASTA View)	12
VIII. AI & Phân tích mô hình	12
SCR-23 — Nhận dạng loài qua ảnh  (AI Species Identification)	12
SCR-24 — Dự báo phân bố (SDM)  (SDM Prediction Portal)	12
SCR-25 — Dashboard phân tích  (Analytics Dashboard)	13
IX. Báo cáo & Xuất dữ liệu	13
SCR-26 — Báo cáo danh lục & Thống kê  (Reports & Checklists)	13
SCR-27 — Báo cáo KPI số hóa  (Digitization KPI Report)	13
SCR-28 — Bộ dựng báo cáo tùy chỉnh  (Custom Report Builder)	13
X. Quản trị hệ thống	13
SCR-29 — Kiểm soát chia sẻ công khai  (Public/Private Control)	13
SCR-30 — Nhật ký & Cấu hình hệ thống  (System Audit Log & Config)	13
5. Bảng màu tham chiếu nhanh	14

 
1. Hướng dẫn sử dụng để đạt hiệu quả cao nhất
1.1. Nguyên tắc chung
●	Luôn dùng khối "Design Tokens" ở Mục 2 làm nền cho MỌI prompt — dán nguyên vào đầu mỗi prompt màn hình để Stitch không tự chọn màu khác qua từng lần tạo.
●	Thiết kế theo đúng THỨ TỰ NHÓM ở Mục 3, không nhảy ngẫu nhiên giữa các nhóm — giúp Stitch giữ ngữ cảnh phong cách trong cùng phiên làm việc.
●	Sau khi có 1 màn ưng ý trong 1 nhóm, dùng lệnh "Giữ đúng thiết kế hệ thống ở trên, chỉ thay nội dung" cho các màn còn lại cùng nhóm, thay vì mở phiên mới.
●	Không mô tả màu chung chung ("xanh lá", "vàng") — luôn dùng mã HEX chính xác như trong từng prompt.
●	Sau khi Stitch xuất kết quả, đối chiếu lại với cột "Chức năng chính" trong Danh_sách_màn_hình_dự_kiến.md để đảm bảo không thiếu thành phần (đặc biệt các badge trạng thái Public/Private, IUCN).
1.2. Quy trình thao tác từng bước
●	Bước 1 — Mở phiên Stitch mới, dán MASTER PROMPT (Mục 2) làm tin nhắn đầu tiên. Đây là bước bắt buộc, không bỏ qua.
●	Bước 2 — Chọn 1 màn hình đại diện dễ định hình phong cách nhất để làm "neo" (khuyến nghị: SCR-03 Admin Dashboard hoặc SCR-04 Public Home) và tạo trước.
●	Bước 3 — Xác nhận Stitch đã bám đúng bảng màu & bo góc & shadow mong muốn. Nếu lệch, chỉnh sửa ngay tại đây trước khi sang màn tiếp theo.
●	Bước 4 — Lần lượt dán từng prompt trong CÙNG một nhóm chức năng (theo Mục 3), giữ nguyên phiên chat để Stitch kế thừa phong cách.
●	Bước 5 — Hết 1 nhóm, có thể mở phiên mới cho nhóm kế tiếp nếu phiên cũ quá dài/chậm, nhưng luôn dán lại MASTER PROMPT ở đầu phiên mới.
●	Bước 6 — Sau khi đủ 30 màn, xuất toàn bộ và đối chiếu với Cây_thư_mục_dự_án.md để gắn đúng tên component khi hiện thực hóa bằng React + Bootstrap 5.
1.3. Lưu ý kỹ thuật khi chuyển từ Stitch sang code thật
●	Frontend dùng Bootstrap 5 + react-bootstrap (không phải Tailwind) — sau khi có thiết kế Stitch, cần map lại token màu (bản đậm) vào file SCSS override của Bootstrap: $primary: #2E7D32; $secondary: #0F3820; $danger: #B0241A; $warning: #9C7A1F; $light: #F3F7EE; $body-color: #0E2419;
●	Hiệu ứng gooey/pixel-trail ở SCR-04 nên tách thành component riêng HomeMapHero.js / hiệu ứng hover dùng SVG filter (feTurbulence/feDisplacementMap) hoặc canvas — không nhờ Stitch sinh code, chỉ lấy ý tưởng hình ảnh.
●	Bảng dữ liệu lớn (SCR-05, SCR-15, SCR-20) nên giữ thiết kế đơn giản, ít hiệu ứng động để không ảnh hưởng hiệu năng khi render nhiều dòng (khớp yêu cầu P95 < 2s trong SRS).
●	Bản đồ ở SCR-04 dùng lại component BaseMap.js/OccurrenceLayer.js/PopupCard.js đã có sẵn, chỉ bọc thêm 1 wrapper riêng (HomeMapHero.js) — không viết lại logic bản đồ.
●	Bản đồ SCR-04 nên render GeoJSON ranh giới Việt Nam bằng L.geoJSON() KHÔNG kèm TileLayer nền (bỏ hẳn OSM/Google tile), để chỉ hiện đúng hình Việt Nam, nhẹ hơn và tránh vấn đề biên giới tranh chấp trên bản đồ nước ngoài. SCR-18 (Occurrence Map) vẫn giữ tile nền thật vì là công cụ phân tích chuyên sâu.
 
2. Master Prompt — Design System (dùng cho màn hình đầu tiên)
Dán khối này làm tin nhắn đầu tiên trong phiên Stitch, trước khi tạo bất kỳ màn hình nào. Toàn bộ 30 prompt bên dưới đều giả định phần "[DESIGN TOKENS]" tham chiếu đúng khối này.
Thiết kế hệ thống giao diện web quản lý dữ liệu lớn về côn trùng Việt Nam (VietInsect BigData System), phong cách đơn giản, chuyên nghiệp, khoa học, lấy cảm hứng thiên nhiên nhưng KHÔNG sến, KHÔNG hoạt hình trẻ con — hướng tới người dùng là nhà khoa học, cán bộ viện nghiên cứu.
 
DESIGN TOKENS — PHIÊN BẢN MÀU ĐẬM (áp dụng nhất quán toàn hệ thống):
- Nền chính: #F3F7EE (trắng ngà, ngả xanh nhẹ hơn bản gốc)
- Nền phụ / card: #DCE8D2 (xanh rêu nhạt đậm hơn — tương phản rõ hơn với nền chính)
- Văn bản chính & tiêu đề: #0E2419 (xanh rêu rất thẫm, gần đen)
- Màu thương hiệu / primary (header, icon, link, viền active): #2E7D32 (xanh lá đậm, bão hòa cao — bớt "tươi/pastel", nghiêng về forest green)
- Màu nút bấm chính / footer: #0F3820 (xanh lá rất đậm, gần đen — tăng độ tương phản với chữ trắng)
- Accent cảnh báo/CTA/error: #B0241A (đỏ trầm, đậm hơn đỏ bọ rùa gốc — bớt sặc sỡ, giữ cảm giác nghiêm túc khoa học)
- Accent nhấn nhá/tag/hover: #9C7A1F (vàng đất đậm, ngả nâu — bớt vàng chanh, sang trọng hơn)
- Tỷ lệ 60-30-10: nền 60%, xanh lá 30%, đỏ/vàng 10%
- Lưu ý khi dùng bản đậm này: vì nền phụ #DCE8D2 và primary #2E7D32 đã tối hơn, luôn kiểm tra lại tương phản chữ/nền theo WCAG 2.1 AA; chữ trên nền primary/secondary dùng trắng #FFFFFF thay vì #0E2419.
 
Typography: font sans-serif hiện đại, dễ đọc dữ liệu khoa học (kiểu Inter/Manrope), tiêu đề đậm, cỡ chữ rõ ràng phân cấp H1/H2/body/caption. Hỗ trợ tiếng Việt có dấu.
 
Bo góc: 8–12px cho card/button (mềm mại vừa phải, không bo tròn quá mức).
Shadow: rất nhẹ (soft shadow), tránh đổ bóng nặng.
Icon style: outline, mảnh, đơn sắc theo primary color, chủ đề côn trùng/lá cây/bản đồ tinh tế.
Component chuẩn cần thiết kế mẫu: Button (primary/secondary/danger/ghost), Input, Badge trạng thái (Public màu xanh lá / Private màu xám / IUCN LC-NT-VU-EN-CR theo thang màu vàng→đỏ), Toast (success xanh, error đỏ, warning vàng), Sidebar Admin, Topbar với toggle ngôn ngữ VI/EN và Dark/Light mode.
 
Hiệu ứng tương tác: hover mượt (transition 150–200ms), nút primary khi hover chuyển sang tông đậm hơn (#0F3820) hoặc viền vàng đất (#9C7A1F), không dùng hiệu ứng "gimmick" gây rối mắt cho màn hình dữ liệu (bảng, danh sách).
 
Yêu cầu bổ sung: responsive desktop (≥1280px) và tablet (≥768px), đạt chuẩn tương phản WCAG 2.1 AA (chữ trên nền #F3F7EE/#DCE8D2 phải đủ độ tương phản, dùng #0E2419 chứ không dùng xám nhạt).
 
3. Thứ tự sử dụng prompt (Roadmap thiết kế)
Thứ tự dưới đây tối ưu để Stitch giữ nhất quán phong cách theo từng cụm chức năng liên quan, đồng thời khớp với thứ tự kỹ thuật triển khai thực tế của dự án (Auth → Dashboard → Taxonomy → Specimen → Search → GIS → DNA → AI → Report → Admin).
STT	Mã màn hình	Tên màn hình
I. Xác thực Admin
1	SCR-01	Đăng nhập  (Admin Login)
2	SCR-02	Đổi mật khẩu  (Change Password)
II. Dashboard & Tổng quan
3	SCR-03	Dashboard Admin  (Admin Dashboard)
4	SCR-04	Trang chủ công khai  (Public Home)
III. Quản lý Mẫu vật
5	SCR-05	Danh sách mẫu vật  (Specimen List)
6	SCR-06	Thêm mới mẫu vật  (Specimen Creation Form)
7	SCR-07	Chỉnh sửa mẫu vật  (Specimen Edit Form)
8	SCR-08	Chi tiết mẫu vật  (Specimen Detail)
9	SCR-09	Nhập dữ liệu hàng loạt  (Bulk Import (Workbench))
10	SCR-10	Chỉnh sửa hàng loạt  (Batch Edit)
11	SCR-11	Định dạng và in nhãn  (Label Printing)
IV. Phân loại học & Hồ sơ loài
12	SCR-12	Cây phân loại học  (Taxonomy Tree)
13	SCR-13	Trang hồ sơ loài  (Species Profile Page)
14	SCR-14	Quản lý danh pháp  (Taxon Editor)
V. Tìm kiếm & Khai thác dữ liệu
15	SCR-15	Tìm kiếm mẫu vật  (Specimen Search)
16	SCR-16	Tìm kiếm nâng cao  (Advanced Search)
17	SCR-17	Thư viện hình ảnh  (Media Gallery)
VI. GIS & Bản đồ
18	SCR-18	Bản đồ phân bố  (Occurrence Map)
19	SCR-19	Quản lý lớp bản đồ  (Layer Manager)
VII. Dữ liệu DNA & GenBank
20	SCR-20	Danh sách chuỗi DNA  (DNA Records List)
21	SCR-21	Form Thêm/Sửa DNA  (DNA Entry & Edit Form)
22	SCR-22	Chi tiết chuỗi FASTA  (DNA Detail / FASTA View)
VIII. AI & Phân tích mô hình
23	SCR-23	Nhận dạng loài qua ảnh  (AI Species Identification)
24	SCR-24	Dự báo phân bố (SDM)  (SDM Prediction Portal)
25	SCR-25	Dashboard phân tích  (Analytics Dashboard)
IX. Báo cáo & Xuất dữ liệu
26	SCR-26	Báo cáo danh lục & Thống kê  (Reports & Checklists)
27	SCR-27	Báo cáo KPI số hóa  (Digitization KPI Report)
28	SCR-28	Bộ dựng báo cáo tùy chỉnh  (Custom Report Builder)
X. Quản trị hệ thống
29	SCR-29	Kiểm soát chia sẻ công khai  (Public/Private Control)
30	SCR-30	Nhật ký & Cấu hình hệ thống  (System Audit Log & Config)
 
4. Toàn bộ Prompt chi tiết theo nhóm
I. Xác thực Admin
SCR-01 — Đăng nhập  (Admin Login)
Nhóm: I. Xác thực Admin
[DESIGN TOKENS]
Thiết kế màn hình Đăng nhập Admin (Admin Login), layout split-screen: bên trái 40% là hình minh họa côn trùng/thiên nhiên dạng illustration line-art màu #2E7D32 trên nền #DCE8D2 kèm slogan "VietInsect BigData System"; bên phải 60% là form đăng nhập trên nền #F3F7EE: logo Viện CNTT/VAST phía trên, input Username, input Password (có icon show/hide), nút "Đăng nhập" nền #0F3820 chữ trắng full-width, dòng chữ nhỏ "Khóa tài khoản sau 5 lần nhập sai", link đổi ngôn ngữ VI/EN góc trên phải. Thiết kế thêm trạng thái lỗi: input viền đỏ #B0241A kèm message lỗi nhỏ bên dưới.
SCR-02 — Đổi mật khẩu  (Change Password)
Nhóm: I. Xác thực Admin
[DESIGN TOKENS]
Thiết kế màn hình Đổi mật khẩu trong AdminLayout (có sidebar + topbar), nội dung là 1 card căn giữa nền #DCE8D2: 3 input (mật khẩu cũ, mật khẩu mới, xác nhận mật khẩu), thanh đánh giá độ mạnh mật khẩu (yếu-đỏ #B0241A / trung bình-vàng #9C7A1F / mạnh-xanh #2E7D32), checklist yêu cầu mật khẩu (≥12 ký tự, hoa/thường/số/ký tự đặc biệt) với dấu tick xanh khi đạt, nút "Cập nhật" màu #0F3820.
II. Dashboard & Tổng quan
SCR-03 — Dashboard Admin  (Admin Dashboard)
Nhóm: II. Dashboard & Tổng quan
[DESIGN TOKENS]
Thiết kế Admin Dashboard trong AdminLayout: hàng trên 4 stat card (Tổng mẫu vật / Tổng loài / Tổng ảnh / Tổng chuỗi DNA) nền #DCE8D2, số liệu lớn màu #0E2419, icon nhỏ màu #2E7D32, mũi tên tăng/giảm xanh/đỏ. Bên dưới chia 2 cột: cột trái Treemap phân loại theo bộ côn trùng (màu theo gradient từ #2E7D32 đến #9C7A1F), cột phải Minimap Leaflet nền nhạt hiển thị điểm phân bố theo tỉnh với marker màu #2E7D32, đậm nhạt theo mật độ. Cuối trang: thanh tiến độ số hóa (progress bar #0F3820) và banner cảnh báo dữ liệu bất thường nền vàng nhạt viền #9C7A1F.
SCR-04 — Trang chủ công khai  (Public Home)
Nhóm: II. Dashboard & Tổng quan
[DESIGN TOKENS ở Master Prompt]
 
Thiết kế Trang chủ công khai (Public Home, layout không sidebar, chỉ header đơn giản không nút đăng nhập), tham khảo tinh thần bố cục của GBIF.org, iDigBio.org và Specify 7 demo — nhưng dùng đúng bảng màu thiên nhiên đã định nghĩa, KHÔNG dùng màu xanh dương/cam mặc định của GBIF.
 
BỐ CỤC:
1. Header trong suốt nổi trên bản đồ: logo VietInsect bên trái, menu (Trang chủ/Tìm kiếm/Bản đồ/Giới thiệu) ở giữa, toggle ngôn ngữ VI/EN bên phải. Không có nút đăng nhập hiển thị.
 
2. HERO SECTION = BẢN ĐỒ VIỆT NAM MINH HỌA (KHÔNG có nước khác, KHÔNG dùng bản đồ thế giới):
   - Chỉ hiển thị hình dạng lãnh thổ Việt Nam dạng silhouette/illustration phẳng (flat map), tách biệt hoàn toàn khỏi các quốc gia lân cận — toàn bộ vùng xung quanh hình Việt Nam là nền trơn màu #F3F7EE hoặc #DCE8D2, KHÔNG có tile bản đồ nền, KHÔNG có đường biên giới/tên nước khác, biển để màu xanh rất nhạt đơn sắc hoặc đồng màu nền.
   - Hình dạng Việt Nam tô màu nền #DCE8D2 với viền mảnh #2E7D32, ranh giới 34 tỉnh/thành hiển thị bằng đường kẻ mảnh màu trắng hoặc xám nhạt bên trong.
   - Trên hình Việt Nam: các chấm/cụm (cluster) thể hiện mẫu vật côn trùng theo tỉnh, kích thước tỷ lệ số lượng, màu gradient từ vàng đất #9C7A1F (ít) đến xanh lá đậm #0F3820 (nhiều) — cơ chế density map giống GBIF nhưng đổi khung nền thành bản đồ Việt Nam riêng biệt.
   - Bố cục: hình Việt Nam đặt lệch phải hoặc căn giữa trong khung hero, chiều cao chiếm khoảng 70-80% chiều cao hero section (dạng dọc, vì lãnh thổ VN dài theo hướng Bắc-Nam). Bên trái/phía trên hình bản đồ là khối tiêu đề "VietInsect BigData System" + thanh tìm kiếm nổi, để cân bằng bố cục với hình bản đồ dọc.
   - Overlay mờ nhẹ phía trên bản đồ (gradient từ #0E2419 đậm ở top xuống trong suốt) để chữ tiêu đề dễ đọc.
   - Thanh tìm kiếm nhanh nổi bật, đặt lơ lửng (floating search bar): input bo góc lớn, nền trắng đục (glassmorphism nhẹ), icon kính lúp, nút tìm kiếm #2E7D32, gõ tên loài/địa danh có gợi ý autocomplete xổ xuống.
   - Góc dưới trái bản đồ: legend nhỏ giải thích thang màu mật độ, nền trắng đục.
   - Góc dưới phải bản đồ: nhóm nút zoom +/- và nút "Xem bản đồ đầy đủ" dẫn sang SCR-18.
   - Toggle nhỏ trên bản đồ để chuyển giữa 2 chế độ hiển thị: "Điểm mẫu" (point) / "Mật độ" (heatmap) — dạng segmented control nhỏ góc trên phải bản đồ.
 
3. Ngay dưới bản đồ: dải 3 số liệu thống kê dạng counter lớn nằm trên thanh nền #0F3820 chữ trắng, đè nhẹ lên viền dưới bản đồ (Số loài / Số mẫu vật / Số tỉnh có dữ liệu).
 
4. Section tiếp theo (nền #F3F7EE): banner ảnh côn trùng nổi bật dạng carousel/grid 4 ảnh, mỗi ảnh có overlay tên loài khi hover.
 
5. Section giới thiệu ngắn về hệ thống, 3 cột icon (Số hóa mẫu vật / Chuẩn Darwin Core-GBIF / AI nhận dạng loài) màu icon #2E7D32.
 
6. Footer nền #0F3820 chữ trắng: thông tin Viện CNTT/VAST, liên kết nhanh, logo đối tác GBIF/BOLD.
 
HIỆU ỨNG:
- Hiệu ứng gooey/pixel-trail (mô tả riêng, sẽ lập trình bằng SVG filter/canvas): áp dụng cho vùng NGOÀI bản đồ — ví dụ khi rê chuột qua tiêu đề hoặc vùng banner ảnh, không áp lên chính bản đồ để tránh xung đột thao tác pan/zoom.
- Marker/cluster trên bản đồ có hiệu ứng pulse nhẹ khi hover, popup nhanh hiện ảnh thumbnail + tên loài + nút "Xem chi tiết" khi click.
- Bản đồ load với hiệu ứng fade-in mượt, cluster "nở" dần khi trang load xong.
Lưu ý: Đây là bản prompt ĐÃ CẬP NHẬT — chỉ dùng bản đồ Việt Nam riêng biệt, không hiển thị các nước khác. Thay thế hoàn toàn bản mô tả bản đồ toàn cầu kiểu GBIF ban đầu.
III. Quản lý Mẫu vật
SCR-05 — Danh sách mẫu vật  (Specimen List)
Nhóm: III. Quản lý Mẫu vật
[DESIGN TOKENS]
Thiết kế bảng danh sách mẫu vật (Specimen List) trong AdminLayout: toolbar trên cùng gồm ô search, nút "Chọn cột" (ColumnPicker dropdown), nút "Thêm mới" nền #0F3820, nút "Xuất dữ liệu" viền #2E7D32. Bảng dữ liệu (DataTable) nền trắng #F3F7EE, header bảng nền #DCE8D2 chữ #0E2419, checkbox chọn dòng, cột trạng thái Public/Private hiển thị Badge (Public nền xanh nhạt chữ #0F3820, Private nền xám). Phân trang cuối bảng dạng số trang, 50 dòng/trang. Hàng hover đổi nền nhạt #DCE8D2.
SCR-06 — Thêm mới mẫu vật  (Specimen Creation Form)
Nhóm: III. Quản lý Mẫu vật
[DESIGN TOKENS]
Thiết kế form Thêm mới mẫu vật, layout 2 cột trong 1 card lớn: cột trái các trường text/số/dropdown (chia nhóm rõ bằng section header nhỏ màu #2E7D32: "Thông tin định danh", "Thông tin thu mẫu", "Vị trí"), cột phải là mini-map Leaflet để chọn GPS (marker kéo thả) và ô upload ảnh dạng drag-and-drop viền nét đứt #2E7D32. Input có validation inline: viền đỏ #B0241A + text lỗi nhỏ khi sai. Cuối form: nút "Lưu" #0F3820 và "Hủy" dạng ghost viền xám.
SCR-07 — Chỉnh sửa mẫu vật  (Specimen Edit Form)
Nhóm: III. Quản lý Mẫu vật
[DESIGN TOKENS]
Thiết kế form Chỉnh sửa mẫu vật, tương tự SCR-06 nhưng thêm: banner nhỏ trên cùng "Đang chỉnh sửa mẫu VIN-HN-2025-0012" nền #DCE8D2, tab phụ "Lịch sử thay đổi" cạnh form hiển thị timeline dọc (chấm tròn #2E7D32, đường nối, mỗi mục ghi ai/khi nào/trường nào đổi). Nút "Xóa mềm" viền đỏ #B0241A đặt tách biệt góc dưới trái để tránh nhấn nhầm.
SCR-08 — Chi tiết mẫu vật  (Specimen Detail)
Nhóm: III. Quản lý Mẫu vật
[DESIGN TOKENS]
Thiết kế trang Chi tiết mẫu vật: header lớn tên khoa học in nghiêng màu #0E2419 kèm Badge IUCN màu theo mức độ, dưới là slideshow ảnh (khung bo góc, nút điều hướng tròn #2E7D32), bên phải thông tin dạng grid 2 cột nhãn/giá trị trên nền #DCE8D2, danh sách chuỗi DNA liên kết dạng card nhỏ có icon DNA. Với vai trò Admin: hiện nút "Sửa/Xóa/In nhãn" nổi góc trên phải; với vai trò User: các nút này ẩn, chỉ hiện nút "Xuất dữ liệu Public".
SCR-09 — Nhập dữ liệu hàng loạt  (Bulk Import (Workbench))
Nhóm: III. Quản lý Mẫu vật
[DESIGN TOKENS]
Thiết kế màn hình Nhập dữ liệu hàng loạt dạng wizard 4 bước (stepper ngang trên cùng, bước hiện tại tô #2E7D32, bước đã xong có dấu tick, bước chưa tới màu xám nhạt): Bước 1 tải template, Bước 2 upload file (dropzone lớn), Bước 3 map cột (giao diện 2 cột kéo thả nối bằng đường line), Bước 4 preview bảng dữ liệu với ô lỗi tô nền đỏ nhạt, ô cảnh báo tô nền vàng nhạt #9C7A1F, thanh tiến độ import realtime dạng progress bar.
SCR-10 — Chỉnh sửa hàng loạt  (Batch Edit)
Nhóm: III. Quản lý Mẫu vật
[DESIGN TOKENS]
Thiết kế màn hình Chỉnh sửa hàng loạt: bảng danh sách mẫu đã chọn (checkbox tick sẵn) phía trên, panel dưới dạng card nổi (giống modal dính đáy màn hình) gồm dropdown "Chọn trường cần sửa" → input giá trị mới → bảng preview số bản ghi ảnh hưởng → nút "Áp dụng" #0F3820 kèm nút hủy.
SCR-11 — Định dạng và in nhãn  (Label Printing)
Nhóm: III. Quản lý Mẫu vật
[DESIGN TOKENS]
Thiết kế màn hình In nhãn mẫu vật: bên trái panel cấu hình (chọn template nhãn, font, kích thước, dạng radio/dropdown), bên phải là khung xem trước nhãn in (LabelCanvas) dạng thẻ nhỏ trắng có viền, hiển thị mã QR góc trái, tên khoa học, mã mẫu — mô phỏng đúng layout sẽ in trên giấy. Nút "Xuất PDF hàng loạt" #0F3820 cố định góc dưới phải.
IV. Phân loại học & Hồ sơ loài
SCR-12 — Cây phân loại học  (Taxonomy Tree)
Nhóm: IV. Phân loại học & Hồ sơ loài
[DESIGN TOKENS]
Thiết kế Cây phân loại học dạng interactive tree view: mỗi node có icon mở/thu gọn (chevron #2E7D32), tên khoa học in nghiêng, badge nhỏ hiển thị số mẫu vật bên phải mỗi node nền #DCE8D2. Thanh tìm kiếm nhanh phía trên tree với gợi ý autocomplete. Node đang được chọn có nền highlight vàng nhạt #9C7A1F.
SCR-13 — Trang hồ sơ loài  (Species Profile Page)
Nhóm: IV. Phân loại học & Hồ sơ loài
[DESIGN TOKENS]
Thiết kế Trang hồ sơ loài: header lớn ảnh loài full-width mờ dưới overlay gradient tối, tên khoa học + tên thường nổi bật màu trắng. Bên dưới là tab ngang (Hình thái & Sinh thái / Mẫu vật / DNA / Hoạt tính / Phân bố) tab active có gạch chân #2E7D32. Panel phải cố định (sticky) chứa widget AI nhận dạng thu nhỏ và widget SDM thu nhỏ, cùng các chip liên kết GBIF/BOLD/ITIS/COL/IUCN dạng badge tròn nhỏ.
SCR-14 — Quản lý danh pháp  (Taxon Editor)
Nhóm: IV. Phân loại học & Hồ sơ loài
[DESIGN TOKENS]
Thiết kế màn hình Quản lý danh pháp: layout 2 cột — trái là danh sách taxon dạng cây thu gọn để chọn, phải là form CRUD (tên khoa học, tác giả, năm công bố, tên thường VI/EN) kèm ô kết quả xác thực từ Catalogue of Life API hiển thị dạng thẻ nhỏ (khớp = viền xanh #2E7D32, không khớp = viền đỏ #B0241A gợi ý sửa chính tả). Bảng quản lý đồng danh pháp (synonym) bên dưới dạng table 2 cột accepted/synonym.
V. Tìm kiếm & Khai thác dữ liệu
SCR-15 — Tìm kiếm mẫu vật  (Specimen Search)
Nhóm: V. Tìm kiếm & Khai thác
[DESIGN TOKENS]
Thiết kế màn hình Tìm kiếm mẫu vật: sidebar trái là Facet Panel (accordion 8 nhóm lọc: Taxon, Tỉnh, Năm dạng slider, Loại media checkbox, IUCN, Độ cao slider, Người thu autocomplete, Có GPS toggle) — mỗi lựa chọn hiện số lượng bản ghi bên cạnh. Trên cùng khu vực kết quả là ViewSwitcher 5 icon (List/Label/Gallery/Map/Treemap) dạng segmented control nền #DCE8D2. Chip "Active Filters" hiển thị dưới thanh search, mỗi chip có nút x để xóa, màu nền vàng nhạt #9C7A1F.
SCR-16 — Tìm kiếm nâng cao  (Advanced Search)
Nhóm: V. Tìm kiếm & Khai thác
[DESIGN TOKENS]
Thiết kế Query Builder trực quan: các dòng điều kiện có thể thêm/xóa, mỗi dòng gồm dropdown trường + dropdown toán tử + input giá trị + nút xóa (icon đỏ), dòng nối nhau bằng label AND/OR/NOT dạng pill màu #2E7D32 có thể click đổi. Cuối form: ô lưu bộ lọc với tên, danh sách bộ lọc đã lưu dạng list bên phải. Với Admin: thêm khung "SQL trực tiếp" dạng code editor nền tối #0E2419 chữ sáng.
SCR-17 — Thư viện hình ảnh  (Media Gallery)
Nhóm: V. Tìm kiếm & Khai thác
[DESIGN TOKENS]
Thiết kế Thư viện hình ảnh dạng grid masonry, ảnh bo góc nhẹ, hover hiện overlay tối mờ với tên loài + icon phóng to. Panel lọc trái đơn giản (taxon/tỉnh/năm dạng dropdown gọn). Lightbox xem ảnh lớn: nền đen mờ, ảnh giữa màn hình, thanh metadata dưới ảnh nền #0E2419 chữ trắng.
VI. GIS & Bản đồ
SCR-18 — Bản đồ phân bố  (Occurrence Map)
Nhóm: VI. GIS & Bản đồ
[DESIGN TOKENS]
Thiết kế Bản đồ phân bố full-screen (Leaflet): toolbar nổi góc trên trái (toggle Heatmap, chuyển lớp nền, vẽ polygon) dạng nhóm nút bo góc nền trắng đục shadow nhẹ. Marker các điểm mẫu màu phân biệt theo bộ côn trùng (dùng bảng màu phụ trợ xoay quanh #2E7D32/#9C7A1F/#0F3820, không dùng đỏ để tránh nhầm cảnh báo), legend cố định góc dưới trái nền trắng đục. Popup thông tin nhanh khi click marker: card nhỏ có ảnh thumbnail, tên khoa học, nút "Xem chi tiết".
Lưu ý: Màn hình này VẪN dùng tile bản đồ nền thật (Google/OSM) vì là công cụ phân tích chuyên sâu cần bối cảnh địa lý xung quanh — khác với bản đồ Việt Nam riêng biệt ở SCR-04.
SCR-19 — Quản lý lớp bản đồ  (Layer Manager)
Nhóm: VI. GIS & Bản đồ
[DESIGN TOKENS]
Thiết kế Quản lý lớp bản đồ: sidebar trái danh sách lớp dạng list kéo-thả sắp xếp (drag handle icon), mỗi item có toggle bật/tắt, color swatch chọn màu style, icon xóa. Khu vực phải là bản đồ preview lớn hiển thị lớp đang chọn. Modal upload lớp mới: dropzone cho Shapefile/GeoJSON/GeoTIFF với icon định dạng file tương ứng.
VII. Dữ liệu DNA & GenBank
SCR-20 — Danh sách chuỗi DNA  (DNA Records List)
Nhóm: VII. Dữ liệu DNA & GenBank
[DESIGN TOKENS]
Thiết kế bảng danh sách chuỗi DNA: cột gen marker hiển thị Badge nhỏ màu #2E7D32 (COI/16S rRNA/ITS2...), cột mã Accession dạng link màu #0F3820 gạch chân khi hover, cột liên kết NCBI/BOLD hiển thị icon nhỏ ngoài link. Bộ lọc trên cùng dạng thanh ngang gọn.
SCR-21 — Form Thêm/Sửa DNA  (DNA Entry & Edit Form)
Nhóm: VII. Dữ liệu DNA & GenBank
[DESIGN TOKENS]
Thiết kế Form thêm/sửa DNA: input mã Accession GenBank có icon loading khi đang fetch NCBI, sau khi fetch thành công hiện card preview metadata (tên loài, độ dài trình tự, ngày đăng, tác giả) nền #DCE8D2 viền trái đậm #2E7D32 như một "thông báo thành công". Các trường primer, ghi chú bên dưới dạng form thường.
SCR-22 — Chi tiết chuỗi FASTA  (DNA Detail / FASTA View)
Nhóm: VII. Dữ liệu DNA & GenBank
[DESIGN TOKENS]
Thiết kế trang xem chuỗi FASTA: khung hiển thị nucleotide dạng monospace font trên nền tối #0E2419 chữ sáng (giống code viewer) để dễ đọc chuỗi dài, nút "Copy" và "Download .fasta" nổi góc trên phải khung. Panel metadata bên cạnh dạng list nhãn/giá trị, cuối trang 2 nút liên kết ngoài NCBI/BOLD dạng button outline.
VIII. AI & Phân tích mô hình
SCR-23 — Nhận dạng loài qua ảnh  (AI Species Identification)
Nhóm: VIII. AI & Phân tích mô hình
[DESIGN TOKENS]
Thiết kế màn hình Nhận dạng loài qua ảnh: khu vực upload lớn ở giữa (dropzone viền nét đứt #2E7D32, icon camera/upload), sau khi tải ảnh hiện kết quả top-5 dạng list card ngang: ảnh loài tham khảo nhỏ bên trái, tên khoa học, thanh phần trăm xác suất (progress bar màu gradient #2E7D32→#9C7A1F theo % giảm dần), nút "Xác nhận gắn vào mẫu vật" ở dòng có xác suất cao nhất.
SCR-24 — Dự báo phân bố (SDM)  (SDM Prediction Portal)
Nhóm: VIII. AI & Phân tích mô hình
[DESIGN TOKENS]
Thiết kế màn hình Dự báo phân bố (SDM): panel trái chọn loài + checkbox chọn biến khí hậu (WorldClim/CHELSA) dạng danh sách cuộn có scrollbar mảnh, nút "Chạy mô hình" #0F3820 kèm icon loading khi đang xử lý. Panel phải là bản đồ kết quả dạng raster overlay (gradient nhiệt từ vàng nhạt #9C7A1F đến xanh đậm #0F3820 thể hiện xác suất phân bố), thanh legend gradient bên dưới bản đồ, nút download PNG/GeoTIFF.
SCR-25 — Dashboard phân tích  (Analytics Dashboard)
Nhóm: VIII. AI & Phân tích mô hình
[DESIGN TOKENS]
Thiết kế Dashboard phân tích dữ liệu: lưới 4 biểu đồ — line chart xu hướng số hóa (đường màu #2E7D32), donut chart độ phủ dữ liệu (4 màu trong bảng màu chính), bar chart phân bố theo taxon (cột màu #0F3820), choropleth mini theo tỉnh (gradient xanh). Bộ lọc thời gian dạng segmented control (7 ngày/30 ngày/12 tháng/tùy chọn) góc trên phải.
IX. Báo cáo & Xuất dữ liệu
SCR-26 — Báo cáo danh lục & Thống kê  (Reports & Checklists)
Nhóm: IX. Báo cáo & Xuất dữ liệu
[DESIGN TOKENS]
Thiết kế màn hình Báo cáo danh lục & Thống kê: danh sách các loại báo cáo dạng card lớn có icon minh họa, mỗi card có nút "Xuất" và dropdown chọn định dạng (PDF/Excel). Khung xem trước PDF bên phải mô phỏng trang giấy A4 trắng có header Quốc hiệu + tên Viện, watermark mờ chữ "VietInsect" chéo góc, footer ngày giờ + số trang.
SCR-27 — Báo cáo KPI số hóa  (Digitization KPI Report)
Nhóm: IX. Báo cáo & Xuất dữ liệu
[DESIGN TOKENS]
Thiết kế Báo cáo KPI số hóa: bảng tổng hợp theo tháng (table với dòng tổng in đậm nền #DCE8D2), line chart xu hướng phía trên bảng, bộ lọc khoảng thời gian dạng date range picker gọn góc trên phải, nút "Xuất Excel" #0F3820.
SCR-28 — Bộ dựng báo cáo tùy chỉnh  (Custom Report Builder)
Nhóm: IX. Báo cáo & Xuất dữ liệu
[DESIGN TOKENS]
Thiết kế Bộ dựng báo cáo tùy chỉnh: 2 cột kéo-thả — cột trái danh sách trường dữ liệu có sẵn (item dạng chip có icon kéo), cột phải khu vực thả trường đã chọn (dashed border khi rỗng, hiện placeholder "Kéo trường vào đây"), bảng preview kết quả bên dưới cập nhật realtime.
X. Quản trị hệ thống
SCR-29 — Kiểm soát chia sẻ công khai  (Public/Private Control)
Nhóm: X. Quản trị hệ thống
[DESIGN TOKENS]
Thiết kế màn hình Kiểm soát chia sẻ công khai: bảng danh sách bản ghi với cột cuối là Toggle Switch lớn (on = nền #2E7D32 nhãn "Public", off = nền xám nhãn "Private"), checkbox chọn hàng loạt + nút "Cập nhật hàng loạt" nổi lên khi có chọn (dạng thanh floating action bar phía dưới màn hình nền #0F3820). Nút "Xem trước giao diện User" mở modal preview.
SCR-30 — Nhật ký & Cấu hình hệ thống  (System Audit Log & Config)
Nhóm: X. Quản trị hệ thống
[DESIGN TOKENS]
Thiết kế màn hình 2-trong-1 dạng tab: Tab "Nhật ký hệ thống" — bảng log dạng timeline compact (icon loại thao tác, thời gian, tài khoản, IP), bộ lọc trên cùng. Tab "Cấu hình hệ thống" — form chia section rõ ràng (SMTP, Google Maps API key, Danh mục dropdown, Backup schedule, Logo Viện) mỗi section trong 1 card riêng nền #DCE8D2, phần API key có input dạng password che (dấu chấm) kèm icon con mắt.
 
5. Bảng màu tham chiếu nhanh (PHIÊN BẢN ĐẬM)
Vai trò	Mã màu cũ (nhạt)	Mã màu mới (đậm)	Ghi chú sử dụng
Nền chính (60%)	#F8FAF6	#F3F7EE	Trắng ngà ngả xanh — nền toàn trang
Nền phụ / card	#EEF4E9	#DCE8D2	Xanh rêu nhạt đậm hơn — section phụ, thẻ
Văn bản chính	#133120	#0E2419	Xanh rêu gần đen — heading & body
Primary (30%)	#4B9B42	#2E7D32	Xanh lá đậm bão hòa — header, icon, link
Secondary	#1A4D2E	#0F3820	Xanh lá rất đậm — nút bấm, footer
Accent CTA/Lỗi (10%)	#D8362A	#B0241A	Đỏ trầm — CTA quan trọng, cảnh báo lỗi
Accent nhấn nhá	#C1A24B	#9C7A1F	Vàng đất đậm/nâu vàng — tag, hover, nhãn dán

Ghi chú: bản đậm này tăng độ tương phản và "trọng lượng thị giác" tổng thể, phù hợp nếu bản gốc bị đánh giá là quá nhạt/pastel. Nếu cần chữ trên nền Primary/Secondary, luôn dùng #FFFFFF (không dùng #0E2419) để đảm bảo WCAG AA.