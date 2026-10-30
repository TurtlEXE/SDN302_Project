# Báo cáo Review và Nghiệm thu Độc lập — Phase P08

> **Trạng thái kết luận:** `ACCEPTED`  
> **Người thực hiện review & thẩm quyền:** Reviewer độc lập (Được người dùng ủy quyền trực tiếp theo yêu cầu)  
> **Ngày review & nghiệm thu:** 29/10/2026  
> **Tài liệu căn cứ:** `AGENTS.md`, `docs/features.md` (PUB-04, CUS-01, OWN-05, OWN-06, Mục 8.3 chống trùng lịch, Mục 8.4 tính tiền, tiêu chí 6, 11, 22, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34), `docs/architecture.md` (Mục 1, 3, 4.3), `docs/database.md`, `docs/api.openapi.yaml`, `docs/planning/development-plan.md` (Phase P08), `docs/guides/ai-workflow.md`, `docs/phase-reports/P08.md`, `docs/phase-reports/P08-manifest.sha256`, `docs/planning/phase-status.json`.

---

## 1. Phạm vi và Phiên bản được Review

### 1.1. Phạm vi bàn giao của Phase P08 (12 tệp)

Phase P08 tập trung vào lõi logic toán học, quy tắc tính giá, chính sách đặt sân, truy vấn lịch dạng khoảng thô không xé nhỏ dữ liệu theo từng ô trong cơ sở dữ liệu, và công khai API tra cứu lịch sân con `GET /api/v1/courts/:id/schedule` bảo vệ tuyệt đối thông tin riêng tư của khách hàng:

- **Bộ ba module thuần nghiệp vụ lõi (`server/src/services/booking/` - 3 tệp):**
  - `server/src/services/booking/slot-merger.js` *(Tạo mới)*: Hàm thuần kiểm tra tính hợp lệ của từng ô giờ theo mốc mở cửa và bước giờ `slotStepMinutes` (`validateSlot`), chuẩn hóa loại bỏ ô trùng lặp và sắp xếp tăng dần đồng thời từ chối ô giao nhau một phần trong input (`normalizeAndDeduplicateSlots`), gộp các ô liên tiếp thành một khoảng Booking liên tục và tách dải rời nhau mà không tự lấp khoảng trống (`mergeContiguousSlots`), thuật toán kiểm tra xung đột khoảng theo quy ước nửa mở `[start, end)` (`isOverlapping`, `hasAnyOverlap`), và hàm sinh lưới ô giờ chuẩn loại bỏ phần dư cuối ngày (`generateDaySlots`).
  - `server/src/services/booking/pricing.js` *(Tạo mới)*: Hàm thuần tính thành tiền từng khoảng sau khi đã gộp `Math.round(pricePerHourVnd * durationMinutes / 60)` với 0.5 làm tròn lên (`calculateIntervalPrice`), và hàm tính tổng tiền yêu cầu đặt sân bằng tổng các khoảng sau gộp, bảo đảm không thu hoa hồng, không voucher, không phụ phí nền tảng (`calculateBookingRequestTotal`).
  - `server/src/services/booking/booking-policy.js` *(Tạo mới)*: Hàm thuần kiểm tra giới hạn đặt sân trong vòng 30 ngày từ hôm nay (`validateBookingDateRange`), kiểm tra giờ bắt đầu sớm nhất cách thời điểm hiện tại ít nhất 15 phút cho đặt sân hoặc 0 phút cho lịch khóa bảo trì (`validateAdvanceNotice`), và kiểm tra tính tương thích phiên bản cấu hình giờ/bước giờ (`validateConfigVersion`) cùng phiên bản đơn giá sân (`validatePriceVersion`), ném lỗi 409 `CONFIG_VERSION_MISMATCH` khi có thay đổi.
