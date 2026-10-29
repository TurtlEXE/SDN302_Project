# Sport Booking — nền tảng đặt sân thể thao

Dự án môn học sử dụng Node.js/Express, React và MongoDB, theo kiến trúc client–server 3 tier. Backend được triển khai và nghiệm thu trước frontend.

## Trạng thái hiện tại

- Phase P00: Đã được nghiệm thu (`ACCEPTED`).
- Phase P01: Đã được nghiệm thu (`ACCEPTED`).
- Phase P02: Đã hoàn tất cài đặt MongoDB Replica Set (`rs0`), 17 Mongoose models/schemas chuẩn hóa, helper transaction ACID, ràng buộc index & unique, điều phối `CourtDaySchedule`, scripts sync index và seed admin, fixtures kiểm thử; đang ở trạng thái `READY_FOR_REVIEW`.
- Cổng frontend (`BE_READY`): Chưa nghiệm thu. Thư mục `client/` được giữ chỗ, cam kết không triển khai React trước khi toàn bộ backend hoàn tất nghiệm thu (P14).

Các lệnh khởi động và kiểm thử được quản lý tập trung từ thư mục gốc thông qua npm workspaces.

## Bắt đầu từ đây

1. Đọc [quy tắc cho agent](AGENTS.md).
2. Đọc [đặc tả tính năng](docs/features.md) và [kiến trúc dự án](docs/architecture.md).
3. Xem [kế hoạch P00–P20](docs/planning/development-plan.md) và [trạng thái hiện tại](docs/planning/phase-status.json).
4. Dùng prompt trong [hướng dẫn giao việc AI](docs/guides/ai-workflow.md), mục 6, khi muốn bắt đầu P00.

Nếu dùng Gemini trong Antigravity, thực hiện bước kiểm tra ở [mục 2.1 của hướng dẫn AI](docs/guides/ai-workflow.md#21-antigravity) để xác nhận agent đang đọc đúng dự án và quy tắc trước khi giao phase.

Đường dẫn viết dưới dạng code trong các tài liệu tính từ gốc `sport-booking/`, trừ khi có ghi rõ khác. Link Markdown tính từ file đang chứa link.

## Bố trí thư mục hiện có

```text
sport-booking/
├── AGENTS.md                       # Quy tắc chính cho agent
├── README.md                       # Điểm bắt đầu đọc dự án
├── .cursor/rules/                  # Rule dẫn tới AGENTS.md
├── docs/
│   ├── README.md                   # Mục lục tài liệu
│   ├── features.md                 # Tính năng và 64 tiêu chí nghiệm thu
│   ├── architecture.md             # Cấu trúc, layer, JWT/cookie
│   ├── planning/
│   │   ├── development-plan.md     # Các phase P00–P20
│   │   └── phase-status.json       # Trạng thái duy nhất của các phase/gate
│   ├── guides/
│   │   └── ai-workflow.md          # Prompt triển khai, review, tiếp tục
│   └── phase-reports/
│       └── TEMPLATE.md             # Mẫu báo cáo, chưa có báo cáo thực hiện
├── server/
│   ├── README.md
│   ├── src/                       # Các thư mục theo layer
│   ├── scripts/                   # Dành cho seed/index ở phase tương ứng
│   └── tests/                     # unit, integration, fixtures
├── client/
│   └── README.md                  # Giữ chỗ đến P15
└── tests/
    └── e2e/
        └── README.md              # Giữ chỗ cho kiểm thử xuyên hệ thống
```

Các file ứng dụng chi tiết trong [cây kiến trúc đích](docs/architecture.md) được tạo khi thực hiện phase tương ứng. Việc chuẩn bị các thư mục này không thay thế điều kiện hoàn thành P00/P01.
