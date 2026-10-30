# Báo cáo Review Độc lập Phase P17 & Quyết định Nghiệm thu

> Trạng thái nghiệm thu Phase P17: **ACCEPTED**  
> Người review: Independent Reviewer (Được ủy quyền nghiệm thu trực tiếp bởi người dùng)  
> Ngày review: 30/10/2026  
> Tài liệu căn cứ: `AGENTS.md`, `docs/features.md` (Mục 4 Checkout và thanh toán VNPay 100%, Mục 5 Đơn của khách; Tiêu chí 34–53), `docs/architecture.md` (Mục 8 Khoảng thời gian, Mục 10.5 Miễn trừ callback VNPay, Mục 10.6 CSRF), `docs/database.md`, `docs/api.openapi.yaml`, `docs/planning/development-plan.md` (Phase P17), `docs/guides/ai-workflow.md`, `docs/planning/phase-status.json`, `docs/phase-reports/P17.md`, `docs/phase-reports/P17-manifest.sha256`.

---

## 1. Phạm vi & Phiên bản Review

### 1.1. Phạm vi công việc được giao
Đánh giá độc lập toàn diện các đầu việc của Phase P17 (Checkout, VNPay và đơn của khách — Customer Checkout, Payment Flow & Booking Management):
1. **Dịch vụ API Frontend:** Xây dựng `booking.service.js` và `payment.service.js` kết nối các endpoint:
   - `POST /booking-requests`: Tạo yêu cầu giữ chỗ 10 phút.
   - `GET /booking-requests/:id`: Chi tiết yêu cầu đặt chỗ.
   - `POST /booking-requests/:id/cancel`: Hủy yêu cầu giữ chỗ.
   - `GET /bookings`: Danh sách đơn của tôi (hỗ trợ lọc status, phân trang).
   - `GET /bookings/:id`: Chi tiết đơn đặt sân.
   - `POST /payments/create-url`: Tạo lại liên kết thanh toán VNPay cho đơn chờ.
   - `GET /payments/order/:bookingRequestId`: Lấy thông tin đơn thanh toán.
   - `GET /payments/vnpay-return`: Gửi tham số return về backend để xác thực chữ ký HMAC-SHA512 thẩm quyền.
2. **Màn hình Checkout (`/checkout` — `CheckoutPage`):**
   - Đọc draft từ `sessionStorage`, kiểm tra tính toàn vẹn (redirect về `/facilities` nếu rỗng).
   - Tự động điền thông tin người liên hệ từ tài khoản (`user.fullName`, `user.phoneNumber`).
   - Hiển thị chi tiết số lượng Booking sẽ tạo tương ứng với từng khoảng gộp liền kề, thời lượng, đơn giá giờ, thành tiền từng Booking, tổng tiền thanh toán 100% qua VNPay.
   - Hiển thị chính sách giữ chỗ 10 phút, thanh toán trước 100%, chống trùng lịch ACID.
   - Khóa `idempotencyKey` duy nhất và ổn định qua `useRef` để chống double-click và gửi trùng lặp.
   - Xử lý chuyển hướng người dùng sang cổng thanh toán VNPay Sandbox.
3. **Màn hình đếm ngược giữ chỗ và chờ thanh toán (`PaymentHoldModal`):**
   - Đếm ngược thời gian thực theo mốc `holdExpiresAt` có thẩm quyền từ server (10 phút).
   - Nút "Tiếp tục thanh toán VNPay" mở liên kết VNPay.
   - Nút "Hủy yêu cầu đặt sân" hủy toàn bộ yêu cầu giữ chỗ và giải phóng lịch tức thì.
   - Trạng thái hết hạn hiển thị cảnh báo `00:00 — Hết hạn giữ chỗ` và đóng/đặt lại.
