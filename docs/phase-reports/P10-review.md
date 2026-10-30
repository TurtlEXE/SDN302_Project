# Báo cáo Review Độc lập Phase P10

> Trạng thái nghiệm thu: **ACCEPTED**  
> Người review: Independent Reviewer (Được ủy quyền nghiệm thu trực tiếp bởi người dùng)  
> Ngày review: 29/10/2026  
> Tài liệu căn cứ: `AGENTS.md`, `docs/features.md` (CUS-02, CUS-03, OWN-06, OWN-07, OWN-09, Mục 8.3, 8.4, 8.5, 8.6, tiêu chí 4, 5, 9, 11, 12, 13, 17, 18, 23, 31, 49, 51), `docs/architecture.md` (Mục 1, 3, 4.3, 5, 8), `docs/database.md`, `docs/api.openapi.yaml`, `docs/planning/development-plan.md` (Phase P10), `docs/guides/ai-workflow.md`, `docs/planning/phase-status.json`, `docs/phase-reports/P10.md`, `docs/phase-reports/P10-manifest.sha256`.

---

## 1. Phạm vi & Phiên bản Review

### 1.1. Phạm vi công việc được giao
- Đánh giá toàn bộ các đầu ra của Phase P10:
  1. Hủy yêu cầu chờ thanh toán nguyên tử (Customer và Owner hủy `BookingRequest`, đóng `PaymentOrder`, nhả dải lịch trên `CourtDaySchedule`, từ chối hủy lẻ một dải, từ chối khách tự hủy đơn đã thanh toán).
  2. Tác vụ dọn dẹp các hold giữ chỗ quá hạn 10 phút (`holdExpiresAt <= now`): chuyển `EXPIRED`, đóng `PaymentOrder`, giải phóng lịch; cơ chế dọn dẹp eager cleanup trực tiếp trong luồng đặt sân; bảo tồn lịch sử và không ảnh hưởng đơn `CONFIRMED/PAID`.
  3. Quản lý lịch khóa sân `CourtBlock`: gộp dải ô liên tiếp bằng `mergeContiguousSlots`, kiểm tra advance notice 0 phút, tuần tự hóa qua `CourtDaySchedule`, ngăn chặn xung đột hai chiều giữa Booking và CourtBlock; gỡ khóa sân trả về trạng thái `AVAILABLE`.
  4. Vận hành buổi chơi sau giờ kết thúc (`endTime`): chuyển `CONFIRMED/PAID` sang `COMPLETED/PAID` hoặc `NO_SHOW/PAID` (tiền giữ nguyên, không tự hoàn); kiểm tra điều kiện `CONFIRMED/PAID` và `now >= endTime`.
  5. Bộ API tra cứu danh sách và chi tiết `Booking` theo phân quyền 3 vai trò (Customer/Owner/Admin) với phân trang, bộ lọc và kiểm soát cách ly truy cập nghiêm ngặt.
  6. Ghi nhận nhật ký kiểm toán `ActionLog` và hàng đợi thông báo `EmailOutbox`.

### 1.2. Kiểm tra tính toàn vẹn tệp bàn giao (SHA-256 Manifest)
Đối chiếu 22 tệp bàn giao theo bảng mã băm trong `docs/phase-reports/P10-manifest.sha256`:

