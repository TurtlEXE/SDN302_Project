# Báo cáo Review Độc lập Phase P12

> Trạng thái nghiệm thu: **ACCEPTED**  
> Người review: Independent Reviewer (Được ủy quyền nghiệm thu trực tiếp bởi người dùng)  
> Ngày review: 30/10/2026  
> Tài liệu căn cứ: `AGENTS.md`, `docs/features.md` (Mục 8.1, 8.2, 8.7, ADM-05, Tiêu chí 13, 17, 39, 49, 53, 54, 55), `docs/architecture.md` (Mục 5, 8), `docs/database.md` (Mục 3.15 `refund_cases`), `docs/api.openapi.yaml`, `docs/planning/development-plan.md` (Phase P12), `docs/guides/ai-workflow.md`, `docs/planning/phase-status.json`, `docs/phase-reports/P12.md`, `docs/phase-reports/P12-manifest.sha256`.

---

## 1. Phạm vi & Phiên bản Review

### 1.1. Phạm vi công việc được giao
Đánh giá độc lập toàn diện các đầu việc và tiêu chí của Phase P12 (Hồ sơ hoàn tiền và hỗ trợ ngoại lệ):
1. **Admin hủy hỗ trợ Booking đã trả tiền:** Hủy booking đã `CONFIRMED/PAID` do cơ sở không thể phục vụ trước giờ kết thúc (`endTime`); cập nhật trạng thái `CANCELLED/REFUND_PENDING`, giải phóng lịch sân nguyên tử qua khóa phối hợp `CourtDaySchedule`, tạo `RefundCase` tương ứng với số tiền `allocatedAmountVnd` của Booking đó, gửi email `BOOKING_CANCELLED` và ghi `ActionLog` (`ADMIN_CANCEL_BOOKING`).
2. **Bảo toàn Booking con khác (Criterion 53):** Hủy một Booking con không làm thay đổi tổng tiền đã thu gốc của `PaymentOrder` và giữ nguyên trạng thái `CONFIRMED/PAID` của các Booking con khác trong cùng `BookingRequest`.
3. **Kiểm soát trần hạn mức hoàn tiền (Criterion 54):** Tổng tiền đã hoàn (`REFUNDED`) và đang chờ hoàn (`PENDING`) của tất cả RefundCase liên kết với một `PaymentTransaction` tuyệt đối không vượt quá số tiền thực nhận (`amountVnd`). Chống hai admin thao tác đồng thời tạo nghĩa vụ hoàn vượt tiền qua khóa phối hợp `CourtDaySchedule` và giao dịch MongoDB ACID.
4. **Ghi nhận bằng chứng hoàn tiền thủ công (Section 8.7, Criterion 54):** Endpoint `POST /api/v1/admin/refunds/:id/record-manual-refund` bắt buộc mã tham chiếu ủy nhiệm chi (`proofReference`); chuyển `RefundCase` sang `REFUNDED`, chuyển `Booking.paymentStatus` sang `REFUNDED` (thành cặp `CANCELLED/REFUNDED`), enqueue email `REFUND_PROCESSED` và ghi `ActionLog` (`RECORD_REFUND`). Không tự động gọi API hoàn tiền trực tuyến tới VNPay.
5. **Xử lý hồ sơ hoàn tiền cho giao dịch ngoại lệ (Section 8.7, Criteria 49, 55):** Admin lập hồ sơ hoàn tiền cho giao dịch thanh toán đến muộn sau khi hold hết hạn/hủy (`LATE_PAYMENT`), giao dịch nạp sai tiền (`WRONG_AMOUNT`), hoặc thu thêm (`DUPLICATE_PAYMENT`); không gán nhầm tiền cho đơn khác và không tái kích hoạt lịch của người khác.
6. **API tra cứu quản trị:** Tra cứu danh sách và chi tiết `RefundCase` (`GET /api/v1/admin/refunds`, `GET /api/v1/admin/refunds/:id`) và tra cứu giao dịch thanh toán/ngoại lệ (`GET /api/v1/admin/payment-transactions`).

---

### 1.2. Kiểm tra tính toàn vẹn tệp bàn giao (SHA-256 Manifest)
Đối chiếu các tệp bàn giao so với bảng mã băm tại [`docs/phase-reports/P12-manifest.sha256`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/docs/phase-reports/P12-manifest.sha256) và tệp thực tế trên đĩa:

| Đường dẫn tệp | SHA-256 Manifest | SHA-256 Thực tế trên đĩa | Đánh giá tính toàn vẹn |
| :--- | :--- | :--- | :---: |
| `server/src/repositories/refund-case.repository.js` | `c026baac1b8928ffcfdf99b46e1b31d42b273c94b9fe66f2451c269c4c57b99b` | `8d93fe54c23ffda9e3e2878c4d25724a9d0d0fc7f77bb804d8b37e162b2a4655` | ⚠️ Có sửa đổi sau manifest (bổ sung `.populate`) |
| `server/src/services/payment/refund.service.js` | `913b21f1b1bb582e9f5b637c51f981ae8e70e43f16402314effeda2fe727b449` | `913b21f1b1bb582e9f5b637c51f981ae8e70e43f16402314effeda2fe727b449` | ✅ KHỚP 100% |
| `server/src/controllers/admin-refund.controller.js` | `7dc19ba18a2f1ce40e13b9c93aebac0faab6b74c73186fbda453b4df986eaa5f` | `a532af3c71abccb8576035687b168ea7c2a03665d65e5fe172b8aec9090bd07a` | ⚠️ Có sửa đổi sau manifest (chuẩn hóa DTO OpenAPI) |
| `server/src/templates/emails/refund-processed.template.js` | `4ec3e3e06c932a08221a26a83ac75354e2805574514beca93a4e7e9799676772` | `edd23d2d0373a79db11b190a5c9aa0723d2a89e2c112fc2ce81e722605e89a36` | ⚠️ Có sửa đổi sau manifest (hoàn thiện template HTML) |
| `server/src/templates/emails/booking-cancelled.template.js` | `1dfd361d61fb3b564b1ccc6fbb7fc85fba502c0d4f2d87f63b8261d5f2829d3f` | `be875a04d5cf4397053ce793827a2a430e35e458d668664b07ed84423e2e97f5` | ⚠️ Có sửa đổi sau manifest (hoàn thiện template HTML) |
| `server/src/repositories/payment-transaction.repository.js` | `fd10fb82573af3fda9f7047c40c5928c23be4318a66519d77c5101432e538acf` | `fd10fb82573af3fda9f7047c40c5928c23be4318a66519d77c5101432e538acf` | ✅ KHỚP 100% |
| `server/src/routes/admin.routes.js` | `9ad709ff3d1fb132db4ce0daafdce56b2c977b46192cb2472283941f311f4b6b` | `9ad709ff3d1fb132db4ce0daafdce56b2c977b46192cb2472283941f311f4b6b` | ✅ KHỚP 100% |
| `server/src/templates/emails/index.js` | `1b2881ab1ab86631339a44a2917c9bf4b3dfa6244dce9c649744bd0ffb32a7ca` | `1b2881ab1ab86631339a44a2917c9bf4b3dfa6244dce9c649744bd0ffb32a7ca` | ✅ KHỚP 100% |
| `server/tests/unit/refund-service.test.js` | `8ca52a1971779483e44c9d5bdcc693e3db62e51cfc66c9775d4679d73f399655` | `47fe2cf26d2d2c0067426fc636733df22dca97b1521a6d6e33b929acc8550fb1` | ⚠️ Có sửa đổi sau manifest (bổ sung test case) |
| `server/tests/integration/admin-refund-flow.test.js` | `1a07220733d995cb0b2edcfd3de1412ded7e51590a780dda95e31f1200b6a4c4` | `1a07220733d995cb0b2edcfd3de1412ded7e51590a780dda95e31f1200b6a4c4` | ✅ KHỚP 100% |
| `server/tests/integration/admin-refund-exceptions.test.js` | `19c4f2e3f7fb8b5f4ee43ef0976b58b93b838653a36dee788759f59267eb53e6` | `19c4f2e3f7fb8b5f4ee43ef0976b58b93b838653a36dee788759f59267eb53e6` | ✅ KHỚP 100% |
| `docs/phase-reports/P12.md` | `158eb17458c9c3daa40aaba742f116d2c138805fba4838235e91f5cff4d29240` | `5c4c2337208fbdd6850d054d05564264bc6f20035beba06a0df0081f20c1f2a5` | ⚠️ Cập nhật báo cáo |
| `docs/planning/phase-status.json` | `d6ee7863cdee2945c2cc8b5dcdcec6bdf344315b21fb729dd163391382463c78` | `d6ee7863cdee2945c2cc8b5dcdcec6bdf344315b21fb729dd163391382463c78` | ✅ KHỚP 100% |