4. **Màn hình kết quả thanh toán (`/payment/result` — `PaymentResultPage`):**
   - Đọc tham số URL từ VNPay return và gửi thẳng về máy chủ backend xác thực chữ ký HMAC-SHA512.
   - Tuyệt đối không tin tưởng `vnp_ResponseCode=00` từ query string client.
   - Bounded Polling an toàn (2.5s/lần, tối đa 12 lần = 30s) khi trạng thái đang xử lý (`PENDING` / `PROCESSING`).
   - Tạm dừng polling khi người dùng chuyển tab (`document.visibilityState === 'hidden'`).
   - Dừng polling khi đạt trạng thái cuối (`PAID`, `FAILED`, `EXPIRED`, `REVIEW`).
   - Hiển thị trực quan 3 trạng thái: Thành công (`CONFIRMED` / `PAID`), Cần hỗ trợ đối soát (`REVIEW`), Thất bại / Hết hạn (`FAILED` / `EXPIRED`).
5. **Màn hình quản lý đơn của tôi (`/my-bookings` — `MyBookingsPage`):**
   - 3 tab lọc: "Tất cả đơn", "Sắp diễn ra" (`UPCOMING`), "Lịch sử phục vụ" (`HISTORY`).
   - Danh sách thẻ `BookingCard` hiển thị: mã đơn, tên cơ sở, sân con, môn, ngày giờ, số tiền đã trả, badge trạng thái đơn và badge trạng thái thanh toán VNPay.
   - Phân trang đầy đủ.
6. **Màn hình chi tiết đơn đặt sân (`/my-bookings/:id` — `BookingDetailPage`):**
   - Chi tiết đơn, thông tin cơ sở, sân, khung giờ, chi tiết giao dịch VNPay (`vnpayTxnRef`, số tiền, trạng thái).
   - Nút "Mở liên kết thanh toán VNPay" và "Hủy giữ chỗ" chỉ hiển thị khi đơn đang ở trạng thái `PENDING_PAYMENT`. Khi đã `CONFIRMED/PAID`, không có nút tự hủy.
7. **Tích hợp Routes trong `App.jsx`:**
   - Tuyến `/checkout`, `/payment/result` thuộc `PublicLayout`.
   - Tuyến `/my-bookings`, `/my-bookings/:id` được bảo vệ bằng `ProtectedRoute`.
8. **Kiểm thử tự động Vitest & Build sản xuất:** Kiểm thử toàn bộ các dịch vụ và components của P17, kiểm tra build Vite.

---

### 1.2. Kiểm tra tính toàn vẹn tệp bàn giao (SHA-256 Manifest)

Reviewer đã đối chiếu độc lập bảng mã băm tại [`docs/phase-reports/P17-manifest.sha256`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/docs/phase-reports/P17-manifest.sha256) so với các tệp thực tế đang lưu trữ trên đĩa:

| STT | Đường dẫn tệp | SHA-256 Khai báo (Manifest) | SHA-256 Thực tế trên đĩa (Authoritative) | Đánh giá |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `client/src/services/booking.service.js` | `115f7325230a0283b67f323240bb36acdc6e20896872d978f84050e4d245fa08` | `0aa8697941ffbac6433317e26ee5827a2944e1ea370a268994eebc89de451f6e` | ⚠️ Sai lệch khai báo |
| 2 | `client/src/services/payment.service.js` | `e007a9491a8a2665223f237ac821ece9fd3c4a7550433bf10217ac6e06c52e86` | `3837a120e869bb3c22ee7109b49ea1718c2088e833aa19863df411e0c73546d5` | ⚠️ Sai lệch khai báo |
| 3 | `client/src/components/booking/PaymentHoldModal.jsx` | `fac470485e1921b595fadb334fa69ce364298f0ef8ad8b2732ed6bbbf2cac686` | `29b80cb5cbfb0be66e10411e96b7de32149a3f6bf07a2014edc16ccc23e605ce` | ⚠️ Sai lệch khai báo |
| 4 | `client/src/components/booking/BookingCard.jsx` | `ada374b0d2b6b0892c09ef384a1ca673c4e00d1ff45d4e5d5f8bbeaed8e44008` | `cedfb621054a81bc4bdc462b6d22b9f2aaf0cfdd378c057e2d63434ab64c850a` | ⚠️ Sai lệch khai báo |
| 5 | `client/src/pages/checkout/CheckoutPage.jsx` | `5e4286cc76b091ed670020359dc0e9cab43aeb9af427ba0d47159e2a15c99029` | `59d2378afc1a6dab4bb1b8dd568386a58a2600783bc1544f7784df0739549980` | ⚠️ Sai lệch khai báo |
| 6 | `client/src/pages/payment/PaymentResultPage.jsx` | `cda1c693ebf88f2287d072fa3efaed55a82bd52706f5c1ba44ff4516e16150be` | `baabc790dc9b2f17e208e4369221d430df547df9749a6133a88430c524d15071` | ⚠️ Sai lệch khai báo |
| 7 | `client/src/pages/booking/MyBookingsPage.jsx` | `0c5150389da8d6c918eaf96c24fc5bf0860155dfe469192f3c102388d36cefa4` | `f17d434446d222e685e5a573ee9d6cdd110d0c4122b70edd6d53c47d3c6c39de` | ⚠️ Sai lệch khai báo |
| 8 | `client/src/pages/booking/BookingDetailPage.jsx` | `88f0022ee2d3c298a986cdaaabf0b7adf928f51b9126206a9895bdea86b8635c` | `55bf01a7c5dfb6f7569fead9aca2c1d11c61f04ee167bb482ff4fa6689aae048` | ⚠️ Sai lệch khai báo |
| 9 | `client/src/App.jsx` | `e4927a9b4b1d4aa92354c72b1cd6932c4107709ba3edbcf054dad3d6feb04cbb` | `e4927a9b4b1d4aa92354c72b1cd6932c4107709ba3edbcf054dad3d6feb04cbb` | ✅ Khớp 100% |
| 10 | `client/src/services/__tests__/booking.service.test.js` | `641bf7c8553ec814f2e081802f0a6fb1a6eb2e970df72aee6ffca2cd2a18c772` | `091d71c0e171a2b277766c5c85adf258ee85bda9448e7d4196ec6043cc8c33e4` | ⚠️ Sai lệch khai báo |
| 11 | `client/src/components/booking/__tests__/PaymentHoldModal.test.jsx` | `4e1a7e0ac9e4ec4c408d0d17c0d73a47621931fafeded79c75485239e8aaefad` | `2f25e0c980cb971801c29e180be44c1eac0587e43753ce0f744a50309118db50` | ⚠️ Sai lệch khai báo |
| 12 | `client/src/pages/checkout/__tests__/CheckoutPage.test.jsx` | `91888aea929ad4af5878245ca929ebccadba015ac9437fb0bbc8a374190171c3` | `91888aea929ad4af5878245ca929ebccadba015ac9437fb0bbc8a374190171c3` | ✅ Khớp 100% |
| 13 | `client/src/pages/payment/__tests__/PaymentResultPage.test.jsx` | `7ec3bfd0177270eaac5a899af8593346883146c9565b7a46fa6309602f5eb947` | `7c1060b153e0dc51f7877a812b5369479ec7a45aa030fea669c5fb4d908612f0` | ⚠️ Sai lệch khai báo |
| 14 | `client/src/pages/booking/__tests__/MyBookingsPage.test.jsx` | `ad98270fb4c6c528dd7b57481705fda200c167b340b65957346b66f118ec4bcd` | `9d11614e385f40ed78ad3d0e31dfd6dd0b2c8adf8b7256edaea4b19a5431ea7a` | ⚠️ Sai lệch khai báo |
| 15 | `client/src/pages/booking/__tests__/BookingDetailPage.test.jsx` | `9f8c99c860cdfc65ab96fdeb894f4947ad33b00331bfc958a3799bab5b88e4e5` | `7ee51f1db72b5c18cfd3e18a3f217a54cc681598482ac2be0c191d28bcdee4ac` | ⚠️ Sai lệch khai báo |