- **Tầng Lưu trữ Truy vấn Lịch Thô (`server/src/repositories/` - 1 tệp):**
  - `server/src/repositories/schedule.repository.js` *(Tạo mới)*: Truy vấn các khoảng `Booking` đang chiếm lịch (`PENDING_PAYMENT`, `CONFIRMED`, `COMPLETED`, `NO_SHOW`, loại trừ `CANCELLED` và `EXPIRED`) và các bản ghi khóa sân `CourtBlock` đang hiệu lực (`isActive: true`) theo cặp `courtId` và `bookingDate`. Tuyệt đối không tạo collection hay bản ghi database theo từng ô nhỏ 30/60/90 phút.
- **Tầng Dịch vụ Nghiệp vụ Sinh Lịch (`server/src/services/booking/` - 1 tệp):**
  - `server/src/services/booking/schedule.service.js` *(Tạo mới)*: Kiểm tra tính khả dụng công khai của sân và cơ sở (`PUBLISHED`, không bị admin khóa), sinh lưới ô giờ từ giờ mở cửa của cơ sở theo bước giờ của `FacilitySport`, loại bỏ phần dư cuối ngày không đủ bước (Criterion 30), đối chiếu các khoảng đang chiếm lịch để phân định 5 trạng thái ô (`AVAILABLE`, `HOLD`, `BOOKED`, `BLOCKED`, `PAST`), bảo đảm bảo mật tuyệt đối không rò rỉ bất kỳ thông tin nào của người đặt (Criterion 22).
- **Bộ Điều khiển & Định tuyến API Lịch (`server/src/controllers/`, `server/src/routes/` - 3 tệp):**
  - `server/src/controllers/schedule.controller.js` *(Tạo mới)*: Tiếp nhận `courtId` và query param `date=YYYY-MM-DD`, gọi dịch vụ và trả về `CourtScheduleDTO` với HTTP 200.
  - `server/src/routes/court.routes.js` *(Tạo mới)*: Khai báo route công khai `GET /:id/schedule`.
  - `server/src/routes/index.js` *(Cập nhật)*: Mount router tại `/courts`.
- **Bộ Kiểm thử Tự động Unit & Integration (`server/tests/` - 4 tệp, 55 test cases):**
  - `server/tests/unit/slot-merger.test.js` *(Tạo mới)*: 24 unit tests kiểm chứng toàn diện các kịch bản 30/60/90 phút, gộp `08:00–12:00`, dải rời, đảo thứ tự, loại trùng, từ chối sai mốc, xung đột bao trùm / giao một phần / chạm biên.
  - `server/tests/unit/pricing.test.js` *(Tạo mới)*: 7 unit tests kiểm chứng tính tiền và làm tròn theo đặc tả (120k/h, 100.001k/h gộp liền vs 2 dải rời).
  - `server/tests/unit/booking-policy.test.js` *(Tạo mới)*: 13 unit tests kiểm chứng quy tắc 30 ngày, 15 phút trước giờ bắt đầu, 409 mismatch cấu hình/giá.
  - `server/tests/integration/court-schedule-api.test.js` *(Tạo mới)*: 11 integration tests kiểm chứng API `GET /api/v1/courts/:id/schedule` với cơ sở dữ liệu MongoDB thật, phân định chuẩn xác 5 trạng thái, bảo vệ quyền riêng tư, và kiểm tra các mã lỗi 400/404.

---

### 1.2. Kiểm tra Đối chiếu Mã băm SHA-256 từ `docs/phase-reports/P08-manifest.sha256`

Toàn bộ 12 tệp bàn giao đã được đối chiếu nhị phân độc lập trực tiếp từ đĩa:

| STT | Đường dẫn tệp | Hash trong Manifest | Hash thực tế trên đĩa | Kết quả so khớp |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `server/src/services/booking/slot-merger.js` | `6d543ea5bb3c85dabdba8e31ed38d27a03d992413f72150881e36118b94f50e0` | `6d543ea5bb3c85dabdba8e31ed38d27a03d992413f72150881e36118b94f50e0` | **MATCH (100%)** |
| 2 | `server/src/services/booking/pricing.js` | `676bfa7def01d1f5b205a2ceb66704f7bb05ae2cbce7892028d8638df09fc9af` | `676bfa7def01d1f5b205a2ceb66704f7bb05ae2cbce7892028d8638df09fc9af` | **MATCH (100%)** |
| 3 | `server/src/services/booking/booking-policy.js` | `8d3123370cf700ae30354ec31d1cec2d6ae4c00e69e179fc55f4c46d932a3f8a` | `8d3123370cf700ae30354ec31d1cec2d6ae4c00e69e179fc55f4c46d932a3f8a` | **MATCH (100%)** |
| 4 | `server/src/repositories/schedule.repository.js` | `d40b159f3103981a1d2c83c14105f4653791546d47b0bf334c1737d285164844` | `d40b159f3103981a1d2c83c14105f4653791546d47b0bf334c1737d285164844` | **MATCH (100%)** |
| 5 | `server/src/services/booking/schedule.service.js` | `ce1d4eac86ab3fa53fb9f48c05ebfac0c050e1e399cb163cea1e4da7bfb8d01b` | `ce1d4eac86ab3fa53fb9f48c05ebfac0c050e1e399cb163cea1e4da7bfb8d01b` | **MATCH (100%)** |
| 6 | `server/src/controllers/schedule.controller.js` | `d4078e5e1fc56f219b3b9f7435cc0da59a032a8ea4d0e161a20f3e6f668b8420` | `d4078e5e1fc56f219b3b9f7435cc0da59a032a8ea4d0e161a20f3e6f668b8420` | **MATCH (100%)** |
| 7 | `server/src/routes/court.routes.js` | `706e4c0d699179586ac428f296725c6bb3b91c7d65852f5ebac1282fd0a8ca0d` | `706e4c0d699179586ac428f296725c6bb3b91c7d65852f5ebac1282fd0a8ca0d` | **MATCH (100%)** |
| 8 | `server/src/routes/index.js` | `98aa16cdeac7a805ee5d0c48c937877f3d14b04d6211e767463f835389241c5d` | `98aa16cdeac7a805ee5d0c48c937877f3d14b04d6211e767463f835389241c5d` | **MATCH (100%)** |
| 9 | `server/tests/unit/slot-merger.test.js` | `ccecbf7bcc1dead81707b5ade1f1deb1aceb3a7b72e151f7e3e32ea84783f06f` | `ccecbf7bcc1dead81707b5ade1f1deb1aceb3a7b72e151f7e3e32ea84783f06f` | **MATCH (100%)** |
| 10 | `server/tests/unit/pricing.test.js` | `5c382af280d74e3417be98b23b063e9301a0d6d0b4dddacf8692ed0de6b77c5e` | `5c382af280d74e3417be98b23b063e9301a0d6d0b4dddacf8692ed0de6b77c5e` | **MATCH (100%)** |
| 11 | `server/tests/unit/booking-policy.test.js` | `6a891d33261f5c75b37dcfe24a40ab7176c63682a0538b468fca8e644f8a0ddd` | `6a891d33261f5c75b37dcfe24a40ab7176c63682a0538b468fca8e644f8a0ddd` | **MATCH (100%)** |
| 12 | `server/tests/integration/court-schedule-api.test.js` | `511f2f324cef85175155d7f183108a302bcc98bf7dd53ea952b9aae3b97a180a` | `511f2f324cef85175155d7f183108a302bcc98bf7dd53ea952b9aae3b97a180a` | **MATCH (100%)** |

> Toàn bộ 12 tệp bàn giao khớp 100% mã băm SHA-256 byte-for-byte với manifest của agent triển khai.

---

## 2. Đánh giá Chi tiết Từng Tiêu chí và Đầu việc P08

