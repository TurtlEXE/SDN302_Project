# Thiết kế Cơ sở dữ liệu MongoDB — Phase P00

> Dự án: Platform đặt sân thể thao (sport-booking)  
> Ngày biên soạn: 28/10/2026 — Phase P00  
> Công nghệ: MongoDB / Mongoose với Replica Set (bắt buộc cho Multi-Document ACID Transactions)  
> Tài liệu căn cứ: `docs/features.md`, `docs/architecture.md`, `docs/architecture-decisions.md`.

---

## 1. Nguyên tắc thiết kế và Môi trường lưu trữ

1. **Yêu cầu Replica Set:** MongoDB bắt buộc phải chạy dưới dạng Replica Set (kể cả trên máy local chạy 1-node `rs0`) để hỗ trợ MongoDB Transactions (`session.withTransaction`). Mọi thao tác ghi liên quan đến đặt sân, hủy sân, cập nhật thanh toán và xoay vòng refresh token phải chạy trong transaction có truyền đối tượng `session` xuyên suốt service và repository.
2. **Quy ước đặt tên:**
   - Collection: Dùng chữ thường, phân cách bằng dấu gạch dưới (`snake_case`), số nhiều (ví dụ: `users`, `facility_sports`, `court_day_schedules`, `payment_orders`).
   - Trường thuộc tính (Field): Dùng kiểu lạc đà (`camelCase`) (ví dụ: `slotStepMinutes`, `holdExpiresAt`, `startMinutes`).
3. **Quy ước thời gian và múi giờ:**
   - Múi giờ nghiệp vụ: `Asia/Ho_Chi_Minh` (UTC+7).
   - Ngày đặt sân (`bookingDate`): Chuỗi định dạng ISO `YYYY-MM-DD` (ví dụ: `"2026-11-05"`).
   - Giờ trong ngày (`startTime`, `endTime`): Chuỗi 24h định dạng `HH:mm` (ví dụ: `"06:00"`, `"07:30"`).
   - Số phút từ 00:00 (`startMinutes`, `endMinutes`): Số nguyên tính từ nửa đêm (ví dụ: `06:00` là `360`, `07:30` là `450`). Dùng để tối ưu hóa truy vấn kiểm tra giao khoảng: `startMinutes < newEnd AND endMinutes > newStart`.
   - Timestamps hệ thống (`createdAt`, `updatedAt`, `expiresAt`, `holdExpiresAt`, `usedAt`, `revokedAt`): MongoDB `Date` (UTC).
4. **Chính sách TTL (Time-To-Live):**
   - TTL index chỉ được phép dùng để dọn dẹp các token tạm thời (`auth_tokens` sau khi hết hạn, các `auth_sessions` đã hết hạn lâu ngày).
   - **Tuyệt đối KHÔNG áp dụng TTL index** cho các collection `bookings`, `booking_requests`, `payment_orders`, `payment_transactions`, `refund_cases` và `action_logs` để bảo toàn lịch sử và chứng từ thanh toán.
5. **Cơ chế chống chia nhỏ dữ liệu thành slot:**
   - Không tạo collection `slots` hoặc `booking_slots` theo từng ô 30/60/90 phút.
   - Các ô giờ liền nhau được gộp thành đúng 1 bản ghi `Booking` dạng khoảng liên tục. Các ô giờ trên giao diện được suy luận động từ cấu hình `FacilitySport`.

---

## 2. Sơ đồ thực thể và quan hệ (ERD)

