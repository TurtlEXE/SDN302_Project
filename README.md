# SportBooking Platform — Nền Tảng Đặt Sân Thể Thao Trực Tuyến

> **Tài liệu Bàn giao Tổng thể & Hướng dẫn Vận hành RELEASE-READY (Phase P20)**  
> Dự án môn học Kiến trúc Phần mềm & Phát triển Ứng dụng Web Phân tán (SDN302).  
> Kiến trúc: Client–Server 3-Tier, Backend-first Layered Architecture, React Single Page Application, MongoDB Replica Set with ACID Transactions.

---

## 1. Giới thiệu Tổng quan Hệ thống

**SportBooking Platform** là hệ thống trung gian kết nối các chủ cơ sở thể thao (sân cầu lông, bóng đá mini, quần vợt, bóng rổ, pickleball,...) với khách hàng có nhu cầu tìm kiếm, đặt sân và thanh toán trực tuyến. Hệ thống giải quyết triệt để bài toán xung đột lịch đặt sân đồng thời (concurrency double-booking), thanh toán bảo mật 100% qua cổng VNPay, phân tách rõ ràng vai trò người dùng (RBAC), và tự động hóa quy trình gửi email thông báo.

### Các vai trò trong hệ thống:
1. **Khách hàng (Customer):**
   - Đăng ký tài khoản, xác thực email qua link dùng 1 lần (15 phút).
   - Tìm kiếm cơ sở thể thao theo môn, tỉnh/thành phố, quận/huyện, khoảng giá.
   - Xem lưới lịch trực quan thời gian thực (bước giờ 30/60/90 phút).
   - Chọn các ô giờ liền kề và tạo đơn đặt sân với cơ chế **Khóa giữ chỗ 10 phút** (`PENDING_PAYMENT`).
   - Thanh toán trực tuyến an toàn qua Cổng VNPay (HMAC-SHA512).
   - Quản lý lịch sử đặt sân, hủy yêu cầu giữ chỗ trước khi thanh toán.
2. **Chủ sân (Owner):**
   - Được Quản trị viên cấp tài khoản và kích hoạt qua email mời (24 giờ).
   - Thiết lập thông tin cơ sở thể thao, giờ hoạt động, chính sách hủy hoàn.
   - Cấu hình các môn thể thao tại cơ sở kèm bước giờ đặt (30/60/90 phút) và đơn giá thuê theo giờ.
   - Quản lý danh sách sân con, trạng thái hoạt động (bảo trì, nhận đặt).
   - Khóa sân thủ công (Court Block) phục vụ giải đấu nội bộ hoặc sự kiện riêng.
   - Đặt sân hộ cho khách vãng lai (On-behalf booking).
   - Theo dõi dashboard vận hành: doanh thu theo ngày/tháng, công suất sân, xác nhận hoàn tất dịch vụ (`COMPLETED`) hoặc ghi nhận khách vắng mặt (`NO_SHOW`).
3. **Quản trị viên (Admin):**
   - Cấp tài khoản Chủ sân (Owner Provisioning), khóa/mở khóa tài khoản khi có vi phạm.
   - Quản lý danh mục môn thể thao toàn hệ thống (tạo mới, đổi tên, biểu tượng, kích hoạt/tạm dừng).
   - Giám sát toàn bộ cơ sở thể thao, khóa cơ sở vi phạm chính sách.
   - Giám sát toàn bộ đơn đặt sân và các giao dịch cổng thanh toán VNPay.
   - Xử lý bất khả kháng: hủy sân và lập hồ sơ hoàn tiền (`RefundCase`), ghi nhận chuyển khoản hoàn tiền thủ công ngoài hệ thống kèm mã chứng từ (`proofReference`).
   - Theo dõi hàng đợi Email (`EmailOutbox`), xem lịch sử và kích hoạt gửi lại các email gặp sự cố mạng.
   - Xem nhật ký kiểm toán hành vi hệ thống (`ActionLog`).

---

## 2. Kiến trúc & Công nghệ

