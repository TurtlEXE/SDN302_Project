# Báo cáo Review và Nghiệm thu Độc lập — Phase P09

> **Trạng thái kết luận:** `ACCEPTED`  
> **Người thực hiện review & thẩm quyền:** Reviewer độc lập (Được người dùng ủy quyền trực tiếp theo yêu cầu)  
> **Ngày review & nghiệm thu:** 29/10/2026  
> **Tài liệu căn cứ:** `AGENTS.md`, `docs/features.md` (CUS-01, OWN-08, Mục 8.3 chống trùng lịch, Mục 8.4 tính tiền, Mục 8.5 tạm ngừng/khóa, Mục 8.6 luồng thanh toán VNPay, các tiêu chí 6, 7, 8, 10, 11, 14, 16, 24, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36, 46), `docs/architecture.md` (Mục 1, 3, 4.3, 5, 8), `docs/database.md`, `docs/api.openapi.yaml`, `docs/planning/development-plan.md` (Phase P09), `docs/guides/ai-workflow.md`, `docs/phase-reports/P09.md`, `docs/phase-reports/P09-manifest.sha256`, `docs/planning/phase-status.json`.

---

## 1. Phạm vi và Phiên bản được Review

### 1.1. Phạm vi bàn giao của Phase P09 (12 tệp)

Phase P09 hiện thực toàn bộ quy trình tạo yêu cầu đặt sân nguyên tử trong giao dịch MongoDB ACID (`withTransaction`), cơ chế tuần tự hóa chống xung đột lịch đồng thời trên document phối hợp `CourtDaySchedule`, gộp ô thành các `Booking` dạng khoảng liên tục, tạo duy nhất một `PaymentOrder` (thu 100% tổng tiền các khoảng) với thời hạn giữ chỗ đúng 10 phút, hỗ trợ Idempotency Key chống tạo trùng lặp dựa trên SHA-256 payload fingerprint, và cung cấp API tạo đơn cho khách hàng cùng API tạo hộ khách ngoài cho chủ sân:

- **Tầng Lưu trữ Truy vấn & Phối hợp Ghi Lịch (`server/src/repositories/` - 4 tệp):**
  - `server/src/repositories/court-day-schedule.repository.js` *(Tạo mới)*: Cung cấp `acquireCoordinationLock(courtId, bookingDate, session)` khóa ghi độc quyền và tăng `scheduleVersion` trong transaction, xử lý an toàn lỗi duplicate key (code 11000) khi hai transaction đồng thời upsert document phối hợp chưa từng tồn tại (Section 8.3.3, Criterion 7).
  - `server/src/repositories/booking-request.repository.js` *(Tạo mới)*: Quản lý truy vấn `BookingRequest` theo ID, `requestNumber`, và tìm kiếm chống lặp theo cặp `(createdBy, idempotencyKey)` trong transaction session (Criterion 10).
  - `server/src/repositories/booking.repository.js` *(Tạo mới)*: Quản lý tạo mảng `Booking` dạng khoảng theo session với `ordered: true`, truy vấn theo `bookingRequestId`, và truy vấn các khoảng đang chiếm lịch theo `courtId + bookingDate`.
  - `server/src/repositories/payment-order.repository.js` *(Tạo mới)*: Quản lý tạo `PaymentOrder` theo session, tìm theo `bookingRequestId` và `vnpayTxnRef`.