```text
+-------------------+           +-----------------------+           +------------------+
|       User        |           |       Facility        |           |      Sport       |
| (CUSTOMER/OWNER/  | 1       * | (Cơ sở thể thao)      | 1       * | (Danh mục môn)   |
|      ADMIN)       +-----------+ ownerId               +-----+-----+                  |
+---------+---------+           +-----------------------+     |     +---------+--------+
          |                                                   |               |
          | 1                                                 | *             | 1
          |                                             +-----+---------------+----+
          | *                                           |      FacilitySport       |
+---------+---------+                                   | (slotStepMinutes: 30/60) |
|    AuthSession    |                                   +-------------+------------+
| (Hạn tối đa 7d)   |                                                 | 1
+---------+---------+                                                 |
          | 1                                                         | *
          |                                             +-------------+------------+
          | *                                           |          Court           |
+---------+---------+                                   | (Sân con cụ thể)         |
|   RefreshToken    |                                   +-------------+------------+
| (SHA-256 hash)    |                                                 | 1
+-------------------+                                                 |
                                                                      | *
+---------------------------------------------------------------------+--------------------+
|                                         |                                                |
| *                                       | *                                              | *
|                                         |                                                |
v                                         v                                                v
+-----------------------+     +-----------+-----------+                      +-------------+------------+
|     CourtBlock        |     |   CourtDaySchedule    |                      |      BookingRequest      |
| (Khóa lịch bảo trì)   |     | (Điều phối nguyên tử) |                      | (Yêu cầu đặt từ khách)   |
+-----------------------+     | courtId + bookingDate |                      +-------------+------------+
                              +-----------------------+                                    | 1
                                                                                           |
                                                                          +----------------+----------------+
                                                                          | *                               | 1
                                                                          v                                 v
                                                              +-----------+-----------+         +-----------+-----------+
                                                              |        Booking        |         |     PaymentOrder      |
                                                              | (Khoảng gộp liên tục) |         | (Tổng tiền yêu cầu)   |
                                                              +-----------------------+         +-----------+-----------+
                                                                                                            | 1
                                                                                                            |
                                                                                           +----------------+----------------+
                                                                                           | *                               | *
                                                                                           v                                 v
                                                                               +-----------+-----------+         +-----------+-----------+
                                                                               |  PaymentTransaction   |         |      RefundCase       |
                                                                               | (VNPay callback txn)  +-------->+ (Hoàn tiền thủ công)  |
                                                                               +-----------------------+         +-----------------------+
```

---

## 3. Chi tiết các Collection và Mongoose Schema

### 3.1. `users` — Tài khoản người dùng

Lưu thông tin tài khoản cho cả 3 vai trò: `CUSTOMER`, `OWNER`, `ADMIN`.

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `email` | String | Có | | Email đăng nhập chuẩn hóa (lowercase, trimmed) |
| `passwordHash` | String | Không | null | Mật khẩu băm (bcrypt/argon2); rỗng với OWNER khi mới tạo chưa kích hoạt |
| `fullName` | String | Có | | Họ và tên người dùng |
| `phoneNumber` | String | Có | | Số điện thoại liên hệ |
| `role` | String | Có | `"CUSTOMER"` | Enum: `CUSTOMER`, `OWNER`, `ADMIN` |
| `isLocked` | Boolean | Có | `false` | Cờ tài khoản bị Admin khóa |
| `lockReason` | String | Không | null | Lý do khóa tài khoản |
| `tokenVersion` | Number | Có | `0` | Phiên bản token; tăng lên khi logout-all, đổi pass hoặc bị khóa |
| `emailVerifiedAt` | Date | Không | null | Thời điểm xác thực email (với CUSTOMER) |
| `activatedAt` | Date | Không | null | Thời điểm kích hoạt tài khoản và đặt pass (với OWNER) |
| `createdAt` | Date | Có | `Date.now` | Thời điểm tạo |
| `updatedAt` | Date | Có | `Date.now` | Thời điểm cập nhật |

- **Indexes:**
  - Unique Index: `{ email: 1 }`
  - Index: `{ role: 1, isLocked: 1 }`

---

### 3.2. `auth_tokens` — Token dùng một lần qua email

