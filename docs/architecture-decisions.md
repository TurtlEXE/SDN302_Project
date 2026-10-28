# Quyết định kiến trúc và cấu hình nền tảng (ADR) — Phase P00

> Dự án: Platform đặt sân thể thao (sport-booking)  
> Ngày chốt: 28/10/2026 — Phase P00  
> Tài liệu căn cứ: `docs/features.md`, `docs/architecture.md`, `docs/planning/development-plan.md`.

---

## 1. ADR-01: Quy ước múi giờ, ngày và thời gian nghiệp vụ

### Bối cảnh
Nghiệp vụ đặt sân thể thao diễn ra tại Việt Nam, khách hàng và chủ sân thao tác theo giờ địa phương. Cần tránh lỗi lệch giờ do chênh lệch múi giờ giữa máy chủ (thường là UTC), client trình duyệt và cơ sở dữ liệu. Đồng thời cần hỗ trợ việc kiểm tra giao khoảng thời gian (`[start, end)`) một cách chính xác, hiệu năng cao trên MongoDB.

### Quyết định
1. **Múi giờ nghiệp vụ thống nhất:** Cố định là `Asia/Ho_Chi_Minh` (UTC+7) cho mọi tính toán ngày chơi, giờ mở/đóng cửa, kiểm tra quá giờ và hiển thị.
2. **Biểu diễn ngày chơi (`bookingDate`):** Lưu dạng chuỗi định dạng ISO `YYYY-MM-DD` (ví dụ: `2026-11-01`). Chuỗi này độc lập với múi giờ, loại bỏ hoàn toàn nguy cơ lệch sang ngày hôm trước/sau khi serialize qua lại giữa server và client.
3. **Biểu diễn giờ trong ngày (`startTime`, `endTime`):**
   - Lưu chuỗi giờ 24h: `HH:mm` (ví dụ: `06:00`, `07:30`, `22:00`).
   - Lưu kèm số phút nguyên tính từ 00:00 (`startMinutes`, `endMinutes`): ví dụ `06:00` là `360`, `07:30` là `450`.
   - **Lợi ích:** Truy vấn kiểm tra giao nhau giữa khoảng mới `[newStart, newEnd)` và các khoảng hiện hữu `[existingStart, existingEnd)` trở thành phép so sánh số nguyên cực nhanh:  
     `existing.startMinutes < newEndMinutes AND existing.endMinutes > newStartMinutes`.
4. **Biểu diễn timestamp kỹ thuật:** Mọi trường thời điểm hệ thống như `createdAt`, `updatedAt`, `holdExpiresAt`, `expiresAt`, `revokedAt`, `usedAt`, `emailVerifiedAt` lưu dưới dạng MongoDB Date (UTC ISO 8601 string khi trả về API).
5. **Quy tắc thời gian đặt:**
   - Ngày đặt được phép từ ngày hiện tại (`today`) đến tối đa `today + 30 ngày`.
   - Giờ bắt đầu của đơn đặt (`startTime`) phải cách thời điểm tạo yêu cầu ít nhất 15 phút để đảm bảo khách có đủ cửa sổ thanh toán 10 phút trước khi buổi chơi bắt đầu.
   - Giờ hoạt động mở cửa tối đa đến 23:00 (không hỗ trợ chơi qua đêm trong bản đầu).

---

## 2. ADR-02: Phân cấp Cơ sở (Facility) → Nhóm môn (FacilitySport) → Sân con (Court)

### Bối cảnh
Mỗi cơ sở có thể có nhiều môn thể thao khác nhau (ví dụ: cầu lông, bóng đá, tennis). Mỗi môn có đặc thù thời lượng chơi khác nhau: cầu lông thường đặt theo bước 30 phút hoặc 60 phút, bóng đá thường đặt theo bước 90 phút.