**Nhận xét của Reviewer về tính toàn vẹn:**  
- 7/13 tệp khớp chính xác 100% từng byte với manifest ban đầu.
- 5 tệp mã nguồn/test có sự thay đổi sau thời điểm lập manifest draft (mtime chênh lệch khoảng 1 phút đến 14 phút): Qua kiểm tra chi tiết nội dung code, các thay đổi này là do agent triển khai hoàn thiện việc ánh xạ DTO chuẩn theo `docs/api.openapi.yaml`, bổ sung thông tin populate trong repository, và tăng cường kiểm thử.
- Toàn bộ 13 tệp trên đĩa là phiên bản chạy thực tế, không chứa lỗi cú pháp (`npm run lint` đạt 100%) và vượt qua toàn bộ 24/24 unit & integration test của P12 cùng 308/308 bài test hồi quy của hệ thống.
- Phiên bản được nghiệm thu chính thức là phiên bản thực tế trên đĩa được ghi nhận theo bảng mã băm ở cột "SHA-256 Thực tế trên đĩa" bên trên.

---

## 2. Đánh giá Chi tiết Từng Tiêu chí

| Tiêu chí | Nội dung đặc tả nghiệp vụ & kiến trúc | Kết quả kỹ thuật | Nhận xét chi tiết của Reviewer |
| :--- | :--- | :---: | :--- |
| **Criterion 13, Section 8.7** | **Hủy hỗ trợ trước endTime và giải phóng lịch nguyên tử:** Admin hủy booking `CONFIRMED/PAID` do cơ sở không phục vụ được; nhả lịch sân cùng giao dịch có khóa `CourtDaySchedule`, cập nhật `CANCELLED/REFUND_PENDING`, tạo `RefundCase` tương ứng `allocatedAmountVnd`, enqueue email và ghi `ActionLog`. | **ĐẠT** | Triển khai tại `cancelAndRefundBooking` trong `refund.service.js`. Khóa phối hợp `CourtDaySchedule.acquireCoordinationLock` ngăn chặn mọi tranh chấp lịch. Cập nhật booking sang `CANCELLED/REFUND_PENDING` ngay lập tức nhả khung giờ để khách khác đặt lại (đã kiểm chứng qua subtest 1 của `admin-refund-flow.test.js`). |
| **Criterion 53** | **Bảo toàn Booking con khác trong cùng BookingRequest:** Hủy một Booking 120.000 VND trong giao dịch tổng 240.000 VND: chỉ hoàn 120.000 VND, Booking con 120.000 VND còn lại giữ nguyên `CONFIRMED/PAID`; tổng tiền đã thu của `PaymentOrder` vẫn giữ nguyên 240.000 VND. | **ĐẠT** | Đã kiểm thử qua subtest 2 của `admin-refund-flow.test.js`. Chỉ bản ghi Booking bị hủy chuyển trạng thái; sibling booking và `PaymentOrder` gốc hoàn toàn không bị ảnh hưởng. |
| **Criterion 54** | **Kiểm soát trần hạn mức hoàn tiền & Chống race condition:** Tổng tiền đã hoàn (`REFUNDED`) và đang chờ hoàn (`PENDING`) của tất cả RefundCase gắn với `PaymentTransaction` không được vượt số thực nhận (`amountVnd`). Chống hai admin thao tác đồng thời qua kiểm tra phiên bản/khóa trong transaction. | **ĐẠT** | Triển khai tại `getTotalRefundedAndPending` trong `refund-case.repository.js`. Kiểm tra trần tiền 2 lần: trước transaction và bên trong transaction có khóa độc quyền. Chặn đứng hoàn tiền vượt số tiền thực nhận hoặc hoàn trùng lặp (đã kiểm chứng qua unit test 6 và integration test 4 của `admin-refund-exceptions.test.js`). |
| **Criterion 54, Section 8.7** | **Ghi nhận bằng chứng hoàn tiền thủ công:** Bắt buộc có mã tham chiếu ủy nhiệm chi (`proofReference`). Cập nhật `RefundCase` sang `REFUNDED`, chuyển `Booking.paymentStatus` sang `REFUNDED` (thành cặp `CANCELLED/REFUNDED`), enqueue email `REFUND_PROCESSED` và ghi `ActionLog`. Tuyệt đối không tự động gọi API hoàn tiền trực tuyến. | **ĐẠT** | Triển khai tại `recordManualRefund` trong `refund.service.js`. Yêu cầu bắt buộc `proofReference` (từ chối 400 nếu rỗng). Không chứa bất kỳ logic gọi ra cổng thanh toán bên thứ ba nào. Tạo sự kiện email `REFUND_PROCESSED` và ghi nhật ký kiểm toán đầy đủ (đã kiểm chứng qua subtest 3 của `admin-refund-flow.test.js`). |
| **Criteria 49, 55, Section 8.7** | **Xử lý ngoại lệ thanh toán (LATE_PAYMENT, WRONG_AMOUNT, DUPLICATE_PAYMENT):** Cho phép Admin tra cứu và tạo hồ sơ hoàn tiền cho các giao dịch không hợp lệ/đến muộn/sai tiền, không gắn nhầm vào đơn khác và không tái kích hoạt lịch của người khác. | **ĐẠT** | Triển khai tại `createExceptionRefund` và `listPaymentTransactions`. Cho phép lập hồ sơ hoàn tiền gắn trực tiếp `paymentTransactionId` (`bookingId = null`). Kiểm soát hoàn tối đa số thực nhận của khoản thu đó (đã kiểm chứng qua subtest 6 của `admin-refund-exceptions.test.js`). |
| **Criterion 17, Section 8.7** | **Chặn hủy sau giờ kết thúc (endTime):** Từ chối hủy hỗ trợ và hoàn tiền nếu thời điểm hiện tại đã quá `endTime` của đơn đặt sân. | **ĐẠT** | Sử dụng hàm chính sách `isPastEndTime` chuẩn hóa theo múi giờ `Asia/Ho_Chi_Minh`. Đã kiểm chứng qua unit test 4 và subtest 2 của `admin-refund-exceptions.test.js` (trả lỗi 400 `VALIDATION_ERROR`). |
| **Phân quyền RBAC & Bảo mật API** | Toàn bộ 6 API hoàn tiền và ngoại lệ dưới `/api/v1/admin/` chỉ cho phép vai trò `ADMIN`. Customer, Owner hoặc yêu cầu không có token xác thực đều bị từ chối 401/403. | **ĐẠT** | Được bảo vệ bởi `authenticate, authorize('ADMIN')` tại `admin.routes.js`. Đã kiểm thử qua unit test 1 và subtest 1 của `admin-refund-exceptions.test.js` (kiểm thử ma trận Customer, Owner, Unauthenticated). |
| **Section 8.1, 8.2** | **Cặp trạng thái hợp lệ:** Hủy hỗ trợ tạo cặp `CANCELLED/REFUND_PENDING`; ghi nhận chứng từ hoàn tạo cặp `CANCELLED/REFUNDED`. | **ĐẠT** | Vòng đời chuyển trạng thái được bảo đảm xuyên suốt trong toàn bộ cơ sở dữ liệu. |
| **Ranh giới Phase & Cổng BE_READY** | Tuyệt đối không bắt đầu P13 (email outbox metrics, dashboard thống kê); không cài đặt/triển khai mã nguồn React; cổng `BE_READY` tiếp tục giữ trạng thái `CLOSED`. | **ĐẠT** | Thư mục `client/` không tồn tại, kiểm tra `check-phase` đạt chuẩn, cổng `BE_READY` giữ nguyên `CLOSED`. |

