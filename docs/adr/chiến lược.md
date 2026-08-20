## ***Nhóm nội dung 3: Phát triển và hoàn thiện phần mềm sử dụng cho việc xây dựng Bộ CSDL về mẫu côn trùng ở Việt Nam (Viện CNTT bổ sung)***
 
***Nội dung 1: Phân tích yêu cầu, thiết kế kiến trúc hệ thống và cơ sở dữ liệu*.**
 
- [x]  Công việc 1.1: Khảo sát, phân tích yêu cầu hệ thống.
- [x]  Công việc 1.2: Thiết kế kiến trúc tổng thể hệ thống.
- [ ]  Công việc 1.3: Thiết kế mô hình cơ sở dữ liệu.
 
Phương pháp nghiên cứu của Nội dung 1: 
 
- Sử dụng phương pháp phân tích và thiết kế hệ thống hướng đối tượng kết hợp ngôn ngữ mô hình hóa thống nhất UML.
- Mô hình dữ liệu được thiết kế theo phương pháp chuẩn hóa đến dạng chuẩn 3NF, đồng thời áp dụng chuẩn Darwin Core cho metadata đa dạng sinh học.
- Công cụ sử dụng bao gồm: Enterprise Architect hoặc Visual Paradigm cho thiết kế UML, PostgreSQL/PostGIS cho cơ sở dữ liệu không gian, MongoDB cho dữ liệu phi cấu trúc.
 
***Nội dung 2: Phát triển phần mềm web quản lý, phân tích cơ sở dữ liệu côn trùng và hệ thống bản   đồ WebGIS tích hợp.***
 
- [ ]  Công việc 2.1: Phát triển module quản lý danh mục phân loại học.
- [ ]  Công việc 2.2: Phát triển module nhập liệu và quản lý mẫu vật.
- [ ]  Công việc 2.3: Phát triển module xuất báo cáo thống kê và truy vấn thông tin.
- [ ]  Công việc 2.4: Phát triển module quản lý người dùng và phân quyền.
- [ ]  Công việc 2.5: Xây dựng bản đồ phân bố trực tuyến hiển thị vị trí ghi nhận loài.
- [ ]  Công việc 2.6: Phát triển công cụ phân tích không gian xác định vùng giàu loài và loài đặc hữu, quý hiếm.
- [ ]  Công việc 2.7: Tích hợp dữ liệu sinh thái, môi trường lên bản đồ.
 
Phương pháp nghiên cứu của Nội dung 2: 
 
- Sử dụng công nghệ phát triển web hiện đại theo mô hình tách biệt front-end và back-end.
    - Front-end sử dụng framework ReactJS để xây dựng giao diện người dùng thân thiện, responsive, tương thích đa thiết bị.
    - Back-end sử dụng framework Node.js để xây dựng API, xử lý logic nghiệp vụ và kết nối cơ sở dữ liệu.
    - Cơ sở dữ liệu PostgreSQL kết hợp extension PostGIS cho dữ liệu không gian địa lý.
 
### **12.2.12. Phương pháp phân tích yêu cầu và thiết kế kiến trúc hệ thống**
 
Sử dụng phương pháp phân tích và thiết kế hệ thống hướng đối tượng kết hợp ngôn ngữ mô hình hóa thống nhất UML (Unified Modeling Language) để mô hình hóa các quy trình nghiệp vụ, luồng dữ liệu và tương tác giữa các thành phần hệ thống. Kiến trúc hệ thống được thiết kế theo mô hình phân tầng, bao gồm: tầng trình diễn (giao diện web responsive), tầng xử lý nghiệp vụ (quản lý các quy trình nhập liệu, xác thực, phân tích), tầng dữ liệu (quản lý lưu trữ và truy xuất), và tầng tích hợp (kết nối với các hệ thống bên ngoài như bản đồ trực tuyến).
 
Mô hình cơ sở dữ liệu quan hệ được thiết kế theo phương pháp chuẩn hóa đến dạng chuẩn 3NF (Third Normal Form), đồng thời áp dụng chuẩn Darwin Core (DwC) – tiêu chuẩn quốc tế cho metadata đa dạng sinh học. 
 
- **Cơ sở dữ liệu bao gồm các nhóm bảng chính:** thông tin phân loại học theo hệ thống phân loại cập nhật, thông tin mẫu vật, thông tin phân bố địa lý, thông tin sinh thái – sinh học.
- Ngoài cơ sở dữ liệu quan hệ, thiết kế bổ sung kho lưu trữ **phi cấu trúc (NoSQL) cho dữ liệu ảnh, tài liệu mô tả và metadata liên quan**.
- **Công cụ sử dụng bao gồm:** Enterprise Architect hoặc Visual Paradigm cho thiết kế UML, PostgreSQL/PostGIS cho cơ sở dữ liệu không gian, MongoDB cho dữ liệu phi cấu trúc.
 
