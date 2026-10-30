# Logic Fix B02 — Điều kiện nhận đặt, thay đổi cấu hình đồng thời và ngày nghiệp vụ

> Trạng thái: READY_FOR_REVIEW. Người thực hiện: Antigravity. Ngày bắt đầu: 2026-10-31. Ngày hoàn thành: 2026-10-31.
> Đây là đợt sửa lỗi logic xuyên suốt các phase (P06, P07, P08, P10, P16, P18), không phải phase mới và không chuyển đổi phase.

## 1. Hợp đồng thực hiện

- **Yêu cầu giao việc**: Thực hiện batch sửa lỗi B02 của dự án sport-booking: điều kiện nhận đặt, thay đổi cấu hình đồng thời và ngày nghiệp vụ theo 4 phát hiện cụ thể; đối chiếu mã nguồn thực tế; cập nhật tài liệu API, test và phase-status; đánh dấu gate `BE_READY` và `RELEASE_READY` là `STALE`; không tự ghi `ACCEPTED`; trạng thái bàn giao tối đa `READY_FOR_REVIEW`.
- **Mục tiêu**:
  1. Thiết lập điều kiện nhận đặt thống nhất theo đặc tả: kiểm tra nhất quán trạng thái owner bị khóa (`owner.isLocked = false` và `owner.activatedAt != null`) tại danh sách công khai, chi tiết cơ sở (`getPublicFacilityById`), lịch sân (`getCourtSchedule`) và tạo đơn đặt (`createBookingRequest`). Không nhận đơn mới trái quy định qua ID cơ sở/sân cũ. Giữ đúng quy định đối với đơn đã xác nhận (không tự hủy đơn đã trả tiền hoặc tự hoàn tiền).
  2. Phối hợp ghi nguyên tử giữa luồng đổi giờ hoạt động (`updateOwnerFacility`) / đổi bước giờ (`updateFacilitySportStep`) với luồng tạo Booking (`createBookingRequest`) và CourtBlock (`createCourtBlock`) bằng cơ chế khóa phối hợp ghi trên `Court` document (`touchCoordination`). Chứng minh loại bỏ hoàn toàn Write Skew trên MongoDB Replica Set: không thể có trường hợp kiểm tra "chưa có lịch" rồi phát sinh lịch theo cấu hình cũ lọt qua sau khi đổi.
  3. Kiểm tra đồng bộ phiên bản giờ hoạt động (`operatingHoursVersion`): trả về `operatingHoursVersion` trong API lịch, lưu xuyên suốt từ lịch -> draft -> checkout và on-behalf, kiểm tra bắt buộc tại `createBookingRequest`; bản nháp dùng giờ hoặc bước giờ cũ bị từ chối với HTTP 409 `CONFIG_VERSION_MISMATCH` và yêu cầu tải lại/xác nhận lại theo đặc tả (Criteria 15, 33, 34, 179, 252). Đồng thời tăng `configVersion` trên các FacilitySport khi đổi giờ hoạt động.
  4. Thống nhất ngày nghiệp vụ `Asia/Ho_Chi_Minh` cho chọn ngày và giới hạn đặt (từ hôm nay đến ngày thứ 30): xây dựng helper ngày giờ chuẩn tại client, sửa `OwnerOnBehalfPage` và `OwnerCourtBlocksPage` không dùng `new Date().toISOString().split('T')[0]` (bị lệch ngày UTC vào khung 00:00–06:59 VN), cập nhật `getValidDateList` trong `slot-helper.js` không phụ thuộc múi giờ máy người dùng. Giới hạn ngày chọn trong khoảng `[todayVN, todayVN + 30]`. Xử lý đúng biên cuối tháng và cuối năm.
- **Các tài liệu đã đọc**:
  - `AGENTS.md` (quy tắc phase, review, cập nhật gate `STALE`).
  - `docs/features.md` (các tiêu chí 6, 9, 11, 14, 15, 17, 18, 21, 22, 26, 27, 28, 29, 30, 31, 32, 33, 34, 46, 51, 56, 60, 175, 179, 249, 250, 252).
  - `docs/architecture.md` (mục 7 & 8: transaction coordination, write skew prevention, date-time timezone `Asia/Ho_Chi_Minh`).
  - `docs/planning/development-plan.md` và `docs/planning/phase-status.json`.
  - `docs/phase-reports/logic-fix-B01.md`.
