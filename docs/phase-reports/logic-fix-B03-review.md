# Báo cáo Review Độc lập: Logic Fix B03 — Bảng giá sân theo khung giờ & loại ngày, Lịch hoạt động theo ngày trong tuần

> Ngày review: 31/10/2026  
> Vai trò: Independent Code Reviewer (Độc lập)  
> Đối tượng review: Batch B03 (`docs/phase-reports/logic-fix-B03.md`, HEAD revision `fcb9231ed39f8845ccc023424112676fb042a45d`)  
> Kết luận sơ bộ: **NEEDS_CHANGES** (Phát hiện 1 lỗi P2 về trải nghiệm bị tắc nghẽn khi giá thay đổi tại trang Checkout, 2 góp ý P3 về fallback ước lượng giá và migration log)

---

## 1. Phạm vi và Đối chiếu Hợp đồng B03

### 1.1. Tài liệu và Mã nguồn Đối chiếu
- Quy tắc dự án: `AGENTS.md` (Workspace & Project).
- Báo cáo triển khai batch: `docs/phase-reports/logic-fix-B03.md`.
- Đặc tả nghiệp vụ & kiến trúc: `docs/features.md`, `docs/architecture.md` (Mục 7 & 8).
- Tài liệu hợp đồng API: `docs/api.openapi.yaml`.
- Mã nguồn backend:
  - `server/src/models/court.model.js`
  - `server/src/models/facility.model.js`
  - `server/src/models/booking.model.js`
  - `server/src/utils/date-time.js`
  - `server/src/services/booking/pricing.js`
  - `server/src/services/booking/schedule.service.js`
  - `server/src/services/booking/booking-request.service.js`
  - `server/src/controllers/booking-request.controller.js`
  - `server/src/routes/booking-request.routes.js`
  - `server/src/repositories/court.repository.js`
  - `server/src/services/court.service.js`
  - `server/src/services/facility.service.js`
  - `server/scripts/migrations/migrate-b03-pricing-weekly.js`
- Mã nguồn frontend:
  - `client/src/utils/slot-helper.js`
  - `client/src/services/booking.service.js`
  - `client/src/components/schedule/CourtSchedule.jsx`
  - `client/src/components/schedule/SelectedRangesSummary.jsx`
  - `client/src/pages/checkout/CheckoutPage.jsx`
  - `client/src/pages/owner/OwnerFacilitiesPage.jsx`
  - `client/src/pages/owner/OwnerOnBehalfPage.jsx`
- Kiểm thử đã thực hiện:
  - `node --test server/tests/unit/pricing.test.js` (11/11 PASS)
  - `node --test server/tests/integration/logic-fix-b03-flow.test.js` (9/9 PASS trên Replica Set)
  - `node --test server/tests/integration/court-schedule-api.test.js` (PASS)

### 1.2. Đối chiếu Checklist B03