### Quyết định
1. **Thực thể `FacilitySport` (Cặp Cơ sở - Môn thể thao):**
   - Đóng vai trò là cấu hình trung gian giữa `Facility` và `Court`.
   - Lưu cấu hình bước giờ: `slotStepMinutes ∈ {30, 60, 90}`.
   - Unique compound index: `{ facilityId: 1, sportId: 1 }`.
   - Có `configVersion` (số nguyên tăng dần mỗi khi đổi cấu hình).
2. **Thực thể Sân con `Court`:**
   - Thuộc về đúng một `FacilitySport` (từ đó suy ra `facilityId` và `sportId`).
   - Có mức giá cố định theo giờ (`pricePerHourVnd`, số nguyên VND > 0) và trạng thái nhận đặt (`isActive`).
   - Không cấu hình bước giờ riêng lẻ trên từng sân con trong cùng một nhóm môn.
3. **Mốc sinh ô giờ (Slot Generator):**
   - Mốc gốc luôn bắt đầu từ giờ mở cửa của cơ sở (`openTime`).
   - Các ô có dạng `[openTime + n × step, openTime + (n+1) × step)`.
   - Phần dư cuối ngày nếu nhỏ hơn `slotStepMinutes` (ví dụ mở đến 23:00, bước 90 phút thì đoạn 22:30–23:00) sẽ không được sinh ô và không cho phép đặt.
4. **Bảo vệ toàn vẹn khi đổi cấu hình:**
   - Chỉ cho phép sửa `slotStepMinutes` khi toàn bộ các sân trong `FacilitySport` không còn Booking `PENDING_PAYMENT` còn hạn, Booking `CONFIRMED` chưa kết thúc (endTime > hiện tại) và lịch khóa `CourtBlock` chưa kết thúc.
   - Tương tự, chỉ cho phép đổi giờ mở/đóng cửa của cơ sở khi toàn bộ cơ sở không còn lịch chưa kết thúc.

---

## 3. ADR-03: Mô hình BookingRequest → Các Booking dạng khoảng → Một PaymentOrder

### Bối cảnh
Khách hàng có thể chọn nhiều ô giờ trong cùng một ngày trên một sân con. Các ô giờ có thể liền nhau (ví dụ `08:00–08:30`, `08:30–09:00`, `09:00–09:30`) hoặc rời nhau (ví dụ `06:00–07:00` và `08:00–08:30`).

### Quyết định
1. **Thuật toán gộp khoảng trước khi lưu (Slot Merger):**
   - Các ô giờ liên tiếp trên cùng sân/ngày được tự động gộp thành đúng một khoảng liên tục duy nhất (`Booking`).
   - Ví dụ: `08:00–08:30`, `08:30–09:00`, `09:00–09:30` gộp thành 1 `Booking` có khoảng `08:00–09:30` (90 phút).
   - Tuyệt đối không lưu các bản ghi riêng lẻ cho từng ô 30/60/90 phút trong database.
2. **Xử lý các dải rời nhau:**
   - Nếu khách chọn các dải rời nhau (ví dụ `06:00–07:00` và `08:00–08:30`), hệ thống tạo 2 `Booking` riêng biệt. Khoảng giữa `07:00–08:00` hoàn toàn để trống.
3. **Quan hệ với `BookingRequest` và `PaymentOrder`:**
   - Một lần nhấn đặt tạo 1 `BookingRequest`.
   - `BookingRequest` liên kết với 1 hoặc nhiều `Booking` (nếu có các dải rời).
   - `BookingRequest` liên kết với đúng 1 `PaymentOrder` duy nhất chịu trách nhiệm thu 100% tổng tiền của toàn bộ các `Booking` con.
   - Tất cả `Booking` con chung một hạn thanh toán `holdExpiresAt = createdAt + 10 phút`.
4. **Tính tiền chuẩn xác:**
   - `Thành tiền Booking = Math.round(pricePerHourVnd × durationMinutes / 60)`.
   - `Tổng tiền PaymentOrder = ∑ (Thành tiền của từng Booking)`.
   - Không cộng dồn tiền từ các ô nhỏ đã làm tròn riêng lẻ; làm tròn sau khi tính trên tổng số phút của từng dải đã gộp.

