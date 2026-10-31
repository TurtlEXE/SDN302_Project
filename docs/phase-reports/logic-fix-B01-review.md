# Báo cáo Review Độc lập: Logic Fix B01 — Luồng đặt sân và thanh toán

> Ngày review: 31/10/2026  
> Vai trò: Independent Code Reviewer (Độc lập)  
> Đối tượng review: Batch B01 (`docs/phase-reports/logic-fix-B01.md`, commit `65dde81321501b09503719fd70a8dd48e26a8a9e`, HEAD revision `fcb9231ed39f8845ccc023424112676fb042a45d`)  
> Kết luận sơ bộ: **NEEDS_CHANGES** (Phát hiện 1 lỗi P1 về kiểm soát quyền/lệch quy tắc đặt, 2 lỗi P2 về giao diện và xử lý đồng thời, 2 góp ý P3)

---

## 1. Phạm vi và Đối chiếu Hợp đồng B01

### 1.1. Tài liệu và Mã nguồn Đối chiếu
- Quy tắc dự án: `AGENTS.md` (Workspace & Project).
- Báo cáo triển khai batch: `docs/phase-reports/logic-fix-B01.md`.
- Đặc tả nghiệp vụ & kiến trúc: `docs/features.md` (Tiêu chí 6, 10, 11, 22, 26, 27, 28, 29, 32, 33, 34, 46, 51, 52), `docs/architecture.md` (Mục 7, 8, 10).
- Tài liệu hợp đồng API: `docs/api.openapi.yaml`.
- Mã nguồn backend: `server/src/controllers/schedule.controller.js`, `server/src/controllers/booking-request.controller.js`, `server/src/services/booking/booking-request.service.js`, `server/src/services/booking/schedule.service.js`, `server/src/services/booking/slot-merger.js`, `server/src/services/booking/booking-policy.js`, `server/src/services/payment/payment.service.js`, `server/src/middlewares/auth.js`, `server/src/middlewares/error-handler.js`.
- Mã nguồn client: `client/src/components/schedule/CourtSchedule.jsx`, `client/src/components/schedule/SelectedRangesSummary.jsx`, `client/src/pages/checkout/CheckoutPage.jsx`, `client/src/pages/owner/OwnerOnBehalfPage.jsx`, `client/src/pages/payment/GuestPayPage.jsx`.

### 1.2. Đối chiếu Checklist B01
1. **`configVersion` đi từ API lịch đến bản nháp và tạo đơn; không mặc định 1**: **ĐẠT**.
   - API trả `configVersion` từ `facilitySport.configVersion`.
   - `SelectedRangesSummary.jsx` lưu trực tiếp `configVersion` vào `sport_booking_draft`.
   - `CheckoutPage.jsx` gửi `draft.configVersion` (đã bỏ `|| 1`).
   - `booking-request.service.js` bắt buộc `typeof configVersion === 'number'` (ném 400 nếu thiếu) và `validateConfigVersion` ném 409 `CONFIG_VERSION_MISMATCH` nếu phiên bản lệch.
2. **Frontend gửi raw `selectedSlots`; backend gộp khoảng đúng bước giờ**: **ĐẠT**.
   - Client gửi các ô gốc đúng `slotStepMinutes` trong mảng `selectedSlots`.
   - Backend `slot-merger.js` chạy `validateSlot` (kiểm tra `duration === slotStepMinutes`), sắp xếp, phát hiện chồng lấn và gộp thành các `mergedIntervals` để tạo child `Booking`s độc lập.
3. **Owner dùng đúng ID và payload theo API**: **ĐẠT**.
   - `OwnerOnBehalfPage.jsx` sử dụng `fac.id || fac._id` và `court.id || court._id`.
   - Payload gửi `courtId`, `bookingDate`, `selectedSlots`, `customerName`, `customerPhone`, `configVersion`, `idempotencyKey`.
   - Backend controller map đúng sang `contactName`, `contactPhone`.
4. **`idempotencyKey` ổn định khi retry/tải lại, đổi đúng lúc khi tạo yêu cầu mới**: **ĐẠT MỘT PHẦN** (Xem Finding 5 về việc không reset key khi sửa tên/SĐT khách ở màn đặt hộ).
5. **Mất phản hồi sau khi server đã commit không sinh đơn mới**: **ĐẠT**.
   - Xác minh trên MongoDB Replica Set: Khi server đã commit đơn nhưng client gửi lại cùng key, `countDocuments` cho BookingRequest/Booking/PaymentOrder luôn giữ nguyên = 1.