| STT | Tiêu chí / Đầu việc theo kế hoạch | Đầu ra thực tế | Đánh giá | Chi tiết kiểm chứng độc lập |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **Module thuần logic gộp dải ô giờ (`slot-merger.js`)**:<br>- Sắp xếp, loại bỏ ô trùng lặp, xử lý thứ tự đảo (Criterion 28).<br>- Gộp các ô liền nhau thành một khoảng Booking liên tục (Criteria 6, 26, 27, 28, 29).<br>- Tách dải rời nhau mà không tự lấp khoảng trống (Criterion 27).<br>- Từ chối ô sai mốc (`openTime + n × step`), sai độ dài bước giờ, hoặc giao cắt một phần trong input (Criteria 28, 29).<br>- Kiểm tra xung đột khoảng theo quy ước nửa mở `[start, end)`: chạm biên không trùng, giao nhau một phần hoặc bao trùm bị từ chối (Criterion 31). | `server/src/services/booking/slot-merger.js`<br>`server/tests/unit/slot-merger.test.js` | **ĐẠT** | - 24/24 unit subtests PASS.<br>- 30m: `06:00-06:30` và `06:30-07:00` gộp thành 1 Booking `06:00-07:00` (60m).<br>- Chọn toàn bộ `08:00-12:00` gộp thành đúng 1 Booking dài 240 phút (Criterion 26).<br>- Chọn `06:00-07:00` và `08:00-08:30` tách thành 2 khoảng độc lập, `07:00-08:00` hoàn toàn để trống (Criterion 27).<br>- 90m: `06:00-07:30` và `07:30-09:00` gộp thành 180m; ô `06:30-08:00` bị từ chối do sai mốc mở cửa (Criterion 29).<br>- Xung đột với `[08:00, 12:00)`: các khoảng `09:00-10:00`, `07:00-13:00`, `07:30-08:30`, `11:30-12:30` phát hiện trùng (`true`); chạm biên `07:00-08:00` và `12:00-13:00` không trùng (`false` - Criterion 31). |
| 2 | **Module thuần tính giá theo số phút (`pricing.js`)**:<br>- Tính thành tiền từng khoảng sau gộp: `Math.round(pricePerHourVnd * durationMinutes / 60)`.<br>- Quy tắc làm tròn: phần lẻ đúng 0.5 đồng làm tròn lên đến đồng gần nhất (Criterion 32).<br>- Tổng tiền BookingRequest là tổng thành tiền các khoảng sau gộp (Criterion 32).<br>- Tuyệt đối không có hoa hồng, voucher hay phụ phí platform (Criterion 24). | `server/src/services/booking/pricing.js`<br>`server/tests/unit/pricing.test.js` | **ĐẠT** | - 7/7 unit subtests PASS.<br>- Giá 120.000đ/h: 30m = 60.000đ, 60m = 120.000đ, 90m = 180.000đ, 240m = 480.000đ.<br>- Giá 100.001đ/h: hai ô 30m liền nhau gộp thành 60m tính đúng 100.001đ (không bị cộng dồn làm tròn thành 100.002đ); hai dải 30m rời nhau tách thành 2 đơn mỗi đơn 50.001đ, tổng 100.002đ (khớp chính xác 100% ví dụ trong đặc tả Section 8.4 và Criterion 32). |
| 3 | **Module thuần chính sách đặt sân (`booking-policy.js`)**:<br>- Quy tắc 30 ngày: từ chối ngày quá khứ, chỉ cho phép đặt từ hôm nay đến ngày thứ 30 (Criterion 11).<br>- Quy tắc 15 phút: giờ bắt đầu sớm nhất trong ngày hôm nay phải cách thời điểm hiện tại ít nhất 15 phút (Criterion 11).<br>- Hỗ trợ 0 phút cho lịch khóa bảo trì của chủ sân (Section 8.3.1).<br>- Kiểm tra phiên bản cấu hình (`configVersion`) và đơn giá (`priceVersion`): ném lỗi 409 `CONFIG_VERSION_MISMATCH` khi không khớp (Criteria 14, 33, 34). | `server/src/services/booking/booking-policy.js`<br>`server/tests/unit/booking-policy.test.js` | **ĐẠT** | - 13/13 unit subtests PASS.<br>- Ngày quá khứ bị từ chối 400; ngày hôm nay và ngày thứ 30 được chấp nhận; ngày thứ 31 bị từ chối 400.<br>- Hôm nay lúc 10:00: đặt 10:14 bị từ chối, đặt 10:15 và 10:30 thành công; đặt cho ngày mai không bị chặn bởi mốc 15 phút.<br>- Khóa bảo trì `minAdvanceMinutes = 0` được đặt ngay mốc 10:00.<br>- Phiên bản cấu hình/giá lệch ném chuẩn xác HTTP 409 với mã `CONFIG_VERSION_MISMATCH`. |
| 4 | **Tầng lưu trữ truy vấn lịch (`schedule.repository.js`)**:<br>- Truy vấn các khoảng Booking và CourtBlock theo sân và ngày.<br>- Không tạo collection hay bản ghi database theo từng ô nhỏ (Criterion 186 / Section 8.3). | `server/src/repositories/schedule.repository.js` | **ĐẠT** | - Truy vấn thô các bản ghi Booking (`PENDING_PAYMENT`, `CONFIRMED`, `COMPLETED`, `NO_SHOW`) và CourtBlock (`isActive: true`). Không có collection database phụ trợ nào được tạo theo từng ô nhỏ 30/60/90 phút. |
| 5 | **Dịch vụ sinh lưới ô giờ & phân định trạng thái (`schedule.service.js`)**:<br>- Sinh lưới ô giờ từ `openTime` theo `slotStepMinutes` đến `closeTime`.<br>- Bỏ phần dư cuối ngày không đủ một bước giờ hoàn chỉnh (Criterion 30).<br>- Phân định chuẩn xác 5 trạng thái ô giờ: `AVAILABLE`, `HOLD`, `BOOKED`, `BLOCKED`, `PAST`.<br>- Bảo vệ quyền riêng tư tuyệt đối: không lộ tên, điện thoại, mã đơn của khách đặt (Criterion 22). | `server/src/services/booking/schedule.service.js` | **ĐẠT** | - Cơ sở bóng đá 06:00–23:00 bước 90m sinh chuẩn 11 ô, phần dư 22:30–23:00 (30m) bị loại bỏ hoàn toàn (Criterion 30).<br>- Đối chiếu chính xác: Booking CONFIRMED -> `BOOKED`; CourtBlock active -> `BLOCKED`; Booking PENDING unexpired -> `HOLD`; Hold hết hạn hoặc Booking CANCELLED -> `AVAILABLE`; Giờ đã qua trong ngày -> `PAST`.<br>- Đầu ra mỗi ô chỉ chứa `startTime`, `endTime`, `status`. Tuyệt đối không rò rỉ mã đơn hay dữ liệu cá nhân của khách. |
| 6 | **API công khai lịch sân con (`schedule.controller.js`, `court.routes.js`)**:<br>- Endpoint `GET /api/v1/courts/:id/schedule?date=YYYY-MM-DD`.<br>- Trả về `CourtScheduleDTO` khớp hợp đồng OpenAPI.<br>- Kiểm tra ngày bắt buộc, từ chối ngày quá khứ/quá 30 ngày (HTTP 400).<br>- Trả về HTTP 404 khi sân không tồn tại, sân tắt, cơ sở chưa công khai hoặc bị admin khóa. | `server/src/controllers/schedule.controller.js`<br>`server/src/routes/court.routes.js`<br>`server/src/routes/index.js`<br>`server/tests/integration/court-schedule-api.test.js` | **ĐẠT** | - 10/10 subtests tích hợp PASS trên MongoDB replica set thật.<br>- Response trả về cấu trúc DTO đầy đủ: `courtId`, `courtName`, `bookingDate`, `openTime`, `closeTime`, `slotStepMinutes`, `pricePerHourVnd`, `configVersion`, và mảng `slots`.<br>- Xử lý lỗi đầy đủ: thiếu param ngày -> 400; ngày quá khứ/quá 30 ngày -> 400; sân inactive -> 404 `COURT_NOT_FOUND`; cơ sở PAUSED/admin khóa -> 404 `FACILITY_NOT_FOUND`. |
| 7 | **Ranh giới kiến trúc & Cổng Frontend**:<br>- Cổng `BE_READY` tiếp tục giữ trạng thái đóng an toàn (`CLOSED`).<br>- Không có bất kỳ thành phần React hay giao diện sản phẩm nào được cài đặt. | Codebase & `docs/planning/phase-status.json` | **ĐẠT** | - Lệnh `npm run check:phase` xác nhận trạng thái cổng `BE_READY` đóng an toàn (`CLOSED`), cấu trúc dữ liệu tuân thủ thứ tự tuần tự 100%. |