- **Tầng Dịch vụ Nghiệp vụ Lõi Đặt Sân (`server/src/services/booking/` - 1 tệp):**
  - `server/src/services/booking/booking-request.service.js` *(Tạo mới)*:
    - Hàm băm chuẩn hóa `computePayloadFingerprint`: sinh mã băm SHA-256 từ `courtId`, `bookingDate`, `configVersion`, danh sách ô đã sắp xếp, tên và SĐT người liên hệ (Criterion 10).
    - Các bộ sinh mã nghiệp vụ: `generateRequestNumber` (`BR...`), `generateBookingCode` (`BK...`), `generateVnpayTxnRef` (`PO...`).
    - Dịch vụ `createBookingRequest`: thực hiện toàn bộ quy trình trong MongoDB ACID session: kiểm tra điều kiện tài khoản (khách đã xác thực email - Criterion 36, tài khoản không bị khóa); kiểm tra cơ sở `PUBLISHED` và sân `isActive`; kiểm tra `configVersion` (Criteria 33, 34); gộp ô qua `mergeContiguousSlots` và tính giá qua `calculateBookingRequestTotal` từ P08; khóa ghi `CourtDaySchedule`; kiểm tra xung đột thời gian với các booking unexpired/confirmed và court blocks; tạo nguyên tử `BookingRequest`, các `Booking` con và `PaymentOrder` (100% tổng tiền, giữ chỗ 10 phút - Criterion 46); hỗ trợ luồng chủ sân tạo hộ khách ngoài với `guestAccessLink` và mã băm `guestAccessCodeHash` (Criterion 16).
    - Dịch vụ `getBookingRequestById`: tra cứu chi tiết yêu cầu đặt kèm danh sách booking con, phân quyền nghiêm ngặt theo vai trò (Customer chỉ xem đơn của mình, Owner chỉ xem đơn thuộc cơ sở của mình).
- **Bộ Điều khiển & Định tuyến API (`server/src/controllers/`, `server/src/routes/` - 4 tệp):**
  - `server/src/controllers/booking-request.controller.js` *(Tạo mới)*: Điều phối `createBookingRequest`, `getBookingRequestById`, `createOnBehalfBooking`.
  - `server/src/routes/booking-request.routes.js` *(Tạo mới)*: Khai báo các endpoint `POST /api/v1/booking-requests` và `GET /api/v1/booking-requests/:id`, bảo vệ bởi `authenticate`.
  - `server/src/routes/owner.routes.js` *(Cập nhật)*: Mount thêm endpoint `POST /api/v1/owner/bookings/on-behalf` bảo vệ bởi `authenticate, authorize('OWNER')`.
  - `server/src/routes/index.js` *(Cập nhật)*: Mount router `/booking-requests`.
- **Bộ Kiểm thử Tự động Unit & Integration (`server/tests/` - 3 tệp, 23 test cases):**
  - `server/tests/unit/idempotency.test.js` *(Tạo mới)*: 9 unit tests kiểm chứng tính độc lập thứ tự ô giờ của fingerprint, kiểm tra phân biệt hoa thường/khoảng trắng, và tính duy nhất của các bộ sinh mã (Criterion 10).
  - `server/tests/integration/booking-request-api.test.js` *(Tạo mới)*: 10 integration tests kiểm chứng luồng tạo đơn gộp ô (Criteria 6, 26), đơn nhiều dải rời (Criteria 27, 35), retry idempotency (Criterion 10), collision idempotency khác payload (Criterion 10), chặn version lệch (Criteria 33, 34), chặn khách chưa verify email (Criterion 36), chủ sân tạo hộ (Criterion 16), cách ly quyền giữa các khách hàng và chủ sân.
  - `server/tests/integration/booking-concurrency.test.js` *(Tạo mới)*: 2 integration tests kiểm chứng đua lệnh concurrency: 2 khách đồng thời đặt khoảng giao nhau lệch giờ -> đúng 1 khách thắng (201), 1 khách nhận 409 `SCHEDULE_CONFLICT` ngay cả khi chưa có document phối hợp trước đó (Criterion 7); đơn nhiều dải bị từ chối nguyên tử nếu 1 dải bận (Criterion 8).

---

### 1.2. Kiểm tra Đối chiếu Mã băm SHA-256 từ `docs/phase-reports/P09-manifest.sha256`

Toàn bộ 12 tệp bàn giao đã được đối chiếu nhị phân độc lập trực tiếp từ đĩa:

| STT | Đường dẫn tệp | Hash trong Manifest | Hash thực tế trên đĩa | Kết quả so khớp |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `server/src/repositories/court-day-schedule.repository.js` | `1a3035bcaba4c24a977fbcba40bf90b65ec34684eb94ffe272531daa9d4ffb88` | `1a3035bcaba4c24a977fbcba40bf90b65ec34684eb94ffe272531daa9d4ffb88` | **MATCH (100%)** |
| 2 | `server/src/repositories/booking-request.repository.js` | `98ae01e36b047ca161abc0dd243588dff3038ddb295e6c6fd6f6b51c93b125ce` | `98ae01e36b047ca161abc0dd243588dff3038ddb295e6c6fd6f6b51c93b125ce` | **MATCH (100%)** |
| 3 | `server/src/repositories/booking.repository.js` | `6bde7a586f1753278fde65228ff0250f90a7ec0185bfd1278d176e7d90e0c323` | `6bde7a586f1753278fde65228ff0250f90a7ec0185bfd1278d176e7d90e0c323` | **MATCH (100%)** |
| 4 | `server/src/repositories/payment-order.repository.js` | `ab706999ba4d9a6a70724b11606a92e323af85fbd257a8bfa9e32aa7cee2e86e` | `ab706999ba4d9a6a70724b11606a92e323af85fbd257a8bfa9e32aa7cee2e86e` | **MATCH (100%)** |
| 5 | `server/src/services/booking/booking-request.service.js` | `02d11fa0226a621516c50f9e6604646b50637d5f4bff80179173dd70099a907b` | `02d11fa0226a621516c50f9e6604646b50637d5f4bff80179173dd70099a907b` | **MATCH (100%)** |
| 6 | `server/src/controllers/booking-request.controller.js` | `c82bdf4ed357980de68ca08108822855c9b90051b55a6ad7eafa48ac96dbbc59` | `c82bdf4ed357980de68ca08108822855c9b90051b55a6ad7eafa48ac96dbbc59` | **MATCH (100%)** |
| 7 | `server/src/routes/booking-request.routes.js` | `2a8303b28eef98e7ae8dbd4e4cfb15d4c6701d1db93b03b7c78ccb919f542ed4` | `2a8303b28eef98e7ae8dbd4e4cfb15d4c6701d1db93b03b7c78ccb919f542ed4` | **MATCH (100%)** |
| 8 | `server/src/routes/owner.routes.js` | `51b8f44b282e07e2277a6e7a8e24eb1a52cfda8832cb6c156887db680b9d9bee` | `51b8f44b282e07e2277a6e7a8e24eb1a52cfda8832cb6c156887db680b9d9bee` | **MATCH (100%)** |
| 9 | `server/src/routes/index.js` | `e8ef8cd9752f8de67cae53f20d0aa300f5dbec3e64f89930424529359965a32e` | `e8ef8cd9752f8de67cae53f20d0aa300f5dbec3e64f89930424529359965a32e` | **MATCH (100%)** |
| 10 | `server/tests/unit/idempotency.test.js` | `58b2fc29fde937ff65f45d5a29f98cc6c98e247d3acb357dd7acb5bd0519014b` | `58b2fc29fde937ff65f45d5a29f98cc6c98e247d3acb357dd7acb5bd0519014b` | **MATCH (100%)** |
| 11 | `server/tests/integration/booking-request-api.test.js` | `076c595b6605f777179eaebaf06d72853028c7d613c0535d9c83bf18822830c5` | `076c595b6605f777179eaebaf06d72853028c7d613c0535d9c83bf18822830c5` | **MATCH (100%)** |
| 12 | `server/tests/integration/booking-concurrency.test.js` | `06a272ee77bb61cf9a25fcea79b478a29b463483b24d78e07bec4a4032ed5384` | `06a272ee77bb61cf9a25fcea79b478a29b463483b24d78e07bec4a4032ed5384` | **MATCH (100%)** |

> Toàn bộ 12 tệp bàn giao khớp 100% mã băm SHA-256 byte-for-byte với manifest của agent triển khai.

---

## 2. Đánh giá Chi tiết Từng Tiêu chí và Đầu việc P09