- **Backend:** Node.js (>= 20.x), Express.js (ES Modules).
  - Kiến trúc phân tầng rõ ràng: `Routes` → `Middlewares` → `Controllers` → `Services` → `Repositories` → `Models`.
  - Cơ sở dữ liệu: MongoDB với **Replica Set** (`rs0`) để thực thi các giao dịch phân tán **ACID Transactions** đa tài liệu (Multi-Document Transactions).
  - Điều phối lịch: `CourtDaySchedule` kết hợp cơ chế khóa giữ chỗ 10 phút và kiểm tra khoảng thời gian liền kề (`slot-merger.js`).
  - Bảo mật phiên: Access Token JWT ngắn hạn (10 phút) lưu trữ an toàn trong RAM; Refresh Token ngẫu nhiên xoay vòng (Token Rotation) lưu trong HttpOnly Cookie (`SameSite=Lax`, `Path=/api/v1/auth`); Chống dò đoán và tái sử dụng token (Reuse Detection); Phòng vệ CSRF qua `X-CSRF-Guard: 1` và kiểm soát chặt chẽ `Origin/Referer`.
- **Worker Nền (Background Worker):**
  - Chạy độc lập (`server/src/worker.js`) với chu kỳ định thời xử lý hàng đợi email (`EmailOutbox`) có cơ chế retry lũy thừa lùi (exponential backoff) và tự động dọn dẹp các đơn đặt sân hết hạn giữ chỗ (Hold Expiration Cleanup).
- **Frontend:** React 19, Vite, React Router 7, Tailwind CSS, Lucide React.
  - Quản lý trạng thái xác thực tập trung (`AuthContext`) điều phối access token trong RAM, bootstrap silent refresh một lần khi tải trang và đồng bộ qua broadcast đa tab.
  - Phân vùng giao diện theo role: Layout Công khai (Public), Layout Khách hàng (Customer), Layout Trang quản trị (Dashboard chung cho Owner và Admin).
  - Bảo vệ điều hướng client-side (`ProtectedRoute`) kết hợp kiểm tra quyền từ server (phân quyền thực tế luôn do Backend thực thi).

---

## 3. Cấu trúc Thư mục Dự án

```text
sport-booking/
├── .cursor/rules/                  # Quy tắc IDE & dẫn tới AGENTS.md
├── AGENTS.md                       # Bản quy tắc triển khai dự án nghiêm ngặt
├── README.md                       # Tài liệu bàn giao & hướng dẫn vận hành toàn dự án
├── package.json                    # Monorepo root config (npm workspaces: server, client)
├── docs/                           # Tài liệu thiết kế & quy chuẩn
│   ├── features.md                 # Đặc tả 64 tiêu chí nghiệm thu chi tiết
│   ├── architecture.md             # Kiến trúc hệ thống, layer, bảo mật phiên
│   ├── planning/
│   │   ├── development-plan.md     # Kế hoạch chi tiết 21 phases (P00 -> P20)
│   │   └── phase-status.json       # Trạng thái tiến độ & các cổng kiểm soát (Gates)
│   ├── guides/
│   │   └── ai-workflow.md          # Quy trình điều phối & kiểm thử AI
│   └── phase-reports/              # Biên bản bàn giao & nghiệm thu các phase P00-P20
├── server/                         # Ứng dụng Backend API & Worker
│   ├── package.json                # Server dependencies & scripts
│   ├── .env.example                # File mẫu biến môi trường
│   ├── src/
│   │   ├── server.js               # Điểm khởi chạy HTTP Server
│   │   ├── worker.js               # Điểm khởi chạy Worker nền (Email & Cleanup)
│   │   ├── app.js                  # Cấu hình Express app & middlewares
│   │   ├── config/                 # Cấu hình Database, biến môi trường
│   │   ├── controllers/            # Tầng điều khiển HTTP
│   │   ├── database/               # Quản lý kết nối & ACID transactions
│   │   ├── errors/                 # Lớp lỗi chuẩn hóa AppError & mã lỗi
│   │   ├── integrations/           # Tích hợp VNPay Client, Nodemailer
│   │   ├── middlewares/            # Auth, CSRF-Guard, Rate-Limit, Upload, ErrorHandler
│   │   ├── models/                 # 17 Mongoose schemas chuẩn hóa
│   │   ├── repositories/           # Tầng truy xuất dữ liệu (Data Access Layer)
│   │   ├── routes/                 # Định tuyến API (/api/v1/*)
│   │   ├── services/               # Tầng nghiệp vụ cốt lõi (Business Logic)
│   │   └── utils/                  # Tiện ích ngày giờ, logging, validation
│   ├── scripts/                    # Scripts đồng bộ indexes, seed admin, seed demo
│   └── tests/                      # 52 file kiểm thử Backend (Unit, Integration, Security)
├── client/                         # Ứng dụng Frontend React SPA
│   ├── package.json                # Client dependencies & scripts
│   ├── vite.config.js              # Cấu hình Vite & reverse proxy sang Backend
│   ├── src/
│   │   ├── components/             # Components dùng chung (Header, Footer, Modals)
│   │   ├── contexts/               # Contexts (AuthContext, ToastContext)
│   │   ├── layouts/                # PublicLayout, CustomerLayout, DashboardLayout
│   │   ├── pages/                  # Các trang theo vai trò (Auth, Search, Booking, Owner, Admin)
│   │   ├── routes/                 # Cấu hình Router & ProtectedRoute
│   │   └── services/               # API clients giao tiếp Backend
│   └── tests/                      # 29 file kiểm thử Client Component (138 tests)
└── tests/                          # Thư mục kiểm thử xuyên hệ thống
    └── e2e/
        ├── README.md               # Đặc tả bộ kiểm thử E2E
        └── release-ready-e2e.test.js # Bộ kiểm thử E2E 14 kịch bản liên vai trò
```