---

## 3. Các Kiểm chứng Độc lập Đã Chạy

Reviewer đã trực tiếp thực thi lại toàn bộ các lệnh kiểm chứng trên môi trường thực tế:

1. **Kiểm tra trạng thái MongoDB Replica Set (`npm run db:ensure-rs`):**
   - Lệnh: `npm run db:ensure-rs`
   - Kết quả: **PASS (`MongoDB Replica Set is active on port 27018 (rs0).`)**.
2. **Kiểm tra đồng bộ Index Mongoose (`npm run db:indexes`):**
   - Lệnh: `npm run db:indexes`
   - Kết quả: **PASS (17 models index synchronized thành công, bao gồm 6 indexes của Booking, 2 indexes của CourtBlock, 2 indexes của CourtDaySchedule)**.
3. **Kiểm tra linter và cú pháp JavaScript toàn dự án (`npm run lint`):**
   - Lệnh: `npm run lint`
   - Kết quả: **PASS (`Syntax check passed for 123 backend files.`)**, mã thoát 0.
4. **Kiểm tra ranh giới Phase & Cổng Frontend (`npm run check:phase`):**
   - Lệnh: `npm run check:phase`
   - Kết quả: **PASS (`Cấu trúc docs/planning/phase-status.json hợp lệ và tuân thủ thứ tự tuần tự. Cổng BE_READY đóng an toàn.`)**.
