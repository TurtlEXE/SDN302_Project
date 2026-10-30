# Báo cáo Review Độc lập Phase P11

> Trạng thái nghiệm thu: **ACCEPTED**  
> Người review: Independent Reviewer (Được ủy quyền nghiệm thu trực tiếp bởi người dùng)  
> Ngày review: 30/10/2026  
> Tài liệu căn cứ: `AGENTS.md`, `docs/features.md` (Mục 8.6, CUS-01, OWN-08, Tiêu chí 39, 40, 41, 44, 45, 46, 47, 48, 49, 50, 52, 55, 56), `docs/architecture.md` (Mục 5, 8, 10.5), `docs/database.md`, `docs/api.openapi.yaml`, `docs/planning/development-plan.md` (Phase P11), `docs/guides/ai-workflow.md`, `docs/planning/phase-status.json`, `docs/phase-reports/P11.md`, `docs/phase-reports/P11-manifest.sha256`.

---

## 1. Phạm vi & Phiên bản Review

### 1.1. Phạm vi công việc được giao
Đánh giá toàn diện các đầu việc và tiêu chí của Phase P11 (VNPay thu đủ 100% và callback đáng tin cậy):
1. **VNPay Gateway Client:** Xây dựng client tạo URL thanh toán ký HMAC-SHA512, quy đổi `vnp_Amount = expectedAmountVnd * 100`, `vnp_ExpireDate` khớp chính xác `holdExpiresAt` (Criterion 46). Xác minh chữ ký `verifySignature` cho callback.
2. **Tiếp tục thanh toán:** Cho phép mở lại URL thanh toán trên cùng `PaymentOrder` còn hạn; không tạo order song song, không thay đổi hạn giữ chỗ hoặc đơn giá đã chốt.
3. **Logic callback hợp nhất (`processVNPayCallback`):** Dùng chung logic kiểm tra cho cả IPN (`GET /api/v1/payments/vnpay-ipn`) và Return (`GET /api/v1/payments/vnpay-return`), kiểm tra chữ ký, `vnp_TxnRef`, kiểm tra số tiền khớp 100%, chống lặp idempotency.
4. **Xác nhận thanh toán nguyên tử:** Giao dịch MongoDB ACID có khóa phối hợp `CourtDaySchedule`, cập nhật `PaymentOrder` sang `PAID`, phân bổ thành tiền cho tất cả `Booking` con sang `CONFIRMED/PAID`, lưu `PaymentTransaction`, enqueue email `BOOKING_CONFIRMED` vào `EmailOutbox` và ghi `ActionLog`.
5. **Chống race condition & Callback lặp:** Return và IPN lặp chỉ ghi nhận tiền và email một lần; callback thất bại đến sau thành công không hạ trạng thái đơn đã trả tiền (Criterion 50).
6. **Xử lý ngoại lệ thanh toán:** Chuyển `PaymentOrder` sang `REVIEW` và ghi `PaymentTransaction` với `exceptionType` tương ứng khi:
   - Thanh toán đến muộn sau khi hold đã hết hạn hoặc bị hủy (`LATE_PAYMENT`), không khôi phục lịch đã nhả (Criterion 49).
   - Thanh toán sai số tiền (`WRONG_AMOUNT`), hủy đơn chờ và nhả lịch (Criteria 44, 55).
   - Phát sinh giao dịch thu thêm (`DUPLICATE_PAYMENT`), giữ nguyên đơn hợp lệ, lưu khoản dư để admin xử lý hoàn tiền (Criterion 55).
7. **Ngoại lệ bảo mật IPN/Return:** Không yêu cầu JWT, Cookie phiên hoặc CSRF token (Mục 10.5).
8. **Khách hàng không có tài khoản (`OWNER_ON_BEHALF`):** Truy cập đơn và lấy link VNPay qua mã bí mật `accessCode` đối chiếu `guestAccessCodeHash` (Criterion 52).
9. **Trang kiểm thử return tối thiểu:** Hỗ trợ định dạng HTML fixture phục vụ kiểm thử luồng callback trên trình duyệt mà không cần React.

### 1.2. Kiểm tra tính toàn vẹn tệp bàn giao (SHA-256 Manifest)
Đối chiếu toàn bộ 13 tệp theo bảng mã băm trong [`docs/phase-reports/P11-manifest.sha256`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/docs/phase-reports/P11-manifest.sha256):