Phục vụ các luồng: xác thực email khách hàng, mời kích hoạt chủ sân, và đặt lại mật khẩu.

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `userId` | ObjectId | Có | | Tham chiếu `users._id` |
| `type` | String | Có | | Enum: `VERIFY_EMAIL`, `ACTIVATE_OWNER`, `RESET_PASSWORD` |
| `tokenHash` | String | Có | | Mã SHA-256 của chuỗi token ngẫu nhiên |
| `expiresAt` | Date | Có | | Thời điểm hết hạn (15 phút với verify/reset; 24 giờ với activate) |
| `usedAt` | Date | Không | null | Thời điểm token đã được tiêu thụ |
| `createdAt` | Date | Có | `Date.now` | Thời điểm tạo |

- **Indexes:**
  - Unique Index: `{ tokenHash: 1 }`
  - Index: `{ userId: 1, type: 1 }`
  - TTL Index: `{ expiresAt: 1 }` với `expireAfterSeconds: 604800` (dọn dẹp bản ghi cũ sau 7 ngày)

---

### 3.3. `auth_sessions` — Phiên đăng nhập người dùng

Mỗi lần login thành công tạo một `AuthSession`. Có hạn tuyệt đối tối đa 7 ngày.

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính (chính là claim `sid` trong Access JWT) |
| `userId` | ObjectId | Có | | Tham chiếu `users._id` |
| `ipAddress` | String | Không | null | Địa chỉ IP tại lúc đăng nhập |
| `userAgent` | String | Không | null | Chuỗi User-Agent |
| `absoluteExpiresAt` | Date | Có | | Hạn tuyệt đối của phiên (login time + 7 ngày) |
| `revokedAt` | Date | Không | null | Thời điểm phiên bị thu hồi |
| `revokedReason` | String | Không | null | Lý do thu hồi (LOGOUT, PASSWORD_CHANGED, REUSE_DETECTED, ADMIN_LOCKED) |
| `createdAt` | Date | Có | `Date.now` | Thời điểm tạo |
| `updatedAt` | Date | Có | `Date.now` | Thời điểm cập nhật |

- **Indexes:**
  - Index: `{ userId: 1, revokedAt: 1 }`
  - TTL Index: `{ absoluteExpiresAt: 1 }` với `expireAfterSeconds: 86400` (dọn dẹp sau 1 ngày từ khi hết hạn phiên)

---

### 3.4. `refresh_tokens` — Refresh token luân phiên trong cookie

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `sessionId` | ObjectId | Có | | Tham chiếu `auth_sessions._id` |
| `userId` | ObjectId | Có | | Tham chiếu `users._id` |
| `tokenHash` | String | Có | | SHA-256 hash của refresh token nhận diện |
| `expiresAt` | Date | Có | | Hạn token (không vượt quá `absoluteExpiresAt` của session) |
| `usedAt` | Date | Không | null | Thời điểm token đã được dùng để rotate |
| `revokedAt` | Date | Không | null | Thời điểm bị thu hồi |
| `replacedByTokenId`| ObjectId | Không | null | Tham chiếu đến RefreshToken mới kế tiếp |
| `createdAt` | Date | Có | `Date.now` | Thời điểm tạo |

- **Indexes:**
  - Unique Index: `{ tokenHash: 1 }`
  - Index: `{ sessionId: 1, usedAt: 1 }`
  - TTL Index: `{ expiresAt: 1 }` với `expireAfterSeconds: 604800`

---

### 3.5. `sports` — Danh mục môn thể thao

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `name` | String | Có | | Tên môn (Bóng đá, Cầu lông, Tennis, Pickleball) |
| `normalizedName` | String | Có | | Tên viết hoa/chuẩn hóa để chống trùng lặp |
| `description` | String | Không | `""` | Mô tả môn thể thao |
| `isActive` | Boolean | Có | `true` | Cờ cho phép chọn khi tạo sân |
| `createdAt` | Date | Có | `Date.now` | |
| `updatedAt` | Date | Có | `Date.now` | |