| STT | Tiêu chí / Đầu việc theo kế hoạch | Đầu ra thực tế | Đánh giá | Chi tiết kiểm chứng độc lập |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **Tạo BookingRequest, Booking dạng khoảng và PaymentOrder nguyên tử trong giao dịch (Criteria 6, 26, 46)**:<br>- Tạo đồng thời trong một MongoDB ACID transaction (`withTransaction`).<br>- Gộp các ô liên tiếp thành một Booking dạng khoảng (`mergeContiguousSlots`).<br>- Giữ chỗ đúng 10 phút (`holdExpiresAt = now + 10m`) chung cho toàn bộ Booking và PaymentOrder.<br>- PaymentOrder thu 100% tổng tiền. | `server/src/services/booking/booking-request.service.js`<br>`server/tests/integration/booking-request-api.test.js` | **ĐẠT** | - Khách chọn `06:00-06:30` và `06:30-07:00`: tạo thành công 1 BookingRequest và 1 Booking duy nhất `06:00-07:00` (60 phút, 120.000đ).<br>- PaymentOrder được tạo cùng giao dịch với số tiền 120.000đ, trạng thái `PENDING`.<br>- Hạn giữ chỗ `holdExpiresAt` được ghi nhận đúng 10 phút tính từ thời điểm tạo.<br>- Dữ liệu trong cơ sở dữ liệu xác nhận trạng thái `PENDING_PAYMENT` và `UNPAID`. |
| 2 | **Xử lý dải rời nhau: Nhiều Booking nhưng duy nhất một PaymentOrder (Criteria 27, 35)**:<br>- Chọn các ô không liên tiếp trên cùng sân/ngày (ví dụ `06:00-07:00` và `08:00-08:30`).<br>- Server tách thành các Booking riêng nhưng chỉ phát hành duy nhất một PaymentOrder thu tổng tiền 100%. | `server/src/services/booking/booking-request.service.js`<br>`server/tests/integration/booking-request-api.test.js` | **ĐẠT** | - Khách chọn `06:00-07:00` (120k) và `08:00-08:30` (60k): tạo đúng 2 bản ghi Booking con và duy nhất 1 PaymentOrder với tổng tiền 180.000đ (Criteria 27, 35).<br>- Khoảng thời gian trống giữa hai dải (`07:00-08:00`) hoàn toàn không bị chiếm lịch. |
| 3 | **Phối hợp ghi sân/ngày và bảo vệ tranh chấp đồng thời (Criterion 7, Section 8.3.3)**:<br>- Khóa ghi độc quyền document `CourtDaySchedule` theo `courtId + bookingDate` trong transaction trước khi truy vấn overlap.<br>- Xử lý tự động trường hợp document phối hợp chưa tồn tại (upsert atomic, bắt lỗi 11000).<br>- Hai request đồng thời giao giờ: đúng 1 request thành công (201), request kia báo `SCHEDULE_CONFLICT` (409). | `server/src/repositories/court-day-schedule.repository.js`<br>`server/src/services/booking/booking-request.service.js`<br>`server/tests/integration/booking-concurrency.test.js` | **ĐẠT** | - Test concurrency giả lập 2 khách đặt đồng thời các khoảng lệch giờ nhưng giao nhau (`08:00-09:30` và `09:00-10:00`) khi chưa có document phối hợp trước đó.<br>- Kết quả: Đúng 1 request nhận HTTP 201 Created, request còn lại nhận HTTP 409 Conflict với mã `SCHEDULE_CONFLICT` (Criterion 7).<br>- Cơ sở dữ liệu ghi nhận đúng 1 BookingRequest và 1 PaymentOrder; `CourtDaySchedule` được khởi tạo và tăng `scheduleVersion` an toàn. |
| 4 | **Tính nguyên tử khi có nhiều dải (Atomic Rollback - Criterion 8)**:<br>- Một yêu cầu có nhiều dải mà một dải bất kỳ bị trùng lịch hoặc lỗi.<br>- Toàn bộ yêu cầu phải thất bại, không lưu Booking một phần, không lưu BookingRequest hay PaymentOrder. | `server/src/services/booking/booking-request.service.js`<br>`server/tests/integration/booking-concurrency.test.js` | **ĐẠT** | - Yêu cầu gồm 2 dải: `06:00-07:00` (trống) và `08:00-08:30` (đã bận): server ném 409 `SCHEDULE_CONFLICT`.<br>- Kiểm tra cơ sở dữ liệu: Customer 2 có đúng 0 BookingRequest, và dải trống `06:00-07:00` có đúng 0 Booking được lưu (Criterion 8). |
| 5 | **Cơ chế Idempotency Key & Payload Fingerprint (Criterion 10)**:<br>- Khóa chống lặp theo `createdBy` và `idempotencyKey`.<br>- Fingerprint SHA-256 từ `courtId`, `bookingDate`, `configVersion`, danh sách ô đã chuẩn hóa, tên và SĐT người liên hệ.<br>- Gửi lại cùng mã + cùng nội dung: trả lại kết quả đã tạo không trùng lặp.<br>- Gửi lại cùng mã + khác nội dung: từ chối 400 `VALIDATION_ERROR`. | `server/src/services/booking/booking-request.service.js`<br>`server/tests/unit/idempotency.test.js`<br>`server/tests/integration/booking-request-api.test.js` | **ĐẠT** | - 9 unit tests PASS: fingerprint độc lập thứ tự ô giờ trong mảng, phân biệt hoa/thường tên người liên hệ, nhận diện mọi thay đổi về sân/ngày/bước giờ/ô giờ.<br>- Gửi lại request với cùng key và cùng payload: trả về đúng `bookingRequestId` và `requestNumber` đã tạo; số lượng document trong DB vẫn là 1.<br>- Gửi lại cùng key nhưng đổi ô giờ: bị từ chối 400 `VALIDATION_ERROR` ("Mã idempotencyKey này đã được dùng cho một yêu cầu có nội dung khác" - Criterion 10). |
| 6 | **Bảo vệ tính tương thích cấu hình và quyền tài khoản (Criteria 14, 33, 34, 36)**:<br>- Customer chưa xác thực email bị cấm đặt sân (HTTP 403 `ACCOUNT_NOT_VERIFIED`).<br>- Tài khoản bị khóa bị từ chối (HTTP 403 `ACCOUNT_LOCKED`).<br>- Lệch `configVersion` bị từ chối (HTTP 409 `CONFIG_VERSION_MISMATCH`).<br>- Sân không hoạt động hoặc cơ sở tạm dừng/bị admin khóa bị từ chối (HTTP 404). | `server/src/services/booking/booking-request.service.js`<br>`server/tests/integration/booking-request-api.test.js` | **ĐẠT** | - Khách chưa verify email gửi request bị chặn 403 `ACCOUNT_NOT_VERIFIED` (Criterion 36).<br>- Gửi `configVersion = 99` bị từ chối 409 `CONFIG_VERSION_MISMATCH` (Criteria 33, 34).<br>- Sân không tồn tại hoặc inactive trả về 404 `COURT_NOT_FOUND`. |
| 7 | **Chủ sân tạo đơn đặt hộ khách ngoài (Criterion 16, OWN-08)**:<br>- Endpoint `POST /api/v1/owner/bookings/on-behalf`.<br>- Dùng chung service và toàn bộ quy tắc chống trùng, tính giá, giữ chỗ 10 phút.<br>- Gán `source = 'OWNER_ON_BEHALF'`, `customerId = null`, sinh `guestAccessLink` và lưu `guestAccessCodeHash`.<br>- Chủ sân chỉ được tạo hộ trên cơ sở thuộc sở hữu của mình. | `server/src/controllers/booking-request.controller.js`<br>`server/src/routes/owner.routes.js`<br>`server/tests/integration/booking-request-api.test.js` | **ĐẠT** | - Owner tạo đơn hộ thành công, nhận HTTP 201 với `guestAccessLink` (`/guest-pay/:orderId?code=...`).<br>- Cơ sở dữ liệu ghi nhận `source = 'OWNER_ON_BEHALF'`, `customerId: null`, `guestAccessCodeHash` được lưu an toàn.<br>- Owner 2 cố tình tạo hộ trên cơ sở của Owner 1 bị từ chối 403 `FORBIDDEN`. |
| 8 | **Xem chi tiết yêu cầu đặt và phân quyền bảo mật**:<br>- Endpoint `GET /api/v1/booking-requests/:id`.<br>- Khách chỉ xem được đơn của mình; Owner chỉ xem được đơn thuộc cơ sở của mình. | `server/src/controllers/booking-request.controller.js`<br>`server/src/routes/booking-request.routes.js`<br>`server/tests/integration/booking-request-api.test.js` | **ĐẠT** | - Customer xem đơn của mình nhận 200 kèm chi tiết các booking con.<br>- Customer khác cố tình truy cập ID đơn của người khác bị chặn 403 `FORBIDDEN`. |
| 9 | **Ranh giới kiến trúc & Cổng Frontend**:<br>- Không tạo endpoint giả mạo "mark paid" hay phát hành URL VNPay thật khi chưa tới P11.<br>- Cổng `BE_READY` tiếp tục giữ trạng thái đóng an toàn (`CLOSED`).<br>- Không có bất kỳ thành phần React hay giao diện sản phẩm nào được cài đặt. | Codebase & `docs/planning/phase-status.json` | **ĐẠT** | - `npm run check:phase` xác nhận trạng thái cổng `BE_READY` đóng an toàn (`CLOSED`), quy trình tuân thủ tuần tự 100%. |