---

## 4. Hướng dẫn Cài đặt & Khởi động Dự án

### 4.1. Yêu cầu Tiền đề (Prerequisites)
- **Node.js:** Phiên bản `>= 20.x` (khuyến nghị Node 20 LTS hoặc Node 22).
- **npm:** Phiên bản `>= 10.x`.
- **MongoDB:** Phiên bản `>= 6.0` hoặc `>= 7.0` đã kích hoạt **Replica Set** (bắt buộc cho ACID transactions).

### 4.2. Cài đặt Dependencies
Từ thư mục gốc dự án, chạy lệnh:
```bash
npm install
```
Lệnh trên sẽ tự động cài đặt toàn bộ dependencies cho cả `server` và `client` thông qua npm workspaces.

### 4.3. Cấu hình Biến Môi trường (.env)
Tạo file `.env` tại thư mục gốc hoặc thư mục `server/` (đã có sẵn file mẫu `server/.env.example`):
```env
# Application
NODE_ENV=development
PORT=5000
API_PREFIX=/api/v1
CLIENT_ORIGIN=http://localhost:3000

# Database (Replica Set bắt buộc cho transactions)
MONGODB_URI=mongodb://127.0.0.1:27017/sport_booking?replicaSet=rs0
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/sport_booking_test?replicaSet=rs0

# JWT & Authentication
JWT_ACCESS_SECRET=sport_booking_jwt_access_secret_super_secure_min_32_chars_key_2026
JWT_ACCESS_EXPIRES_IN=10m
JWT_ISSUER=sport-booking
JWT_AUDIENCE=sport-booking-client
REFRESH_COOKIE_NAME=refresh_token
REFRESH_COOKIE_PATH=/api/v1/auth
SESSION_MAX_AGE_DAYS=7

# VNPay Sandbox Configuration
VNPAY_TMN_CODE=SANDBOX_TMN_CODE
VNPAY_HASH_SECRET=SANDBOX_HASH_SECRET_KEY
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/payment/result
VNPAY_IPN_URL=http://localhost:5000/api/v1/payments/vnpay-ipn

# Email (SMTP Mailtrap / Gmail / Sandbox)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=mock_smtp_user
SMTP_PASS=mock_smtp_password
EMAIL_FROM="SportBooking Support" <noreply@sportbooking.local>
```

### 4.4. Khởi tạo Cơ sở Dữ liệu & Dữ liệu Mẫu (Seed Data)
1. **Đảm bảo MongoDB Replica Set hoạt động:**
   ```bash
   npm run db:ensure-rs
   ```
2. **Đồng bộ hóa các Chỉ mục (Indexes):**
   ```bash
   npm run db:indexes
   ```
3. **Nạp Dữ liệu Mẫu Vận hành Toàn diện (Demo Dataset):**
   ```bash
   npm run db:seed-demo
   ```
   *Script này tự động tạo các tài khoản mẫu với mật khẩu chuẩn `Password123!`, các cơ sở thể thao tại Hà Nội và Đà Nẵng, môn cầu lông/bóng đá, các sân con và các đơn đặt sân mẫu với đầy đủ trạng thái (`CONFIRMED`, `COMPLETED`, `NO_SHOW`, `REFUNDED`, `PENDING_REFUND`).*