- **Indexes:**
  - Unique Index: `{ normalizedName: 1 }`
  - Index: `{ isActive: 1 }`

---

### 3.6. `facilities` — Cơ sở thể thao

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `ownerId` | ObjectId | Có | | Tham chiếu `users._id` (phải có vai trò `OWNER`) |
| `name` | String | Có | | Tên cơ sở |
| `description` | String | Không | `""` | Giới thiệu cơ sở |
| `address` | String | Có | | Địa chỉ chi tiết |
| `province` | String | Có | | Tỉnh / Thành phố |
| `phoneNumber` | String | Có | | Số điện thoại liên hệ của cơ sở |
| `openTime` | String | Có | `"06:00"` | Giờ mở cửa định dạng `HH:mm` (bội số của 30 phút) |
| `closeTime` | String | Có | `"22:00"` | Giờ đóng cửa định dạng `HH:mm` (tối đa `"23:00"`) |
| `operatingHoursVersion`| Number | Có | `1` | Phiên bản cấu hình giờ mở/đóng cửa |
| `status` | String | Có | `"DRAFT"` | Enum: `DRAFT`, `PUBLISHED`, `PAUSED` |
| `isLockedByAdmin` | Boolean | Có | `false` | Cờ khóa bởi Quản trị viên |
| `lockReason` | String | Không | null | Lý do Admin khóa cơ sở |
| `images` | Array | Có | `[]` | Danh sách ảnh cơ sở (tối đa 10 ảnh) |
| `images[].id` | String | Có | | Mã nhận diện ảnh |
| `images[].url` | String | Có | | Đường dẫn ảnh |
| `images[].isCover` | Boolean | Có | `false` | Ảnh đại diện |
| `images[].order` | Number | Có | `0` | Thứ tự hiển thị |
| `createdAt` | Date | Có | `Date.now` | |
| `updatedAt` | Date | Có | `Date.now` | |

- **Indexes:**
  - Index: `{ ownerId: 1 }`
  - Index: `{ status: 1, isLockedByAdmin: 1, province: 1 }`
  - Text Index: `{ name: "text", address: "text" }`

---

### 3.7. `facility_sports` — Nhóm môn tại cơ sở & Cấu hình bước giờ

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `facilityId` | ObjectId | Có | | Tham chiếu `facilities._id` |
| `sportId` | ObjectId | Có | | Tham chiếu `sports._id` |
| `slotStepMinutes` | Number | Có | `60` | Bước giờ: chỉ chấp nhận giá trị `30`, `60`, hoặc `90` |
| `configVersion` | Number | Có | `1` | Phiên bản cấu hình; tăng khi đổi `slotStepMinutes` |
| `createdAt` | Date | Có | `Date.now` | |
| `updatedAt` | Date | Có | `Date.now` | |

- **Indexes:**
  - Unique Compound Index: `{ facilityId: 1, sportId: 1 }`

---

### 3.8. `courts` — Sân con cụ thể

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `facilitySportId`| ObjectId | Có | | Tham chiếu `facility_sports._id` |
| `facilityId` | ObjectId | Có | | Tham chiếu `facilities._id` (denormalized để query nhanh) |
| `sportId` | ObjectId | Có | | Tham chiếu `sports._id` (denormalized để query nhanh) |
| `name` | String | Có | | Tên sân (ví dụ: Sân số 1, Sân VIP) |
| `description` | String | Không | `""` | Đặc điểm sân (mặt cỏ nhân tạo, sàn gỗ...) |
| `pricePerHourVnd`| Number | Có | | Giá thuê 1 giờ (số nguyên VND > 0) |
| `priceVersion` | Number | Có | `1` | Phiên bản giá; tăng mỗi lần đổi giá |
| `isActive` | Boolean | Có | `true` | Trạng thái nhận đặt sân |
| `createdAt` | Date | Có | `Date.now` | |
| `updatedAt` | Date | Có | `Date.now` | |

