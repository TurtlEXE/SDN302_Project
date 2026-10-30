# Bộ Kiểm Thử Xuyên Hệ Thống (End-to-End Test Suite)

Tài liệu hướng dẫn và đặc tả bộ kiểm thử E2E liên vai trò phục vụ nghiệm thu **RELEASE-READY** (Phase P20) của nền tảng đặt sân thể thao **SportBooking Platform**.

---

## 1. Mục tiêu & Phạm vi

Bộ kiểm thử E2E (`tests/e2e/release-ready-e2e.test.js`) thực thi kịch bản tích hợp hoàn chỉnh xuyên suốt toàn bộ các tầng nghiệp vụ:
**Khách hàng (Customer) ↔ Chủ sân (Owner) ↔ Quản trị viên (Admin) ↔ Hệ thống Cổng thanh toán (VNPay Gateway) ↔ Hàng đợi Email (Email Outbox)**.

Mọi kịch bản đều kiểm chứng tính toàn vẹn dữ liệu, các ràng buộc ACID transaction của MongoDB replica set, kiểm soát xung đột đồng thời (concurrency hold lock 10 phút), chữ ký số HMAC-SHA512 VNPay, tính lũy kế (idempotency), và các cơ chế phòng vệ bảo mật (RBAC, CSRF/Origin Guard, Token Revocation).

---

## 2. Danh mục 14 Kịch bản Kiểm thử Liên vai trò

1. **System Health & Initial Actor Setup:** Kiểm tra endpoint `/api/v1/health` và `/api/v1/ready`. Khởi tạo Admin hệ thống và tạo danh mục môn thể thao (`/api/v1/admin/sports`).
2. **Admin cấp tài khoản Owner & Kích hoạt:** Admin cấp tài khoản Owner (`/api/v1/admin/users/owners`), hệ thống sinh token và lưu `OWNER_ACTIVATION` vào `EmailOutbox`. Owner kiểm tra token hợp lệ và thiết lập mật khẩu qua `/api/v1/auth/activate-owner`, sau đó đăng nhập lấy Bearer token.
3. **Khách hàng Đăng ký & Xác thực Email:** Khách hàng đăng ký tài khoản (`/api/v1/auth/register`), lấy token xác thực từ `EmailOutbox`, xác thực email (`/api/v1/auth/verify-email`) và đăng nhập nhận JWT. Khởi tạo khách hàng phụ để kiểm tra xung đột đặt sân.
4. **Owner cấu hình Cơ sở, Môn & Sân, Công khai:** Owner tạo cơ sở thể thao (`/api/v1/owner/facilities`), cấu hình môn với bước nhảy 60 phút và bảng giá (`/api/v1/owner/facilities/:id/sports`), tạo sân đấu (`/api/v1/owner/courts`), chuyển trạng thái sang `PUBLISHED`. Khách hàng tìm kiếm công khai thấy sân đấu hiển thị.
5. **Truy vấn Lịch & Đặt sân Giữ chỗ (Hold Lock):** Khách hàng xem lịch trống ngày chỉ định (`/api/v1/courts/:courtId/schedule`), đặt slot liền kề. Hệ thống khóa giữ chỗ 10 phút (`PENDING_PAYMENT`), tạo `PaymentOrder`. Kiểm tra đồng thời: khách hàng khác đặt trùng slot lập tức bị chặn với mã lỗi HTTP 409 Conflict.
6. **Thanh toán VNPay & Xử lý Webhook Idempotent:** Hệ thống sinh URL thanh toán VNPay chuẩn HMAC-SHA512 với hệ số `x100`. Giả lập IPN webhook với chữ ký hợp lệ: đơn hàng chuyển sang `PAID`, booking chuyển sang `CONFIRMED/PAID`, email xác nhận đặt sân được xếp vào `EmailOutbox`. Gọi lại IPN lần 2 với cùng dữ liệu: hệ thống xử lý idempotent thành công (`RspCode: 00`) không nhân đôi giao dịch.
7. **Phục vụ Khách & Hoàn tất Dịch vụ:** Khách hàng kiểm tra lịch sử đặt sân (`/api/v1/bookings`). Owner kiểm tra danh sách đơn đặt của cơ sở (`/api/v1/owner/bookings`) và ghi nhận hoàn tất dịch vụ (`/api/v1/owner/bookings/:id/complete`).
8. **Khách hàng Hủy giữ chỗ trong thời gian Hold:** Khách hàng chủ động hủy yêu cầu đặt sân đang chờ thanh toán (`/api/v1/booking-requests/:id/cancel`). Slot sân lập tức được giải phóng để khách hàng khác có thể đặt ngay.
9. **Hủy bất khả kháng bởi Admin/Host & Quy trình Hoàn tiền (Refund Case):** Đơn đặt sân đã thanh toán bị hủy do sự cố bất khả kháng (`/api/v1/admin/bookings/:id/cancel-and-refund`). Hệ thống tự động tạo `RefundCase` trạng thái `PENDING`. Admin tra cứu danh sách hoàn tiền và thực hiện ghi nhận hoàn tiền thủ công kèm mã chứng từ giao dịch (`proofReference`), trạng thái chuyển sang `PROCESSED`.
10. **Bảo mật Chữ ký VNPay & Chống giả mạo:** Gửi IPN với chữ ký sai hoặc sai lệch số tiền; hệ thống từ chối với mã lỗi `97` (Sai checksum) hoặc `04` (Sai số tiền).
11. **Phân quyền RBAC & Cô lập Đa người thuê (Tenant Isolation):** Khách hàng không thể gọi API của Owner hoặc Admin (HTTP 403 Forbidden). Chủ sân A không thể xem hoặc can thiệp cơ sở/sân của Chủ sân B (HTTP 403/404).
12. **Bảo mật Phiên & Thu hồi Token tức thì:** Khi Admin khóa tài khoản (`/api/v1/admin/users/:id/lock`), token JWT trong RAM của người dùng bị vô hiệu hóa ngay lập tức (HTTP 401 Unauthorized do tokenVersion không khớp).
13. **Phòng vệ CSRF & Origin Guard:** Mọi request thay đổi trạng thái (POST/PUT/PATCH/DELETE) gửi từ Origin lạ không nằm trong danh sách whitelist đều bị từ chối với HTTP 403 Forbidden.
14. **Bảng điều khiển Vận hành & Doanh thu:** Owner Dashboard và Admin Dashboard trả về đầy đủ các chỉ số thống kê doanh thu, trạng thái đơn, và công suất sân.

---

## 3. Cách chạy kiểm thử

### Yêu cầu môi trường
- Node.js >= 20.x
- MongoDB Replica Set đang chạy (mặc định cổng 27017, database test `sport_booking_test`).
- File cấu hình môi trường `.env` hợp lệ.

### Lệnh thực thi
```bash
# Chạy toàn bộ bộ test E2E từ thư mục gốc
npm run test:e2e

# Hoặc chạy trực tiếp với Node test runner
node --test tests/e2e/release-ready-e2e.test.js
```