| SHA-256 Checksum | Đường dẫn tệp | Loại tệp | Trạng thái |
| :--- | :--- | :--- | :---: |
| `653e2825c137c3e7c361093a5d06ed3b4a6f6f033e363697c8bde09b00dc38d3` | `server/src/integrations/vnpay.client.js` | Tạo mới (VNPay Client) | ✅ KHỚP 100% |
| `d29ee78d64498a8b75d9ac3faf7998f46c1700adcef75af61b1d3d984837bb07` | `server/src/repositories/payment-transaction.repository.js` | Tạo mới (Repository) | ✅ KHỚP 100% |
| `8a86511672646ed7a753fbe6b42769c29c132cd8969870101c8088067abf60ca` | `server/src/services/payment/payment.service.js` | Tạo mới (Core Service) | ✅ KHỚP 100% |
| `95077c1748e44e69088f74287ec0c6f4e5be5c652e65d19c21ccdfd18c916c34` | `server/src/controllers/payment.controller.js` | Tạo mới (Controller) | ✅ KHỚP 100% |
| `f565b31d89e77f9a9790b8903028a65bcfb87289204ae942d7c73fc6dcd388e4` | `server/src/routes/payment.routes.js` | Tạo mới (Router) | ✅ KHỚP 100% |
| `34999923f1ee145391c514cded66ed773c860f5f418809b08a9a940efb6b99bd` | `server/src/routes/index.js` | Chỉnh sửa (Mount `/payments`) | ✅ KHỚP 100% |
| `e74a178d17dd5c289a3f137c4354c40ecc7e46709a91269d4d1bda83b5b473e8` | `server/src/templates/emails/booking-confirmed.template.js` | Tạo mới (Email Template) | ✅ KHỚP 100% |
| `5f3500420645a1dae61764545b878e9c9aa2c24c022ba70ffb5e0548801d2676` | `server/src/templates/emails/index.js` | Chỉnh sửa (Register Template) | ✅ KHỚP 100% |
| `e25868ea1238eb341467ba6d56ffb654361f090e371ead30deb2512f93ee065d` | `server/src/models/action-log.model.js` | Chỉnh sửa (Audit Log Enums) | ✅ KHỚP 100% |
| `7678529a5c26b3a7ba8d4a454210d1c9470099e213d6d67570e812cca7c9b81e` | `server/src/services/booking/booking-request.service.js` | Chỉnh sửa (Auto paymentUrl) | ✅ KHỚP 100% |
| `36f7f211ecba739542349466bef8f34a895e23160a915c2bb88d5ebb7ebef45d` | `server/tests/unit/vnpay-client.test.js` | Tạo mới (Unit Test) | ✅ KHỚP 100% |
| `90bddb1412a2224f9f39f9cce7c6f6086d84de131e62e95822b8b85eac3776b1` | `server/tests/integration/vnpay-payment-flow.test.js` | Tạo mới (Integration Test) | ✅ KHỚP 100% |
| `a2e6d3c053aa03c4cf86806f0d8d5d1aa3176db6b6075d069563da51a22a7728` | `server/tests/integration/vnpay-exceptions.test.js` | Tạo mới (Integration Test) | ✅ KHỚP 100% |

*Kết quả đối chiếu:* 13/13 tệp khớp 100% byte-for-byte với manifest SHA-256 đã nộp.

---

## 2. Đánh giá Chi tiết Từng Tiêu chí

