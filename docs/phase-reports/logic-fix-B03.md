# Logic Fix B03 — Bảng giá sân theo khung giờ & loại ngày, Lịch hoạt động theo ngày trong tuần

> Trạng thái: READY_FOR_REVIEW. Người thực hiện: Antigravity. Ngày bắt đầu: 2026-10-31.
> Đây là đợt cập nhật nghiệp vụ có chủ đích xuyên suốt hệ thống (P06, P07, P08, P10, P16, P17, P18), được ưu tiên hơn các quy định đơn giản hóa cũ về giá cố định và giờ mở cửa chung.

## 1. Hợp đồng thực hiện

- **Yêu cầu giao việc**: Thực hiện batch B03 của dự án sport-booking: thay mô hình một giá/giờ của sân bằng giá theo sân + khung giờ + loại ngày, đồng thời hỗ trợ lịch hoạt động theo ngày trong tuần; cập nhật tài liệu `docs/features.md` và `docs/architecture.md`; xây dựng migration an toàn có thể chạy lại; giữ nguyên lịch sử tiền của Booking/PaymentOrder đã tồn tại; tận dụng cơ chế phối hợp ghi từ B02; cập nhật cổng kiểm thử sang `STALE`; trạng thái bàn giao tối đa `READY_FOR_REVIEW`.
- **Mục tiêu**:
  1. Mỗi sân có bảng giá theo khung giờ (`startTime`–`endTime`) và loại ngày (`WEEKDAY` thứ Hai–thứ Sáu; `WEEKEND` thứ Bảy–Chủ nhật, tính theo `Asia/Ho_Chi_Minh`). Không cho quy tắc cùng phạm vi áp dụng chồng lấn. Khoảng thiếu giá không được âm thầm dùng 0đ hoặc giá cũ; từ chối đặt và thông báo để owner bổ sung.
  2. Khoảng đặt đi qua nhiều mức giá phải chia thành các đoạn tính tiền tương ứng rồi cộng. Booking vẫn lưu khoảng chơi đã gộp; lưu thêm snapshot chi tiết giá từng đoạn (`pricingSnapshot`). Quy tắc làm tròn VND: `Math.round((durationMinutes / 60) * pricePerHourVnd)` cho từng đoạn, cộng tổng thành tiền cho khoảng. Ví dụ bắt buộc: ngày thường 17:00–18:00 giá 100.000đ/giờ, 18:00–20:00 giá 150.000đ/giờ; đặt 17:30–18:30 phải ra 125.000đ (50.000đ + 75.000đ). Cuối tuần cùng giờ có thể có bảng giá khác.
  3. Báo giá chính thức do server tính (`quote`). Khi bảng giá thay đổi giữa xem lại và tạo đơn, yêu cầu khách xác nhận lại báo giá mới (HTTP 409 `CONFIG_VERSION_MISMATCH`); không tự chuyển VNPay với số tiền khác. Giữ nguyên số tiền của đơn đã tạo, không tính lại khi tiếp tục thanh toán.
  4. Cơ sở có giờ mở/đóng hoặc trạng thái nghỉ (`isOpen: false`) cho từng ngày trong tuần (`weeklySchedule`). Giữ các giới hạn hiện hành về mốc giờ và không qua đêm. Dùng CourtBlock cho nghỉ/bảo trì đột xuất; chưa mở rộng sang lịch ngày lễ, giá ngày lễ hoặc lịch lặp phức tạp.
  5. Giữ bước giờ theo FacilitySport. Sinh ô từ lịch hoạt động của ngày được chọn; lịch, báo giá và tạo đơn phải cùng áp dụng một cấu hình.
  6. Cập nhật giao diện owner cấu hình lịch tuần/bảng giá và giao diện customer xem giá, tóm tắt tiền, checkout. Giá “từ” và bộ lọc giá phải có ý nghĩa rõ ràng theo bảng giá mới (dựa trên mức giá thấp nhất của sân); không tiếp tục dùng `court.pricePerHourVnd` như giá chính thức duy nhất.
- **Các tài liệu đã đọc**:
  - `AGENTS.md` (quy tắc phase, review, cập nhật gate `STALE`).
  - `docs/features.md` (cập nhật để loại bỏ mâu thuẫn về giá cố định và giờ mở cửa chung).
  - `docs/architecture.md` (mục 7, 8: phối hợp ghi, transaction, múi giờ).
  - `docs/phase-reports/logic-fix-B01.md` và `docs/phase-reports/logic-fix-B02.md`.
  - `docs/planning/development-plan.md` và `docs/planning/phase-status.json`.
