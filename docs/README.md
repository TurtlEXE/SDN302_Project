# Mục lục tài liệu

- [Đặc tả tính năng](features.md): phạm vi nghiệp vụ, đặt sân theo khoảng, VNPay 100%, email và tiêu chí nghiệm thu.
- [Kiến trúc](architecture.md): client–server 3 tier, backend theo layer, component React và xác thực JWT/cookie.
- [Kế hoạch phát triển](planning/development-plan.md): đầu việc, phụ thuộc và điều kiện hoàn thành từng phase P00–P20.
- [Trạng thái phase](planning/phase-status.json): tiến độ hiện tại và các gate; chỉ có một bản chính thức.
- [Hướng dẫn giao việc AI](guides/ai-workflow.md): cách triển khai, review, nghiệm thu và tiếp tục công việc.
- [Mẫu báo cáo phase](phase-reports/TEMPLATE.md): hợp đồng thực hiện, bằng chứng kiểm chứng và bàn giao.
- [Quy tắc cho agent](../AGENTS.md): đọc trước khi làm việc trong dự án.

## Tài liệu đã hoàn thành ở Phase P00

- [Hợp đồng API OpenAPI](api.openapi.yaml): đặc tả kỹ thuật chi tiết toàn bộ endpoint `/api/v1`, models, DTOs, query/body params, status và mã lỗi.
- [Thiết kế Cơ sở dữ liệu MongoDB](database.md): 17 collections/models, quan hệ, schema, unique compound indexes, chuẩn thời gian Asia/Ho_Chi_Minh và transaction.
- [Quyết định kiến trúc & cấu hình (ADR)](architecture-decisions.md): các quyết định kỹ thuật chốt ở P00 (múi giờ, gộp khoảng, JWT/cookie, topology, VNPay, xử lý ngoại lệ).
- [Ánh xạ 64 tiêu chí nghiệm thu](planning/criteria-mapping.md): phân bổ trách nhiệm kiểm thử giữa Backend (P01–P14) và UI (P15–P20) cho từng tiêu chí.
- [Cấu hình môi trường mẫu](../server/.env.example): danh sách biến môi trường backend không chứa secret thật.
- [Báo cáo thực hiện Phase P00](phase-reports/P00.md): hợp đồng, kết quả, kiểm chứng và biên bản bàn giao.

Khi bắt đầu một phase, tạo `docs/phase-reports/Pxx.md` từ mẫu; báo cáo review riêng là `docs/phase-reports/Pxx-review.md`. Đường dẫn bằng chứng lưu trong status luôn tính từ gốc dự án `sport-booking/`.