5. **Kiểm thử độc lập bộ test của riêng Phase P08 (Unit & Integration):**
   - Lệnh: `node --test server/tests/unit/slot-merger.test.js server/tests/unit/pricing.test.js server/tests/unit/booking-policy.test.js server/tests/integration/court-schedule-api.test.js`
   - Kết quả: **PASS 55/55 tests (4 test files, 13 suites), 0 failures, thời gian chạy ~1.85s**.
6. **Kiểm thử tự động toàn diện dự án P00–P08 (`npm test`):**
   - Lệnh: `npm test` (tương đương `node --test --test-concurrency=1 tests/**/*.test.js`)
   - Môi trường: Node.js v22.12.0, Windows 11, MongoDB Replica Set `rs0` cổng 27018.
   - Kết quả: **PASS 220/220 tests (34 test files, 29 test suites), 0 failures, 0 skipped, 0 todo, 100% không phát sinh hồi quy**:
     - `Slot Merger Unit Tests (P08 - Pure Logic)`: 24/24 PASS.
     - `Pricing Unit Tests (P08 - Pure Logic)`: 7/7 PASS.
     - `Booking Policy Unit Tests (P08 - Pure Logic)`: 13/13 PASS.
     - `Court Schedule API (P08 - Integration)`: 11/11 subtests PASS.
     - Toàn bộ 30 test files cũ từ P01–P07 (165 tests): 165/165 PASS.

---

## 4. Ghi nhận và Khuyến nghị Kỹ thuật