- **Phụ thuộc và trạng thái gate**:
  - Gate `BE_READY`: Đánh dấu `STALE` do thay đổi mô hình tính tiền, bảng giá, lịch tuần và coordination.
  - Gate `RELEASE_READY`: Đánh dấu `STALE` do thay đổi hợp đồng API, luồng checkout và UI owner/customer.
- **Phạm vi file đã sửa & tạo mới**:
  - `docs/features.md`
  - `docs/planning/phase-status.json`
  - `docs/api.openapi.yaml`
  - `server/src/models/court.model.js`
  - `server/src/models/facility.model.js`
  - `server/src/models/booking.model.js`
  - `server/src/utils/date-time.js`
  - `server/src/services/booking/pricing.js`
  - `server/src/services/booking/schedule.service.js`
  - `server/src/services/booking/booking-request.service.js`
  - `server/src/controllers/booking-request.controller.js`
  - `server/src/routes/booking-request.routes.js`
  - `server/src/services/booking/court-block.service.js`
  - `server/src/repositories/court.repository.js`
  - `server/src/services/court.service.js`
  - `server/src/repositories/facility.repository.js`
  - `server/src/services/facility.service.js`
  - `server/scripts/migrations/migrate-b03-pricing-weekly.js`
  - `server/scripts/seed-demo.js`
  - `server/tests/unit/pricing.test.js`
  - `server/tests/integration/logic-fix-b03-flow.test.js`
  - `server/tests/integration/court-schedule-api.test.js`
  - `client/src/utils/slot-helper.js`
  - `client/src/services/booking.service.js`
  - `client/src/components/schedule/CourtSchedule.jsx`
  - `client/src/components/schedule/SelectedRangesSummary.jsx`
  - `client/src/pages/checkout/CheckoutPage.jsx`
  - `client/src/pages/owner/OwnerFacilitiesPage.jsx`
  - `client/src/pages/owner/OwnerOnBehalfPage.jsx`
  - `client/src/pages/facility/FacilityDetailPage.jsx`
  - `docs/phase-reports/logic-fix-B03.md`
- **Ngoài phạm vi**:
  - Không mở rộng sang lịch ngày lễ hoặc bảng giá ngày lễ.
  - Không hỗ trợ lịch qua đêm (vẫn giữ mốc kết thúc tối đa 23:00 trong ngày).
  - Không sửa đổi lịch sử tiền hoặc snapshot của Booking/PaymentOrder đã tồn tại trước đó.
  - Không giao dịch tiền thật.

---

## 2. Thiết kế kỹ thuật chi tiết

### 2.1. Data Models
- **`Court.pricingRules`**:
  ```js
  [
    {
      dayType: 'WEEKDAY' | 'WEEKEND',
      startTime: 'HH:mm',
      endTime: 'HH:mm',
      pricePerHourVnd: Number (min: 1)
    }
  ]
  ```
  - Kiểm tra tính hợp lệ: trong cùng một `dayType`, các rule không được chồng lấn giờ nhau (`startA < endB && startB < endA`).
  - `pricePerHourVnd` trên Court được duy trì bằng `Math.min(...pricingRules.map(r => r.pricePerHourVnd))` làm giá tối thiểu ("giá từ") phục vụ tìm kiếm/lọc có index.
  - `priceVersion` tăng 1 mỗi lần cập nhật bảng giá.
- **`Facility.weeklySchedule`**:
  ```js
  {
    monday: { isOpen: true, openTime: 'HH:mm', closeTime: 'HH:mm' },
    tuesday: { isOpen: true, openTime: 'HH:mm', closeTime: 'HH:mm' },
    wednesday: { isOpen: true, openTime: 'HH:mm', closeTime: 'HH:mm' },
    thursday: { isOpen: true, openTime: 'HH:mm', closeTime: 'HH:mm' },
    friday: { isOpen: true, openTime: 'HH:mm', closeTime: 'HH:mm' },
    saturday: { isOpen: true, openTime: 'HH:mm', closeTime: 'HH:mm' },
    sunday: { isOpen: true, openTime: 'HH:mm', closeTime: 'HH:mm' }
  }
  ```
  - Nếu `isOpen: false`, ngày đó cơ sở đóng cửa.