---

## 3. Các Kiểm chứng Độc lập Đã Chạy

Reviewer đã trực tiếp thực thi lại toàn bộ các lệnh kiểm chứng trên môi trường thực tế:

1. **Kiểm tra trạng thái MongoDB Replica Set (`npm run db:ensure-rs`):**
   - Lệnh: `npm run db:ensure-rs`
   - Kết quả: **PASS (`MongoDB Replica Set is active on port 27018 (rs0).`)**.
2. **Kiểm tra đồng bộ Index Mongoose (`npm run db:indexes`):**
   - Lệnh: `npm run db:indexes`
   - Kết quả: **PASS (17 models index synchronized thành công, bao gồm 5 indexes của BookingRequest, 6 indexes của Booking, 4 indexes của PaymentOrder, 2 indexes của CourtDaySchedule)**.
3. **Kiểm tra linter và cú pháp JavaScript toàn dự án (`npm run lint`):**
   - Lệnh: `npm run lint`
   - Kết quả: **PASS (`Syntax check passed for 133 backend files.`)**, mã thoát 0.
4. **Kiểm tra ranh giới Phase & Cổng Frontend (`npm run check:phase`):**
   - Lệnh: `npm run check:phase`
   - Kết quả: **PASS (`Cấu trúc docs/planning/phase-status.json hợp lệ và tuân thủ thứ tự tuần tự. Cổng BE_READY đóng an toàn.`)**.
