# Báo cáo Review Độc lập: Logic Fix B04 — Thiết kế lại Màn chi tiết cơ sở và Lịch đặt sân đa môn, đa sân theo ngày

> Ngày review: 31/10/2026  
> Vai trò: Independent Code Reviewer (Độc lập)  
> Đối tượng review: Batch B04 (`docs/phase-reports/logic-fix-B04.md`, HEAD revision `fcb9231ed39f8845ccc023424112676fb042a45d`)  
> Kết luận sơ bộ: **NO_BLOCKING_FINDINGS** (Không có lỗi P0/P1/P2 gây chặn luồng; cấu trúc UI/UX và API đạt chuẩn cao; ghi nhận 1 quan sát P3 về tối ưu fallback load ban đầu)

---

## 1. Phạm vi và Đối chiếu Hợp đồng B04

### 1.1. Tài liệu và Mã nguồn Đối chiếu
- Quy tắc dự án: `AGENTS.md` (Workspace & Project).
- Báo cáo triển khai batch: `docs/phase-reports/logic-fix-B04.md`.
- Đặc tả nghiệp vụ & kiến trúc: `docs/features.md`, `docs/architecture.md`.
- Tài liệu hợp đồng API: `docs/api.openapi.yaml` (`GET /facilities/{id}/schedule`, `FacilityScheduleDTO`).
- Mã nguồn backend:
  - `server/src/repositories/schedule.repository.js`
  - `server/src/services/booking/schedule.service.js`
  - `server/src/controllers/schedule.controller.js`
  - `server/src/routes/facility.routes.js`
- Mã nguồn frontend:
  - `client/src/services/facility.service.js`
  - `client/src/layouts/PublicLayout.jsx`
  - `client/src/components/schedule/FacilityPricingModal.jsx`
  - `client/src/components/schedule/FacilityDetailInfoModal.jsx`
  - `client/src/components/schedule/DatePickerModal.jsx`
  - `client/src/components/schedule/FacilityScheduleGrid.jsx`
  - `client/src/components/schedule/SelectedRangesSummary.jsx`
  - `client/src/pages/facility/FacilityDetailPage.jsx`
- Kiểm thử đã thực hiện:
  - `node --test server/tests/integration/facility-schedule-api.test.js` (6/6 PASS)
  - `npm --prefix client test src/pages/facility/__tests__/FacilityDetailPage.test.jsx` (3/3 PASS)

### 1.2. Đối chiếu Checklist B04