---

## 4. ADR-04: Kiến trúc xác thực JWT, Cookie HttpOnly và CSRF Guard

### Bối cảnh
Yêu cầu bảo mật cao: chống đánh cắp token qua XSS, chống tấn công CSRF, hỗ trợ thu hồi phiên tức thời (khi logout, đổi mật khẩu, hoặc admin khóa tài khoản), và không dùng localStorage để lưu trữ token.

### Quyết định
1. **Access Token:**
   - JSON Web Token (JWT) ký bằng thuật toán cố định `HS256` với khóa bí mật tối thiểu 256-bit tại server.
   - Thời hạn ngắn: **10 phút** (`10m`).
   - Lưu trữ: Client chỉ giữ trong bộ nhớ RAM (`token-memory.js` / module variable). Tuyệt đối không lưu vào `localStorage`, `sessionStorage`, IndexedDB hay persisted state.
   - Header gửi đi: `Authorization: Bearer <accessToken>`.
   - Claims bắt buộc: `sub` (userId), `sid` (sessionId), `ver` (tokenVersion của user), `role`, `type: "access"`, `iss: "sport-booking"`, `aud: "sport-booking-client"`, `iat`, `exp`.
2. **Refresh Token & Cookie HttpOnly:**
   - Chuỗi ngẫu nhiên mật mã 64 ký tự (hex từ 32 bytes ngẫu nhiên). Server lưu trữ dạng SHA-256 hash trong database (`RefreshToken`).
   - Gửi về client qua HTTP header `Set-Cookie`:
     - Tên: `refresh_token`
     - Thuộc tính: `HttpOnly = true`, `SameSite = Lax`, `Path = /api/v1/auth`, `Secure = true` (trên HTTPS production, `false` trên HTTP development local), không đặt `Domain` (host-only).
     - `Max-Age`: Bằng số giây còn lại của phiên làm việc.
3. **Quản lý phiên (Session Management):**
   - Bản ghi `AuthSession` lưu tại database. Hạn tuyệt đối của phiên: tối đa **7 ngày** (`7d`) kể từ thời điểm đăng nhập ban đầu.
   - Thao tác refresh token thực hiện **rotation nguyên tử**: vô hiệu hóa refresh token cũ (`usedAt`), phát hành refresh token mới cùng cookie mới.
   - Nếu phát hiện token cũ được gửi lại (reuse): ngay lập tức thu hồi toàn bộ session (`revokedAt = now`) để bảo vệ tài khoản.
4. **Thu hồi phiên tức thì:**
   - Middleware `authenticate` kiểm tra chữ ký JWT, kiểm tra `AuthSession` (phải chưa bị revoked và chưa quá 7 ngày), kiểm tra `User` (phải active, `tokenVersion` phải khớp với claim `ver`).
   - Logout: Đánh dấu `revokedAt` cho session, xóa cookie `refresh_token`.
   - Logout-all / Đổi mật khẩu / Khóa tài khoản: Tăng `tokenVersion` của User trong database, thu hồi toàn bộ session đang mở. Access token cũ sẽ bị từ chối ngay lập tức ở request kế tiếp.
5. **CSRF & Origin Guard (`auth-request-guard`):**
   - Đối với các mutation endpoint xác thực gọi từ browser (`/api/v1/auth/login`, `/refresh`, `/logout`, v.v.):
     - Bắt buộc kiểm tra header tùy chỉnh: `X-CSRF-Guard: 1`.
     - Bắt buộc kiểm tra header `Origin`: phải khớp chính xác với `CLIENT_ORIGIN` được cấu hình.
     - Từ chối mọi request thiếu Origin, Origin null hoặc thiếu header guard.
   - Riêng webhook VNPay (`/api/v1/payments/vnpay-ipn`, `vnpay-return`) là ngoại lệ: không yêu cầu cookie, không yêu cầu JWT và không yêu cầu Origin guard, nhưng bắt buộc kiểm tra chữ ký HMAC SHA-512 của VNPay.

