# Logic Fix B01 — Sửa các lỗi trong luồng đặt sân và thanh toán (Cross-Phase Bugfix)

> Trạng thái: IN_PROGRESS. Người thực hiện: Antigravity. Ngày bắt đầu: 2026-10-31.
> Đây là đợt sửa lỗi logic xuyên suốt các phase (P08, P10, P11, P12, P16, P17, P18, P19), không phải phase mới và không chuyển đổi phase.

## 1. Hợp đồng thực hiện

- **Yêu cầu giao việc**: Sửa các lỗi trong luồng đặt sân và thanh toán của dự án sport-booking theo 7 phát hiện cụ thể; đối chiếu mã nguồn thực tế; cập nhật tài liệu API và test; đánh dấu gate `BE_READY` và `RELEASE_READY` là `STALE`; không tự ghi `ACCEPTED`; trạng thái bàn giao tối đa `READY_FOR_REVIEW`.
- **Mục tiêu**:
  1. Đồng bộ `configVersion` từ API lịch -> `SelectedRangesSummary` -> `sport_booking_draft` -> `CheckoutPage` -> backend. Tuyệt đối không dùng giá trị mặc định 1 để che dữ liệu thiếu.
  2. Gửi các ô giờ gốc (`selectedSlots`) khớp `slotStepMinutes` từ `CheckoutPage` tới backend; giữ các khoảng gộp (`ranges`) để hiển thị và tính toán tổng thời lượng/giá.
  3. Sửa `OwnerOnBehalfPage` đọc đúng trường `id` thay vì `_id` từ DTO cơ sở và sân thể thao.
  4. Bổ sung `idempotencyKey` ổn định cho đơn đặt hộ của chủ sân (duy trì qua retry mạng, chỉ sinh mới khi đặt mới) và lưu `idempotencyKey` vào draft đặt sân của khách hàng để không bị đổi mã khi tải lại trang.
  5. Cập nhật `getGuestPaymentOrder` trả đầy đủ `requestNumber`, `contactName`, `contactPhone`, `totalAmountVnd`, và danh sách từng khoảng đặt rời nhau (`intervals`), không gộp thành một khoảng kéo dài qua giờ không đặt. Sửa `GuestPayPage` hiển thị đúng các trường, không biến thành "0đ".
  6. Sửa nhánh gửi lại cùng `idempotencyKey` trong `bookingRequestService.createBookingRequest`: tiếp tục thanh toán an toàn cho đơn PENDING còn hạn bằng việc sinh `paymentUrl` đúng hạn hold gốc và `guestAccessLink` chứa access code bảo mật được tái suy xuất bằng HMAC (không lưu plaintext bí mật trong DB); đơn đã trả (PAID), hủy (CANCELLED) hoặc hết hạn (EXPIRED) trả đúng trạng thái và không gia hạn hold/không tạo đơn mới.
  7. Đồng bộ khả năng chọn khung giờ trên API lịch với chính sách đặt: khách hàng trực tuyến (CUSTOMER) không được chọn các ô bắt đầu trong vòng dưới 15 phút (đánh dấu `PAST`); chủ sân đặt hộ (OWNER) được chọn các ô sắp tới sát giờ chơi (`minAdvance = 0`).
- **Các tài liệu đã đọc**:
  - `AGENTS.md` (quy tắc phase, review, cập nhật gate `STALE`).
  - `docs/features.md` (các tiêu chí 6, 10, 11, 22, 26, 27, 28, 29, 32, 33, 34, 46, 51, 52).
  - `docs/architecture.md` (cấu trúc layer, transaction coordination, auth, token bảo mật).
  - `docs/planning/development-plan.md` và `docs/planning/phase-status.json`.
- **Phụ thuộc và trạng thái gate**:
  - Gate `BE_READY`: Đã chuyển sang `STALE` vì thay đổi backend lịch, idempotency resume và contract guest payment order.
  - Gate `RELEASE_READY`: Đã chuyển sang `STALE` vì cập nhật luồng đặt sân xuyên suốt backend và frontend.