- **Indexes:**
  - Unique Compound Index: `{ facilitySportId: 1, name: 1 }`
  - Index: `{ facilityId: 1, isActive: 1 }`
  - Index: `{ sportId: 1, isActive: 1, pricePerHourVnd: 1 }`

---

### 3.9. `court_day_schedules` — Bản ghi điều phối nguyên tử sân/ngày

Tài liệu này dùng để tuần tự hóa các giao dịch đặt sân, khóa sân và cập nhật thanh toán trên cùng một sân trong một ngày.

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `courtId` | ObjectId | Có | | Tham chiếu `courts._id` |
| `bookingDate` | String | Có | | Ngày chơi định dạng `YYYY-MM-DD` |
| `scheduleVersion`| Number | Có | `1` | Số nguyên tăng dần mỗi khi có thay đổi lịch |
| `updatedAt` | Date | Có | `Date.now` | Thời điểm cập nhật cuối |

- **Indexes:**
  - Unique Compound Index: `{ courtId: 1, bookingDate: 1 }`

---

### 3.10. `court_blocks` — Lịch khóa sân (bảo trì, đột xuất)

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `courtId` | ObjectId | Có | | Tham chiếu `courts._id` |
| `bookingDate` | String | Có | | Ngày khóa `YYYY-MM-DD` |
| `startTime` | String | Có | | Giờ bắt đầu `HH:mm` |
| `endTime` | String | Có | | Giờ kết thúc `HH:mm` |
| `startMinutes` | Number | Có | | Số phút từ 00:00 của `startTime` |
| `endMinutes` | Number | Có | | Số phút từ 00:00 của `endTime` |
| `reason` | String | Có | | Lý do khóa sân |
| `createdBy` | ObjectId | Có | | Tham chiếu `users._id` (Owner hoặc Admin) |
| `isActive` | Boolean | Có | `true` | `true`: đang hiệu lực; `false`: đã mở khóa |
| `createdAt` | Date | Có | `Date.now` | |
| `updatedAt` | Date | Có | `Date.now` | |

- **Indexes:**
  - Index: `{ courtId: 1, bookingDate: 1, isActive: 1, startMinutes: 1, endMinutes: 1 }`

---

### 3.11. `booking_requests` — Yêu cầu đặt sân tổng thể

Đại diện cho một lần khách hàng hoặc chủ sân xác nhận lựa chọn đặt lịch.

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `requestNumber` | String | Có | | Mã yêu cầu sinh ngẫu nhiên duy nhất (ví dụ: `BR20261101-ABCD`) |
| `customerId` | ObjectId | Không | null | Tham chiếu `users._id`; null nếu do Owner tạo cho khách ngoài |
| `createdBy` | ObjectId | Có | | Người tạo request (`users._id`) |
| `source` | String | Có | `"CUSTOMER_ONLINE"` | Enum: `CUSTOMER_ONLINE`, `OWNER_ON_BEHALF` |
| `courtId` | ObjectId | Có | | Tham chiếu `courts._id` |
| `facilityId` | ObjectId | Có | | Tham chiếu `facilities._id` (denormalized) |
| `bookingDate` | String | Có | | Ngày chơi `YYYY-MM-DD` |
| `totalAmountVnd`| Number | Có | | Tổng tiền tất cả các booking con cộng lại (số nguyên VND) |
| `holdExpiresAt` | Date | Có | | Thời điểm hết hạn giữ chỗ (`createdAt + 10 phút`) |
| `contactName` | String | Có | | Tên người liên hệ |
| `contactPhone` | String | Có | | Số điện thoại liên hệ |
| `guestAccessCodeHash`| String | Không | null | Mã băm truy cập cho đơn owner tạo cho khách chưa có tài khoản |
| `idempotencyKey`| String | Có | | Khóa chống lặp yêu cầu |
| `payloadFingerprint`| String| Có | | Hash nội dung lựa chọn để phát hiện thay đổi nội dung khi retry |
| `createdAt` | Date | Có | `Date.now` | |
| `updatedAt` | Date | Có | `Date.now` | |