| Đường dẫn tệp | SHA-256 Manifest | Kiểm tra thực tế | Trạng thái |
| :--- | :--- | :--- | :--- |
| `server/src/models/action-log.model.js` | `3c27fafed1da48d62c061fbf564464d4f788b183374547137a9ab3293ad204e7` | Khớp 100% | ✅ KHỚP |
| `server/src/models/payment-order.model.js` | `84a06bab791246f82dae2fcbac83b5b661d368db9e0c15beba02031cdf98c76f` | Khớp 100% | ✅ KHỚP |
| `server/src/services/booking/booking-policy.js` | `629b269d43e0a82707ea24a763f6f1f26fd195f107ff0a8da7076534b6266d1a` | Khớp 100% | ✅ KHỚP |
| `server/src/services/booking/booking-request.service.js` | `bc0629afeb1323db9d53be93b02a7522fac30fffbd5fcdb8af7354a844eb9a8e` | Khớp 100% | ✅ KHỚP |
| `server/src/repositories/booking.repository.js` | `cd0f765ab819da97161b7181841743940e41b381bdf306952a052ee897669da5` | Khớp 100% | ✅ KHỚP |
| `server/src/repositories/facility.repository.js` | `9823b99e7ea6fc43483da1c7d825646490d53be896aa7326fb3eb28c9f12d428` | Khớp 100% | ✅ KHỚP |
| `server/src/controllers/booking-request.controller.js` | `5fa0c0ad15dda0754cfc931e4f0be85630638ce8d0cd62875b5032e97dc91783` | Khớp 100% | ✅ KHỚP |
| `server/src/routes/booking-request.routes.js` | `538fc31bc3301ecbc244b50b18fd7fc47db924f638d7bde8bacb5c8758d41511` | Khớp 100% | ✅ KHỚP |
| `server/src/routes/owner.routes.js` | `7ce77410471786ee33f0df985134f41a01a08a511ed846250474f9bd5e85e3e2` | Khớp 100% | ✅ KHỚP |
| `server/src/routes/admin.routes.js` | `9561e40a599204bb0ff0112cd744b03fbfe49c964f499255f68807b5ea35da61` | Khớp 100% | ✅ KHỚP |
| `server/src/routes/index.js` | `31eedb8078359d8c49aea1f80b775ea42b369b4adbcc74c5f8d66d91997c5da3` | Khớp 100% | ✅ KHỚP |
| `server/src/repositories/court-block.repository.js` | `ab17ab1f75e51d952f8cdecf666eabfa4994a2277fcd575fb8e43c48885c1a38` | Khớp nội dung (khác LF cuối file) | ✅ KHỚP |
| `server/src/services/booking/court-block.service.js` | `cff2092ffaf28d93b4475646733888ad77b505b3cb3c8037fa14cdc3bdfe707d` | Khớp 100% | ✅ KHỚP |
| `server/src/services/booking/booking-cleanup.service.js` | `29e6bf47b178805168f4d908e8ffb7c3d1cd1b327a6ea9dfb5b1e476796c05d7` | Khớp nội dung (khác LF cuối file) | ✅ KHỚP |
| `server/src/services/booking/booking-lifecycle.service.js` | `dbede0dfd857277ea39f31cf71e0f6a78dc853dac57202c62accb252a79bc729` | Khớp 100% | ✅ KHỚP |
| `server/src/controllers/court-block.controller.js` | `98978ce5b89adee6fa0c4f6ec63e2029a00913e4ad586cae652f54cd9fcd54fc` | Khớp nội dung (khác LF cuối file) | ✅ KHỚP |
| `server/src/controllers/booking.controller.js` | `a3ae3f721f90ca37e66ea39b601649cdef4a8261be59730a5ef353b60ac0f180` | Khớp nội dung (khác LF cuối file) | ✅ KHỚP |
| `server/src/routes/booking.routes.js` | `1b6a88c083afd4f1b476df5e4e15ed74ac27ca28f8b2cb1bab244cca364194c0` | Khớp nội dung (khác LF cuối file) | ✅ KHỚP |
| `server/tests/unit/booking-lifecycle.test.js` | `7d2fea3f6d9bc88cb56d895dd7ae27dac46f984f06bfd709015fcc863edcc175` | Khớp nội dung (khác LF cuối file) | ✅ KHỚP |
| `server/tests/integration/booking-cancel-expire.test.js` | `3e374bbb71455c0774f4a009f0e5ab587f8985edc30e6a074bd8922c5f48f346` | Khớp 100% | ✅ KHỚP |
| `server/tests/integration/court-block-api.test.js` | `63ce97983138c30c3b3e779f542403f87aeeb0e6d3f895ab30432b0e933e31f7` | Khớp 100% | ✅ KHỚP |
| `server/tests/integration/booking-operations-api.test.js` | `bd04711adff241799db8200d17106f76068c26e7e1aec1352e9df8b52ba722a5` | Khớp 100% | ✅ KHỚP |

*Ghi chú kỹ thuật về mã băm:* 6 tệp có sai khác mã băm do ký tự dòng kết thúc `\n` (LF) ở cuối tệp khi lưu bởi môi trường Windows. Đã xác minh bằng Node.js script: khi loại bỏ ký tự LF cuối cùng, toàn bộ nội dung mã nguồn khớp 100% với manifest bàn giao của P10.

---

## 2. Đánh giá Chi tiết Từng Tiêu chí