6. **Retry đơn còn hạn có thể tiếp tục thanh toán; đơn đã trả/hủy/hết hạn không được mở lại hoặc gia hạn**: **ĐẠT TẠI BACKEND, LỖI TẠI FRONTEND** (Xem Finding 2 về việc `CheckoutPage` đứng im khi server trả đơn EXPIRED/PAID).
7. **Guest access code được bảo vệ; không lộ bí mật**: **ĐẠT**.
   - Mã truy cập bí mật được sinh phái sinh qua HMAC-SHA256 (`deriveGuestAccessCode`). MongoDB chỉ lưu SHA-256 hash `guestAccessCodeHash`, tuyệt đối không lưu plaintext.
8. **GuestPay hiển thị đúng tiền, mã yêu cầu và từng khoảng rời nhau**: **ĐẠT**.
   - `GuestPaymentOrderDTO` và `GuestPayPage.jsx` hiển thị đầy đủ `requestNumber`, `contactName`, `contactPhone`, `totalAmountVnd`, và danh sách từng khoảng thời gian rời rạc (`intervals`).
9. **Lịch và tạo đơn thống nhất quy tắc đặt trước theo vai trò**: **KHÔNG ĐẠT** (Xem Finding 1).
10. **Kiểm tra ảnh hưởng của optional authentication**: **KHÔNG ĐẠT** (Xem Finding 1).

---

## 2. Danh sách Findings chi tiết

### Finding 1 (P1 — Security / Broken Access Control & Policy Mismatch)
- **Tên lỗi**: API Lịch công khai tin cậy tham số query `?role=OWNER` không xác thực để mở khóa ô giờ sát 15 phút, gây lệch quy tắc với API tạo đơn.
- **File & dòng**:
  - `server/src/controllers/schedule.controller.js#L23-L24`
  - `server/src/controllers/schedule.controller.js#L55-L56`
- **Kịch bản tái hiện**:
  1. Người dùng chưa đăng nhập hoặc có role `CUSTOMER` gửi request `GET /api/v1/courts/:id/schedule?date=TODAY&role=OWNER` hoặc `GET /api/v1/facilities/:id/schedule?date=TODAY&role=OWNER`.
  2. Thời điểm hiện tại cách giờ bắt đầu của ô tiếp theo 10 phút (< 15 phút).
  3. Controller thực thi:
     ```javascript
     const effectiveRole =
       req.user?.role === 'OWNER' || role === 'OWNER' ? 'OWNER' : 'CUSTOMER';
     ```
  4. Vì `role === 'OWNER'`, `effectiveRole` trở thành `'OWNER'`.
  5. API lịch trả về ô giờ này có trạng thái `AVAILABLE` (vì chủ sân có `minAdvance = 0`).
  6. Khách hàng thấy ô giờ còn trống, bấm chọn và tiến hành đặt sân tại `POST /api/v1/booking-requests`.
  7. API tạo đơn chạy với `source = 'CUSTOMER_ONLINE'`, áp dụng `minAdvance = 15` tại `booking-request.service.js#L439-L440` và ném lỗi 400 Bad Request:
     `"Giờ bắt đầu sớm nhất (...) phải cách thời điểm hiện tại ít nhất 15 phút."`
- **Kết quả mong đợi**: API lịch công khai (có gắn middleware `optionalAuthenticate`) chỉ được cấp đặc quyền `effectiveRole = 'OWNER'` khi token của người dùng thực sự có vai trò OWNER (`req.user?.role === 'OWNER'`). Người dùng không có quyền hoặc truyền bừa `?role=OWNER` phải bị đối xử như CUSTOMER (`minAdvance = 15`).
- **Kết quả thực tế**: Unauthenticated request hoặc CUSTOMER chỉ cần gắn `?role=OWNER` là xem được lịch với chính sách của chủ sân, gây lệch quy tắc (mismatch) giữa màn hình hiển thị và API tạo đơn thực tế.
- **Ảnh hưởng**: Vi phạm trực tiếp Checklist Item 9 & 10 của B01 ("Lịch và tạo đơn thống nhất quy tắc đặt trước theo vai trò", "Kiểm tra ảnh hưởng của optional authentication nếu có"). Gây lỗi cho khách hàng khi giao diện báo ô giờ khả dụng nhưng khi bấm đặt thì bị server từ chối.
- **Bằng chứng**:
  - `server/src/controllers/schedule.controller.js`:
    ```javascript
    const effectiveRole =
      req.user?.role === 'OWNER' || role === 'OWNER' ? 'OWNER' : 'CUSTOMER';
    ```
