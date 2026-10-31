# Báo cáo Review Độc lập: Logic Fix B02 — Điều kiện nhận đặt, đồng thời và múi giờ

> Ngày review: 31/10/2026  
> Vai trò: Independent Code Reviewer (Độc lập)  
> Đối tượng review: Batch B02 (`docs/phase-reports/logic-fix-B02.md`, HEAD revision `fcb9231ed39f8845ccc023424112676fb042a45d`)  
> Kết luận sơ bộ: **NEEDS_CHANGES** (Phát hiện 1 lỗi P1 ngăn cản chủ sân tạo lịch bảo trì sân tại giao diện do sai lệch DTO ID, 1 góp ý P3 về test mock)

---

## 1. Phạm vi và Đối chiếu Hợp đồng B02

### 1.1. Tài liệu và Mã nguồn Đối chiếu
- Quy tắc dự án: `AGENTS.md` (Workspace & Project).
- Báo cáo triển khai batch: `docs/phase-reports/logic-fix-B02.md`.
- Đặc tả nghiệp vụ & kiến trúc: `docs/features.md` (Tiêu chí 6, 9, 11, 14, 15, 17, 18, 21, 22, 26, 27, 28, 29, 30, 31, 32, 33, 34, 46, 51, 56, 60, 175, 179, 249, 250, 252), `docs/architecture.md` (Mục 7 & 8).
- Tài liệu hợp đồng API: `docs/api.openapi.yaml`.
- Mã nguồn backend:
  - `server/src/models/court.model.js`
  - `server/src/repositories/court.repository.js`
  - `server/src/repositories/facility-sport.repository.js`
  - `server/src/services/facility.service.js`
  - `server/src/services/booking/schedule.service.js`
  - `server/src/services/booking/booking-request.service.js`
  - `server/src/services/booking/court-block.service.js`
- Mã nguồn frontend:
  - `client/src/utils/slot-helper.js`
  - `client/src/components/schedule/CourtSchedule.jsx`
  - `client/src/components/schedule/SelectedRangesSummary.jsx`
  - `client/src/pages/checkout/CheckoutPage.jsx`
  - `client/src/pages/owner/OwnerOnBehalfPage.jsx`
  - `client/src/pages/owner/OwnerCourtBlocksPage.jsx`
- Kiểm thử đã thực hiện:
  - `node --test server/tests/integration/logic-fix-b02-flow.test.js` (MongoDB Replica Set rs0 trên cổng 27018: 9/9 PASS)
  - `npm --prefix client test src/utils/__tests__/slot-helper.test.js` (Vitest: 15/15 PASS)

### 1.2. Đối chiếu Checklist B02