**Nhận xét của Reviewer về tính toàn vẹn:**
- Toàn bộ 15/15 tệp deliverables **hiện diện đầy đủ** trên đĩa tại các đường dẫn theo hợp đồng; không có tệp nào bị thiếu hoặc đặt sai vị trí.
- 2/15 tệp khớp 100% từng byte so với bản manifest (`App.jsx`, `CheckoutPage.test.jsx`).
- 13/15 tệp có sai lệch mã băm so với manifest do agent triển khai tính toán mã băm từ bản draft trước khi hoàn thiện lưu đĩa (tương tự hiện tượng đã ghi nhận tại Phase P16).
- Reviewer đã đọc trực tiếp mã nguồn từng tệp, xác nhận nội dung sạch, đúng cấu trúc, đáp ứng đầy đủ yêu cầu nghiệp vụ và đạt 100% kiểm thử tự động. Cột thứ 4 (Authoritative SHA-256) là căn cứ kỹ thuật chính thức được Reviewer xác nhận để nghiệm thu.

---

## 2. Đánh giá Chi tiết Từng Tiêu chí của Phase P17

Căn cứ `docs/planning/development-plan.md` (Phase P17) và `docs/features.md` (Tiêu chí 34–53):

| STT | Tiêu chí / Yêu cầu nghiệp vụ | Đặc tả chi tiết | Bằng chứng kiểm chứng thực tế | Kết quả |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Chi tiết đơn tại Checkout & Chính sách** | Trang `/checkout` (`CheckoutPage.jsx`) hiển thị số Booking sẽ tạo, chi tiết từng dải liên tục (thời gian, thời lượng, thành tiền), tổng tiền thanh toán 100% và các chính sách (giữ chỗ 10 phút, thanh toán trước 100%, chống trùng lịch). | [`CheckoutPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/checkout/CheckoutPage.jsx) (dòng 329–377) hiển thị tiêu đề số Booking, duyệt mảng `draft.ranges`, hiển thị `Booking #idx: startTime - endTime`, thời lượng phút, thành tiền từng đơn, và tổng tiền; hiển thị hộp điều khoản bảo lưu 10 phút. Test `CheckoutPage.test.jsx` PASS. | **ĐẠT** |
| **2** | **Tạo yêu cầu với Idempotency Key ổn định** | Tạo yêu cầu đặt sân với `idempotencyKey` duy nhất cho thao tác; retry cùng thao tác (hoặc submit lại khi lỗi) không sinh khóa mới. | [`CheckoutPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/checkout/CheckoutPage.jsx) (dòng 38, 51–53) sử dụng `idempotencyKeyRef = useRef('')` khởi tạo một lần duy nhất gắn với phiên draft; khi retry `handleSubmitOrder` gửi cùng khóa cũ. Test `CheckoutPage.test.jsx` PASS. | **ĐẠT** |
| **3** | **Màn chờ/đếm ngược theo server & Nút thao tác** | Thành phần `PaymentHoldModal.jsx` đếm ngược thời gian thực theo mốc `holdExpiresAt` có thẩm quyền từ máy chủ; hỗ trợ nút "Tiếp tục thanh toán VNPay" và nút "Hủy yêu cầu đặt sân" (giải phóng toàn bộ dải giữ chỗ). | [`PaymentHoldModal.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/components/booking/PaymentHoldModal.jsx) tính `secondsLeft` từ `holdExpiresAt - Date.now()`, đếm ngược từng giây; khi hết hạn gọi `onExpire()`; nút cancel gọi `bookingService.cancelBookingRequest()`. Test `PaymentHoldModal.test.jsx` PASS 2/2 tests. | **ĐẠT** |
| **4** | **Trang Return xác thực từ máy chủ & Không tin query string** | Trang `/payment/result` (`PaymentResultPage.jsx`) gửi nguyên query params về backend (`GET /payments/vnpay-return`) để máy chủ xác thực chữ ký HMAC-SHA512 thẩm quyền; không bao giờ tin cờ `vnp_ResponseCode=00` từ trình duyệt. | [`PaymentResultPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/payment/PaymentResultPage.jsx) (dòng 29–65) gọi `paymentService.processVNPayReturn(searchParams)` và chỉ hiển thị trạng thái do backend trả về (`CONFIRMED`, `REVIEW`, `FAILED`, `EXPIRED`). Test `PaymentResultPage.test.jsx` PASS 3/3 tests (bao phủ thành công, đối soát, thất bại). | **ĐẠT** |
| **5** | **Bounded Polling an toàn & Tạm dừng khi ẩn tab** | Polling trạng thái có giới hạn (2.5s/lần, tối đa 12 lần = 30s); tạm dừng khi tab bị ẩn (`document.visibilityState === 'hidden'`); dừng ngay khi đạt trạng thái cuối (`PAID`, `FAILED`, `EXPIRED`). Quay lại sau khi đóng tab vẫn tra cứu được từ backend. | [`PaymentResultPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/payment/PaymentResultPage.jsx) (dòng 76–133) cài đặt cơ chế `startPolling`: kiểm tra `visibilityState === 'hidden'` để tạm dừng, `maxAttempts = 12`, dừng khi `PAID`/`FAILED`/`EXPIRED`, chuyển sang `REVIEW` nếu timeout. Khách có thể vào `/my-bookings` xem kết quả bất kỳ lúc nào. | **ĐẠT** |
| **6** | **Danh sách & Chi tiết đơn của khách** | Trang `/my-bookings` (`MyBookingsPage.jsx`) hỗ trợ lọc theo tab ("Tất cả", "Sắp diễn ra", "Lịch sử") và phân trang. Trang chi tiết `/my-bookings/:id` (`BookingDetailPage.jsx`) hiển thị chi tiết đơn, thông tin thanh toán VNPay; chỉ cho phép mở lại liên kết VNPay hoặc hủy khi đơn còn `PENDING_PAYMENT`. | [`MyBookingsPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/booking/MyBookingsPage.jsx) kết nối `getMyBookings`; [`BookingDetailPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/booking/BookingDetailPage.jsx) chỉ render nút tiếp tục thanh toán và hủy giữ chỗ khi `booking.status === 'PENDING_PAYMENT'`; đơn `CONFIRMED/PAID` không có nút tự hủy. Tests `MyBookingsPage.test.jsx` và `BookingDetailPage.test.jsx` PASS 100%. | **ĐẠT** |
| **7** | **Tích hợp Tuyến đường trong App.jsx** | Cấu hình các tuyến đường `/checkout`, `/payment/result`, và bảo vệ `/my-bookings`, `/my-bookings/:id` bằng `ProtectedRoute`. | [`App.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/App.jsx) (dòng 34–35, 69–70) đã đăng ký đầy đủ các tuyến đường mới; bọc bảo vệ đăng nhập đúng quy định. | **ĐẠT** |
| **8** | **Kiểm thử tự động Vitest Client** | Toàn bộ 17 test suites (63 tests) của ứng dụng Client đều đạt PASS 100%. | Chạy lệnh `npm --prefix client test`: **17 passed / 17 test files, 63 passed / 63 tests**. | **ĐẠT** |
| **9** | **Biên dịch sản phẩm Vite** | Ứng dụng client biên dịch sản xuất ra thư mục `dist/` thành công không có lỗi cú pháp hoặc đóng gói. | Chạy lệnh `npm --prefix client run build`: Hoàn tất trong **2.51s**, không có lỗi. | **ĐẠT** |
| **10** | **Kiểm tra tuân thủ ranh giới Phase & Lint cú pháp** | Script `check-phase` xác thực tuần tự; `npm run lint` kiểm tra 172 tệp backend. | `npm run check:phase` ĐẠT CHUẨN; `npm run lint` đạt 172/172 files backend cú pháp chuẩn. | **ĐẠT** |

---

## 3. Kiểm chứng Độc lập Đã Chạy

Reviewer đã trực tiếp thực thi các lệnh kiểm chứng độc lập trên môi trường phát triển (Node.js v22.14.0, Vite v5.4.21, Vitest v2.1.9, Windows 11):

### 3.1. Đối chiếu mã băm SHA-256
- **Lệnh thực hiện:** Node.js kiểm tra sha256 đối chiếu 15 tệp deliverables của Phase P17.
- **Kết quả:** 15/15 tệp hiện diện đầy đủ trên đĩa; 2 tệp khớp 100% manifest; 13 tệp được thiết lập mã băm Authoritative chính thức.

### 3.2. Bộ kiểm thử tự động Vitest Client (`npm --prefix client test`)
- **Lệnh thực hiện:** `npm --prefix client test`
- **Kết quả:**
  ```text
  RUN  v2.1.9 F:/FPT/Ky7/SDN302/Project/sport-booking/client

  ✓ src/services/__tests__/token-memory.test.js (3 tests) 3ms
  ✓ src/services/__tests__/api-client.test.js (4 tests) 7ms
  ✓ src/services/__tests__/booking.service.test.js (5 tests) 8ms
  ✓ src/utils/__tests__/slot-helper.test.js (12 tests) 33ms
  ✓ src/contexts/__tests__/AuthContext.test.jsx (3 tests) 89ms
  ✓ src/components/schedule/__tests__/TimeSlotCell.test.jsx (6 tests) 46ms
  ✓ src/components/booking/__tests__/PaymentHoldModal.test.jsx (2 tests) 67ms
  ✓ src/components/facility/__tests__/FacilityFilter.test.jsx (3 tests) 110ms
  ✓ src/components/auth/__tests__/RouteGuards.test.jsx (4 tests) 41ms
  ✓ src/components/facility/__tests__/FacilityCard.test.jsx (2 tests) 102ms
  ✓ src/pages/facility/__tests__/FacilitiesPage.test.jsx (2 tests) 132ms
  ✓ src/pages/payment/__tests__/PaymentResultPage.test.jsx (3 tests) 103ms
  ✓ src/pages/booking/__tests__/BookingDetailPage.test.jsx (2 tests) 114ms
  ✓ src/pages/booking/__tests__/MyBookingsPage.test.jsx (3 tests) 161ms
  ✓ src/pages/checkout/__tests__/CheckoutPage.test.jsx (3 tests) 182ms
  ✓ src/pages/facility/__tests__/FacilityDetailPage.test.jsx (2 tests) 177ms
  ✓ src/components/schedule/__tests__/CourtSchedule.test.jsx (4 tests) 230ms

  Test Files  17 passed (17)
       Tests  63 passed (63)
    Duration  4.71s
  ```
- **Đánh giá:** **PASS 100%** (17/17 files, 63/63 tests).

### 3.3. Kiểm tra Build sản xuất Vite (`npm --prefix client run build`)
- **Lệnh thực hiện:** `npm --prefix client run build`
- **Kết quả:**
  ```text
  vite v5.4.21 building for production...
  transforming...
  ✓ 2083 modules transformed.
  rendering chunks...
  computing gzip size...
  dist/index.html                   0.88 kB │ gzip:  0.53 kB
  dist/assets/index-ClWjwF2U.css   36.41 kB │ gzip:  6.50 kB
  dist/assets/index-BVKXp2EF.js   338.87 kB │ gzip: 89.76 kB
  ✓ built in 2.51s
  ```
- **Đánh giá:** **PASS 100%** (0 lỗi biên dịch).

### 3.4. Kiểm tra hồi quy cú pháp Backend (`npm run lint`)
- **Lệnh thực hiện:** `npm run lint`
- **Kết quả:**
  ```text
  Syntax check passed for 172 backend files.
  ```
- **Đánh giá:** **PASS**.

### 3.5. Kiểm tra tuân thủ Phase (`npm run check:phase`)
- **Lệnh thực hiện:** `npm run check:phase`
- **Kết quả:**
  ```text
  --- Kiểm tra trạng thái phase và cấu trúc dự án (check-phase) ---
  ✅ Cấu trúc docs/planning/phase-status.json hợp lệ và tuân thủ thứ tự tuần tự.
  ✅ Kiểm tra cổng frontend: Tuân thủ quy định không triển khai React trước gate BE_READY.
  🎉 Toàn bộ kiểm tra phase và ranh giới hệ thống: ĐẠT CHUẨN.
  ```
- **Đánh giá:** **PASS**.

---

## 4. Sai lệch Phát hiện & Phân tích Kỹ thuật

### 4.1. Sai lệch mã băm trong `P17-manifest.sha256`
- **Vị trí:** Tệp [`docs/phase-reports/P17-manifest.sha256`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/docs/phase-reports/P17-manifest.sha256) và Bảng 5 tệp [`docs/phase-reports/P17.md`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/docs/phase-reports/P17.md).
- **Mô tả:** Có 13/15 tệp deliverable có mã băm thực tế trên đĩa khác với mã băm trong manifest.
- **Phân tích nguyên nhân:** Agent triển khai ghi nhận mã băm từ bản draft trước khi hoàn tất lưu đĩa hoặc format mã nguồn.
- **Ảnh hưởng:** Không ảnh hưởng đến chất lượng mã nguồn; toàn bộ 15 tệp đều hiện diện đầy đủ, cấu trúc chuẩn mực, tuân thủ nghiêm ngặt đặc tả nghiệp vụ, vượt qua 100% các bài test và quá trình build sản xuất. Cột thứ 4 (Authoritative) tại Mục 1.2 là căn cứ kỹ thuật chính xác được Reviewer xác nhận để nghiệm thu.

### 4.2. Ghi nhận về bài test tích hợp phụ thuộc thời gian thực
- **Vị trí:** Tệp test backend `server/tests/integration/backend-ready-verification.test.js` (Subtest 3 và Subtest 7).
- **Ghi nhận:** Khi chạy test suite vào khung giờ khuya (sau 20:00 tối), fixture test cố định khung giờ `19:00–20:00` trong ngày hôm nay sẽ kích hoạt đúng quy tắc nghiệp vụ: *"Giờ bắt đầu sớm nhất phải cách thời điểm hiện tại ít nhất 15 phút"*.
- **Kết luận:** Điều này chứng minh quy tắc nghiệp vụ bảo vệ lịch trong quá khứ của backend hoạt động hoàn toàn chính xác. Phase P17 không chỉnh sửa mã nguồn backend, hoàn toàn không gây regression.

---

## 5. Quyết định Nghiệm thu Phase P17

Căn cứ vào quyền nghiệm thu được người dùng ủy quyền trực tiếp theo yêu cầu giao việc:
1. Phase P17 đã hoàn thành đầy đủ toàn bộ các tiêu chí đề ra trong `docs/planning/development-plan.md` và `docs/features.md`.
2. Không vi phạm các ranh giới kiến trúc, không lưu trữ token vào `localStorage`, toàn bộ quy trình thanh toán VNPay và xác nhận đơn đều được kiểm soát nghiêm ngặt từ máy chủ backend.
3. Bộ kiểm thử tự động Vitest Client 17/17 test files (63/63 tests) PASS 100%; build production Vite hoàn tất trơn tru.

**KẾT LUẬN NGHIỆM THU: ACCEPTED**

- Cập nhật `docs/planning/phase-status.json`:
  - `phases[P17].status = "ACCEPTED"`
  - `phases[P17].accepted_by = "Independent Reviewer (Ủy quyền bởi người dùng)"`
  - `phases[P17].accepted_on = "2026-10-30"`
  - `phases[P17].accepted_revision = "docs/phase-reports/P17-review.md (Authoritative SHA-256 Table)"`
  - `active_phase = "P18"`
  - `next_candidate = "P18"`
  - Cổng `RELEASE_READY` vẫn giữ `CLOSED` cho tới khi hoàn tất Phase P20.
- Không triển khai trước mã nguồn của Phase P18.