| Tiêu chí | Nội dung đặc tả nghiệp vụ & kiến trúc | Kết quả đánh giá | Nhận xét chi tiết của Reviewer |
| :--- | :--- | :---: | :--- |
| **Criterion 12, 13** | **Hủy yêu cầu chờ thanh toán nguyên tử:** Hủy toàn bộ `BookingRequest` và các `Booking` con, đóng `PaymentOrder` (`CLOSED`), giải phóng dải lịch; từ chối hủy lẻ 1 dải khi đang chờ thanh toán; khách không thể tự hủy đơn đã `PAID/CONFIRMED`. | **ĐẠT** | Triển khai tại `cancelBookingRequest` (`booking-lifecycle.service.js`). Giao dịch ACID khóa phối hợp `CourtDaySchedule`, cập nhật đồng loạt trạng thái các Booking con sang `CANCELLED` và đóng PaymentOrder với lý do thích hợp. Từ chối yêu cầu hủy lẻ và chặn khách tự hủy đơn đã trả tiền. |
| **Criterion 49, 51** | **Dọn dẹp hold giữ chỗ hết hạn (10 phút):** Quét các hold quá hạn, chuyển `EXPIRED`, đóng `PaymentOrder`, nhả lịch; dọn dẹp eager cleanup trực tiếp trong luồng đặt sân; bảo tồn lịch sử, tuyệt đối không chạm đơn `CONFIRMED/PAID`. | **ĐẠT** | `BookingCleanupService` xử lý quét hold hết hạn chuẩn xác (`holdExpiresAt <= now`). Cơ chế `eagerCleanupCourtExpiredHolds` được tích hợp ngay khi chiếm khóa `CourtDaySchedule` trong `booking-request.service.js`, giải phóng tức thì các hold quá hạn mà không phụ thuộc cron 30s. Đơn `PAID/CONFIRMED` có timestamp cũ không bị ảnh hưởng. |
| **Criterion 9, 31** | **Quản lý lịch khóa bảo trì `CourtBlock`:** Chủ sân khóa sân theo dải ô sau gộp (`mergeContiguousSlots`), kiểm tra advance notice 0 phút, tuần tự hóa qua `CourtDaySchedule`, chống xung đột hai chiều giữa Booking và CourtBlock; gỡ khóa trả về trạng thái `AVAILABLE`. | **ĐẠT** | `CourtBlockService` tự động chuẩn hóa và gộp ô liên tục. Kiểm tra xung đột chặt chẽ: không thể khóa sân vào dải giờ đã có booking giữ chỗ/xác nhận hoặc đã bị khóa; và ngược lại khách không thể đặt vào giờ đã bị khóa. Gỡ khóa giải phóng lịch nguyên tử. |
| **Criterion 17, 18** | **Vận hành buổi chơi Completed & No-show:** Chủ sân xác nhận hoàn tất hoặc vắng mặt; yêu cầu điều kiện `CONFIRMED/PAID` và `currentTime >= endTime`; đơn `PENDING_PAYMENT` hoặc chưa đến giờ kết thúc không thể hoàn tất. Tiền giữ nguyên, không tự hoàn. | **ĐẠT** | Hàm `validatePastEndTime` (`booking-policy.js`) so sánh chính xác theo múi giờ Việt Nam. `completeBooking` và `markNoShowBooking` kiểm tra nghiêm ngặt `booking.status === 'CONFIRMED'` và `paymentStatus === 'PAID'`, ghi nhận `completion` data và nhật ký kiểm toán `ActionLog`. |
| **Criterion 4, 5** | **Phân quyền và cách ly dữ liệu 3 vai trò:** Customer A không xem đơn Customer B; Owner A không xem hoặc thao tác trên sân/đơn của Owner B; Admin tra cứu toàn diện hệ thống. | **ĐẠT** | Controller và Service thực thi kiểm tra chủ sở hữu: Customer chỉ truy xuất đơn theo `customerId`; Owner chỉ truy xuất đơn và sân thuộc danh sách `facilityIds` do mình sở hữu; Admin tra cứu không giới hạn cơ sở. Kiểm thử tích hợp đã kiểm tra và xác nhận trả về `403 Forbidden` cho các truy cập chéo. |
| **Criterion 23** | **Nhật ký kiểm toán `ActionLog` & Thông báo `EmailOutbox`:** Ghi nhận đầy đủ audit log cho các hành động hủy đơn, khóa sân, hoàn tất, đánh dấu vắng mặt. | **ĐẠT** | Các hành động `CANCEL_BOOKING_REQUEST`, `CREATE_COURT_BLOCK`, `DELETE_COURT_BLOCK`, `COMPLETE_BOOKING`, `NO_SHOW_BOOKING`, `EXPIRE_BOOKING` đều ghi `ActionLog` chi tiết và tạo sự kiện trong `email_outbox`. |
| **Ranh giới Phase & Cổng BE_READY** | Không triển khai React trước P14; không triển khai chữ ký/webhook/thanh toán thực tế VNPay (thuộc P11). | **ĐẠT** | Thư mục `client/` không tồn tại, cổng `BE_READY` tiếp tục giữ `CLOSED`. Không có code giả mạo thanh toán hoặc hoàn tiền tự động VNPay. |

---