- **Phụ thuộc và trạng thái gate**:
  - Gate `BE_READY`: Đã chuyển sang `STALE` vì thay đổi điều kiện kiểm tra owner, coordination lock trên Court, và version validation.
  - Gate `RELEASE_READY`: Đã chuyển sang `STALE` vì cập nhật logic đồng thời và timezone date picker client/backend.
- **Phạm vi file sửa**:
  - `server/src/models/court.model.js` (bổ sung `bookingCoordinationVersion`)
  - `server/src/repositories/court.repository.js` (thêm `touchCoordination`, `touchCoordinationForCourts`)
  - `server/src/repositories/facility-sport.repository.js` (thêm `incrementConfigVersionForFacility`)
  - `server/src/services/facility.service.js` (`getPublicFacilityById` kiểm tra owner; `updateOwnerFacility` và `updateFacilitySportStep` phối hợp transaction và write lock)
  - `server/src/services/booking/schedule.service.js` (kiểm tra owner active/unlocked; trả `operatingHoursVersion`)
  - `server/src/services/booking/booking-request.service.js` (kiểm tra owner active/unlocked; phối hợp ghi `touchCoordination`; validate `operatingHoursVersion`)
  - `server/src/services/booking/court-block.service.js` (phối hợp ghi `touchCoordination`)
  - `client/src/utils/slot-helper.js` (chuẩn hóa múi giờ `Asia/Ho_Chi_Minh` cho `getValidDateList`, `getTodayVN`, `addDaysVN`, `getMaxBookingDateVN`)
  - `client/src/components/schedule/CourtSchedule.jsx` (truyền `operatingHoursVersion`)
  - `client/src/components/schedule/SelectedRangesSummary.jsx` (lưu `operatingHoursVersion` vào draft)
  - `client/src/pages/checkout/CheckoutPage.jsx` (gửi `operatingHoursVersion`, xử lý 409 `CONFIG_VERSION_MISMATCH`)
  - `client/src/pages/owner/OwnerOnBehalfPage.jsx` (dùng `getTodayVN`, `maxDateStr`, gửi `operatingHoursVersion`)
  - `client/src/pages/owner/OwnerCourtBlocksPage.jsx` (dùng `getTodayVN`, `maxDateStr`)
  - `docs/api.openapi.yaml`
  - `server/tests/integration/logic-fix-b02-flow.test.js` (suite kiểm thử tích hợp 8 mục)
  - `docs/planning/phase-status.json`
- **Ngoài phạm vi**:
  - Không tự hủy đơn đã xác nhận khi owner/cơ sở bị khóa; không tự hoàn tiền.
  - Không thêm lịch tuần hoặc bảng giá theo khung giờ / ngày lễ.
  - Không chuyển mô hình lịch thành từng ô cố định trong DB.
  - Không giao dịch tiền thật.

---

## 2. Đầu việc và kết quả

- [x] **Đầu việc 1 — Áp dụng điều kiện owner bị khóa thống nhất tại chi tiết, lịch và đặt sân (Issue 1)**
  - *Đầu ra*:
    - `server/src/services/facility.service.js` (`getPublicFacilityById`): Sau khi kiểm tra `facility.status === 'PUBLISHED'` và `!facility.isLockedByAdmin`, truy vấn `User.findById(facility.ownerId)`. Nếu không tìm thấy, hoặc `owner.isLocked === true` hoặc `!owner.activatedAt`, trả về 404 `FACILITY_NOT_FOUND` ("Không tìm thấy cơ sở thể thao công khai.").
    - `server/src/services/booking/schedule.service.js` (`getCourtSchedule`): Tương tự, kiểm tra chủ sân của cơ sở; nếu `!owner || owner.isLocked || !owner.activatedAt`, trả về 404 `FACILITY_NOT_FOUND`.
    - `server/src/services/booking/booking-request.service.js` (`createBookingRequest`): Trong transaction tạo đơn, tìm nạp `User.findById(facility.ownerId).session(session)`. Nếu `!owner || owner.isLocked || !owner.activatedAt`, abort transaction và trả lỗi 403 `FACILITY_NOT_FOUND` ("Cơ sở thể thao hoặc chủ sân đang bị khóa, không thể nhận đặt sân.").
    - Đơn đã xác nhận (`CONFIRMED`/`PAID`) không bị tự hủy hoặc tự hoàn tiền. Mở khóa owner khôi phục quyền truy cập công khai và nhận đặt bình thường mà không làm thay đổi trạng thái các cơ sở đang tạm dừng (`PAUSED`).
  - *Kiểm chứng*: Subtest 1 và 2 trong `server/tests/integration/logic-fix-b02-flow.test.js`.
  - *Bằng chứng*: `logic-fix-b02-flow.test.js` Subtest 1 (Khóa owner -> GET facility detail 404, GET schedule 404, POST booking 403; đơn confirmed giữ nguyên) & Subtest 2 (Mở khóa owner -> phục hồi truy cập công khai, cơ sở paused vẫn giữ nguyên) PASS.