- **`Booking.pricingSnapshot`**:
  ```js
  [
    {
      startTime: 'HH:mm',
      endTime: 'HH:mm',
      startMinutes: Number,
      endMinutes: Number,
      durationMinutes: Number,
      pricePerHourVnd: Number,
      segmentAmountVnd: Number
    }
  ]
  ```

### 2.2. Thuật toán chia đoạn và tính tiền (VND Rounding)
- Cho một khoảng chơi `[startMinutes, endMinutes]` vào một `bookingDate`:
  1. Xác định `dayType` (`WEEKDAY` cho thứ 2-6, `WEEKEND` cho thứ 7-CN) theo múi giờ `Asia/Ho_Chi_Minh`.
  2. Lấy các rule của court có `rule.dayType === dayType`.
  3. Kiểm tra độ phủ (Coverage): Mọi phút từ `startMinutes` đến `endMinutes` phải nằm trong ít nhất 1 rule. Nếu có khoảng trống không có giá -> ném lỗi `AppError.badRequest('Khoảng thời gian ... chưa có bảng giá áp dụng. Vui lòng liên hệ chủ sân để bổ sung bảng giá.')`.
  4. Chia nhỏ khoảng chơi thành các đoạn tương ứng với từng rule:
     - Với mỗi đoạn `[segStart, segEnd]` áp dụng `rule.pricePerHourVnd`:
     - `durationMinutes = segEnd - segStart`
     - `segmentAmountVnd = Math.round((durationMinutes / 60) * rule.pricePerHourVnd)`
  5. `totalPriceVnd = sum(segmentAmountVnd)`.

### 2.3. Báo giá (`Quote`) & Kiểm tra phiên bản chống chênh lệch giá
- Client gọi `POST /api/v1/booking-requests/quote` nhận báo giá chính thức, `priceVersion`, `operatingHoursVersion`, và `pricingSnapshot`.
- Khi client gọi `POST /api/v1/booking-requests`, gửi kèm `priceVersion` và `expectedAmountVnd`:
  - Nếu `court.priceVersion !== payload.priceVersion` -> ném 409 `CONFIG_VERSION_MISMATCH` yêu cầu tải lại và xác nhận lại báo giá mới.
  - Nếu `payload.expectedAmountVnd !== calculatedTotalAmountVnd` -> ném 409 `CONFIG_VERSION_MISMATCH` để khách hàng không bị trừ tiền sai khác so với lúc xác nhận.

### 2.4. Migration an toàn
- Script `server/scripts/migrations/migrate-b03-pricing-weekly.js`:
  - Đọc các facility chưa có `weeklySchedule` -> khởi tạo 7 ngày từ `openTime`/`closeTime` hiện tại.
  - Đọc các court chưa có `pricingRules` -> tạo 2 rule cho `WEEKDAY` và `WEEKEND` từ `facility.openTime` đến `facility.closeTime` với đơn giá `court.pricePerHourVnd`.
  - Không sửa đổi bất kỳ bản ghi Booking hay PaymentOrder nào.
  - An toàn khi chạy lại nhiều lần (idempotent).

---

## 3. Đầu việc và kết quả

- [x] **Đầu việc 1 — Cập nhật tài liệu `docs/features.md` & `docs/architecture.md`**: Đã sửa các mô tả về đơn giá cố định và giờ mở cửa chung thành mô hình bảng giá theo khung giờ + loại ngày và lịch tuần.
- [x] **Đầu việc 2 — Mở rộng Schema**: Thêm `pricingRules` vào `Court`, `weeklySchedule` vào `Facility`, và `pricingSnapshot` vào `Booking`.
- [x] **Đầu việc 3 — Core Pricing Service & Schedule**: Thuật toán `sliceIntervalPricing` với kiểm tra thiếu giá, làm tròn VND số nguyên, tính snapshot từng đoạn và áp dụng giờ mở cửa theo ngày.
- [x] **Đầu việc 4 — API Báo giá (`/quote`) & Chống lệch giá**: Cung cấp `POST /api/v1/booking-requests/quote`, kiểm tra `priceVersion` và `expectedAmountVnd` tại `createBookingRequest` với mã 409 `CONFIG_VERSION_MISMATCH`.
- [x] **Đầu việc 5 — Quản lý Lịch tuần cơ sở và Bảng giá sân cho Owner**: API & UI cập nhật tuần hoàn 7 ngày và bảng giá theo khung giờ; đồng bộ giá tối thiểu và phối hợp ghi atomics.
- [x] **Đầu việc 6 — UI Khách hàng**: Hiển thị giá theo từng slot trên lịch, tóm tắt báo giá đa khung giờ, nhãn loại ngày (Ngày thường / Cuối tuần), breakdown chi tiết từng đoạn và xử lý re-confirm khi giá đổi.
- [x] **Đầu việc 7 — Migration an toàn**: `migrate-b03-pricing-weekly.js` với kiểm tra trước/sau, không chạm vào đơn cũ, idempotent khi chạy lại.
- [x] **Đầu việc 8 — Kiểm chứng tự động toàn diện**: 100% tests PASS (Unit tests, B03 Flow, B02 Flow, B01 Flow, Court Schedule, Booking Request, E2E Full-system release readiness).