Trước khi thiết kế, tiến hành khảo sát chi tiết nhu cầu sử dụng từ các nhóm đối tượng chính (nhà nghiên cứu côn trùng học, cán bộ quản lý khu bảo tồn, sinh viên, cộng tác viên khoa học cộng đồng) và nghiên cứu, đánh giá các nền tảng cơ sở dữ liệu đa dạng sinh học quốc tế hiện có như iNaturalist, GBIF, BOLD Systems và Species Link để rút ra bài học kinh nghiệm về kiến trúc dữ liệu, chuẩn trao đổi thông tin và giao diện người dùng.
 
### **12.2.13. Phương pháp phát triển phần mềm web quản lý và phân tích cơ sở dữ liệu côn trùng**
 
Sử dụng công nghệ phát triển web hiện đại theo mô hình tách biệt front-end và back-end. Front-end sử dụng framework ReactJS để xây dựng giao diện người dùng thân thiện, responsive, tương thích đa thiết bị. Back-end sử dụng framework Node.js để xây dựng API RESTful, xử lý logic nghiệp vụ và kết nối cơ sở dữ liệu. Cơ sở dữ liệu PostgreSQL kết hợp extension PostGIS phục vụ lưu trữ, truy vấn và phân tích dữ liệu không gian địa lý.
 
Hệ thống phần mềm bao gồm các module chức năng chính: 
 
(1) Module quản lý danh mục phân loại học đa cấp bậc, hỗ trợ cập nhật linh hoạt khi có thay đổi về danh pháp hoặc vị trí phân loại, quản lý tên đồng nghĩa và tên thường; 
 
(2) Module nhập liệu và quản lý mẫu vật, cho phép tải lên ảnh chụp mẫu vật, nhập thông tin thu mẫu, ghi nhận tọa độ GPS, mô tả đặc điểm hình thái và sinh cảnh, tích hợp quy trình xác thực dữ liệu nhiều bước bao gồm kiểm tra tự động các trường bắt buộc, kiểm tra tính hợp lệ của tọa độ và quy trình duyệt bởi chuyên gia; 
 
(3) Module xuất báo cáo thống kê và truy vấn nâng cao, cho phép tìm kiếm theo nhiều tiêu chí kết hợp, xuất báo cáo tổng hợp theo các định dạng CSV, Excel, PDF; 
 
(4) Module quản lý người dùng đa cấp với các vai trò: quản trị viên hệ thống, cộng tác viên khoa học cộng đồng và khách, mỗi vai trò được gán quyền truy cập và thao tác phù hợp.
 
### **12.2.14. Phương pháp xây dựng hệ thống bản đồ WebGIS tích hợp**
 
Phát triển hệ thống bản đồ WebGIS tương tác hiển thị vị trí ghi nhận của các loài côn trùng trên nền bản đồ Việt Nam, cho phép hiển thị và lọc dữ liệu theo nhiều lớp thông tin: ranh giới hành chính, ranh giới các khu bảo tồn thiên nhiên và vườn quốc gia. Xây dựng các công cụ phân tích không gian cho phép tính toán và hiển thị chỉ số đa dạng loài (Species Richness Index) theo từng đơn vị không gian, bản đồ phân bố loài đặc hữu và loài quý hiếm theo phân hạng Sách Đỏ Việt Nam, xác định nhanh các khu vực "điểm nóng đa dạng sinh học" (biodiversity hotspots) – nơi có mật độ loài cao nhất và tập trung nhiều loài đặc hữu, quý hiếm – phục vụ đề xuất ưu tiên bảo tồn.
 
Tích hợp các lớp dữ liệu bổ trợ lên hệ thống bản đồ bao gồm dữ liệu địa hình, ranh giới các khu bảo tồn và vườn quốc gia; phát triển chức năng chồng lớp cho phép phân tích mối quan hệ giữa phân bố côn trùng với các yếu tố sinh thái – môi trường, hỗ trợ nghiên cứu sinh thái học và dự báo phân bố loài. Công cụ sử dụng: PostgreSQL/PostGIS cho phân tích không gian phía server, thư viện bản đồ JavaScript (Leaflet hoặc OpenLayers) cho hiển thị bản đồ phía client.
 
### **12.2.15. Phương pháp nhận dạng loài côn trùng bằng trí tuệ nhân tạo**
 