- **Phạm vi file dự kiến sửa**:
  - `client/src/components/schedule/CourtSchedule.jsx`
  - `client/src/components/schedule/SelectedRangesSummary.jsx`
  - `client/src/pages/checkout/CheckoutPage.jsx`
  - `client/src/pages/owner/OwnerOnBehalfPage.jsx`
  - `client/src/pages/payment/GuestPayPage.jsx`
  - `client/src/services/court.service.js`
  - `server/src/services/booking/schedule.service.js`
  - `server/src/controllers/schedule.controller.js`
  - `server/src/routes/court.routes.js`
  - `server/src/services/booking/booking-request.service.js`
  - `server/src/services/payment/payment.service.js`
  - `server/src/middlewares/auth.js` (hỗ trợ `optionalAuthenticate` nếu cần)
  - `docs/api/booking-api.md` & `docs/api/payment-api.md`
  - `server/tests/...` & `client/src/.../__tests__/...`
- **Ngoài phạm vi**:
  - Không thay đổi mô hình giá, chính sách giá giờ cao điểm/cuối tuần.
  - Không thay đổi giờ hoạt động theo ngày trong tuần.
  - Không thay đổi chính sách hoàn tiền hoặc thêm voucher/hoa hồng.
  - Không thực hiện giao dịch tiền thật.
- **Cách kiểm chứng**:
  - Unit/integration test backend: schedule 15m advance notice, idempotency retry unexpired/expired/paid/cancelled, guest order detail with intervals.
  - Client vitest: SelectedRangesSummary với configVersion, CheckoutPage với raw selectedSlots và persistent idempotencyKey, OwnerOnBehalfPage với id và idempotencyKey, GuestPayPage hiển thị đúng intervals và số tiền.
  - E2E / integration flows: toàn bộ chu trình đặt sân, đặt hộ, thanh toán và retry.

## 2. Đầu việc và kết quả

- [x] **Đầu việc 1 — Đồng bộ `configVersion` xuyên suốt Lịch -> Draft -> Checkout (Issue 1)**
  - *Đầu ra*: `CourtSchedule.jsx` truyền `configVersion={scheduleData?.configVersion}` và `slotStepMinutes={scheduleData?.slotStepMinutes}` sang `SelectedRangesSummary.jsx`. `SelectedRangesSummary` lưu chính xác `configVersion` vào `sessionStorage` (`sport_booking_draft`). `CheckoutPage.jsx` đọc `draft.configVersion` gửi lên backend; loại bỏ giá trị fallback `|| 1`.
  - *Kiểm chứng*: `SelectedRangesSummary` lưu đúng `configVersion = 2`, `CheckoutPage` gửi payload với `configVersion = 2`, backend xác thực khớp phiên bản (Criterion 33, 34). Test: `src/pages/checkout/__tests__/CheckoutPage.test.jsx`, `server/tests/integration/logic-fix-b01-flow.test.js` (Subtest 1).
  - *Bằng chứng*: `npm --prefix client test src/pages/checkout/__tests__/CheckoutPage.test.jsx` (3 passed), `logic-fix-b01-flow.test.js` Subtest 1 PASS.

- [x] **Đầu việc 2 — Checkout gửi các ô gốc đúng `slotStepMinutes`, giữ khoảng gộp cho UI (Issue 2)**
  - *Đầu ra*: `SelectedRangesSummary` lưu cả `selectedSlots` (các ô gốc tương ứng `slotStepMinutes`) và `ranges` (các khoảng đã gộp liền nhau). `CheckoutPage.jsx` gửi `selectedSlots` gốc lên API backend `/api/v1/booking-requests` để backend tự thực hiện `mergeContiguousSlots` theo Criteria 6, 26, 27 và lưu vào các Booking con; `ranges` được giữ nguyên cho việc render tóm tắt và hiển thị tại UI.
  - *Kiểm chứng*: Đặt 1 ô (30m), nhiều ô liền nhau (90m), và nhiều ô rời rạc (30m + 60m). Backend `validateSlot` không bị lỗi độ dài không khớp bước giờ quy định.
  - *Bằng chứng*: `logic-fix-b01-flow.test.js` (Subtest 1 PASS cho cả 3 trường hợp single, contiguous 90m -> 1 Booking, disjoint -> 2 Bookings).