- **Indexes:**
  - Unique Index: `{ requestNumber: 1 }`
  - Unique Compound Index: `{ createdBy: 1, idempotencyKey: 1 }`
  - Index: `{ customerId: 1, createdAt: -1 }`
  - Index: `{ holdExpiresAt: 1 }`

---

### 3.12. `bookings` — Đơn đặt sân dạng khoảng đã gộp

Mỗi bản ghi đại diện cho một khoảng thời gian liên tục đã được gộp.

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `bookingCode` | String | Có | | Mã đơn duy nhất (ví dụ: `BK20261101-1234`) |
| `bookingRequestId`| ObjectId | Có | | Tham chiếu `booking_requests._id` |
| `customerId` | ObjectId | Không | null | Tham chiếu `users._id` (khách hàng sở hữu đơn) |
| `courtId` | ObjectId | Có | | Tham chiếu `courts._id` |
| `facilityId` | ObjectId | Có | | Tham chiếu `facilities._id` |
| `bookingDate` | String | Có | | Ngày chơi `YYYY-MM-DD` |
| `startTime` | String | Có | | Giờ bắt đầu `HH:mm` |
| `endTime` | String | Có | | Giờ kết thúc `HH:mm` |
| `startMinutes` | Number | Có | | Số phút từ 00:00 của `startTime` |
| `endMinutes` | Number | Có | | Số phút từ 00:00 của `endTime` |
| `durationMinutes`| Number| Có | | `endMinutes - startMinutes` |
| `pricePerHourVnd`| Number| Có | | Giá/giờ được chốt tại thời điểm đặt |
| `totalPriceVnd` | Number | Có | | `Math.round(pricePerHourVnd * durationMinutes / 60)` |
| `allocatedAmountVnd`| Number| Có | `0` | Số tiền thực nhận được phân bổ từ VNPay |
| `status` | String | Có | `"PENDING_PAYMENT"`| Enum: `PENDING_PAYMENT`, `CONFIRMED`, `CANCELLED`, `EXPIRED`, `COMPLETED`, `NO_SHOW` |
| `paymentStatus` | String | Có | `"UNPAID"` | Enum: `UNPAID`, `PAID`, `REFUND_PENDING`, `REFUNDED` |
| `holdExpiresAt` | Date | Có | | Hạn giữ chỗ (trùng với `BookingRequest`) |
| `snapshot` | Object | Có | | Bản chụp thông tin: tên cơ sở, địa chỉ, tên sân, tên môn, bước giờ |
| `cancellation` | Object | Không | null | `{ cancelledAt, cancelledBy, reason }` |
| `completion` | Object | Không | null | `{ completedAt, completedBy, note }` |
| `statusVersion` | Number | Có | `1` | Phiên bản trạng thái (optimistic concurrency) |
| `createdAt` | Date | Có | `Date.now` | |
| `updatedAt` | Date | Có | `Date.now` | |

- **Indexes:**
  - Unique Index: `{ bookingCode: 1 }`
  - Compound Index (Query lịch & kiểm tra giao khoảng):  
    `{ courtId: 1, bookingDate: 1, status: 1, startMinutes: 1, endMinutes: 1 }`
  - Index: `{ bookingRequestId: 1 }`
  - Index: `{ customerId: 1, bookingDate: 1 }`
  - Index: `{ facilityId: 1, bookingDate: 1 }`

---