---

## 5. ADR-05: Cấu trúc Topology mạng và Triển khai

### Bối cảnh
Ứng dụng gồm React SPA và Node.js Express API. Cần thiết lập mô hình kết nối an toàn cho cookie và CORS.

### Quyết định
1. **Môi trường phát triển cục bộ (Local Development):**
   - Client chạy Vite dev server tại `http://localhost:3000`.
   - Backend chạy Express tại `http://localhost:5000`.
   - Vite cấu hình reverse proxy: mọi request bắt đầu bằng `/api` được chuyển tiếp tới `http://localhost:5000`.
   - Nhờ đó, trình duyệt coi client và API là cùng origin (`http://localhost:3000`), giúp cookie `SameSite=Lax` và cookie HttpOnly hoạt động hoàn toàn tự nhiên và ổn định.
2. **Môi trường triển khai Production / Staging:**
   - Ưu tiên cấu hình reverse proxy (Nginx, Caddy, hoặc Cloud Gateway) phục vụ chung một domain HTTPS duy nhất:
     - `https://sportbooking.example.com/` → React Static Bundle.
     - `https://sportbooking.example.com/api/` → Node.js Server.
   - Cùng Origin giúp bảo vệ cookie tối đa, không cần cấu hình `SameSite=None; Secure` và miễn nhiễm với chính sách chặn cookie bên thứ ba của các trình duyệt hiện đại.
   - Nếu bắt buộc tách subdomain (ví dụ `app.example.com` và `api.example.com`), bắt buộc cấu hình CORS allowlist cụ thể kèm `credentials: true`.

---

## 6. ADR-06: Cơ chế chống trùng lịch đồng thời qua MongoDB Replica Set & CourtDaySchedule

### Bối cảnh
Trong môi trường đa luồng/đa instance, hai khách hàng có thể chọn cùng một khung giờ và gửi yêu cầu tạo đơn đồng thời. Truy vấn đọc lịch thông thường trước khi insert không thể ngăn chặn race condition (Time-of-Check to Time-of-Use).

### Quyết định
1. **Yêu cầu MongoDB Replica Set:**
   - Bắt buộc triển khai MongoDB dạng Replica Set (kể cả local dùng 1-node replica set `rs0`) để hỗ trợ MongoDB Multi-Document ACID Transactions (`session.withTransaction`).
2. **Bản ghi điều phối nguyên tử `CourtDaySchedule`:**
   - Mỗi cặp `courtId + bookingDate` có đúng một document duy nhất trong collection `court_day_schedules`.
   - Ràng buộc: Unique compound index `{ courtId: 1, bookingDate: 1 }`.
   - Có trường `scheduleVersion` (số nguyên) và `updatedAt`.
3. **Quy trình tuần tự hóa giao dịch đặt/khóa lịch:**
   - **Bước 1:** Bắt đầu transaction.
   - **Bước 2:** Lấy quyền ghi độc quyền trên ngày/sân bằng thao tác `findOneAndUpdate` trên `CourtDaySchedule`:
     - Nếu chưa có document: upsert nguyên tử.
     - Tăng `scheduleVersion = scheduleVersion + 1`.
   - **Bước 3:** Đọc toàn bộ các `Booking` (trạng thái `PENDING_PAYMENT` còn hạn hoặc `CONFIRMED` hoặc `COMPLETED/NO_SHOW`) và `CourtBlock` đang hiệu lực trên `courtId` và `bookingDate`.
   - **Bước 4:** Kiểm tra giao nhau theo công thức khoảng:  
     `existing.startMinutes < newEndMinutes AND existing.endMinutes > newStartMinutes`.
   - **Bước 5:** Nếu có bất kỳ xung đột nào: abort transaction, trả về lỗi `SCHEDULE_CONFLICT`.
   - **Bước 6:** Nếu không xung đột: tạo `BookingRequest`, tạo toàn bộ `Booking` con, tạo `PaymentOrder` và ghi bản ghi `EmailOutbox` (nếu cần).
   - **Bước 7:** Commit transaction.