- [x] **Đầu việc 2 — Phối hợp ghi nguyên tử giữa đổi cấu hình và tạo Booking/CourtBlock chống Write Skew (Issue 2)**
  - *Đầu ra*:
    - Cơ chế khóa phối hợp ghi (Coordination Lock): Thêm trường `bookingCoordinationVersion: { type: Number, required: true, default: 1 }` vào schema của `Court` (`server/src/models/court.model.js`).
    - Bổ sung helper `touchCoordination(courtId, session)` và `touchCoordinationForCourts(courtIds, session)` tại `server/src/repositories/court.repository.js` thực hiện `$inc: { bookingCoordinationVersion: 1 }` trong session transaction.
    - `server/src/services/facility.service.js`:
      - `updateOwnerFacility`: Khi cập nhật giờ hoạt động (`operatingHours`), toàn bộ logic chạy trong `withTransaction`. Bước đầu khóa toàn bộ các sân của cơ sở bằng `touchCoordinationForCourts`. Kiểm tra trong cùng lock nếu có đơn đặt hoặc lịch khóa đang hoạt động (`activeBookings`, `activeBlocks`), từ chối bằng lỗi 400. Nếu không có, cập nhật giờ hoạt động, tăng `operatingHoursVersion` của Facility và tăng `configVersion` cho toàn bộ FacilitySport của cơ sở.
      - `updateFacilitySportStep`: Khi thay đổi bước giờ (`slotStepMinutes`), toàn bộ logic chạy trong `withTransaction`. Bước đầu khóa toàn bộ các sân của môn thể thao bằng `touchCoordinationForCourts`. Kiểm tra trong cùng lock nếu có đơn đặt hoặc lịch khóa đang hoạt động, từ chối bằng lỗi 400. Nếu không có, cập nhật `slotStepMinutes` và tăng `configVersion`.
    - `server/src/services/booking/booking-request.service.js` (`createBookingRequest`) & `server/src/services/booking/court-block.service.js` (`createCourtBlock`):
      - Trong session transaction tạo booking / court block, gọi `await courtRepository.touchCoordination(courtId, session)`.
      - Khi transaction tạo booking/block chạy đồng thời với transaction đổi cấu hình trên cùng một cơ sở/sân, write set của cả hai transaction giao nhau tại document `Court`. Cơ chế Snapshot Isolation của MongoDB Replica Set phát hiện xung đột ghi và buộc serialize, loại bỏ hoàn toàn Write Skew.
  - *Kiểm chứng*: Subtest 3, 4, 5 trong `server/tests/integration/logic-fix-b02-flow.test.js` (chạy đồng thời bằng `Promise.allSettled` trên Replica Set thật).
  - *Bằng chứng*:
    - Subtest 3: `createBookingRequest` vs `updateFacilitySportStep` -> đúng 1 bên thành công, bên còn lại xung đột cấu hình 409 hoặc bị khóa 400; không có đơn đặt nào sai bước giờ lọt qua cấu hình mới. PASS.
    - Subtest 4: `createBookingRequest` vs `updateOwnerFacility` -> loại bỏ hoàn toàn write skew. PASS.
    - Subtest 5: `createCourtBlock` vs `updateFacilitySportStep` -> không cho phép tạo lịch khóa sai bước giờ sau khi đổi bước giờ. PASS.