### 4.5. Khởi chạy Ứng dụng
Để trải nghiệm đầy đủ hệ thống, mở 3 cửa sổ terminal riêng biệt:

- **Terminal 1: Khởi động Backend API Server (cổng 5000)**
  ```bash
  npm run dev
  # hoặc: npm start
  ```
- **Terminal 2: Khởi động Background Worker (Email & Cleanup)**
  ```bash
  npm run worker
  ```
- **Terminal 3: Khởi động Frontend React App (cổng 3000)**
  ```bash
  npm run client:dev
  ```

Mở trình duyệt truy cập: [http://localhost:3000](http://localhost:3000).

---

## 5. Danh sách Tài khoản Kiểm thử & Demo

Tất cả các tài khoản demo dưới đây đều sử dụng mật khẩu chung: **`Password123!`**

| Vai trò | Email đăng nhập | Mật khẩu | Mục đích sử dụng / Mô tả kịch bản |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@sportbooking.local` | `Password123!` | Quản trị toàn hệ thống, cấp Owner, duyệt hồ sơ hoàn tiền, xem audit log, giám sát outbox. |
| **Chủ sân (Owner Hà Nội)** | `owner.hanoi@sportbooking.local` | `Password123!` | Quản lý Sân Cầu Lông Ba Đình, cấu hình giá, đặt sân hộ, xác nhận phục vụ (`COMPLETED`), xem dashboard doanh thu. |
| **Chủ sân (Owner Đà Nẵng)** | `owner.danang@sportbooking.local` | `Password123!` | Quản lý Sân Bóng Đá Sơn Trà, kiểm thử cô lập đa người thuê (Tenant Isolation). |
| **Khách hàng 1 (Customer An)**| `customer.an@sportbooking.local` | `Password123!` | Đặt sân trực tuyến, thanh toán VNPay, xem lịch sử đặt sân, hủy yêu cầu giữ chỗ. |
| **Khách hàng 2 (Customer Bình)**| `customer.binh@sportbooking.local` | `Password123!` | Kiểm thử xung đột đồng thời khi đặt cùng một khung giờ đã có người giữ chỗ. |

---

## 6. Hướng dẫn Chạy Kiểm thử (Verification & Test Suites)

Hệ thống được trang bị bộ kiểm thử tự động toàn diện từ tầng Unit, Tầng Tích hợp, Giao diện Thành phần (Component Tests) đến Toàn hệ thống (End-to-End):

```bash
# 1. Chạy toàn bộ 52 file kiểm thử Backend (Unit, Integration, Security, Index Constraints)
npm test

# 2. Chạy toàn bộ 29 file kiểm thử Frontend Component (138 Vitest tests)
npm run client:test

# 3. Chạy bộ kiểm thử Xuyên Hệ Thống E2E 14 kịch bản liên vai trò (Phase P20)
npm run test:e2e

# 4. Kiểm tra biên dịch sản phẩm Frontend (Vite production build)
npm run client:build

# 5. Kiểm tra tính toàn vẹn trạng thái Phase & Gate của dự án
npm run check:phase

# 6. Kiểm tra cú pháp và chất lượng mã nguồn backend
npm run lint
```

---

## 7. Kịch bản Trình diễn Môn học (Academic Presentation Scenario)

Kịch bản trình diễn được thiết kế theo luồng đời thực chuẩn trong 10-15 phút:

### Phần 1: Khách hàng Khám phá & Đặt sân Giữ chỗ (4 phút)
1. Truy cập [http://localhost:3000](http://localhost:3000), xem trang chủ hiển thị danh mục môn thể thao và các cơ sở nổi bật.
2. Tìm kiếm: Chọn môn "Cầu lông", khu vực "Hà Nội". Kết quả trả về "Sân Cầu Lông Ba Đình".
3. Nhấp vào cơ sở để xem chi tiết: địa chỉ, giờ mở cửa (06:00 - 22:00), chính sách hủy hoàn, danh sách sân con.
4. Xem lưới lịch ngày mai của "Sân Số 1": các ô giờ hiển thị màu sắc trực quan (Xanh: Trống, Đỏ: Đã đặt, Xám: Đã qua).
5. Đăng nhập với tài khoản `customer.an@sportbooking.local` / `Password123!`.
6. Chọn khung giờ 08:00 - 09:00, điền thông tin người chơi, nhấp **"Tiến hành đặt sân"**.
7. Hệ thống tạo đơn thành công, hiển thị đồng hồ đếm ngược **Giữ chỗ 10:00 phút** và nút chuyển hướng đến VNPay.

### Phần 2: Kiểm chứng Chống Xung đột Đồng thời (Concurrency Conflict) (2 phút)
1. Mở cửa sổ ẩn danh mới, đăng nhập với tài khoản `customer.binh@sportbooking.local` / `Password123!`.
2. Truy cập đúng Sân Số 1 ngày mai: khung giờ 08:00 - 09:00 lúc này hiển thị trạng thái **Đang giữ chỗ (HOLD)** màu vàng cam.
3. Nếu khách hàng Bình cố tình chọn khung giờ này và gửi yêu cầu đặt: Hệ thống lập tức trả về cảnh báo xung đột (HTTP 409 Conflict) với thông điệp: *"Khoảng thời gian đã có người giữ chỗ hoặc đã được đặt"*.

### Phần 3: Thanh toán VNPay & Phục vụ Khách hàng (3 phút)
1. Quay lại phiên khách hàng An, nhấp nút **"Thanh toán qua VNPay"**.
2. Tại cổng VNPay Sandbox, nhập thông tin thẻ demo hoặc giả lập webhook IPN thành công.
3. Màn hình tự động cập nhật kết quả: Đơn hàng chuyển sang **Đã thanh toán (PAID)**, trạng thái đặt sân là **Đã xác nhận (CONFIRMED)**.
4. Đăng nhập tài khoản `owner.hanoi@sportbooking.local` / `Password123!`, truy cập menu **Quản lý Đơn đặt sân**:
   - Thấy đơn đặt mới của khách hàng An với trạng thái Đã thanh toán.
   - Khi buổi chơi kết thúc, Chủ sân nhấp **"Hoàn tất phục vụ"** (`COMPLETED`).

### Phần 4: Quản trị viên, Xử lý Bất khả kháng & Hoàn tiền (3 phút)
1. Đăng nhập tài khoản `admin@sportbooking.local` / `Password123!`, truy cập **Dashboard Quản trị**:
   - Xem tổng quan doanh thu toàn sàn, số cơ sở hoạt động, số đơn đặt sân.
2. Demo cấp tài khoản Chủ sân mới (`/admin/users`): Nhập tên và email, hệ thống gửi email kích hoạt vào hàng đợi `EmailOutbox`.
3. Demo hủy bất khả kháng và hoàn tiền (`/admin/bookings`):
   - Chọn một đơn đã thanh toán, nhấp **"Hủy đơn & Lập hồ sơ hoàn tiền"** với lý do "Sự cố kỹ thuật điện".
   - Hệ thống tự động giải phóng lịch sân và tạo một hồ sơ `RefundCase` trạng thái `PENDING`.
   - Vào menu **Hồ sơ hoàn tiền** (`/admin/refunds`), nhấp **"Ghi nhận hoàn tiền thủ công"**, nhập mã ủy nhiệm chi ngân hàng (`proofReference`). Hồ sơ chuyển sang `REFUNDED`, email xác nhận hoàn tiền được tự động gửi cho khách hàng.
4. Giám sát Hàng đợi Email (`/admin/email-outbox`): Xem danh sách email sự kiện đã gửi thành công hoặc đang chờ gửi.

---

## 8. Danh mục Tài liệu Tham khảo Kỹ thuật

- [Đặc tả Tính năng & 64 Tiêu chí Nghiệm thu](docs/features.md)
- [Kiến trúc Dự án & Hướng dẫn Bảo mật Phiên](docs/architecture.md)
- [Kế hoạch Phát triển 21 Phases](docs/planning/development-plan.md)
- [Bảng Trạng thái Tiến độ Dự án](docs/planning/phase-status.json)
- [Đặc tả Bộ Kiểm thử E2E](tests/e2e/README.md)
- [Báo cáo Tổng kết Phase P20](docs/phase-reports/P20.md)