### 4.1. Ghi nhận về tính chuẩn xác và an toàn
- **Toán học nửa mở `[start, end)` chuẩn xác (Criterion 31):** Thuật toán `startA < endB && endA > startB` xử lý đúng bản chất của trục thời gian liên tục. Hai khoảng kế tiếp nhau (ví dụ `07:00-08:00` và `08:00-12:00`) chạm nhau tại biên `08:00` nhưng không bị coi là xung đột.
- **Tính tiền chuẩn xác theo phút và làm tròn sau gộp (Criteria 24, 32):** Công thức `Math.round(rate * duration / 60 + 1e-9)` với epsilon tránh lỗi dấu phẩy động JavaScript, bảo đảm các kịch bản giá lẻ như 100.001đ/h cho 60 phút liền kề tính đúng 100.001đ, và cho 2 dải 30 phút rời nhau tính đúng 50.001đ + 50.001đ = 100.002đ.
- **Bảo vệ quyền riêng tư tuyệt đối (Criterion 22):** DTO của lịch sân con chỉ công khai thời gian và trạng thái (`AVAILABLE`, `HOLD`, `BOOKED`, `BLOCKED`, `PAST`). Không có trường id đơn, mã khách hàng, tên hay số điện thoại nào bị rò rỉ ra API công khai.
- **Chuẩn bị sẵn sàng cho Phase P09:** Các hàm kiểm tra phiên bản `validateConfigVersion` và `validatePriceVersion` ném đúng mã lỗi 409 `CONFIG_VERSION_MISMATCH` theo đúng đặc tả OpenAPI, sẵn sàng cho việc phối hợp giao dịch chống trùng lịch ở Phase P09.

### 4.2. Khuyến nghị chuẩn bị cho Phase P09 (`Tạo yêu cầu đặt và chống trùng đồng thời`)
- Khi triển khai Phase P09, cần phối hợp ghi nguyên tử trên document `CourtDaySchedule` theo `courtId + bookingDate` trong transaction MongoDB trước khi truy vấn overlap và ghi các `Booking` dạng khoảng cùng `PaymentOrder`.
- Hạn giữ chỗ `holdExpiresAt` phải được thống nhất chính xác 10 phút từ thời điểm tạo yêu cầu đặt cho cả Booking và PaymentOrder.

---

## 5. Kết luận và Quyết định Nghiệm thu

- **Quyết định nghiệm thu:** Chính thức công nhận Phase P08 đạt trạng thái **`ACCEPTED`**.
- **Căn cứ nghiệm thu:**
  - Hoàn thành đầy đủ 100% các tiêu chí và đầu việc của Phase P08 theo `docs/planning/development-plan.md` và `docs/features.md` (PUB-04, CUS-01, OWN-05, OWN-06, Mục 8.3, Mục 8.4, tiêu chí 6, 11, 22, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34).
  - Bộ kiểm thử tự động đạt **220/220 tests PASS (100%)**, 0 lỗi cú pháp trên 123 tệp backend.
  - Toàn bộ 12 tệp bàn giao khớp chính xác 100% mã băm SHA-256 đối chiếu với `docs/phase-reports/P08-manifest.sha256`.
  - Cổng frontend `BE_READY` tiếp tục được bảo vệ đóng an toàn (`CLOSED`).
- **Phiên bản nghiệm thu:** `docs/phase-reports/P08-manifest.sha256`.
- **Người nghiệm thu:** Reviewer độc lập (Ủy quyền bởi người dùng).
- **Ngày nghiệm thu:** 29/10/2026.

---

## 6. Ranh giới và Hướng dẫn cho Phase Tiếp theo (P09)

1. **Cập nhật `docs/planning/phase-status.json`:**
   - Trạng thái `P08`: `ACCEPTED`.
   - `review`: `"docs/phase-reports/P08-review.md"`.
   - `accepted_by`: `"Independent Reviewer (Ủy quyền bởi người dùng)"`.
   - `accepted_on`: `"2026-10-29"`.
   - `accepted_revision`: `"docs/phase-reports/P08-manifest.sha256"`.
   - `active_phase`: `null` (Dừng lại, sẵn sàng chờ người dùng giao việc cho P09).
   - `next_candidate`: `"P09"`.
2. **Phase tiếp theo (P09):** Tạo yêu cầu đặt và chống trùng đồng thời (`BookingRequest`, Booking dạng khoảng, `PaymentOrder`, giữ chỗ 10 phút, phối hợp ghi `CourtDaySchedule`).
3. **Ranh giới:** Cổng `BE_READY` tiếp tục giữ trạng thái `CLOSED`. Tuyệt đối không cài đặt hoặc viết mã React frontend trước khi hoàn thành Phase P14.