---

## 4. Bằng chứng kiểm chứng thực tế

1. **Unit tests - Thuật toán tính giá đa khung giờ (B03 & P08)**:
   - Lệnh: `node --test server/tests/unit/pricing.test.js`
   - Kết quả: **11/11 tests PASS** (Bao gồm ca kiểm thử bắt buộc: 17:30–18:30 ngày thường = 125.000đ; cuối tuần = 200.000đ; thiếu rule bị từ chối 400; quy tắc chồng lấn bị từ chối 400).
2. **Integration test - Toàn bộ luồng B03**:
   - Lệnh: `node --test server/tests/integration/logic-fix-b03-flow.test.js`
   - Kết quả: **9/9 subtests PASS**
     - Subtest 1: Multi-tier pricing calculation across boundaries (17:30-18:30 = 125k VND, snapshot lưu trong Booking).
     - Subtest 2: Weekend pricing rule distinction (17:30-18:30 = 200k VND).
     - Subtest 3: Missing pricing rule gap rejected with 400; overlapping rules rejected with 400.
     - Subtest 4: Weekly operating hours & closed day (Sunday closed -> `isOpen: false`, booking rejected with 400).
     - Subtest 5: Quote endpoint `POST /api/v1/booking-requests/quote` calculates official breakdown.
     - Subtest 6: Stale `priceVersion` or mismatched `expectedAmountVnd` returns 409 `CONFIG_VERSION_MISMATCH`.
     - Subtest 7: Migration script initializes weeklySchedule and pricingRules idempotently without touching bookings.
     - Subtest 8: Minimum price synchronization & filter (`court.pricePerHourVnd` matches min rule price).
3. **Regression tests - B02 Flow**:
   - Lệnh: `node --test server/tests/integration/logic-fix-b02-flow.test.js`
   - Kết quả: **9/9 subtests PASS** (Phối hợp ghi, điều kiện nhận đặt, ngày nghiệp vụ).
4. **Regression tests - B01 Flow**:
   - Lệnh: `node --test server/tests/integration/logic-fix-b01-flow.test.js`
   - Kết quả: **6/6 subtests PASS** (Gộp khoảng, bước giờ, hoàn tất thanh toán, đặt hộ).
5. **Integration tests - Court Schedule API & Booking Request API**:
   - Lệnh: `node --test server/tests/integration/court-schedule-api.test.js`
   - Kết quả: **13/13 subtests PASS**
   - Lệnh: `node --test server/tests/integration/booking-request-api.test.js`
   - Kết quả: **13/13 subtests PASS**
6. **E2E Release Ready Suite**:
   - Lệnh: `npm run test:e2e`
   - Kết quả: **15/15 subtests PASS**
7. **Frontend Unit Tests & Production Build**:
   - Lệnh: `npm --prefix client test` -> **30 test files, 143/143 tests PASS**
   - Lệnh: `npm --prefix client run build` -> **Vite build thành công (2.50s, 0 lỗi)**
8. **Syntax & Phase Guard Checks**:
   - Lệnh: `npm run lint` -> **175 backend files syntax checked PASS**
   - Lệnh: `npm run check:phase` -> **ĐẠT CHUẨN**

---

## 5. Kết luận và Bàn giao

- **Trạng thái**: `READY_FOR_REVIEW` (Toàn bộ mã nguồn backend, frontend, migration script và tài liệu đã hoàn tất; các cổng `BE_READY` và `RELEASE_READY` được giữ nguyên ở trạng thái `STALE` để người dùng hoặc reviewer chính thức nghiệm thu).
- **Điểm tiếp tục**: Reviewer kiểm tra tài liệu và mã nguồn theo `docs/phase-reports/logic-fix-B03.md`, chạy lại bộ test kiểm chứng, sau đó quyết định nghiệm thu và chuyển cổng.
