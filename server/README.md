# Backend Node.js - Sport Booking Platform

Thư mục backend tuân thủ kiến trúc client–server 3 tier theo [kiến trúc backend](../docs/architecture.md) và phân tầng ES Modules (Node.js >= 20).

## Cấu trúc thư mục (P01)

```text
server/
├── src/
│   ├── app.js               # Khởi tạo Express app, cấu hình middleware bảo mật, routing, errorHandler (không listen port)
│   ├── server.js            # Entry point HTTP server: nạp cấu hình, kết nối MongoDB và lắng nghe cổng
│   ├── worker.js            # Entry point Worker độc lập dành cho cron/scheduled jobs
│   ├── config/
│   │   ├── env.js           # Kiểm tra và parse biến môi trường (fail-fast)
│   │   ├── cors.js          # Cấu hình CORS với CLIENT_ORIGIN và credentials: true
│   │   └── database.js      # Quản lý kết nối Mongoose và kiểm tra trạng thái sức khỏe DB
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
│   ├── unit/                # Unit test (env, logger, app-import)
│   ├── integration/         # Integration test (health, check-phase)
│   └── fixtures/            # Mock & fixtures kiểm thử
├── .env.example             # Mẫu biến môi trường
└── package.json             # Cấu hình gói và dependencies của server
```

## Các lệnh thực thi

Các lệnh có thể chạy trực tiếp từ thư mục gốc dự án hoặc bên trong thư mục `server/`:

```bash
# Cài đặt dependencies (từ gốc dự án)
npm install

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