| STT | Tiêu chí Checklist B02 | Đánh giá | Bằng chứng & Ghi chú |
| :--- | :--- | :---: | :--- |
| 1 | **Owner bị khóa không thể tiếp tục nhận đơn qua ID/link cũ** | **ĐẠT** | `getPublicFacilityById` và `getCourtSchedule` trả 404 `FACILITY_NOT_FOUND` khi `owner.isLocked || !owner.activatedAt`. `createBookingRequest` kiểm tra trong session transaction và trả 403 `FACILITY_NOT_FOUND`. |
| 2 | **Điều kiện công khai/nhận đặt thống nhất ở tìm kiếm, chi tiết, lịch và tạo đơn** | **ĐẠT** | Đồng bộ điều kiện `facility.status === 'PUBLISHED'`, `!facility.isLockedByAdmin`, `!owner.isLocked`, `owner.activatedAt != null`. Mở khóa chủ sân phục hồi bình thường, cơ sở `PAUSED` giữ nguyên trạng thái. |
| 3 | **Không tự hủy hoặc thay đổi tiền của đơn đã xác nhận trái đặc tả** | **ĐẠT** | Không có trigger hay job tự hủy đơn `CONFIRMED`/`PAID` khi owner bị khóa; không tự hoàn tiền. Subtest 1 kiểm chứng `booking.status` vẫn giữ nguyên. |
| 4 | **Sửa giờ/bước giờ và tạo Booking/CourtBlock thực sự có cơ chế phối hợp ghi** | **ĐẠT** | Bổ sung `touchCoordination` (`$inc: { bookingCoordinationVersion: 1 }`) trên `Court` trong cùng session transaction cho cả 3 luồng: `updateOwnerFacility`, `updateFacilitySportStep`, `createBookingRequest`, `createCourtBlock`. |
| 5 | **Không coi transaction chỉ đọc các document khác nhau là đủ ngăn write skew** | **ĐẠT** | Giải quyết triệt để Write Skew: Giao thoa write set trên document `Court` kích hoạt Snapshot Isolation Write Conflict trên Replica Set, buộc 1 transaction fail và bên còn lại được serialize an toàn. Subtest 3, 4, 5 kiểm chứng đồng thời bằng `Promise.allSettled`. |
| 6 | **Phiên bản giờ hoạt động và bước giờ được kiểm tra đúng** | **ĐẠT** | `operatingHoursVersion` được trả từ schedule API, lưu vào draft, gửi qua `createBookingRequest`, đối chiếu bắt buộc và ném 409 `CONFIG_VERSION_MISMATCH` khi không khớp. Khi đổi giờ hoạt động, `incrementConfigVersionForFacility` tăng đồng thời `configVersion` của `FacilitySport`. |
| 7 | **Ngày nghiệp vụ thống nhất Asia/Ho_Chi_Minh, kể cả trình duyệt ở timezone khác** | **ĐẠT** | Helper `getTodayVN()`, `addDaysVN()`, `getMaxBookingDateVN()`, `getValidDateList()` sử dụng `Intl.DateTimeFormat` múi giờ `Asia/Ho_Chi_Minh`. Loại bỏ hoàn toàn `toISOString().split('T')[0]`. |
| 8 | **Biên nửa đêm, cuối tháng/năm và cửa sổ 30 ngày đúng** | **ĐẠT** | Test suite bao phủ đầy đủ các mốc: 00:30 VN, 06:59 VN (tránh trôi về ngày hôm trước theo UTC), 31/01 -> 01/02, 28/02 -> 01/03, 31/12 -> 01/01, và cửa sổ [today, today + 30 ngày]. |

---

## 2. Danh sách Findings chi tiết

### Finding B02-1 (P1 — Functional / UI Runtime Blocker: Chủ sân không thể tạo lịch khóa/bảo trì sân)
- **Tên lỗi**: Màn hình `OwnerCourtBlocksPage.jsx` đọc sai thuộc tính định danh sân và cơ sở (`fac._id`, `court._id` thay vì `fac.id`, `court.id`), khiến `selectedFacilityId` và `selectedCourtId` bị `undefined`, vô hiệu hóa tính năng tạo CourtBlock của chủ sân trên trình duyệt.
- **File & dòng**:
  - `client/src/pages/owner/OwnerCourtBlocksPage.jsx#L44`: `setSelectedFacilityId(facs[0]._id)`
  - `client/src/pages/owner/OwnerCourtBlocksPage.jsx#L68`: `setSelectedCourtId(courtsRes.courts[0]._id)`
  - `client/src/pages/owner/OwnerCourtBlocksPage.jsx#L203`: `<option key={f._id} value={f._id}>`
  - `client/src/pages/owner/OwnerCourtBlocksPage.jsx#L286`: `setTargetCourtId(crts[0]._id)`
  - `client/src/pages/owner/OwnerCourtBlocksPage.jsx#L309`: `<option key={c._id} value={c._id}>`
- **Nguyên nhân gốc**:
  - `facilityRepository.toDTO` trả về: `{ id: facility._id.toString(), ... }`.
  - `courtRepository.toDTO` trả về: `{ id: court._id.toString(), ... }`.
  - Cả hai DTO tầng backend đều chuẩn hóa thuộc tính ID là `id`, không trả về `_id`.
  - Tại B01, file `OwnerOnBehalfPage.jsx` đã được sửa sang `fac.id || fac._id` và `court.id || court._id`. Nhưng `OwnerCourtBlocksPage.jsx` bị bỏ sót, vẫn truy cập trực tiếp `fac._id` và `court._id`.