- [x] **Đầu việc 3 — Kiểm tra phiên bản giờ hoạt động `operatingHoursVersion` xuyên suốt (Issue 3)**
  - *Đầu ra*:
    - API Lịch: `ScheduleService.getCourtSchedule` trả về `operatingHoursVersion: facility.operatingHoursVersion || 1`.
    - Client Draft & Checkout:
      - `CourtSchedule.jsx` truyền `operatingHoursVersion={scheduleData?.operatingHoursVersion}` sang `SelectedRangesSummary.jsx`.
      - `SelectedRangesSummary.jsx` lưu `operatingHoursVersion` vào `sessionStorage` (`sport_booking_draft`).
      - `CheckoutPage.jsx` đọc `draft.operatingHoursVersion` và gửi trong payload `POST /api/v1/booking-requests`. Khi nhận lỗi 409 `CONFIG_VERSION_MISMATCH`, hiển thị thông báo lỗi rõ ràng yêu cầu người dùng tải lại lịch để xác nhận theo cấu hình mới.
      - `OwnerOnBehalfPage.jsx` đọc `operatingHoursVersion` từ schedule data và gửi trong payload `POST /api/v1/owner/bookings/on-behalf`.
    - Backend Validation:
      - `BookingRequestService.createBookingRequest`: Kiểm tra bắt buộc `payload.operatingHoursVersion` khớp `facility.operatingHoursVersion`. Nếu lệch, trả 409 `CONFIG_VERSION_MISMATCH`. Đồng thời đưa `operatingHoursVersion` vào chuỗi canonical fingerprint của `idempotencyKey`.
      - `FacilitySportRepository.incrementConfigVersionForFacility`: Khi cơ sở đổi giờ hoạt động, tăng đồng thời `operatingHoursVersion` của Facility và `configVersion` của toàn bộ các `FacilitySport` thuộc cơ sở (Double Invalidation). Nhờ đó cả client hiện đại lẫn client cũ đều bị từ chối 409 `CONFIG_VERSION_MISMATCH` nếu dùng bản nháp cũ.
    - Tài liệu: Bổ sung `operatingHoursVersion` vào `docs/api.openapi.yaml`.
  - *Kiểm chứng*: Subtest 6 trong `server/tests/integration/logic-fix-b02-flow.test.js`.
  - *Bằng chứng*: `logic-fix-b02-flow.test.js` Subtest 6 PASS (từ chối 409 khi draft lệch `operatingHoursVersion` hoặc `configVersion`).

- [x] **Đầu việc 4 — Thống nhất ngày nghiệp vụ `Asia/Ho_Chi_Minh` cho chọn ngày và giới hạn đặt (Issue 4)**
  - *Đầu ra*:
    - `client/src/utils/slot-helper.js`:
      - Xây dựng `getTodayVN(date = new Date())`: sử dụng `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })` lấy ngày hiện tại định dạng `YYYY-MM-DD`. Đảm bảo trong khung giờ 00:00–06:59 VN (khi UTC vẫn thuộc ngày hôm trước), ngày trả về luôn là ngày hiện tại tại Việt Nam, bất kể múi giờ máy khách.
      - Xây dựng `addDaysVN(dateStr, days)`: cộng trừ ngày an toàn qua mốc UTC 12:00:00 để tránh trôi ngày hoặc lỗi DST.
      - Xây dựng `getMaxBookingDateVN(todayStr, maxDays = 30)`: tính toán ngày thứ 30 chính xác theo lịch Việt Nam.
      - Cập nhật `getValidDateList(todayStr, maxDays = 30)`: sinh danh sách 30 ngày hợp lệ và tính đúng thứ trong tuần (`dayOfWeek`) theo múi giờ `Asia/Ho_Chi_Minh`.
    - `client/src/pages/owner/OwnerOnBehalfPage.jsx` & `client/src/pages/owner/OwnerCourtBlocksPage.jsx`:
      - Thay thế toàn bộ `new Date().toISOString().split('T')[0]` bằng `getTodayVN()`.
      - Giới hạn chọn ngày trên thẻ input date: `min={todayStr}` và `max={maxDateStr}`.
    - Client Unit Tests: Viết 9 bài test mới trong `client/src/utils/__tests__/slot-helper.test.js` bao quát: 00:30 VN, 06:59 VN, cuối tháng 31 ngày (31/01 -> 01/02), cuối tháng 28/29 ngày (28/02 -> 01/03), giao thừa cuối năm (31/12 -> 01/01), danh sách 30 ngày.
  - *Kiểm chứng*: Subtest 7 trong `server/tests/integration/logic-fix-b02-flow.test.js` và toàn bộ 15 tests trong `client/src/utils/__tests__/slot-helper.test.js`.
  - *Bằng chứng*: `slot-helper.test.js` 15/15 PASS; `logic-fix-b02-flow.test.js` Subtest 7 PASS.