- [x] **Đầu việc 3 — Sửa `OwnerOnBehalfPage` dùng `id` thay cho `_id` từ DTO (Issue 3)**
  - *Đầu ra*: Đồng bộ 5 vị trí trong `OwnerOnBehalfPage.jsx` sử dụng `fac.id || fac._id` và `court.id || court._id` (danh sách cơ sở, chọn cơ sở mặc định, danh sách sân, chọn sân mặc định, và tìm sân hiện tại).
  - *Kiểm chứng*: Render giao diện và load danh sách cơ sở/sân không còn bị `undefined` value trong dropdown, chọn đúng sân và tính đúng tiền.
  - *Bằng chứng*: `src/pages/owner/__tests__/OwnerOnBehalfPage.test.jsx` (2 passed), `logic-fix-b01-flow.test.js` (Subtest 3 PASS).

- [x] **Đầu việc 4 — Thêm `idempotencyKey` ổn định cho Đặt hộ và Customer Checkout (Issue 4)**
  - *Đầu ra*:
    - `OwnerOnBehalfPage.jsx`: Bổ sung `idempotencyKeyRef` duy trì mã ổn định khi retry lỗi mạng; chỉ reset mã khi người dùng thay đổi sân, ngày chơi, khung giờ hoặc khi đơn đã được tạo thành công.
    - `SelectedRangesSummary.jsx` & `CheckoutPage.jsx`: Lưu `idempotencyKey` vào `sport_booking_draft` trong `sessionStorage`. Khi khách hàng reload trang checkout, mã idempotencyKey được tải lại từ draft chứ không bị sinh mới ngẫu nhiên.
  - *Kiểm chứng*: Mô phỏng server đã nhận và tạo đơn, client tải lại trang hoặc gửi lại request cùng mã; server trả về đơn cũ không sinh đơn trùng.
  - *Bằng chứng*: `logic-fix-b01-flow.test.js` (Subtest 2 & 3 PASS, `BookingRequest.countDocuments` luôn bằng 1).

- [x] **Đầu việc 5 — Sửa `getGuestPaymentOrder` và `GuestPayPage` hiển thị đúng tiền và các khoảng rời rạc (Issue 5)**
  - *Đầu ra*:
    - `server/src/services/payment/payment.service.js`: `getGuestPaymentOrder` bổ sung trả về `contactName`, `contactPhone`, `totalAmountVnd: paymentOrder.expectedAmountVnd`, và danh sách `intervals` (từng khoảng đặt rời nhau của `childBookings`).
    - `client/src/pages/payment/GuestPayPage.jsx`: Đọc đúng `requestNumber`, `contactName`, `contactPhone`, `totalAmountVnd` (không bị fallback về 0đ), render tên cơ sở/sân, ngày chơi và từng khoảng giờ đặt rời rạc riêng biệt.
  - *Kiểm chứng*: Gọi API thật với accessCode bí mật, kiểm tra DTO trả về đầy đủ; kiểm thử UI vitest với 2 khoảng rời rạc (06:00-07:00 và 08:00-09:00).
  - *Bằng chứng*: `src/pages/payment/__tests__/GuestPayPage.test.jsx` (2 passed), `logic-fix-b01-flow.test.js` (Subtest 3 PASS).