- **Hướng sửa tối thiểu**:
  Loại bỏ hoàn toàn việc đọc `role === 'OWNER'` từ `req.query`:
  ```javascript
  const effectiveRole = req.user?.role === 'OWNER' ? 'OWNER' : 'CUSTOMER';
  ```

---

### Finding 2 (P2 — Functional / Usability Hang on Checkout Stale Order Retry)
- **Tên lỗi**: `CheckoutPage.jsx` không xử lý các trạng thái đơn `EXPIRED`, `PAID`, `CANCELLED` khi gửi lại yêu cầu cùng `idempotencyKey`, khiến giao diện đứng im và không phản hồi lỗi cho người dùng.
- **File & dòng**: `client/src/pages/checkout/CheckoutPage.jsx#L120-L148`
- **Kịch bản tái hiện**:
  1. Khách hàng đã submit đơn đặt sân, server đã ghi nhận vào DB nhưng mạng phía client bị gián đoạn hoặc người dùng tải lại trang Checkout.
  2. Khách hàng rời máy quá 10 phút, phiên giữ chỗ hết hạn (`holdExpiresAt < now`), đơn chuyển sang `EXPIRED`.
  3. Khách hàng quay lại màn hình Checkout và bấm nút "Thanh toán VNPay ngay".
  4. Backend nhận request cùng `idempotencyKey`, kích hoạt nhánh B01 Issue 6 và trả về HTTP 200:
     ```json
     {
       "bookingRequestId": "...",
       "requestNumber": "BR20261101-ABCD",
       "status": "EXPIRED",
       "isExpired": true,
       "paymentOrder": { "status": "EXPIRED", "paymentUrl": "" }
     }
     ```
  5. `CheckoutPage.jsx` chỉ kiểm tra:
     ```javascript
     if (data?.paymentOrder?.paymentUrl) { ... }
     ```
     Vì `paymentUrl` là `""`, điều kiện bị sai. Không có nhánh `else if (data?.isExpired)` hay thông báo lỗi nào được kích hoạt.
  6. Biến `submitting` chuyển về `false` trong `finally`.
- **Kết quả mong đợi**: Khi server trả về đơn đã hết hạn (`isExpired`), đã thanh toán (`isPaid`) hoặc đã hủy (`isCancelled`), giao diện phải hiển thị thông báo lỗi rõ ràng (ví dụ: *"Đơn đặt sân này đã hết thời gian giữ chỗ 10 phút. Vui lòng quay lại chọn lại khung giờ."*), đồng thời xóa draft cũ khỏi `sessionStorage` để người dùng có thể tạo đơn mới.
- **Kết quả thực tế**: Nút bấm dừng quay loading, không có modal, không có thông báo lỗi, `sport_booking_draft` chứa `idempotencyKey` cũ vẫn giữ nguyên trong `sessionStorage`. Người dùng tiếp tục bấm nút thì server tiếp tục trả về `isExpired: true` và giao diện tiếp tục tê liệt.
- **Ảnh hưởng**: Người dùng bị kẹt vô hạn tại trang thanh toán mà không nhận được bất kỳ chỉ dẫn nào khi đơn hết hạn hoặc rớt mạng retry.
- **Bằng chứng**:
  - `client/src/pages/checkout/CheckoutPage.jsx#L122-L137`: Hoàn toàn thiếu nhánh bắt `data.isExpired` / `data.status === 'EXPIRED'`.
- **Hướng sửa tối thiểu**:
  ```javascript
  if (data?.paymentOrder?.paymentUrl) {
    sessionStorage.removeItem('sport_booking_draft');
    setHoldData({ ... });
    window.location.href = data.paymentOrder.paymentUrl;
  } else if (data?.isExpired || data?.status === 'EXPIRED') {
    sessionStorage.removeItem('sport_booking_draft');
    setError('Thời gian giữ chỗ 10 phút của đơn đặt sân đã kết thúc. Vui lòng chọn lại khung giờ.');
  } else if (data?.isPaid || data?.status === 'PAID') {
    sessionStorage.removeItem('sport_booking_draft');
    navigate('/booking-history');
  } else {
    setError('Đơn đặt sân không còn ở trạng thái có thể tiếp tục thanh toán.');
  }
  ```

---