4. **Idempotency Key:**
   - `BookingRequest` chứa `idempotencyKey` duy nhất theo `userId + action`. Nếu client retry cùng idempotencyKey và cùng payload, trả về kết quả đã tạo mà không thực hiện lại giao dịch.

---

## 7. ADR-07: Quy trình thanh toán VNPay 100% và xử lý hoàn tiền ngoại lệ

### Bối cảnh
Hệ thống không thu tiền mặt tại sân, không thu hoa hồng và không cho phép đặt cọc một phần. Toàn bộ tiền thuê sân phải được thanh toán 100% qua VNPay tại thời điểm đặt.

### Quyết định
1. **Khởi tạo và hạn giữ chỗ:**
   - Giữ chỗ trong đúng **10 phút** (`holdExpiresAt = createdAt + 10 phút`).
   - Tham số VNPay `vnp_ExpireDate` được tính toán trùng khớp hoàn toàn với `holdExpiresAt`.
   - Số tiền gửi sang VNPay: `vnp_Amount = expectedAmountVnd × 100`.
2. **Xác minh callback phía server (IPN & Return):**
   - Cả hai endpoint `vnpay-return` và `vnpay-ipn` đều dùng chung một bộ kiểm tra nghiêm ngặt:
     - Kiểm tra chữ ký HMAC SHA-512 với bí mật merchant tại server.
     - Kiểm tra mã tham chiếu giao dịch (`vnp_TxnRef`) tồn tại trong bảng `PaymentOrder`.
     - Kiểm tra số tiền `vnp_Amount / 100 == expectedAmountVnd`.
     - Kiểm tra mã phản hồi `vnp_ResponseCode == "00"` và `vnp_TransactionStatus == "00"`.
3. **Chống xử lý lặp (Idempotency):**
   - Lưu `PaymentTransaction` với unique index trên mã giao dịch VNPay `vnp_TransactionNo`.
   - Nếu IPN và Return tới đồng thời, chỉ giao dịch đầu tiên chuyển trạng thái đơn sang `CONFIRMED` và `PAID`, giao dịch thứ hai nhận diện đã xử lý và trả kết quả thành công cho VNPay mà không cộng tiền hay gửi email lần hai.
4. **Xử lý tình huống biên:**
   - **Thanh toán thành công trong hạn:** Chuyển `PaymentOrder` sang `PAID`, phân bổ tiền vào từng `Booking`, chuyển tất cả `Booking` sang `CONFIRMED / PAID`, tạo outbox email xác nhận.
   - **Thanh toán thất bại:** Đóng `PaymentOrder` (`CLOSED`), hủy các `Booking` con (`CANCELLED`), giải phóng lịch.
   - **Kết quả đến sau khi đã hết hạn/hủy:** Tuyệt đối không tự động chiếm lại lịch của người khác. Chuyển `PaymentOrder` sang trạng thái `REVIEW`, ghi nhận `PaymentTransaction` ngoại lệ, tạo `RefundCase` chờ admin hỗ trợ hoàn tiền thủ công cho khách hàng.
5. **Chính sách hoàn tiền:**
   - Không tích hợp API hoàn tiền tự động VNPay (tránh rủi ro bảo mật và phức tạp không cần thiết cho đồ án).
   - Khi cơ sở thể thao không thể phục vụ (do sự cố sân, bảo trì đột xuất), Admin thực hiện hủy `Booking` đã xác nhận, tạo bản ghi `RefundCase` tương ứng với số tiền đã phân bổ của Booking đó.
   - Admin chuyển khoản hoàn tiền cho khách qua kênh ngân hàng bên ngoài, sau đó cập nhật bằng chứng chuyển tiền (mã giao dịch, hình ảnh biên lai) vào hệ thống để đổi trạng thái sang `REFUNDED`.