- [x] **Đầu việc 6 — Hoàn thiện nhánh gửi lại cùng `idempotencyKey` với `paymentUrl` còn hạn và access code bảo mật tái sinh bằng HMAC (Issue 6)**
  - *Đầu ra*:
    - Xây dựng hàm `deriveGuestAccessCode(bookingRequestId, idempotencyKey)` sử dụng HMAC-SHA256 với secret server (`env.JWT_ACCESS_SECRET`). Plaintext mã truy cập KHÔNG BAO GIỜ lưu trong MongoDB; chỉ lưu sha256 hash. Khi retry cùng `idempotencyKey`, server tính toán lại đúng access code mà không cần lưu rõ.
    - Trong nhánh `idempotencyKey` trùng khớp payload fingerprint:
      - Đơn unexpired PENDING: Tạo `paymentUrl` tươi mới với `expireDate: existingRequest.holdExpiresAt` (giữ nguyên hạn hold gốc, không gia hạn); trả `guestAccessLink` kèm access code hợp lệ cho đơn đặt hộ.
      - Đơn EXPIRED: Trả `{ status: 'EXPIRED', isExpired: true, paymentUrl: '' }`, không tạo đơn mới, không kéo dài hold.
      - Đơn PAID: Trả `{ status: 'PAID', isPaid: true, paymentUrl: '' }`.
      - Đơn CANCELLED: Trả `{ status: 'CANCELLED', isCancelled: true, paymentUrl: '' }`.
  - *Kiểm chứng*: Gửi lại cùng mã khi pending -> có paymentUrl VNPay; gửi lại khi expired -> status EXPIRED, không mở lại hold; gửi lại đơn đặt hộ -> link có access code hợp lệ và mở được endpoint guest-order.
  - *Bằng chứng*: `server/tests/integration/booking-request-api.test.js` (Subtest 3, 11, 12 PASS), `logic-fix-b01-flow.test.js` (Subtest 2, 3, 4 PASS).

- [x] **Đầu việc 7 — Đồng bộ API lịch sát mốc 15 phút giữa Customer và Owner (Issue 7)**
  - *Đầu ra*:
    - `ScheduleService.getCourtSchedule`: Tiếp nhận `forRole` (hoặc `timeOverrides.role`). Với CUSTOMER: các ô trong ngày hiện tại bắt đầu `< nowMinutes + 15` được đánh dấu `PAST` (Criterion 11). Với OWNER: chỉ các ô `<= nowMinutes` mới là `PAST`, các ô sắp tới trong vòng 15 phút vẫn là `AVAILABLE` (`minAdvance = 0`).
    - `ScheduleController`: Nhận diện vai trò qua `req.user?.role` hoặc `req.query.role`.
    - `court.routes.js`: Tích hợp middleware `optionalAuthenticate`.
    - `court.service.js`: Hỗ trợ truyền tham số `role`.
    - `OwnerOnBehalfPage.jsx`: Gọi lịch với role `'OWNER'`.
  - *Kiểm chứng*: Khung giờ cách hiện tại 10 phút: Customer xem thấy `PAST` và API đặt từ chối; Owner xem thấy `AVAILABLE` và API đặt hộ cho phép.
  - *Bằng chứng*: `server/tests/integration/court-schedule-api.test.js` (Subtest 11, 12 PASS), `logic-fix-b01-flow.test.js` (Subtest 5 PASS).

- [x] **Đầu việc 8 — Cập nhật tài liệu API và bộ test tự động (Backend + Frontend + E2E)**
  - *Đầu ra*:
    - `docs/api.openapi.yaml`: Cập nhật schema `GuestPaymentOrderDTO` (bổ sung `contactName`, `contactPhone`, `startTime`, `endTime`, `intervals`, `totalAmountVnd`), thêm `role` parameter cho `GET /courts/{id}/schedule`.
    - `docs/planning/phase-status.json`: Cập nhật gate `BE_READY` và `RELEASE_READY` sang `STALE` kèm lý do kỹ thuật.
    - Toàn bộ test suite chạy thành công: E2E release test (15 passed), client vitest (30 files, 140 passed), backend unit/integration tests.

## 3. Thay đổi thực tế