| STT | Tiêu chí Checklist B04 | Đánh giá | Bằng chứng & Ghi chú |
| :--- | :--- | :---: | :--- |
| 1 | **Mặc định hiện tất cả môn và sân khi mở cơ sở theo ngày** | **ĐẠT** | Bỏ hoàn toàn luồng chọn môn -> chọn sân cũ. Truy cập cơ sở tải ngay API tổng hợp, hiển thị đầy đủ các nhóm môn thể thao và từng sân con nối tiếp nhau. |
| 2 | **Bố cục responsive, cuộn ngang timeline mượt mà trên mobile (>= 390px), cố định cột tên sân và hàng giờ** | **ĐẠT** | Bảng lịch sử dụng CSS `sticky` cho cột tên sân (trái) và hàng thời gian (trên cùng). Touch target các ô lịch tối thiểu 44px, hỗ trợ cuộn cảm ứng mượt mà không gây vỡ layout trang. |
| 3 | **Trạng thái rõ ràng không chỉ dựa vào màu sắc (có text/icon)** | **ĐẠT** | 10 trạng thái được phân định rõ ràng bằng icon SVG chuyên biệt, nhãn chữ trợ năng và thuộc tính `aria-label` chi tiết (Ví dụ: "Đang chọn", "Khóa bảo trì", "Chưa có giá"). |
| 4 | **Quy tắc 1 đơn / 1 sân / 1 ngày, thông báo rõ ràng khi đổi sân/đổi ngày** | **ĐẠT** | Giữ đúng ràng buộc cốt lõi. Khi có ô đã chọn mà người dùng chọn ô của sân khác, modal xác nhận đổi sân xuất hiện ("Chuyển sang sân khác sẽ hủy các giờ đã chọn..."). Đổi ngày hoặc chọn ngày cơ sở đóng cửa có cảnh báo hủy lựa chọn cũ. |
| 5 | **Giá hiển thị theo từng ô tương ứng thời lượng (`slotStepMinutes`)** | **ĐẠT** | Tích hợp tính giá của B03 vào từng ô giờ (ví dụ: ô 30 phút giá 40.000đ khi giá giờ 80.000đ/h). Ô thiếu cấu hình giá mang trạng thái `NO_PRICE` và bị vô hiệu hóa chọn, kèm giải thích rõ. |
| 6 | **API lịch tổng hợp 1 request nguyên khối, có cơ chế hủy request cũ khi chuyển ngày nhanh** | **ĐẠT** | Endpoint `GET /api/v1/facilities/:id/schedule?date=...` gom toàn bộ môn/sân. Frontend sử dụng `activeRequestIdRef` so khớp timestamp của request cuối cùng, ngăn chặn triệt để race condition khi người dùng bấm chọn liên tục các ngày trên thanh date strip. |
| 7 | **Không còn thuật ngữ kỹ thuật rò rỉ ra UI công khai** | **ĐẠT** | Footer tại `PublicLayout.jsx` đã được dọn sạch các thuật ngữ như "JWT RAM", "MongoDB ACID". Mô tả bước giờ hiển thị thân thiện: "Mỗi lượt 30 phút" thay vì "30p/slot". |

---

## 2. Danh sách Findings chi tiết

### Finding B04-1 (P3 — Optimization: Tối ưu giá trị fallback của `operatingHoursVersion` trong thời gian tải dữ liệu ban đầu)
- **File & dòng**: `client/src/pages/facility/FacilityDetailPage.jsx#L646`
- **Mô tả**:
  ```javascript
  operatingHoursVersion={scheduleData?.operatingHoursVersion || facility?.operatingHoursVersion}
  ```
- **Nhận xét**: Khi người dùng mới vào trang và `scheduleData` đang tải, nếu dữ liệu `facility` từ API chi tiết không chứa `operatingHoursVersion` (hoặc đang chờ response), thuộc tính này có thể tạm thời mang giá trị `undefined` truyền xuống `SelectedRangesSummary`. Mặc dù người dùng không thể chọn ô khi bảng lịch chưa tải xong (vì bảng hiển thị trạng thái `Đang tải`), nhưng để mã nguồn chặt chẽ hơn, nên gán fallback giá trị mặc định rõ ràng:
  ```javascript
  operatingHoursVersion={scheduleData?.operatingHoursVersion || facility?.operatingHoursVersion || 1}
  ```

---

## 3. Kết luận và Khuyến nghị

1. **Trạng thái Batch B04**: **NO_BLOCKING_FINDINGS**.
2. **Đánh giá tổng thể**: Batch B04 được triển khai rất tốt, kiến trúc giao diện hiện đại, sạch sẽ, giải quyết triệt để bài toán trải nghiệm người dùng theo đúng phong cách SportHub (tổng hợp đa môn, đa sân theo ngày, responsive tốt, chống race condition khi đổi ngày nhanh).
3. **Cổng kiểm thử (Quality Gates)**: Vì B01, B02, B03 đều chưa giải quyết xong các phát hiện P1/P2 và B04 phụ thuộc vào tính toàn vẹn của chuỗi logic này, hai cổng `BE_READY` và `RELEASE_READY` **tiếp tục duy trì trạng thái STALE**.
4. **Hành động tiếp theo**: Sau khi nhóm triển khai khắc phục các lỗi P1/P2 của B01, B02, B03, toàn bộ hệ sinh thái sẽ sẵn sàng cho đợt kiểm thử hồi quy toàn diện.

