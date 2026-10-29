# Backend Node.js - Sport Booking Platform

Thư mục backend tuân thủ kiến trúc client–server 3 tier theo [kiến trúc backend](../docs/architecture.md) và phân tầng ES Modules (Node.js >= 20).

## Cấu trúc thư mục (P01 & P02)

```text
server/
├── scripts/
│   ├── sync-indexes.js      # Đồng bộ hóa và tạo toàn bộ index Mongoose cho 17 models
│   └── seed-admin.js        # Seed tài khoản ADMIN ban đầu (chạy thủ công bằng CLI, không auto-run)
├── src/
│   ├── app.js               # Khởi tạo Express app, cấu hình middleware bảo mật, routing, errorHandler (không listen port)
│   ├── server.js            # Entry point HTTP server: nạp cấu hình, kết nối MongoDB và lắng nghe cổng
│   ├── worker.js            # Entry point Worker độc lập dành cho cron/scheduled jobs
│   ├── config/
│   │   ├── env.js           # Kiểm tra và parse biến môi trường (fail-fast)
│   │   ├── cors.js          # Cấu hình CORS với CLIENT_ORIGIN và credentials: true
│   │   └── database.js      # Quản lý kết nối Mongoose và kiểm tra trạng thái sức khỏe DB
│   ├── database/
│   │   └── transaction.js   # Helper withTransaction mở multi-document ACID transaction và truyền session
│   ├── models/              # Khai báo 17 Mongoose schemas & models chuẩn hóa
│   │   ├── user.model.js
│   │   ├── auth-token.model.js
│   │   ├── auth-session.model.js
│   │   ├── refresh-token.model.js
│   │   ├── sport.model.js
│   │   ├── facility.model.js
│   │   ├── facility-sport.model.js
│   │   ├── court.model.js
│   │   ├── court-day-schedule.model.js
│   │   ├── court-block.model.js
│   │   ├── booking-request.model.js
│   │   ├── booking.model.js
│   │   ├── payment-order.model.js
│   │   ├── payment-transaction.model.js
│   │   ├── refund-case.model.js
│   │   ├── email-outbox.model.js
│   │   ├── action-log.model.js
│   │   └── index.js
│   ├── errors/
│   │   ├── app-error.js     # Class AppError kế thừa Error chuẩn hóa (status, code, details)
│   │   └── error-codes.js   # 17 mã lỗi nghiệp vụ chuẩn hóa (snake_case)
│   ├── middlewares/
│   │   ├── error-handler.js # Middleware xử lý lỗi tập trung, chuẩn hóa ErrorResponse
│   │   ├── not-found.js     # Middleware bắt 404 chuẩn hóa
│   │   ├── rate-limit.js    # Giới hạn tần suất request (express-rate-limit)
│   │   └── validate.js      # Middleware validate request schemas
│   ├── routes/
│   │   └── index.js         # Router gốc (/api/v1) & endpoint kiểm tra sức khỏe
│   └── utils/
│       └── logger.js        # Logger chuẩn hóa tự động ẩn thông tin nhạy cảm (password, token, cookie)
├── tests/
│   ├── unit/                # Unit test (env, logger, app-import, models)
│   ├── integration/         # Integration test (health, check-phase, transaction, indexes-constraints, seed-admin)
│   └── fixtures/            # Mock & fixtures kiểm thử (users, sports, facilities, courts)
├── .env.example             # Mẫu biến môi trường
└── package.json             # Cấu hình gói và dependencies của server
```

## Các lệnh thực thi

Các lệnh có thể chạy trực tiếp từ thư mục gốc dự án hoặc bên trong thư mục `server/`:

```bash
# Cài đặt dependencies (từ gốc dự án)
npm install

# Đảm bảo MongoDB Replica Set (rs0) đang chạy trên cổng 27018
npm run db:ensure-rs

# Đồng bộ hóa toàn bộ index của 17 models Mongoose
npm run db:indexes

# Seed tài khoản ADMIN ban đầu (chỉ chạy thủ công bằng CLI)
npm run db:seed

# Chạy server ở chế độ development (có hot-reload)
npm run dev --prefix server
# Hoặc từ thư mục server:
npm run dev

# Chạy server ở chế độ production
npm start --prefix server

# Khởi chạy background worker
npm run worker --prefix server

# Chạy toàn bộ test suites (Node.js built-in test runner)
npm test
# Hoặc chỉ test server:
npm --prefix server test

# Kiểm tra trạng thái phase và cổng frontend
npm run check:phase
```

## Endpoints Kiểm tra Sức khỏe

- `GET /health` hoặc `GET /api/v1/health`: Kiểm tra trạng thái hoạt động của tiến trình HTTP (luôn trả về 200 `status: "UP"` nếu server đang sống).
- `GET /ready`: Kiểm tra tính sẵn sàng của hệ thống (database connection). Trả về 200 `READY` khi MongoDB kết nối thành công, hoặc 503 `NOT_READY` khi chưa kết nối.