### Finding 3 (P2 — Concurrency / Unhandled E11000 Duplicate Key Error)
- **Tên lỗi**: Yêu cầu đặt sân đồng thời cùng `idempotencyKey` phát sinh lỗi MongoDB `E11000 duplicate key` chưa được `errorHandler` bắt và xử lý, dẫn đến trả về HTTP 500 kèm chi tiết index nội bộ.
- **File & dòng**: `server/src/middlewares/error-handler.js#L33-L37`
- **Kịch bản tái hiện**:
  1. Do double-click hoặc lỗi mạng retransmit tức thời, client bắn đồng thời 2 request `POST /api/v1/booking-requests` với cùng `idempotencyKey` và cùng `createdBy`.
  2. Cả 2 request cùng thực hiện `findByIdempotencyKey` trước khi một trong hai ghi xong document.
  3. Request A tạo document thành công.
  4. Request B tiến hành insert và vi phạm compound unique index `{ createdBy: 1, idempotencyKey: 1 }`.
  5. MongoDB ném lỗi `MongoServerError: E11000 duplicate key error collection: sport_booking.bookingrequests...`.
- **Kết quả mong đợi**: Server phải bắt lỗi `err.code === 11000` và chuyển đổi thành lỗi client rõ ràng (HTTP 409 Conflict hoặc tự động query lại kết quả idempotent của Request A để trả về 200/201), tuyệt đối không để lộ lỗi 500 hoặc cấu trúc collection database.
- **Kết quả thực tế**: `error-handler.js` chỉ xử lý `ValidationError` và `CastError`. Lỗi E11000 rơi vào fallback `500 Internal Server Error`, ghi log `[Unhandled Error]` và lộ chi tiết collection/index.
- **Ảnh hưởng**: Gây lỗi 500 không đáng có khi có thao tác đồng thời hoặc retry sát nhau, làm giảm tính ổn định của cơ chế chống lặp.
- **Bằng chứng**:
  - `server/src/middlewares/error-handler.js` thiếu khối `if (err.code === 11000)`.
- **Hướng sửa tối thiểu**:
  Trong `errorHandler`:
  ```javascript
  if (err.code === 11000) {
    error = AppError.conflict(
      'Yêu cầu bị xung đột hoặc đang được xử lý đồng thời. Vui lòng thử lại sau giây lát.',
      ERROR_CODES.CONCURRENCY_CONFLICT
    );
  }
  ```

---

### Finding 4 (P3 — Unit Test Fidelity / Mocking Gap)
- **Tên lỗi**: Test suite `CheckoutPage.test.jsx` sử dụng mock draft không có `configVersion` và chứa pre-merged ranges thay vì raw slots, không kiểm thử đúng hợp đồng payload mới của B01.
- **File & dòng**: `client/src/pages/checkout/__tests__/CheckoutPage.test.jsx#L37-L43` & `L114-L117`
- **Kịch bản**:
  - `mockDraft` trong file test thiếu trường `configVersion` và `selectedSlots`.
  - Component kích hoạt nhánh fallback lấy `selectedSlots` từ `ranges` (các khoảng 90 phút).
  - Assertion kỳ vọng `selectedSlots: [{ startTime: '07:00', endTime: '08:30' }, ...]`.
  - Test vẫn PASS vì `bookingService.createBookingRequest` bị mock hoàn toàn. Nếu gửi payload này lên backend thật, nó sẽ fail ngay lập tức do thiếu `configVersion` và ô giờ 90 phút không khớp `slotStepMinutes = 30`.
- **Kết quả mong đợi**: Test của `CheckoutPage` phải kiểm thử với cấu trúc draft chuẩn do `SelectedRangesSummary` tạo ra (có `configVersion` và danh sách raw `selectedSlots` 30 phút), phản ánh đúng hành vi runtime.
- **Kết quả thực tế**: Test vẫn pass trên hợp đồng cũ, tạo cảm giác an tâm giả (false sense of security).
- **Ảnh hưởng**: Giảm độ bao phủ và chất lượng kiểm thử đơn vị client.
- **Hướng sửa tối thiểu**: Bổ sung `configVersion: 1` và danh sách các ô rời rạc đúng bước giờ vào `mockDraft` trong test.

---