- **Các file đã sửa**:
  1. `client/src/components/schedule/CourtSchedule.jsx`: Truyền `configVersion` và `slotStepMinutes` từ `scheduleData` sang `SelectedRangesSummary`.
  2. `client/src/components/schedule/SelectedRangesSummary.jsx`: Lưu `configVersion`, `slotStepMinutes`, `selectedSlots` (raw step slots), `ranges` (merged intervals), và `idempotencyKey` vào `sport_booking_draft`.
  3. `client/src/pages/checkout/CheckoutPage.jsx`: Tải và duy trì `idempotencyKey` từ draft; gửi `selectedSlots` gốc cho backend; đọc `configVersion` từ draft.
  4. `client/src/pages/owner/OwnerOnBehalfPage.jsx`: Đổi `fac._id` và `court._id` thành `id || _id`; thêm `idempotencyKeyRef` ổn định cho retry; gọi lịch với role `'OWNER'`; đọc `configVersion` từ `scheduleData` (không dùng fallback 1).
  5. `client/src/pages/payment/GuestPayPage.jsx`: Đọc đúng `requestNumber`, `contactName`, `contactPhone`, `totalAmountVnd` (không biến thành 0đ); render tên sân/cơ sở và từng khoảng thời gian rời rạc (`intervals`).
  6. `client/src/services/court.service.js`: Hỗ trợ truyền tham số `role` khi lấy lịch.
  7. `server/src/services/booking/schedule.service.js`: Hỗ trợ `forRole` / `timeOverrides.role`; customer đánh dấu slot `< nowMinutes + 15` là `PAST`; owner cho phép đặt slot sát giờ (`minAdvance = 0`).
  8. `server/src/controllers/schedule.controller.js`: Tiếp nhận `req.query.role` hoặc `req.user?.role` để truyền vào `scheduleService`.
  9. `server/src/routes/court.routes.js`: Bổ sung `optionalAuthenticate` cho endpoint `GET /:id/schedule`.
  10. `server/src/middlewares/auth.js`: Export middleware `optionalAuthenticate`.
  11. `server/src/services/booking/booking-request.service.js`: Xây dựng `deriveGuestAccessCode` (HMAC bảo mật, không lưu plaintext vào DB); hoàn thiện nhánh idempotency retry cho các trạng thái PENDING (tạo lại live paymentUrl và guestAccessLink), EXPIRED (không gia hạn hold), PAID, CANCELLED.
  12. `server/src/services/payment/payment.service.js`: `getGuestPaymentOrder` trả về `contactName`, `contactPhone`, `totalAmountVnd`, và danh sách `intervals`.
  13. `docs/api.openapi.yaml`: Cập nhật `GuestPaymentOrderDTO`, query param `role` cho `GET /courts/{id}/schedule`.
  14. `docs/planning/phase-status.json`: Cập nhật gate `BE_READY` và `RELEASE_READY` là `STALE`.

- **Các file test mới / cập nhật**:
  1. `client/src/pages/payment/__tests__/GuestPayPage.test.jsx`: Test suite mới cho GuestPayPage (2 tests passed).
  2. `server/tests/integration/court-schedule-api.test.js`: Bổ sung test 11 & 12 cho mốc 15 phút của Customer vs Owner (12 tests passed).
  3. `server/tests/integration/booking-request-api.test.js`: Bổ sung test 11 & 12 cho idempotency retry paymentUrl, guestAccessLink và expired hold (12 tests passed).
  4. `server/tests/integration/vnpay-payment-flow.test.js`: Cập nhật kiểm tra contract guest order có `intervals`, `contactName`, `contactPhone`.
  5. `server/tests/integration/logic-fix-b01-flow.test.js`: Test suite tích hợp toàn diện xuyên suốt luồng Lịch -> Draft -> Checkout -> API -> Idempotency -> Guest Order (5 tests passed).

## 4. Kiểm chứng

1. **Lịch -> Draft -> Checkout với Single, Contiguous (gộp 90m) và Disjoint Slots**:
   - Lệnh: `node --test server/tests/integration/logic-fix-b01-flow.test.js` (Subtest 1).
   - Kết quả: PASS. Single: 1 Booking 30m; Contiguous: 1 Booking 90m; Disjoint: 2 Bookings (30m + 60m). Không xảy ra lỗi validation bước giờ.