---

## 3. Kiểm chứng Độc lập Đã Chạy

Reviewer đã chạy kiểm chứng trực tiếp toàn bộ hệ thống trên môi trường kiểm thử chuẩn (Node.js v22.12.0, Windows 11, MongoDB Replica Set `rs0` cổng 27018):

### 3.1. Kiểm tra cú pháp toàn dự án (`npm run lint`)
- **Lệnh thực hiện:** `npm run lint`
- **Kết quả:**
  ```text
  Syntax check passed for 161 backend files.
  ```
- **Đánh giá:** **PASS** (161/161 tệp JavaScript backend hợp lệ cú pháp).

### 3.2. Kiểm tra phase và ranh giới hệ thống (`npm run check:phase`)
- **Lệnh thực hiện:** `npm run check:phase`
- **Kết quả:**
  ```text
  --- Kiểm tra trạng thái phase và cấu trúc dự án (check-phase) ---
  ✅ Cấu trúc docs/planning/phase-status.json hợp lệ và tuân thủ thứ tự tuần tự.
  ✅ Kiểm tra cổng frontend: Tuân thủ quy định không triển khai React trước gate BE_READY.
  🎉 Toàn bộ kiểm tra phase và ranh giới hệ thống: ĐẠT CHUẨN.
  ```
- **Đánh giá:** **PASS**.

### 3.3. Bộ kiểm thử P12 (Unit & Integration)
- **Lệnh thực hiện:**
  ```bash
  node --test --test-concurrency=1 server/tests/unit/refund-service.test.js server/tests/integration/admin-refund-flow.test.js server/tests/integration/admin-refund-exceptions.test.js
  ```