---

## 3. Thay đổi thực tế

### Backend Files:
1. `server/src/models/court.model.js`: Bổ sung trường `bookingCoordinationVersion: { type: Number, required: true, default: 1 }`.
2. `server/src/repositories/court.repository.js`: Thêm phương thức `touchCoordination(courtId, session)` và `touchCoordinationForCourts(courtIds, session)`.
3. `server/src/repositories/facility-sport.repository.js`: Thêm phương thức `incrementConfigVersionForFacility(facilityId, session)`.
4. `server/src/services/facility.service.js`:
   - `getPublicFacilityById`: Kiểm tra `owner.isLocked` và `owner.activatedAt`.
   - `updateOwnerFacility`: Bọc transaction, khóa `touchCoordinationForCourts`, kiểm tra active schedules, tăng `operatingHoursVersion` và tăng `configVersion` cho toàn bộ FacilitySport.
   - `updateFacilitySportStep`: Bọc transaction, khóa `touchCoordinationForCourts`, kiểm tra active schedules, tăng `configVersion`.
5. `server/src/services/booking/schedule.service.js`:
   - `getCourtSchedule`: Kiểm tra chủ sân active/unlocked; trả về `operatingHoursVersion: facility.operatingHoursVersion || 1`.
6. `server/src/services/booking/booking-request.service.js`:
   - `createBookingRequest`: Kiểm tra chủ sân active/unlocked; gọi `touchCoordination`; validate `operatingHoursVersion` (ném 409 `CONFIG_VERSION_MISMATCH`); bổ sung `operatingHoursVersion` vào idempotency fingerprint.
7. `server/src/services/booking/court-block.service.js`:
   - `createCourtBlock`: Gọi `touchCoordination`; kiểm tra `configVersion` của môn thể thao trong cùng transaction.
8. `server/tests/integration/logic-fix-b02-flow.test.js`: Tạo mới test suite tích hợp chuyên biệt 8 mục cho B02.

### Frontend Files:
9. `client/src/utils/slot-helper.js`: Thêm `getTodayVN`, `addDaysVN`, `getMaxBookingDateVN`, cập nhật `getValidDateList` theo múi giờ `Asia/Ho_Chi_Minh`.
10. `client/src/utils/__tests__/slot-helper.test.js`: Thêm 9 test cases cho timezone VN, biên ngày, giao thừa, cuối tháng.
11. `client/src/components/schedule/CourtSchedule.jsx`: Truyền `operatingHoursVersion` sang `SelectedRangesSummary`.
12. `client/src/components/schedule/SelectedRangesSummary.jsx`: Lưu `operatingHoursVersion` vào `sessionStorage`.
13. `client/src/pages/checkout/CheckoutPage.jsx`: Gửi `operatingHoursVersion` lên API backend, hiển thị thông báo lỗi thân thiện khi nhận HTTP 409.
14. `client/src/pages/owner/OwnerOnBehalfPage.jsx`: Sử dụng `getTodayVN()`, `maxDateStr`, gửi `operatingHoursVersion`.
15. `client/src/pages/owner/OwnerCourtBlocksPage.jsx`: Sử dụng `getTodayVN()`, `maxDateStr`.

### Tài liệu & Cấu hình:
16. `docs/api.openapi.yaml`: Cập nhật schema `CourtScheduleDTO`, `CreateBookingRequest`, `CreateOnBehalfBookingRequest`.
17. `docs/planning/phase-status.json`: Cập nhật lý do cổng `BE_READY` và `RELEASE_READY` chuyển sang `STALE` ghi nhận `logic-fix-B02`.

---

## 4. Kiểm chứng

### Lệnh chạy và kết quả kiểm thử:

