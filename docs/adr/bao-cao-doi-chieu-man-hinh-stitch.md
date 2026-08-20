# Báo cáo đối chiếu và chuẩn hóa màn hình Stitch

**Dự án:** VietInsect BigData System  
**Phạm vi:** `frontend/stitch-export` và tài liệu trong `docs/adr`  
**Ngày thực hiện:** 20/08/2026  
**Tác giả:** Manus AI

## 1. Mục tiêu và cơ sở đối chiếu

Báo cáo này ghi nhận kết quả đọc, đối chiếu và chuẩn hóa các bản HTML được sinh từ Stitch với danh sách màn hình chuẩn của dự án. SRS xác định hệ thống có **30 màn hình**, mã từ `SCR-01` đến `SCR-30`, được phân thành 10 nhóm chức năng.[1] Danh sách ADR và design brief của Stitch cung cấp cùng một thứ tự mã màn hình; design brief cũng mô tả rõ mục tiêu giao diện của từng mã.[2] [3]

> Quy ước đầu ra được áp dụng: `SCR-số thứ tự-tên màn hình.html`.

Việc đối chiếu được thực hiện theo thứ tự ưu tiên: mã SCR và tên file rõ ràng; tiêu đề, heading và nội dung giao diện; mức độ khớp với tên và chức năng trong SRS; sau cùng là phiên bản thiết kế mới hơn khi có nhiều biến thể cùng một màn hình. Các file HTML chỉ là prototype giao diện tĩnh, vì vậy việc có file tương ứng **không đồng nghĩa** chức năng frontend/backend đã hoàn thiện.

## 2. Kết quả tổng quan

| Hạng mục | Kết quả |
| --- | ---: |
| Số màn hình chuẩn theo SRS | 30 |
| Số HTML trước khi lọc | 39 |
| Số file được chọn làm bản chính và đổi tên | 30 |
| Số file trùng, dư hoặc không phải màn hình bị xóa | 9 |
| Số màn hình thiếu sau đối chiếu | **0** |
| Số file HTML sau chuẩn hóa | **30** |
| Số file sai định dạng tên sau kiểm tra | **0** |

Kết quả kiểm tra cuối cùng cho thấy thư mục `frontend/stitch-export` hiện có đủ liên tục các mã `SCR-01` đến `SCR-30`, mỗi mã có đúng một file HTML. File `design-promt.md` vẫn được giữ lại vì đây là tài liệu thiết kế, không phải màn hình HTML.

## 3. Danh sách file HTML chuẩn sau xử lý