2. **Idempotency, Mất phản hồi & Tải lại trang (Reload Page)**:
   - Lệnh: `node --test server/tests/integration/logic-fix-b01-flow.test.js` (Subtest 2).
   - Kết quả: PASS. Gửi lại cùng `idempotencyKey` không tạo thêm bản ghi DB (`countDocuments = 1`), `holdExpiresAt` giữ nguyên không bị gia hạn, `paymentUrl` hợp lệ được sinh lại.
3. **Owner On-Behalf qua DTO `id` & GuestPay hiển thị các khoảng rời**:
   - Lệnh: `node --test server/tests/integration/logic-fix-b01-flow.test.js` (Subtest 3).
   - Kết quả: PASS. Owner list facilities & courts dùng trường `id`; tạo đơn đặt hộ trả `guestAccessLink` kèm mã `?code=...`; truy cập `guest-order` hiển thị đúng tiền `120.000 ₫`, khách hàng `Anh Vũ Vãng Lai`, 2 khoảng riêng biệt `16:00-16:30` và `18:00-18:30`.
4. **Đơn đã hết hạn, đã hủy hoặc đã trả**:
   - Lệnh: `node --test server/tests/integration/logic-fix-b01-flow.test.js` (Subtest 4).
   - Kết quả: PASS. Đơn hết hạn trả `status: 'EXPIRED'`, `isExpired: true`, `paymentUrl: ''`; không gia hạn hold. Đơn hủy trả `status: 'CANCELLED'`.
5. **Mốc sát 15 phút (Customer vs Owner)**:
   - Lệnh: `node --test server/tests/integration/logic-fix-b01-flow.test.js` (Subtest 5) & `court-schedule-api.test.js` (Subtest 11, 12).
   - Kết quả: PASS. Ô bắt đầu sau 12 phút (< 15 phút): Customer xem lịch thấy `PAST`, chính sách đặt từ chối. Owner xem lịch thấy `AVAILABLE`, chính sách đặt hộ chấp thuận.
6. **Bộ Client Vitest (30 test files, 140 tests)**:
   - Lệnh: `npm --prefix client test`.
   - Kết quả: PASS 100% (30 passed, 140 passed).
7. **Client Build Production (Vite)**:
   - Lệnh: `npm --prefix client run build`.
   - Kết quả: PASS (0 warning, 0 error).
8. **E2E Release Ready Suite**:
   - Lệnh: `node --test tests/e2e/release-ready-e2e.test.js`.
   - Kết quả: PASS 100% (15/15 subtests passed).
9. **Backend Lint (173 files)**:
   - Lệnh: `npm run lint`.
   - Kết quả: PASS (Syntax check passed for 173 backend files).

> [!NOTE]
> Ghi nhận về môi trường kiểm thử: Các kiểm thử giao diện React được thực thi bằng `@testing-library/react` trên môi trường JSDOM (headless virtual DOM) kết hợp mocking API Client; các kiểm thử tích hợp backend được thực thi trên môi trường Node.js kết nối trực tiếp cơ sở dữ liệu MongoDB thật. Thử nghiệm trên trình duyệt thật (Real Browser Automation bằng Playwright/Puppeteer/Selenium) cần kịch bản chuyên biệt riêng nếu có yêu cầu kiểm chứng đồ họa visual thực tế.

## 5. Phiên bản được bàn giao

- **Trạng thái**: READY_FOR_REVIEW.
- **Trạng thái Quality Gates**:
  - `BE_READY`: STALE (Cần độc lập review và nghiệm thu lại do thay đổi backend).
  - `RELEASE_READY`: STALE (Cần độc lập review và nghiệm thu lại do cập nhật luồng đặt sân & thanh toán).
- **Không tự ý chuyển phase**: Giữ nguyên trạng thái các phase trong kế hoạch.

## 6. Việc còn thiếu và điểm tiếp tục

- Không còn lỗi chặn kỹ thuật nào trong 7 phát hiện thuộc phạm vi.
- Điểm tiếp tục: Bàn giao báo cáo `docs/phase-reports/logic-fix-B01.md` cho Reviewer / Người dùng để tiến hành nghiệm thu lại và cập nhật trạng thái các Quality Gates.