- **Kịch bản lỗi tại runtime**:
  1. Chủ sân đăng nhập và truy cập trang Quản lý khóa sân (`/owner/court-blocks`).
  2. Component gọi API lấy danh sách cơ sở: `facilityService.getMyFacilities()`.
  3. Kết quả trả về mảng các cơ sở dạng `[{ id: 'fac-123', facilityName: 'Sân bóng ABC' }]`.
  4. Code thực thi: `setSelectedFacilityId(facs[0]._id)` -> gán `selectedFacilityId = undefined`.
  5. Thẻ `<select value={selectedFacilityId}>` với `<option value={f._id}>` render `<option value="">`.
  6. Khi chủ sân bấm "Thêm lịch khóa", hàm `handleCreateBlock` kiểm tra `if (!targetCourtId) { setError('Vui lòng chọn sân'); return; }` hoặc gửi payload với `courtId: undefined`. Request gửi lên API bị từ chối với lỗi 400 Bad Request.
- **Ảnh hưởng**: Chủ sân không thể thực hiện khóa sân bảo trì/sửa chữa qua giao diện web. Đây là tính năng cốt lõi của chủ sân được hoàn thiện tại B02.
- **Hướng sửa tối thiểu**:
  Thay thế tất cả các điểm đọc `._id` trong `OwnerCourtBlocksPage.jsx` bằng `.id || ._id`:
  ```javascript
  // Dòng 44:
  setSelectedFacilityId(facs[0].id || facs[0]._id);
  // Dòng 68:
  setSelectedCourtId(courtsRes.courts[0].id || courtsRes.courts[0]._id);
  // Dòng 203:
  <option key={f.id || f._id} value={f.id || f._id}>
  // Dòng 286:
  setTargetCourtId(crts[0].id || crts[0]._id);
  // Dòng 309:
  <option key={c.id || c._id} value={c.id || c._id}>
  ```

---

### Finding B02-2 (P3 — Testing / Test Masking Bug: Mock test che giấu lỗi DTO ID)
- **Tên lỗi**: Test unit `client/src/pages/owner/__tests__/OwnerCourtBlocksPage.test.jsx` sử dụng mock data có trường `_id` thay vì cấu trúc thật `id` của DTO backend, che lấp lỗi runtime của Finding B02-1.
- **File & dòng**: `client/src/pages/owner/__tests__/OwnerCourtBlocksPage.test.jsx#L26-L32`
- **Chi tiết**: Mock trả về `{ _id: 'f-1', facilityName: 'Sân A' }` thay vì `{ id: 'f-1', facilityName: 'Sân A' }`. Cần đồng bộ mock data theo đúng `facilityRepository.toDTO` và `courtRepository.toDTO`.

---

## 3. Kết luận và Khuyến nghị

1. **Trạng thái Batch B02**: **NEEDS_CHANGES**.
2. **Lý do**: Phần backend và thuật toán xử lý concurrency / transaction / timezone đạt chuẩn xuất sắc và loại bỏ hoàn toàn Write Skew. Tuy nhiên, tồn tại 1 lỗi P1 ở giao diện `OwnerCourtBlocksPage.jsx` làm tê liệt tính năng khóa sân của chủ sân do không tương thích DTO ID.
3. **Cổng kiểm thử (Quality Gates)**: Tiếp tục duy trì `BE_READY` = `STALE` và `RELEASE_READY` = `STALE`. Không tự ý nâng trạng thái gate sang `ACCEPTED`.
4. **Hành động tiếp theo**: Nhóm triển khai cần sửa `OwnerCourtBlocksPage.jsx` và cập nhật file test liên quan trước khi bàn giao lại cho reviewer.