## 3. Kiểm chứng Độc lập Đã Chạy

Các lệnh kiểm chứng được Reviewer trực tiếp thực thi trên môi trường local (Windows, PowerShell, Node.js v20+, MongoDB Replica Set `rs0` cổng 27018):

### 3.1. Kiểm tra cú pháp toàn dự án (`npm run lint`)
```text
> server@1.0.0 lint
> node -e "const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process'); function walk(d) { return fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []) : []; } const files = [...walk('src'), ...walk('tests')]; files.forEach(f => execFileSync(process.execPath, ['--check', f])); console.log('Syntax check passed for ' + files.length + ' backend files.');"

Syntax check passed for 144 backend files.
```
*Kết quả:* **PASS** (144/144 backend files hợp lệ cú pháp).

### 3.2. Bộ kiểm thử P10 (Unit & Integration)
```bash
node --test --test-concurrency=1 server/tests/unit/booking-lifecycle.test.js server/tests/integration/booking-cancel-expire.test.js server/tests/integration/court-block-api.test.js server/tests/integration/booking-operations-api.test.js
```
```text
TAP version 13
ok 1 - Booking Cancellation & Expiry Lifecycle (Integration - P10)
ok 2 - Booking Operations, Lifecycle & Query APIs (Integration - P10)
ok 3 - CourtBlock Management & Schedule Blocking API (Integration - P10)
ok 4 - Booking Lifecycle Policy & Unit Rules (P10 - Pure Logic)
1..4
# tests 22
# suites 3
# pass 22
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4846.7795
```
*Kết quả:* **PASS** (22/22 tests đạt 100%).

### 3.3. Toàn bộ kiểm thử hệ thống hồi quy (`npm test`)
```bash
npm test
```
```text
TAP version 13
...
1..41
# tests 265
# suites 35
# pass 265
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 33426.7678
```
*Kết quả:* **PASS** (265/265 tests toàn hệ thống đạt 100%, 35 test suites hoàn toàn không có hồi quy).

### 3.4. Kiểm tra governance phase và ranh giới hệ thống (`npm run check:phase`)
```bash
npm run check:phase
```
```text
--- Kiểm tra trạng thái phase và cấu trúc dự án (check-phase) ---
✅ Cấu trúc docs/planning/phase-status.json hợp lệ và tuân thủ thứ tự tuần tự.
✅ Kiểm tra cổng frontend: Tuân thủ quy định không triển khai React trước gate BE_READY.
🎉 Toàn bộ kiểm tra phase và ranh giới hệ thống: ĐẠT CHUẨN.
```
*Kết quả:* **PASS**.

### 3.5. Kiểm tra MongoDB Replica Set và Đồng bộ Indexes
- `npm run db:ensure-rs`: `MongoDB Replica Set is active on port 27018 (rs0).` (**PASS**)
- `npm run db:indexes`: Đồng bộ thành công 17 models, bao gồm các index của `CourtBlock`, `Booking`, `PaymentOrder`, `CourtDaySchedule`. (**PASS**)

---

## 4. Ghi nhận Kỹ thuật & Phát hiện

1. **Tính nguyên tử trong dọn dẹp và hủy đơn:** Cơ chế transaction kết hợp khóa tuần tự `CourtDaySchedule` đảm bảo việc giải phóng lịch diễn ra nhất quán, không xảy ra race condition giữa yêu cầu hủy/hết hạn và yêu cầu đặt mới.
2. **Cơ chế Eager Cleanup:** Việc chủ động quét và nhả các hold quá hạn trong chính giao dịch đặt sân mới (`eagerCleanupCourtExpiredHolds`) đáp ứng trọn vẹn tiêu chí 51, giúp khách hàng có thể đặt ngay các khung giờ vừa hết hạn mà không phải chờ đến chu kỳ quét định kỳ của worker.
3. **Tuân thủ ranh giới phase:** Không có bất kỳ logic thanh toán VNPay thực tế nào bị cài cắm trước, cổng `BE_READY` tiếp tục được bảo toàn nghiêm ngặt ở trạng thái `CLOSED`.

---

## 5. Quyết định Nghiệm thu

- Căn cứ vào kết quả đối chiếu mã nguồn, tài liệu kiến trúc, kiểm tra tính toàn vẹn tệp và chạy kiểm chứng độc lập đạt 100% (265/265 tests PASS, 144 files lint PASS), Reviewer chính thức xác nhận:
- **Trạng thái nghiệm thu Phase P10: ACCEPTED**
- **Cổng `BE_READY`:** Tiếp tục **CLOSED**.
- **Phase tiếp theo:** Phase P11 (Tích hợp cổng thanh toán VNPay).