Sử dụng phương pháp học sâu (deep learning) và thị giác máy tính (computer vision) để xây dựng module nhận dạng loài côn trùng tự động từ ảnh chụp. Quy trình thực hiện gồm các bước chính:
 
Xây dựng bộ dữ liệu ảnh huấn luyện: thu thập ảnh chụp mẫu tiêu bản từ các bộ sưu tập côn trùng tại các viện nghiên cứu, bảo tàng; ảnh chụp côn trùng ngoài tự nhiên; ảnh từ nguồn dữ liệu mở (iNaturalist, GBIF). Tiền xử lý dữ liệu bao gồm chuẩn hóa kích thước, tăng cường dữ liệu (data augmentation) bằng các kỹ thuật Mixup, CutMix, Random Erasing, AutoAugment, và gán nhãn phân loại chính xác theo hệ thống phân loại chuẩn.
 
Huấn luyện mô hình: sử dụng kiến trúc mạng nơ-ron tích chập (CNN) với các kiến trúc tiên tiến như EfficientNet-V2, Vision Transformer (ViT) hoặc ConvNeXt. Áp dụng phương pháp Transfer Learning từ các mô hình đã được huấn luyện sẵn (pre-trained) trên tập dữ liệu ImageNet và iNaturalist, sau đó fine-tune trên bộ dữ liệu côn trùng Việt Nam để tối ưu hiệu suất nhận dạng cho các nhóm côn trùng đặc trưng. Framework phát triển: PyTorch hoặc TensorFlow. Huấn luyện trên hệ thống GPU hiệu năng cao (NVIDIA A100/V100 hoặc tương đương).
 
Đánh giá hiệu suất mô hình: sử dụng tập dữ liệu kiểm tra độc lập với các chỉ số đánh giá bao gồm độ chính xác (Accuracy), Precision, Recall, F1-Score, và phân tích ma trận nhầm lẫn (Confusion Matrix) để xác định các nhóm loài dễ nhầm lẫn, từ đó cải thiện bộ dữ liệu huấn luyện và kiến trúc mô hình.
 
Tích hợp và triển khai: mô hình AI được triển khai dưới dạng REST API sử dụng TensorFlow Serving hoặc TorchServe, đóng gói bằng Docker để đảm bảo khả năng triển khai linh hoạt. Giao diện nhận dạng hiển thị danh sách các loài gợi ý (top-K suggestions) kèm độ tin cậy, ảnh tham khảo từ cơ sở dữ liệu, thông tin phân loại và bản đồ phân bố đã biết của loài gợi ý. Phát triển cơ chế phản hồi từ chuyên gia: kết quả nhận dạng AI được chuyên gia xác nhận hoặc hiệu chỉnh, dữ liệu phản hồi được sử dụng để cải thiện mô hình liên tục (active learning).
 
### **12.2.16. Phương pháp kiểm thử, triển khai hệ thống và xây dựng tài liệu hướng dẫn**
 
Thực hiện kiểm thử toàn diện hệ thống ở nhiều cấp độ: kiểm thử đơn vị (unit testing) cho từng module chức năng, kiểm thử tích hợp (integration testing) đánh giá sự phối hợp giữa các module, kiểm thử hiệu năng (performance testing) đánh giá khả năng xử lý đồng thời nhiều người dùng và dữ liệu lớn, kiểm thử chấp nhận người dùng (UAT) với sự tham gia trực tiếp của các nhà nghiên cứu côn trùng và cán bộ quản lý khu bảo tồn.
 
Triển khai hệ thống trên hạ tầng máy chủ nội bộ, thiết lập cơ chế sao lưu tự động (automated backup) và phương án phục hồi dữ liệu (disaster recovery), cơ chế ghi log hoạt động và giám sát hệ thống để theo dõi hiệu suất và phát hiện sự cố. Phát triển các kết nối tích hợp với hệ thống bên ngoài thông qua API bản đồ và công cụ nhập/xuất dữ liệu hàng loạt (batch import/export) hỗ trợ chuyển đổi từ các định dạng dữ liệu đa dạng sinh học phổ biến.
 
Xây dựng bộ tài liệu hướng dẫn sử dụng hệ thống cho các nhóm đối tượng: tài liệu quản trị hệ thống cho đội ngũ kỹ thuật, tài liệu hướng dẫn sử dụng chi tiết cho cộng tác viên khoa học cộng đồng, tài liệu kỹ thuật mô tả kiến trúc hệ thống, API reference và hướng dẫn bảo trì, nâng cấp. Tài liệu được biên soạn theo chuẩn kỹ thuật viết tài liệu phần mềm, kết hợp phương pháp đào tạo trực tiếp, đào tạo trực tuyến và tài liệu tự học.