### 3.13. `payment_orders` — Yêu cầu thanh toán tổng thể

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `bookingRequestId`| ObjectId| Có | | Tham chiếu `booking_requests._id` (Unique 1-1) |
| `vnpayTxnRef` | String | Có | | Mã tham chiếu gửi sang VNPay (ví dụ: `PO20261101-998877`) |
| `expectedAmountVnd`| Number| Có | | Tổng số tiền cần thu chính xác (VND) |
| `status` | String | Có | `"PENDING"` | Enum: `PENDING`, `PAID`, `CLOSED`, `REVIEW` |
| `closedReason` | String | Không | null | Lý do đóng: `EXPIRED`, `CUSTOMER_CANCELLED`, `FAILED_PAYMENT` |
| `expiresAt` | Date | Có | | Hạn thanh toán (chính xác bằng `holdExpiresAt`) |
| `processingVersion`| Number| Có | `1` | Phiên bản xử lý giao dịch |
| `createdAt` | Date | Có | `Date.now` | |
| `updatedAt` | Date | Có | `Date.now` | |

- **Indexes:**
  - Unique Index: `{ bookingRequestId: 1 }`
  - Unique Index: `{ vnpayTxnRef: 1 }`
  - Index: `{ status: 1, expiresAt: 1 }`

---

### 3.14. `payment_transactions` — Giao dịch VNPay thực tế ghi nhận

Lưu kết quả callback từ VNPay (IPN/Return).

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `paymentOrderId`| ObjectId | Không | null | Tham chiếu `payment_orders._id` |
| `vnpayTransactionNo`| String| Không| null | Mã giao dịch ngân hàng do VNPay cấp (`vnp_TransactionNo`) |
| `vnpayTxnRef` | String | Có | | Mã `vnp_TxnRef` nhận từ callback |
| `amountVnd` | Number | Có | | Số tiền thực nhận tính bằng VND (`vnp_Amount / 100`) |
| `bankCode` | String | Không | null | Ngân hàng thanh toán (`vnp_BankCode`) |
| `responseCode` | String | Có | | Mã kết quả VNPay (`vnp_ResponseCode`, `"00"` là thành công) |
| `transactionStatus`| String| Có | | Trạng thái giao dịch VNPay (`vnp_TransactionStatus`) |
| `payDate` | Date | Không | null | Thời điểm thanh toán theo ghi nhận của VNPay (`vnp_PayDate`) |
| `isAccepted` | Boolean | Có | | `true`: Khoản thu hợp lệ đã được phân bổ cho đơn; `false`: Khoản thu ngoại lệ |
| `exceptionType` | String | Không | null | Enum: `LATE_PAYMENT`, `WRONG_AMOUNT`, `DUPLICATE_PAYMENT`, `UNKNOWN_ORDER` |
| `rawCallbackData`| Object | Có | | Dữ liệu callback đã lọc bỏ secret |
| `createdAt` | Date | Có | `Date.now` | |

- **Indexes:**
  - Unique Index (có điều kiện): `{ vnpayTransactionNo: 1 }` với partialFilter `{ vnpayTransactionNo: { $exists: true, $type: "string" } }`
  - Index: `{ paymentOrderId: 1 }`
  - Index: `{ isAccepted: 1, exceptionType: 1 }`

---

### 3.15. `refund_cases` — Hồ sơ xử lý hoàn tiền thủ công

Tạo khi Booking đã thanh toán bị hủy do cơ sở không thể phục vụ, hoặc khi phát sinh giao dịch VNPay đến muộn/sai tiền.

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `refundCaseCode`| String | Có | | Mã hồ sơ hoàn tiền (ví dụ: `RF20261101-001`) |
| `bookingId` | ObjectId | Không | null | Tham chiếu `bookings._id` (nếu hoàn do hủy booking) |
| `paymentTransactionId`| ObjectId| Có | | Tham chiếu `payment_transactions._id` nguồn tiền |
| `refundAmountVnd`| Number | Có | | Số tiền cần hoàn chính xác (VND) |
| `reason` | String | Có | | Lý do hoàn tiền (Cơ sở hủy lịch đột xuất, nộp thừa, nộp muộn) |
| `status` | String | Có | `"PENDING"` | Enum: `PENDING`, `REFUNDED` |
| `processedBy` | ObjectId | Không | null | Admin xử lý hoàn tiền |
| `processedAt` | Date | Không | null | Thời điểm Admin xác nhận đã chuyển tiền hoàn |
| `proofReference`| String | Không | null | Mã tham chiếu ủy nhiệm chi / biên lai chuyển khoản |
| `proofImageUrl` | String | Không | null | Ảnh chụp biên lai chuyển tiền thành công |
| `createdAt` | Date | Có | `Date.now` | |
| `updatedAt` | Date | Có | `Date.now` | |