| STT | Tiêu chí Checklist B03 | Đánh giá | Bằng chứng & Ghi chú |
| :--- | :--- | :---: | :--- |
| 1 | **Giá theo đúng sân, khung giờ và loại ngày** | **ĐẠT** | `Court.pricingRules` lưu mảng theo `dayType` (`WEEKDAY`/`WEEKEND`), `startTime`, `endTime`, `pricePerHourVnd`. Xác định đúng thứ trong tuần theo `Asia/Ho_Chi_Minh`. |
| 2 | **Chặn quy tắc chồng lấn; thiếu giá không trở thành 0đ hoặc âm thầm dùng giá cũ** | **ĐẠT** | Backend `validatePricingRules` ném 400 nếu khung giờ cùng loại ngày giao nhau (`startA < endB && startB < endA`). `sliceIntervalPricing` ném 400 Bad Request nếu khoảng đặt bị khuyết rule, tuyệt đối không tính 0đ. |
| 3 | **Khoảng vượt nhiều mức giá tính đúng; quy tắc làm tròn nhất quán** | **ĐẠT** | Tách khoảng gộp thành các đoạn con theo từng rule, áp dụng `Math.round((durationMinutes / 60) * pricePerHourVnd)` cho từng đoạn và cộng tổng. |
| 4 | **Ví dụ bắt buộc: 17:30–18:30 với 100k (trước 18h) và 150k (sau 18h) phải ra 125.000đ** | **ĐẠT** | Unit test `server/tests/unit/pricing.test.js` dòng 75 kiểm chứng chính xác: 30p x 100.000đ/60 = 50.000đ; 30p x 150.000đ/60 = 75.000đ; tổng = 125.000đ. |
| 5 | **Báo giá chính thức do server tính; thay đổi giá yêu cầu xác nhận lại** | **ĐẠT TẠI BACKEND, THIẾU THAO TÁC Ở FRONTEND** | Backend cung cấp endpoint `POST /api/v1/booking-requests/quote`, kiểm tra `priceVersion` và `expectedAmountVnd`. Nếu giá lệch trả về 409 `CONFIG_VERSION_MISMATCH`. Tuy nhiên client `CheckoutPage.jsx` chưa có cơ chế bấm xác nhận lại giá mới (Xem Finding B03-1). |
| 6 | **Đơn đã tạo giữ snapshot giá và tổng thanh toán cũ** | **ĐẠT** | `Booking.pricingSnapshot` lưu chi tiết từng đoạn. PaymentOrder và Booking không bao giờ tính lại giá khi người dùng retry thanh toán. |
| 7 | **Lịch tuần/ngày nghỉ áp dụng đồng nhất cho lịch, báo giá và tạo đơn** | **ĐẠT** | `weeklySchedule` xác định `isOpen`, `openTime`, `closeTime` cho từng thứ. Áp dụng đồng bộ trong `schedule.service.js`, `pricing.js` và `booking-request.service.js`. |
| 8 | **Migration bảo toàn dữ liệu cũ, chạy lại an toàn; kiểm tra cả cơ sở nghỉ và trường hợp cấu hình thiếu** | **ĐẠT** | Script `migrate-b03-pricing-weekly.js` là idempotent. Cơ sở chưa có `weeklySchedule` được tạo từ `operatingHours`. Sân chưa có `pricingRules` được sinh rule mặc định từ `court.pricePerHourVnd`. Chạy lại không làm mất các rule tùy chỉnh đã có. |
| 9 | **Giá “từ”, bộ lọc và sắp xếp có cùng ý nghĩa với bảng giá mới** | **ĐẠT** | Thuộc tính `court.pricePerHourVnd` được tự động cập nhật là giá nhỏ nhất (`min`) trong các `pricingRules` của sân, đóng vai trò "giá từ" phục vụ truy vấn, lọc và hiển thị. |
| 10 | **Không lộ hoặc cho owner khác sửa bảng giá/lịch** | **ĐẠT** | Endpoint cập nhật bảng giá và lịch tuần kiểm tra nghiêm ngặt quyền sở hữu `facility.ownerId.toString() === req.user.id.toString()`. |
| 11 | **Không tái tạo lỗi đồng thời đã sửa ở B02** | **ĐẠT** | Khi cập nhật `weeklySchedule` hoặc `pricingRules`, transaction vẫn gọi `touchCoordinationForCourts`, đồng thời tăng `operatingHoursVersion` hoặc `priceVersion`, serialize an toàn với luồng đặt sân. |

---

## 2. Danh sách Findings chi tiết

### Finding B03-1 (P2 — Functional / Usability: Giao diện Checkout bị kẹt vòng lặp vô hạn khi giá thay đổi)
- **Tên lỗi**: `CheckoutPage.jsx` hiển thị thông báo lỗi nhưng không cung cấp nút bấm hoặc cơ chế cho người dùng cập nhật/xác nhận lại báo giá mới khi server trả lỗi 409 `CONFIG_VERSION_MISMATCH` do thay đổi bảng giá (`expectedAmountVnd`).
- **File & dòng**: `client/src/pages/checkout/CheckoutPage.jsx#L138-L146`
- **Nguyên nhân**:
  - Khi chủ sân đổi bảng giá, `priceVersion` hoặc đơn giá thay đổi.
  - Khi người dùng bấm "Thanh toán VNPay ngay", backend ném lỗi 409 `CONFIG_VERSION_MISMATCH` với message:
    `"Báo giá đã thay đổi từ X sang Y. Vui lòng xác nhận lại số tiền trước khi tiếp tục."` kèm theo `data: { calculatedAmount: Y, priceVersion: newVersion }`.
  - Tại `CheckoutPage.jsx`:
    ```javascript
    } catch (err) {
      if (err.response?.status === 409) {
        setError(err.response.data?.message || 'Cấu hình sân đã thay đổi. Vui lòng kiểm tra lại.');
      } else { ... }
    }
    ```
  - State của trang checkout (`draft.expectedAmountVnd`, `draft.totalPriceVnd`, `draft.priceVersion`) không được cập nhật sang giá trị mới `Y`.
  - Không có nút hành động như "Đồng ý số tiền mới và tiếp tục" hoặc "Tải lại báo giá".