| Tiêu chí | Nội dung đặc tả nghiệp vụ & kiến trúc | Kết quả kỹ thuật | Nhận xét chi tiết của Reviewer |
| :--- | :--- | :---: | :--- |
| **Criterion 44, 46** | **Tạo URL VNPay, quy đổi tiền và đồng bộ thời hạn:** Thu đủ 100% VND × 100, ký HMAC-SHA512 với `VNPAY_HASH_SECRET`, sắp xếp tham số A–Z. `vnp_ExpireDate` khớp chính xác `holdExpiresAt` (10 phút). | **ĐẠT** | Triển khai tại `vnpay.client.js` (`createPaymentUrl`). Sắp xếp tham số chuẩn xác, encode `+` cho khoảng trắng, tính toán HMAC-SHA512; kiểm tra ngày `formatDateToVnpay` theo múi giờ GMT+7. Unit tests kiểm tra chữ ký đạt 100%. |
| **Section 8.6 Khoản 3** | **Mở lại thanh toán:** Cho phép mở lại URL trên cùng `PaymentOrder` còn hạn; không tạo order song song, không thay đổi hạn giữ chỗ hoặc đơn giá đã chốt. | **ĐẠT** | `createPaymentUrl` trong `payment.service.js` kiểm tra trạng thái `PENDING` và `now < expiresAt`, tái sử dụng nguyên vẹn `vnpayTxnRef` và `expectedAmountVnd` của PaymentOrder đã có. |
| **Criterion 45, 48** | **Logic callback hợp nhất & Độc lập phiên:** Return và IPN dùng chung logic `processVNPayCallback`. IPN không phụ thuộc JWT/cookie hoặc người dùng có quay lại web hay không. | **ĐẠT** | `processVNPayCallback` trong `payment.service.js` phục vụ cả hai luồng. Endpoint IPN và Return công khai tại `payment.routes.js`, không gắn middleware `authenticate` hoặc CSRF guard (tuân thủ Mục 10.5). |
| **Criteria 39, 44** | **Phân bổ giao dịch và xác nhận nguyên tử:** Phân bổ khoản thu 100% cho tất cả `Booking` con; lưu `PaymentTransaction`, chuyển `CONFIRMED/PAID` và enqueue email `BOOKING_CONFIRMED` trong một MongoDB transaction có khóa `CourtDaySchedule`. | **ĐẠT** | Triển khai trong block `withTransaction` kết hợp `acquireCoordinationLock` trên sân/ngày. Cập nhật đồng loạt child bookings sang `CONFIRMED/PAID`, phân bổ `allocatedAmountVnd`, ghi `payment_transactions` (`isAccepted: true`), đưa sự kiện `BOOKING_CONFIRMED` vào `EmailOutbox` và ghi `ActionLog`. |
| **Criteria 47, 55** | **Chống ghi nhận lặp Idempotency:** Callback trùng/lặp chỉ ghi nhận tiền và gửi email một lần (trả `RspCode: '02'`). Giao dịch thu thêm có `transactionNo` khác được lưu ngoại lệ `DUPLICATE_PAYMENT`. | **ĐẠT** | Đã kiểm thử qua subtest 2 & 3 của `vnpay-exceptions.test.js`. Trả phản hồi `02 Order already confirmed` khi trùng `vnpayTransactionNo`. Thu thêm khác mã được ghi nhận vào `payment_transactions` với `exceptionType: 'DUPLICATE_PAYMENT'`, giữ nguyên đơn hợp lệ. |
| **Criterion 50** | **Xử lý thất bại callback:** Callback thất bại đóng PaymentOrder chờ (`CLOSED/FAILED_PAYMENT`) và hủy các Booking chờ; callback thất bại đến sau thành công tuyệt đối không hạ đơn đã `PAID`. | **ĐẠT** | Kiểm thử qua subtest 6 của `vnpay-exceptions.test.js`. Đơn đã `PAID` nhận callback thất bại vẫn giữ nguyên trạng thái `PAID` và `CONFIRMED`. |
| **Criteria 44, 49, 55** | **Xử lý ngoại lệ (Late Payment & Wrong Amount):** Thanh toán đến muộn sau khi hold hết hạn/hủy (`LATE_PAYMENT`) hoặc thanh toán sai tiền (`WRONG_AMOUNT`) chuyển PaymentOrder sang `REVIEW`, lưu giao dịch ngoại lệ, không tự chiếm lại lịch và không bỏ qua tiền thực nhận. | **ĐẠT** | Kiểm thử qua subtest 4 & 5 của `vnpay-exceptions.test.js`. Khi sai tiền hoặc quá hạn, PaymentOrder chuyển `REVIEW`, Booking chuyển `CANCELLED` hoặc `EXPIRED`, `PaymentTransaction` lưu `exceptionType` tương ứng và trả mã IPN chuẩn cho VNPay. |
| **Criterion 52** | **Đơn do chủ sân tạo hộ (`OWNER_ON_BEHALF`):** Khách không có tài khoản truy cập qua mã bí mật `accessCode` đối chiếu `guestAccessCodeHash`, lấy link VNPay nếu còn hạn; email xác nhận gửi riêng cho chủ sân (Criterion 42). | **ĐẠT** | Triển khai tại `getGuestPaymentOrder` và `payment.controller.js`. Kiểm tra băm SHA-256 mã `accessCode`. Email xác nhận trong outbox lấy người nhận từ `User` chủ sân khi đơn là `OWNER_ON_BEHALF`. |
| **Plan P11 Fixture** | **Trang return tối thiểu:** Hỗ trợ render HTML fixture khi browser yêu cầu `Accept: text/html`. | **ĐẠT** | `handleVNPayReturn` kiểm tra `Accept` header và trả về trang HTML trạng thái đẹp mắt, rõ ràng mà không cần phụ thuộc mã nguồn React. |
| **Ranh giới Phase & Cổng BE_READY** | Không triển khai P12 (RefundCase/hoàn tiền); không tạo mã nguồn React/frontend; cổng `BE_READY` tiếp tục `CLOSED`. | **ĐẠT** | Thư mục `client/` không tồn tại, kiểm tra `check-phase` đạt chuẩn, không có logic hoàn tiền thủ công của P12. |