### Finding 5 (P3 — UX Inconvenience on Owner Contact Modification)
- **Tên lỗi**: `OwnerOnBehalfPage.jsx` không reset `idempotencyKeyRef` khi chủ sân chỉnh sửa thông tin liên hệ khách hàng (`customerName`, `customerPhone`).
- **File & dòng**: `client/src/pages/owner/OwnerOnBehalfPage.jsx#L444` & `L458`
- **Kịch bản**:
  - Chủ sân nhập thông tin khách A rồi gửi yêu cầu. Nếu muốn sửa lại tên hoặc SĐT sang khách B trên cùng khung giờ vừa chọn, `idempotencyKeyRef.current` không được reset trong hàm `onChange`.
  - Khi submit lại, client gửi cùng `idempotencyKey` với payload fingerprint mới, khiến backend ném lỗi 400: *"Mã idempotencyKey này đã được dùng cho một yêu cầu có nội dung khác."*
- **Hướng sửa tối thiểu**: Gọi `idempotencyKeyRef.current = ''` khi người dùng thay đổi giá trị của `customerName` hoặc `customerPhone`.

---

## 3. Kiểm chứng Đã Chạy và Kết quả

| Test Suite / Kiểm chứng | Lệnh thực thi | Môi trường | Kết quả | Ghi chú |
|---|---|---|---|---|
| **Luồng tích hợp B01 (5 subtests)** | `node --test server/tests/integration/logic-fix-b01-flow.test.js` | Node.js + MongoDB Replica Set (port 27018) | **PASS 100%** (6/6 tests) | Đã kiểm chứng: Single/Contiguous/Disjoint slots, Idempotency retry không duplicate, Owner on-behalf qua DTO id, HMAC guest access code, Khóa đơn hết hạn/đã trả, Mốc sát 15 phút. |
| **API Booking Request (12 subtests)** | `node --test server/tests/integration/booking-request-api.test.js` | Node.js + MongoDB Replica Set (port 27018) | **PASS 100%** (13/13 tests) | Đã kiểm chứng: Merge slots, Idempotent collision reject 400, ConfigVersion mismatch 409, Unverified customer 403, Owner cross-facility reject 403, Guest order link HMAC verification. |
| **API Court Schedule (12 subtests)** | `node --test server/tests/integration/court-schedule-api.test.js` | Node.js + MongoDB Replica Set (port 27018) | **PASS 100%** (13/13 tests) | Đã kiểm chứng: Strict privacy protection (0 customer data leak), Status resolution (BLOCKED, BOOKED, HOLD, AVAILABLE, PAST), Role 15-min advance window. |
| **Vitest Client B01 (3 test files)** | `npm --prefix client test CheckoutPage OwnerOnBehalfPage GuestPayPage` | JSDOM + Vitest | **PASS 100%** (3 files, 7 tests) | Đã kiểm chứng render và logic gọi service của Checkout, On-behalf, GuestPay. Phát hiện test CheckoutPage bị hổng mock (Finding 4). |

### Phần chưa kiểm chứng / Giới hạn kiểm chứng:
1. **Kiểm chứng Real Browser với VNPay Gateway thật**: Các test hiện tại kiểm chứng URL sinh ra đúng chữ ký HMAC-SHA512 và tham số VNPay chuẩn (chạy trên môi trường test sandbox giả lập). Chưa thực hiện giao dịch quét mã ngân hàng thật (đúng theo quy tắc phạm vi không dùng tiền thật).
2. **Kiểm chứng tự động trên thiết bị di động thực tế**: Giao diện GuestPay và Checkout được kiểm chứng trên JSDOM và mô phỏng viewport trình duyệt.

---

## 4. Kết luận Review

- **Trạng thái kết luận**: **NEEDS_CHANGES**.
- **Lý do**:
  1. Cần sửa lỗi **P1** (Finding 1): Bỏ việc tin cậy tham số query `?role=OWNER` không qua xác thực tại `ScheduleController`, đảm bảo quy tắc đặt trước 15 phút được kiểm soát chặt chẽ và thống nhất giữa API lịch và API tạo đơn.
  2. Cần khắc phục lỗi **P2** (Finding 2): Thêm xử lý trạng thái `EXPIRED` / `PAID` / `CANCELLED` tại `CheckoutPage.jsx` khi retry idempotent để giao diện không bị treo im lặng.
  3. Cần xử lý lỗi **P2** (Finding 3): Thêm xử lý lỗi MongoDB duplicate key (`err.code === 11000`) trong `error-handler.js` để tránh phát sinh HTTP 500 khi có tranh chấp đồng thời.
- **Quality Gates**:
  - `BE_READY`: Tiếp tục giữ **STALE**.
  - `RELEASE_READY`: Tiếp tục giữ **STALE**.
  - Không tự ý mở gate hoặc chuyển sang `ACCEPTED` khi chưa sửa các findings trên.