5. **Kiểm thử độc lập bộ test của riêng Phase P09:**
   - Lệnh: `node --test --test-concurrency=1 server/tests/unit/idempotency.test.js server/tests/integration/booking-request-api.test.js server/tests/integration/booking-concurrency.test.js`
   - Kết quả: **PASS 23/23 tests (3 test files, 3 suites), 0 failures, thời gian chạy ~3.47s**.
6. **Kiểm thử tự động toàn diện dự án P00–P09 (`npm test`):**
   - Lệnh: `npm test` (tương đương `node --test --test-concurrency=1 tests/**/*.test.js`)
   - Môi trường: Node.js v22.12.0, Windows 11, MongoDB Replica Set `rs0` cổng 27018.
   - Kết quả: **PASS 243/243 tests (37 test files, 32 test suites), 0 failures, 0 skipped, 0 todo, 100% không phát sinh hồi quy**:
     - `Idempotency & Code Generators (Unit)`: 9/9 PASS.
     - `Booking Request API (Integration)`: 11/11 subtests PASS.
     - `Booking Concurrency & Race Protection (Integration)`: 3/3 subtests PASS.
     - Toàn bộ 34 test files cũ từ P01–P08 (220 tests): 220/220 PASS.

---

## 4. Ghi nhận và Khuyến nghị Kỹ thuật