| Mã | Tên màn hình chuẩn | File HTML sau chuẩn hóa | Nguồn Stitch được chọn |
| --- | --- | --- | --- |
| SCR-01 | Đăng nhập | `SCR-01-Dang-nhap.html` | `admin_login.html` |
| SCR-02 | Đổi mật khẩu | `SCR-02-Doi-mat-khau.html` | `change_password.html` |
| SCR-03 | Dashboard Admin | `SCR-03-Dashboard-Admin.html` | `admin_dashboard_statistics_distribution.html` |
| SCR-04 | Trang chủ công khai | `SCR-04-Trang-chu-cong-khai.html` | `public_home_updated_layout_map_on_right.html` |
| SCR-05 | Danh sách mẫu vật | `SCR-05-Danh-sach-mau-vat.html` | `specimen_list_scr_05.html` |
| SCR-06 | Thêm mới mẫu vật | `SCR-06-Them-moi-mau-vat.html` | `specimen_creation_form_scr_06.html` |
| SCR-07 | Chỉnh sửa mẫu vật | `SCR-07-Chinh-sua-mau-vat.html` | `specimen_edit_form_scr_07.html` |
| SCR-08 | Chi tiết mẫu vật | `SCR-08-Chi-tiet-mau-vat.html` | `specimen_detail_attacus_atlas_updated_theme.html` |
| SCR-09 | Nhập dữ liệu hàng loạt | `SCR-09-Nhap-du-lieu-hang-loat.html` | `bulk_import_workbench_scr_09.html` |
| SCR-10 | Chỉnh sửa hàng loạt | `SCR-10-Chinh-sua-hang-loat.html` | `batch_edit_specimens_scr_10.html` |
| SCR-11 | Định dạng và in nhãn | `SCR-11-Dinh-dang-va-in-nhan.html` | `label_printing_formatting_scr_11.html` |
| SCR-12 | Cây phân loại học | `SCR-12-Cay-phan-loai-hoc.html` | `taxonomy_tree_scr_12.html` |
| SCR-13 | Trang hồ sơ loài | `SCR-13-Trang-ho-so-loai.html` | `species_profile_page_scr_13.html` |
| SCR-14 | Quản lý danh pháp | `SCR-14-Quan-ly-danh-phap.html` | `taxon_editor_scr_14.html` |
| SCR-15 | Tìm kiếm mẫu vật | `SCR-15-Tim-kiem-mau-vat.html` | `redesigned_specimen_search_scr_15.html` |
| SCR-16 | Tìm kiếm nâng cao | `SCR-16-Tim-kiem-nang-cao.html` | `advanced_search_scr_16.html` |
| SCR-17 | Thư viện hình ảnh | `SCR-17-Thu-vien-hinh-anh.html` | `media_gallery_scr_17.html` |
| SCR-18 | Bản đồ phân bố | `SCR-18-Ban-do-phan-bo.html` | `occurrence_map_scr_18.html` |
| SCR-19 | Quản lý lớp bản đồ | `SCR-19-Quan-ly-lop-ban-do.html` | `layer_manager_scr_19.html` |
| SCR-20 | Danh sách chuỗi DNA | `SCR-20-Danh-sach-chuoi-DNA.html` | `dna_records_list_scr_20.html` |
| SCR-21 | Form Thêm/Sửa DNA | `SCR-21-Form-Them-Sua-DNA.html` | `dna_entry_edit_form_scr_21.html` |
| SCR-22 | Chi tiết chuỗi FASTA | `SCR-22-Chi-tiet-chuoi-FASTA.html` | `dna_detail_fasta_view_scr_22.html` |
| SCR-23 | Nhận dạng loài qua ảnh | `SCR-23-Nhan-dang-loai-qua-anh.html` | `ai_species_identification_scr_23.html` |
| SCR-24 | Dự báo phân bố (SDM) | `SCR-24-Du-bao-phan-bo-SDM.html` | `sdm_prediction_portal_scr_24.html` |
| SCR-25 | Dashboard phân tích | `SCR-25-Dashboard-phan-tich.html` | `analytics_dashboard_scr_25.html` |
| SCR-26 | Báo cáo danh lục & Thống kê | `SCR-26-Bao-cao-danh-luc-va-thong-ke.html` | `reports_checklists_scr_26.html` |
| SCR-27 | Báo cáo KPI số hóa | `SCR-27-Bao-cao-KPI-so-hoa.html` | `digitization_kpi_report_scr_27.html` |
| SCR-28 | Bộ dựng báo cáo tùy chỉnh | `SCR-28-Bo-dung-bao-cao-tuy-chinh.html` | `custom_report_builder_scr_28.html` |
| SCR-29 | Kiểm soát chia sẻ công khai | `SCR-29-Kiem-soat-chia-se-cong-khai.html` | `public_private_control_scr_29.html` |
| SCR-30 | Nhật ký & Cấu hình hệ thống | `SCR-30-Nhat-ky-va-Cau-hinh-he-thong.html` | `system_audit_log_config_scr_30.html` |

## 4. Các file đã xóa và lý do

| File đã xóa | Phân loại | Lý do xử lý |
| --- | --- | --- |
| `admin_management_panel.html` | Prototype dư/không định danh SCR | Màn hình quản trị tổng quát, trùng ý tưởng với các nhóm Dashboard/Quản trị nhưng không khớp một màn hình SRS cụ thể. |
| `admin_management_panel_updated_theme.html` | Bản cập nhật của prototype dư | Là biến thể mới hơn của file trên, nhưng vẫn không phải bản đại diện một-một cho mã SCR nào. |
| `species_catalog.html` | Prototype dư/không định danh SCR | Trang catalog tổng quát, giao thoa giữa cây phân loại, hồ sơ loài và tìm kiếm; không khớp trực tiếp một màn hình chuẩn. |
| `species_catalog_updated_theme.html` | Bản cập nhật của prototype dư | Trùng khái niệm với `species_catalog.html`, không chọn thay cho SCR-12, SCR-13 hoặc SCR-15 vì các màn hình đó đã có bản riêng. |
| `specimen_detail_attacus_atlas.html` | Bản cũ của SCR-08 | Trùng màn hình chi tiết mẫu vật; giữ bản `updated_theme` làm bản chính. |
| `specimen_detail_view_scr_08.html` | Bản cũ của SCR-08 | Có mã SCR trong tên nhưng là biến thể cũ; bản `updated_theme` được chọn vì giao diện mới hơn và vẫn thể hiện đầy đủ nội dung chi tiết mẫu vật, ảnh, DNA và thao tác Admin. |
| `vietinsect_dashboard.html` | Prototype dashboard dư | Dashboard tổng quát, không cụ thể bằng bản dashboard thống kê/phân bố đã chọn cho SCR-03. |
| `vietinsect_dashboard_updated_theme.html` | Bản cập nhật của prototype dư | Trùng khái niệm với dashboard tổng quát và không thay thế bản SCR-03 đã xác định rõ. |
| `shader.html` | Tài nguyên kỹ thuật, không phải màn hình | Chỉ chứa phần shader/hiệu ứng hỗ trợ, không phải một trang giao diện độc lập trong danh sách SRS. |