1. **Suite kiểm thử B02 Flow**:
   - Lệnh: `node --test server/tests/integration/logic-fix-b02-flow.test.js`
   - Kết quả: **PASS 8/8 subtests** (9/9 tests passed in 2.09s, 0 fail, 0 skipped).
     - Subtest 1: Locked Owner direct access rejected (facility detail 404, court schedule 404, booking request 403); confirmed booking preserved.
     - Subtest 2: Unlocking Owner restores facility and booking access without altering paused facilities.
     - Subtest 3: Concurrency Race: `createBookingRequest` vs `updateFacilitySportStep` on Replica Set (0 write skew).
     - Subtest 4: Concurrency Race: `createBookingRequest` vs `updateOwnerFacility` on Replica Set (0 write skew).
     - Subtest 5: Concurrency Race: `createCourtBlock` vs `updateFacilitySportStep` on Replica Set.
     - Subtest 6: Draft with outdated `operatingHoursVersion` or `configVersion` rejected with 409 `CONFIG_VERSION_MISMATCH`.
     - Subtest 7: Business Date in `Asia/Ho_Chi_Minh` (00:30 & 06:59 VN time, month-end, year-end, 30-day window).
     - Subtest 8: Regression: B01 flows continue to function perfectly.

2. **Hồi quy Suite B01 Flow**:
   - Lệnh: `node --test server/tests/integration/logic-fix-b01-flow.test.js`
   - Kết quả: **PASS 5/5 subtests** (6/6 tests passed in 1.78s).

3. **Hồi quy Court Schedule API**:
   - Lệnh: `node --test server/tests/integration/court-schedule-api.test.js`
   - Kết quả: **PASS 12/12 subtests** (13/13 tests passed in 2.33s).

4. **Hồi quy Booking Request API**:
   - Lệnh: `node --test server/tests/integration/booking-request-api.test.js`
   - Kết quả: **PASS 12/12 subtests** (13/13 tests passed in 2.85s).

5. **Hồi quy Court Block API**:
   - Lệnh: `node --test server/tests/integration/court-block-api.test.js`
   - Kết quả: **PASS 4/4 subtests** (5/5 tests passed in 1.57s).

6. **Hồi quy E2E Release Readiness Suite**:
   - Lệnh: `node --test tests/e2e/release-ready-e2e.test.js`
   - Kết quả: **PASS 14/14 subtests** (15/15 tests passed in 2.11s).

7. **Kiểm thử Client (Vitest)**:
   - Lệnh: `npm --prefix client test`
   - Kết quả: **PASS 30/30 test files (143/143 tests passed in 7.99s)**.

8. **Build Frontend**:
   - Lệnh: `npm --prefix client run build`
   - Kết quả: **Vite build thành công 0 lỗi** (2096 modules transformed).

9. **Syntax & Lint Check**:
   - Lệnh: `npm run lint`
   - Kết quả: **Syntax check passed for 174 backend files**.

10. **Phase & Boundary Guard**:
    - Lệnh: `npm run check:phase`
    - Kết quả: **Cấu trúc hợp lệ, ranh giới hệ thống đạt chuẩn**.

---

## 5. Phiên bản được bàn giao

Toàn bộ các thay đổi được lưu tại working directory theo đúng cấu trúc mô tả tại Mục 3:
- 15 files mã nguồn backend, frontend và OpenAPI spec.
- 1 file integration test mới `server/tests/integration/logic-fix-b02-flow.test.js`.
- Báo cáo chi tiết `docs/phase-reports/logic-fix-B02.md`.
- Trạng thái các gate tại `docs/planning/phase-status.json` đã đánh dấu `STALE`.

---

## 6. Việc còn thiếu và điểm tiếp tục

- **Việc còn thiếu**: Không có. Toàn bộ 4 vấn đề của batch B02 đã được xử lý triệt để, kiểm chứng đầy đủ bằng automated test suites.
- **Rủi ro**: Không có. Mọi ràng buộc không làm lệch (không tự hủy đơn đã xác nhận, không chia database thành từng ô cố định, không thêm hoa hồng/voucher) được tuân thủ nghiêm ngặt.
- **Điểm tiếp tục**: Bàn giao cho người dùng / reviewer độc lập nghiệm thu đợt sửa lỗi B02 và đánh giá mở lại các gate `BE_READY` và `RELEASE_READY`.

---

## 7. Kết luận của agent triển khai

- Trạng thái đề nghị: **READY_FOR_REVIEW**.
- Căn cứ theo `AGENTS.md`: Agent triển khai chỉ được kết luận tối đa `READY_FOR_REVIEW`; trạng thái `ACCEPTED` và việc mở lại các gate `BE_READY` / `RELEASE_READY` thuộc thẩm quyền của người dùng hoặc reviewer được người dùng ủy quyền độc lập.