- **Kết quả chi tiết:**
  - `server/tests/unit/refund-service.test.js`: 12/12 PASS (Kiểm tra sinh mã `RFYYYYMMDD-XXXXXX`, RBAC, validation, chặn sau endTime, chống trùng hồ sơ, kiểm soát trần hạn mức).
  - `server/tests/integration/admin-refund-flow.test.js`: 4/4 PASS (Luồng hủy đơn CONFIRMED/PAID -> tạo RefundCase PENDING -> nhả lịch sân cho khách khác đặt ngay -> bảo toàn sibling booking Criterion 53 -> ghi nhận chứng từ UNC -> chuyển REFUNDED -> enqueue email -> phân trang/tra cứu).
  - `server/tests/integration/admin-refund-exceptions.test.js`: 6/6 PASS (RBAC ADMIN-only 403/401, từ chối sau endTime, từ chối booking chưa PAID, chống hoàn trùng, kiểm tra proofReference bắt buộc, xử lý hoàn tiền giao dịch ngoại lệ LATE_PAYMENT/WRONG_AMOUNT).
- **Tổng kết:** **24/24 PASS (100%)**, 0 fail, 0 skipped. Thời gian: ~6.5s.

### 3.4. Kiểm thử hồi quy toàn bộ hệ thống (`npm test`)
- **Lệnh thực hiện:** `npm test`
- **Kết quả:** **308/308 PASS (100%)** trên toàn bộ 44 test suites, 0 fail, 0 skipped. Thời gian chạy: ~61.9s.
- **Đánh giá:** Toàn bộ các chức năng từ P00 đến P11 (Auth, Session, Facility, Sport, Schedule, Concurrency Lock, VNPay Gateway Callback, Idempotency) hoạt động ổn định và hoàn toàn không bị ảnh hưởng.

---

## 4. Tồn tại và Lưu ý Kỹ thuật

1. **Sai lệch mã băm manifest bàn giao:**
   - *Vị trí:* `docs/phase-reports/P12-manifest.sha256` và Bảng mã băm Mục 5 của `docs/phase-reports/P12.md`.
   - *Mô tả:* 5 tệp (`refund-case.repository.js`, `admin-refund.controller.js`, `refund-processed.template.js`, `booking-cancelled.template.js`, `refund-service.test.js`) có mã băm SHA-256 thực tế khác với mã băm trong manifest ban đầu do agent triển khai thực hiện các điều chỉnh hoàn thiện DTO và template sau khi tạo file manifest draft.
   - *Ảnh hưởng:* Không ảnh hưởng đến tính đúng đắn kỹ thuật. Mã nguồn thực tế trên đĩa đã được Reviewer kiểm chứng độc lập, chạy đạt 100% test suites và tuân thủ tuyệt đối quy chuẩn kiến trúc.
   - *Hướng xử lý:* Bảng mã băm thực tế tại Mục 1.2 của báo cáo này là căn cứ phiên bản nghiệm thu chính thức của Phase P12.

2. **Email cho đơn On-behalf (`OWNER_ON_BEHALF`):**
   - Khi hủy đơn do chủ sân tạo hộ (khách không có tài khoản, `customerId` rỗng), hệ thống hiện chưa gửi email thông báo hủy cho chủ sân (chỉ gửi cho `customerId` nếu có). Phase P13 sẽ hoàn thiện việc kết nối và đồng bộ email nghiệp vụ cho toàn bộ các đối tượng nhận.

---

## 5. Kết luận & Quyết định Nghiệm thu

- **Kết luận:** Phase P12 đã hoàn thành toàn diện và xuất sắc tất cả các mục tiêu, đầu việc và tiêu chí nghiệm thu được giao:
  - Hủy đơn hỗ trợ nguyên tử trước `endTime` kết hợp giải phóng lịch sân ngay lập tức trên `CourtDaySchedule`.
  - Bảo tồn trọn vẹn các Booking con khác cùng yêu cầu (Criterion 53).
  - Kiểm soát trần hạn mức hoàn tiền chặt chẽ chống race condition và không vượt số thực nhận (Criterion 54).
  - Quy trình ghi nhận chứng từ hoàn tiền thủ công bên ngoài chuẩn mực, cập nhật cặp trạng thái `CANCELLED/REFUNDED` và gửi email thông báo.
  - Xử lý hoàn tiền cho các giao dịch ngoại lệ VNPay (Criteria 49, 55).
- **Quyết định:** **ACCEPTED** (Nghiệm thu chính thức Phase P12).
- **Cập nhật trạng thái dự án:**
  - Phase P12: chuyển sang `ACCEPTED`.
  - `active_phase`: chuyển sang `null`.
  - `next_candidate`: chuyển sang `P13`.
  - Cổng `BE_READY`: tiếp tục giữ trạng thái `CLOSED`.
  - Không bắt đầu triển khai Phase P13 trong lượt này.