---

## 3. Kiểm chứng Độc lập Đã Chạy

Reviewer đã trực tiếp chạy kiểm chứng toàn diện trên môi trường local (Windows PowerShell, Node.js v22+, MongoDB Replica Set `rs0` cổng 27018):

### 3.1. Kiểm tra cú pháp toàn dự án (`npm run lint`)
```text
> server@1.0.0 lint
> node -e "const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process'); function walk(d) { return fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []) : []; } const files = [...walk('src'), ...walk('tests')]; files.forEach(f => execFileSync(process.execPath, ['--check', f])); console.log('Syntax check passed for ' + files.length + ' backend files.');"

Syntax check passed for 153 backend files.
```
*Kết quả:* **PASS** (153/153 backend files hợp lệ cú pháp).

### 3.2. Bộ kiểm thử P11 (Unit & Integration)
```bash
node --test --test-concurrency=1 server/tests/unit/vnpay-client.test.js server/tests/integration/vnpay-payment-flow.test.js server/tests/integration/vnpay-exceptions.test.js
```
```text
TAP version 13
ok 1 - VNPay Payment Exceptions & Edge Cases (Integration - P11)
ok 2 - VNPay Payment Flow & IPN Callback (Integration - P11)
ok 3 - VNPay Client Unit Tests
1..3
# tests 19
# suites 4
# pass 19
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3187.9966
```
*Kết quả:* **PASS** (19/19 tests đạt 100%).

### 3.3. Toàn bộ kiểm thử hệ thống hồi quy (`npm test`)
```bash
npm test
```
```text
TAP version 13
...
1..44
# tests 284
# suites 39
# pass 284
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 36486.3311
```
*Kết quả:* **PASS** (284/284 tests toàn hệ thống đạt 100%, 39 test suites chạy qua không lỗi).

### 3.4. Quản trị Phase & Cổng Frontend (`npm run check:phase`)
```text
--- Kiểm tra trạng thái phase và cấu trúc dự án (check-phase) ---
✅ Cấu trúc docs/planning/phase-status.json hợp lệ và tuân thủ thứ tự tuần tự.
✅ Kiểm tra cổng frontend: Tuân thủ quy định không triển khai React trước gate BE_READY.
🎉 Toàn bộ kiểm tra phase và ranh giới hệ thống: ĐẠT CHUẨN.
```
*Kết quả:* **PASS**.

### 3.5. Đồng bộ Database & Indexes
- `npm run db:ensure-rs`: Replica Set `rs0` hoạt động trên port 27018. (**PASS**)
- `npm run db:indexes`: Đồng bộ thành công 17 models, bao gồm `PaymentTransaction` và `PaymentOrder`. (**PASS**)

---

## 4. Đánh giá Khắc phục Thiếu sót Lượt trước

1. **Báo cáo triển khai `docs/phase-reports/P11.md`:** Đã hoàn thiện toàn bộ các mục, cập nhật kết quả kiểm chứng, tệp tạo mới/chỉnh sửa, và kết luận bàn giao ở trạng thái `READY_FOR_REVIEW`. (**ĐẠT**)
2. **Bảng mã băm `docs/phase-reports/P11-manifest.sha256`:** Đã được tạo đầy đủ với 13 tệp bàn giao, đối chiếu khớp 100% byte-for-byte. (**ĐẠT**)

---

## 5. Quyết định Nghiệm thu

- Căn cứ vào kết quả kiểm tra mã nguồn, đối chiếu tài liệu đặc tả, kiểm tra tính toàn vẹn 13 tệp bàn giao theo manifest, và chạy kiểm chứng độc lập đạt 100% (284/284 tests PASS, 153 files lint PASS):
- **Trạng thái nghiệm thu Phase P11: ACCEPTED**
- **Căn cứ nghiệm thu (`accepted_revision`):** `docs/phase-reports/P11-manifest.sha256`
- **Cổng `BE_READY`:** Tiếp tục **CLOSED** (Không triển khai React trước P14).
- **Phase kế tiếp:** Phase P12 (Hồ sơ hoàn tiền và hỗ trợ ngoại lệ).