- **Kịch bản người dùng**:
  1. Khách hàng thấy thông báo lỗi màu đỏ: *"Báo giá đã thay đổi từ 100.000đ sang 120.000đ. Vui lòng xác nhận lại số tiền trước khi tiếp tục."*.
  2. Khách hàng nhìn thấy tổng tiền trên màn hình vẫn ghi 100.000đ.
  3. Khách hàng bấm lại nút "Thanh toán VNPay ngay" với kỳ vọng hệ thống sẽ tiếp tục.
  4. Client lại gửi payload cũ với `expectedAmountVnd: 100000`, server tiếp tục trả về 409.
  5. Người dùng bị mắc kẹt hoàn toàn trên màn hình Checkout, buộc phải tự hiểu và ấn quay lại trang chi tiết cơ sở để chọn lại từ đầu.
- **Ảnh hưởng**: Vi phạm yêu cầu hợp đồng B03: *"Khi bảng giá thay đổi giữa xem lại và tạo đơn, yêu cầu khách xác nhận lại báo giá mới; không tự chuyển VNPay với số tiền khác"*. Việc yêu cầu xác nhận phải đi kèm cơ chế xác nhận tại UI.
- **Hướng sửa đề xuất**:
  Khi bắt lỗi 409 có `data.calculatedAmount` (hoặc `err.response.data.data.calculatedAmount`):
  1. Hiển thị thông báo xác nhận giá mới rõ ràng kèm số tiền mới và số tiền cũ.
  2. Bổ sung nút: `"Chấp nhận giá mới (Y đ) & Thanh toán"`.
  3. Khi bấm nút, cập nhật `draft.expectedAmountVnd = Y`, cập nhật `draft.priceVersion`, cập nhật `sessionStorage` và kích hoạt lại submit đơn.

---

### Finding B03-2 (P3 — Consistency: Lệch pha xử lý khe thiếu giá giữa client helper và backend pricing)
- **Tên lỗi**: Hàm `calculateEstimatedPrice` trong `client/src/utils/slot-helper.js` áp dụng giá dự phòng (`fallbackPrice`) khi gặp khoảng thời gian thiếu quy tắc giá, trong khi backend `pricing.js` (`sliceIntervalPricing`) nghiêm ngặt ném lỗi 400 Bad Request.
- **File & dòng**: `client/src/utils/slot-helper.js#L152-L156`
- **Chi tiết**:
  - Tại client:
    ```javascript
    if (applicableRules.length === 0) {
      total += Math.round((dur / 60) * fallbackPrice);
    }
    ```
  - Tại backend:
    ```javascript
    if (!matchedRule) {
      const err = new Error(`Khoảng thời gian ${segStart}-${segEnd} chưa được cấu hình giá.`);
      err.statusCode = 400;
      throw err;
    }
    ```
  - Mặc dù tại B04, giao diện lịch đã vô hiệu hóa không cho chọn các ô `NO_PRICE`, nhưng sự khác biệt này trong helper có thể dẫn tới việc client hiển thị giá tạm tính khác với phản hồi lỗi của server nếu có ô chưa được cấu hình giá lọt vào draft cũ. Nên đồng bộ client helper trả về `null` hoặc cảnh báo `CHƯA_CÓ_GIÁ`.

---

### Finding B03-3 (P3 — Migration: Cần ghi log cảnh báo khi cơ sở thiếu giờ hoạt động trong script migration)
- **File & dòng**: `server/scripts/migrations/migrate-b03-pricing-weekly.js#L35`
- **Chi tiết**: Khi cơ sở cũ thiếu dữ liệu `operatingHours.openTime/closeTime`, script tự động fallback về `06:00 - 22:00`. Đây là giải pháp an toàn để migration không bị gãy, tuy nhiên nên ghi rõ log mức `WARN` kèm `facilityId` để quản trị viên kiểm tra lại cấu hình thực tế của cơ sở đó.

---

## 3. Kết luận và Khuyến nghị

1. **Trạng thái Batch B03**: **NEEDS_CHANGES**.
2. **Lý do**: Thuật toán chia đoạn giá, tính tiền lũy tiến, snapshot giá và migration đạt độ hoàn thiện rất cao; tuy nhiên luồng xử lý 409 đổi giá tại `CheckoutPage.jsx` chưa hoàn chỉnh (bị lặp vô hạn, thiếu nút xác nhận lại giá mới).
3. **Cổng kiểm thử (Quality Gates)**: Tiếp tục duy trì `BE_READY` = `STALE` và `RELEASE_READY` = `STALE`.
4. **Hành động tiếp theo**: Bổ sung cơ chế cập nhật và chấp nhận báo giá mới trên `CheckoutPage.jsx` khi nhận mã lỗi 409 từ server.