## 5. Đánh giá độ đầy đủ và các điểm cần lưu ý

Đối chiếu mã cho thấy **không còn màn hình thiếu** trong phạm vi các prototype HTML đã sinh. Mỗi mã SCR từ 01 đến 30 đã có một file tên chuẩn. Các file bị xóa đều là bản trùng, prototype chung không định danh hoặc tài nguyên kỹ thuật; không xóa một mã màn hình chuẩn nào.

Một số tên tiếng Việt trong SRS/ADR có lỗi chính tả hoặc lỗi OCR, chẳng hạn “Đảng nhập”, “Đối mặt khẩu”, “Chính sữa” và “Bản độ”. Tên file mới đã dùng tên chuẩn đã hiệu chỉnh theo ngữ nghĩa màn hình và design brief, đồng thời bỏ dấu tiếng Việt để tránh vấn đề tương thích đường dẫn trên các hệ thống build và triển khai.

SCR-08 được chọn từ bản `updated_theme` thay cho bản có tên `specimen_detail_view_scr_08.html`. Đây là quyết định chọn bản thiết kế đại diện, không phải bổ sung màn hình mới. Khi chuyển sang bước triển khai, cần kiểm tra lại với người phụ trách UI/UX xem có muốn giữ nội dung mẫu minh họa “Attacus atlas” hay thay bằng dữ liệu động từ API.

Do HTML được sinh từ Stitch có thể chứa ảnh hoặc font lấy từ URL bên ngoài, bước tiếp theo nên kiểm tra khả năng tải offline, bản quyền tài nguyên, CSP, responsive ở desktop/tablet, khả năng tiếp cận WCAG 2.1 AA, và việc thay thế dữ liệu hard-code bằng component/API thật. SRS yêu cầu responsive từ 768px, hỗ trợ VI/EN, Light/Dark mode và xác nhận trước các thao tác CRUD.[1]

## 6. Đề xuất chuẩn bị cho bước tiếp theo

| Ưu tiên | Việc cần làm | Kết quả mong đợi |
| --- | --- | --- |
| 1 | Chốt bộ 30 file đã chuẩn hóa làm baseline UI | Không còn tranh chấp về mã và tên màn hình. |
| 2 | Lập route/component registry từ `SCR-01` đến `SCR-30` | Mỗi màn hình liên kết được với route, component và nhóm chức năng. |
| 3 | Tách layout dùng chung | Dùng chung `AdminLayout`, `PublicLayout`, Topbar, Sidebar, Toast, Confirm Dialog và i18n. |
| 4 | Đối chiếu màn hình với API và quyền Admin/User | Xác định màn hình nào chỉ đọc, CRUD, xuất dữ liệu hoặc yêu cầu xác thực. |
| 5 | Kiểm tra lại các prototype trên desktop/tablet | Phát hiện lỗi tràn layout, phụ thuộc CDN, dữ liệu mẫu và trạng thái lỗi/loading/empty. |
| 6 | Ưu tiên triển khai theo nhóm | Nên bắt đầu với SCR-01–04, sau đó SCR-05–11, rồi Taxonomy/Search/GIS/DNA/AI/Reports/Admin. |

## 7. Tệp kết quả

Bộ HTML sau chuẩn hóa nằm tại [`frontend/stitch-export`](../../frontend/stitch-export/). Báo cáo này được lưu tại `docs/adr/bao-cao-doi-chieu-man-hinh-stitch.md` để làm mốc cho bước phát triển tiếp theo.

## References

[1]: [SRS.md](SRS.md) — Đặc tả yêu cầu hệ thống VietInsect BigData System, phiên bản 2.0.
[2]: [danh sách màn hình dự kiến .md](danh%20s%C3%A1ch%20m%C3%A0n%20h%C3%ACnh%20d%E1%BB%B1%20ki%E1%BA%BFn%20.md) — Danh sách màn hình ADR và mức độ ưu tiên.
[3]: [design-promt.md](../../frontend/stitch-export/design-promt.md) — Design brief và prompt chi tiết cho SCR-01 đến SCR-30.