- **Indexes:**
  - Unique Index: `{ refundCaseCode: 1 }`
  - Index: `{ bookingId: 1 }`
  - Index: `{ paymentTransactionId: 1 }`
  - Index: `{ status: 1 }`

---

### 3.16. `email_outbox` — Hàng đợi gửi email nghiệp vụ

Ghi nhận sự kiện gửi email ngay trong transaction thay đổi dữ liệu; tiến trình nền sẽ quét và gửi email thực tế.

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `eventKey` | String | Có | | Khóa chống trùng lặp sự kiện duy nhất (ví dụ: `BOOKING_CONFIRMED:PO20261101-998877:user@mail.com`) |
| `eventType` | String | Có | | Enum: `VERIFY_EMAIL`, `ACTIVATE_OWNER`, `RESET_PASSWORD`, `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `HOLD_EXPIRED`, `REFUND_PROCESSED`, `ACCOUNT_LOCKED` |
| `recipientEmail`| String | Có | | Địa chỉ email người nhận |
| `recipientName` | String | Không | `""` | Tên người nhận |
| `subject` | String | Có | | Tiêu đề email |
| `templateName` | String | Có | | Tên template email trong `templates/emails/` |
| `templateData` | Object | Có | | Dữ liệu render email (mã đơn, giờ chơi, số tiền...) |
| `status` | String | Có | `"PENDING"` | Enum: `PENDING`, `SENT`, `FAILED` |
| `retryCount` | Number | Có | `0` | Số lần đã thử gửi lại (tối đa 3 lần) |
| `nextRetryAt` | Date | Có | `Date.now` | Thời điểm thử lại tiếp theo |
| `lastError` | String | Không | null | Thông báo lỗi của lần thử gần nhất |
| `sentAt` | Date | Không | null | Thời điểm gửi thành công |
| `createdAt` | Date | Có | `Date.now` | |

- **Indexes:**
  - Unique Index: `{ eventKey: 1 }`
  - Index: `{ status: 1, nextRetryAt: 1 }`

---

### 3.17. `action_logs` — Nhật ký kiểm toán thao tác quản trị & nghiệp vụ

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `_id` | ObjectId | Có | auto | Khóa chính |
| `actorId` | ObjectId | Không | null | Người thực hiện (`users._id`), null nếu hệ thống tự động |
| `actorRole` | String | Có | | Vai trò: `ADMIN`, `OWNER`, `CUSTOMER`, `SYSTEM` |
| `targetType` | String | Có | | Đối tượng tác động: `USER`, `FACILITY`, `COURT`, `BOOKING`, `REFUND` |
| `targetId` | ObjectId | Có | | Khóa chính của đối tượng tác động |
| `action` | String | Có | | Tên hành động: `LOCK_USER`, `UNLOCK_USER`, `LOCK_FACILITY`, `ADMIN_CANCEL_BOOKING`, `COMPLETE_BOOKING`, `RECORD_REFUND` |
| `reason` | String | Không | null | Lý do thực hiện |
| `previousState`| Object | Không | null | Bản chụp trạng thái trước |
| `newState` | Object | Không | null | Bản chụp trạng thái sau |
| `ipAddress` | String | Không | null | IP người thao tác |
| `createdAt` | Date | Có | `Date.now` | |

- **Indexes:**
  - Index: `{ targetType: 1, targetId: 1, createdAt: -1 }`
  - Index: `{ actorId: 1, createdAt: -1 }`