### 4.1. Ghi nhận về tính chuẩn xác và an toàn
- **Khóa ghi phối hợp `CourtDaySchedule` (Section 8.3.3):** Giải pháp sử dụng document `CourtDaySchedule` với thao tác `$inc: { scheduleVersion: 1 }` và cơ chế bắt lỗi `code 11000` bảo đảm tính tuần tự hóa tuyệt đối giữa các giao dịch cạnh tranh trên cùng sân/ngày. Điều này giải quyết triệt để rủi ro race condition khi hai khách hàng đọc cùng thấy lịch trống và ghi đồng thời.
- **Tính nguyên tử của đơn nhiều dải (Criterion 8):** Việc gom toàn bộ thao tác tạo `BookingRequest`, tạo mảng các `Booking` con và tạo `PaymentOrder` vào trong `withTransaction` bảo đảm nếu bất kỳ dải nào trong danh sách bị trùng lịch hoặc gặp lỗi, toàn bộ transaction sẽ bị rollback và hoàn toàn không để lại dữ liệu rác hay đơn dở dang.
- **Idempotency Key với Fingerprint chuẩn xác (Criterion 10):** Hàm tính fingerprint sắp xếp các ô giờ trước khi băm, giúp nhận diện chính xác các yêu cầu trùng lặp dù thứ tự các ô giờ trong request body bị xáo trộn, đồng thời bảo vệ hệ thống trước hành vi tái sử dụng cùng một idempotencyKey cho các nội dung đặt sân khác nhau.
- **Bảo mật và phân quyền:** Khách chưa xác thực email không thể tạo đơn đặt sân (Criterion 36); chủ sân tạo hộ chỉ được thực hiện trên cơ sở của mình; truy vấn chi tiết yêu cầu đặt được bảo vệ phân quyền chặt chẽ theo vai trò (Customer/Owner/Admin).

### 4.2. Khuyến nghị chuẩn bị cho Phase P10 (`Hủy chờ, hết hạn, khóa lịch và vận hành Booking`)
- Khi triển khai tính năng hủy yêu cầu chờ hoặc xử lý cleanup hết hạn giữ chỗ (10 phút), cần sử dụng cùng cơ chế khóa phối hợp ghi trên `CourtDaySchedule` để bảo đảm việc nhả lịch không xung đột với các yêu cầu đặt mới đang diễn ra đồng thời.
- Khi tạo/gỡ lịch khóa sân `CourtBlock`, cũng phải đi qua cơ chế giao dịch và khóa phối hợp tương tự như khi tạo đặt sân.

---

## 5. Kết luận và Quyết định Nghiệm thu

- **Quyết định nghiệm thu:** Chính thức công nhận Phase P09 đạt trạng thái **`ACCEPTED`**.
- **Căn cứ nghiệm thu:**
  - Hoàn thành đầy đủ 100% các tiêu chí và đầu việc của Phase P09 theo `docs/planning/development-plan.md` và `docs/features.md` (CUS-01, OWN-08, Mục 8.3, 8.4, 8.5, 8.6, tiêu chí 6, 7, 8, 10, 11, 14, 16, 24, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36, 46).
  - Bộ kiểm thử tự động đạt **243/243 tests PASS (100%)**, 0 lỗi cú pháp trên 133 tệp backend.
  - Toàn bộ 12 tệp bàn giao khớp chính xác 100% mã băm SHA-256 đối chiếu với `docs/phase-reports/P09-manifest.sha256`.
  - Cổng frontend `BE_READY` tiếp tục được bảo vệ đóng an toàn (`CLOSED`).
- **Phiên bản nghiệm thu:** `docs/phase-reports/P09-manifest.sha256`.
- **Người nghiệm thu:** Reviewer độc lập (Ủy quyền bởi người dùng).
- **Ngày nghiệm thu:** 29/10/2026.

---

## 6. Ranh giới và Hướng dẫn cho Phase Tiếp theo (P10)

1. **Cập nhật `docs/planning/phase-status.json`:**
   - Trạng thái `P09`: `ACCEPTED`.
   - `review`: `"docs/phase-reports/P09-review.md"`.
   - `accepted_by`: `"Independent Reviewer (Ủy quyền bởi người dùng)"`.
   - `accepted_on`: `"2026-10-29"`.
   - `accepted_revision`: `"docs/phase-reports/P09-manifest.sha256"`.
   - `active_phase`: `null` (Dừng lại, sẵn sàng chờ người dùng giao việc cho P10).
   - `next_candidate`: `"P10"`.
2. **Phase tiếp theo (P10):** Hủy chờ, hết hạn, khóa lịch và vận hành Booking (Hủy toàn bộ yêu cầu chờ, cleanup hết hạn giữ chỗ định kỳ 30s, tạo/gỡ `CourtBlock`, API danh sách/chi tiết Booking của customer, owner và admin, chuyển trạng thái `COMPLETED`/`NO_SHOW`).
3. **Ranh giới:** Cổng `BE_READY` tiếp tục giữ trạng thái `CLOSED`. Tuyệt đối không cài đặt hoặc viết mã React frontend trước khi hoàn thành Phase P14.