---

## 8. ADR-08: Chuẩn hóa định dạng phản hồi API và mã lỗi

### Chuẩn phản hồi thành công
```json
{
  "success": true,
  "data": { ... },
  "message": "Thao tác thành công" // tùy chọn
}
```

### Chuẩn phản hồi phân trang
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Chuẩn phản hồi lỗi
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_UPPERCASE",
    "message": "Thông báo thân thiện bằng tiếng Việt",
    "details": [
      {
        "field": "email",
        "message": "Email không đúng định dạng"
      }
    ]
  }
}
```

### Bảng mã lỗi chuẩn hóa toàn hệ thống
- `UNAUTHORIZED` (401): Chưa đăng nhập hoặc token không hợp lệ
- `ACCESS_TOKEN_EXPIRED` (401): Access token hết hạn (tín hiệu cho client refresh)
- `SESSION_REVOKED` (401): Phiên làm việc đã bị thu hồi hoặc phát hiện token reuse
- `ACCOUNT_LOCKED` (403): Tài khoản bị quản trị viên khóa
- `ACCOUNT_NOT_VERIFIED` (403): Khách hàng chưa xác thực email
- `ACCOUNT_NOT_ACTIVATED` (403): Chủ sân chưa kích hoạt tài khoản qua email mời
- `FORBIDDEN` (403): Không có quyền truy cập tài nguyên (sai role hoặc không sở hữu)
- `NOT_FOUND` (404): Tài nguyên không tồn tại
- `VALIDATION_ERROR` (422): Dữ liệu đầu vào không hợp lệ
- `SCHEDULE_CONFLICT` (409): Khung giờ đã có người đặt, đang giữ chỗ hoặc bị khóa
- `CONFIG_VERSION_MISMATCH` (409): Cấu hình bước giờ/giá đã thay đổi so với bản xem trước
- `HOLD_EXPIRED` (410): Thời hạn giữ chỗ 10 phút đã hết hạn
- `PAYMENT_FAILED` (400): Giao dịch thanh toán không thành công
- `INVALID_SIGNATURE` (400): Chữ ký dữ liệu thanh toán không hợp lệ
- `CSRF_GUARD_TRIGGERED` (403): Vi phạm Origin hoặc thiếu header X-CSRF-Guard
- `RATE_LIMIT_EXCEEDED` (429): Quá số lượt gửi request cho phép
- `INTERNAL_SERVER_ERROR` (500): Lỗi máy chủ nội bộ

---

## 9. ADR-09: Cấu hình môi trường cần thiết

Dự án yêu cầu các cấu hình môi trường được khai báo trong `server/.env.example`:
1. `MONGODB_URI`: Chuỗi kết nối MongoDB có tham số Replica Set (ví dụ: `mongodb://localhost:27017/sport_booking?replicaSet=rs0`).
2. `MONGODB_TEST_URI`: Database riêng biệt phục vụ test integration.
3. `JWT_ACCESS_SECRET`: Khóa bí mật ký access token (tối thiểu 32 ký tự).
4. `JWT_ACCESS_EXPIRES_IN`: Thời hạn access token (`10m`).
5. `REFRESH_COOKIE_NAME`: Tên cookie (`refresh_token`).
6. `SESSION_MAX_AGE_DAYS`: Hạn phiên đăng nhập (`7`).
7. `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_URL`: Cấu hình sandbox VNPay.
8. `VNPAY_RETURN_URL`, `VNPAY_IPN_URL`: URL nhận kết quả thanh toán.
9. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: Cấu hình máy chủ gửi email thử nghiệm (ví dụ Mailtrap / Ethereal / Gmail SMTP).
10. `STORAGE_DRIVER`, `STORAGE_LOCAL_PATH`: Cấu hình lưu trữ ảnh (mặc định lưu local trong `uploads/`, giới hạn JPG/PNG/WebP tối đa 5MB).

