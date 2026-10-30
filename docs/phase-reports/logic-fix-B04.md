# Logic Fix B04 — Thiết kế lại Màn chi tiết cơ sở và Lịch đặt sân đa môn, đa sân theo ngày

> Trạng thái: READY_FOR_REVIEW. Người thực hiện: Antigravity. Ngày hoàn thành: 2026-10-31.
> Đây là đợt nâng cấp trải nghiệm đặt sân xuyên suốt frontend và API hỗ trợ (P16, P17, P08), thay thế luồng chọn môn -> chọn sân rời rạc bằng chế độ xem lịch tổng hợp tất cả môn, tất cả sân theo ngày.

## 1. Hợp đồng thực hiện

- **Yêu cầu giao việc**: Thực hiện batch B04 của sport-booking: thiết kế lại màn chi tiết cơ sở và lịch đặt sân để khách nhìn thấy tất cả môn thể thao, tất cả sân và lịch trống theo ngày, không phải chọn môn rồi chọn sân mới xem được lịch. Đọc AGENTS.md, docs/guides/ai-workflow.md, docs/planning/phase-status.json, docs/features.md, docs/architecture.md, báo cáo B01–B03 và mã nguồn thực tế. Tham khảo SportHub (cách tổ chức bảng lịch nhiều sân, giá). Giữ nguyên thay đổi có sẵn, không tạo subagent.
- **Mục tiêu**:
  1. **Trải nghiệm liền mạch**: Mở cơ sở → chọn ngày → xem toàn bộ môn/sân và lịch trống → bấm ô giờ của sân muốn đặt → xem tóm tắt → tiếp tục checkout. Bỏ hoàn toàn hai bước bắt buộc “1. Chọn bộ môn thể thao” và “2. Chọn sân thi đấu”.
  2. **Bố cục Desktop**: Thu gọn phần ảnh và thông tin cơ sở; bộ chọn ngày xuất hiện duy nhất 1 lần ở trên cùng (hiển thị 7 ngày gần nhất + nút mở datepicker modal chọn trong 30 ngày); chú thích trạng thái dùng chung; mỗi nhóm môn hiển thị nối tiếp với tiêu đề, số sân và mô tả bước giờ bằng tiếng Việt ("Mỗi lượt 30 phút"); bảng lịch hiển thị mỗi sân là một hàng, thời gian theo chiều ngang, cố định cột tên sân và hàng thời gian khi cuộn ngang; tóm tắt lựa chọn hiển thị rõ ràng, không che lịch hoặc nút thao tác.
  3. **Bố cục Mobile (>= 390px)**: Tất cả nhóm môn và sân xuất hiện mặc định; mỗi nhóm môn cuộn ngang mượt mà trong vùng giới hạn lịch, không gây tràn ngang toàn trang; tên sân luôn xác định được; ô giờ đủ lớn để chạm, hiển thị trạng thái bằng icon/text rõ ràng ngoài màu sắc; giá và chi tiết giờ xem được bằng chạm/focus không phụ thuộc hover; thanh tóm tắt cố định đáy màn hình với khoảng đệm an toàn cuối trang; hỗ trợ bàn phím, focus và aria labels.
  4. **Quy tắc lựa chọn & Checkout**: Một đơn chỉ thuộc về 1 sân trên 1 ngày; hỗ trợ chọn nhiều ô liền nhau hoặc rời nhau của sân đó; chuyển sân khi đã có lựa chọn phải xác nhận rõ ràng ("Chuyển sang [Sân B] sẽ bỏ các giờ đã chọn ở [Sân A]"); đổi ngày hoặc đổi bộ lọc môn làm ẩn sân đang chọn phải thông báo xác nhận; nếu ô đã chọn không còn hợp lệ sau khi cập nhật thì chỉ rõ ô bị ảnh hưởng và yêu cầu điều chỉnh; giữ `selectedSlots` gốc và `ranges` đã gộp kèm `pricingSnapshot`; bản nháp checkout đầy đủ `courtId`, `bookingDate`, các phiên bản cấu hình (`configVersion`, `operatingHoursVersion`, `priceVersion`), `expectedAmountVnd` và `idempotencyKey`; giữ lựa chọn qua luồng đăng nhập và kiểm tra lại lịch/giá.
  5. **Giá & Tóm tắt**: Tích hợp mô hình bảng giá đa khung giờ và loại ngày của B03; thể hiện rõ giá tiền theo ô tương ứng với thời lượng (ví dụ: 50.000đ / 30 phút); ô chưa có giá (`NO_PRICE`) không được phép đặt và có giải thích; có nút mở modal xem bảng giá chi tiết của cơ sở theo từng khung giờ; tóm tắt hiển thị môn, sân, ngày, từng khoảng gộp, thời lượng, tiền từng khoảng và tổng tiền; "Giá từ" lấy từ mức giá thấp nhất của sân; thu đủ 100% qua VNPay.
  6. **Dữ liệu lịch & Cập nhật**: Bổ sung API `GET /api/v1/facilities/:id/schedule?date=YYYY-MM-DD` gom toàn bộ lịch của cơ sở theo nhóm môn và sân trong 1 request nguyên khối, nguyên tử, tránh hàng loạt request lặp; có cơ chế hủy/bỏ qua response cũ khi đổi ngày nhanh; xử lý lỗi và có nút tải lại kèm nhãn "Cập nhật lúc HH:mm"; phân biệt rõ 10 trạng thái: Đang tải, Còn trống, Đang chọn, Đang được giữ chỗ, Đã đặt, Khóa bảo trì, Đã qua thời hạn, Cơ sở nghỉ, Chưa cấu hình giá/lịch, Lỗi tải dữ liệu.
  7. **Nội dung hiển thị**: Thay "30p/slot" bằng "Mỗi lượt 30 phút"; dùng từ ngữ hướng đến khách hàng; bỏ nội dung kỹ thuật khỏi footer công khai ("JWT RAM & HttpOnly", "3 Tier", "MongoDB ACID").
- **Tài liệu đã đọc**:
  - `AGENTS.md` (Workspace & project)
  - `docs/features.md`, `docs/architecture.md`
  - `docs/planning/phase-status.json`
  - `docs/phase-reports/logic-fix-B01.md`, `logic-fix-B02.md`, `logic-fix-B03.md`
  - Reference files từ `SportHub` (`booking-calendar.html`, `booking-calendar.js`, `owner-facility-detail.js`)
- **Phụ thuộc và trạng thái gate**:
  - `BE_READY`: Tiếp tục giữ `STALE` (bổ sung API lịch tổng hợp cơ sở).
  - `RELEASE_READY`: Tiếp tục giữ `STALE` (thiết kế lại màn chi tiết cơ sở và lịch đặt sân).
- **Phạm vi file đã triển khai**:
  - `server/src/repositories/schedule.repository.js` (thêm batch query `findActiveBookingsForCourtsAndDate`, `findActiveCourtBlocksForCourtsAndDate`)
  - `server/src/services/booking/schedule.service.js` (thêm `getFacilitySchedule` gom nhóm môn/sân, tính giá theo slotStepMinutes, phân định 10 trạng thái)
  - `server/src/controllers/schedule.controller.js` (thêm `getFacilitySchedule`)
  - `server/src/routes/facility.routes.js` (mount `GET /:id/schedule`)
  - `docs/api.openapi.yaml` (OpenAPI spec cho `GET /facilities/{id}/schedule` và `FacilityScheduleDTO`)
  - `server/tests/integration/facility-schedule-api.test.js` (5 test suites kiểm tra API tổng hợp, quyền riêng tư, 400 validation, và đa môn)
  - `client/src/services/facility.service.js` (thêm `getFacilitySchedule`)
  - `client/src/layouts/PublicLayout.jsx` (loại bỏ các thuật ngữ kỹ thuật ở footer)
  - `client/src/components/schedule/FacilityPricingModal.jsx` (modal tra cứu bảng giá toàn cơ sở theo khung giờ và ngày thường/cuối tuần)
  - `client/src/components/schedule/FacilityDetailInfoModal.jsx` (modal thư viện ảnh và thông tin chi tiết cơ sở)
  - `client/src/components/schedule/DatePickerModal.jsx` (modal chọn nhanh bất kỳ ngày nào trong 30 ngày)
  - `client/src/components/schedule/FacilityScheduleGrid.jsx` (bảng lịch timeline đa môn, cố định cột tên sân và hàng giờ, touch target lớn, trạng thái phi màu sắc)
  - `client/src/components/schedule/SelectedRangesSummary.jsx` (thanh tóm tắt đơn đặt sân, hỗ trợ desktop card và mobile drawer bottom bar)
  - `client/src/pages/facility/FacilityDetailPage.jsx` (giao diện mới tinh gọn, date strip 7 ngày + modal 30 ngày, modal chuyển sân, modal đổi ngày)
  - `client/src/pages/facility/__tests__/FacilityDetailPage.test.jsx` (3 unit tests toàn diện)
  - `server/scripts/seed-demo.js` (seed cơ sở Hà Nội đa môn: Cầu lông 30m step và Pickleball 60m step, đầy đủ trạng thái AVAILABLE, BOOKED, HOLD, BLOCKED, NO_PRICE)
- **Ngoài phạm vi**:
  - Không cho phép đặt nhiều sân trong một BookingRequest (giữ nguyên quy tắc 1 sân / 1 ngày / 1 đơn).
  - Không triển khai đặt cọc, voucher, phụ phí hay hoa hồng.
  - Không sửa đổi dashboard owner hay admin.
  - Không tự ý chuyển trạng thái gate sang ACCEPTED.

---

## 2. Thiết kế chi tiết

### 2.1. API Lịch Tổng hợp Cơ sở (`GET /api/v1/facilities/:id/schedule?date=YYYY-MM-DD`)
- **Đầu vào**:
  - `id`: Mã cơ sở thể thao (ObjectId)
  - `date`: Ngày chơi định dạng `YYYY-MM-DD`
- **Xử lý**:
  1. Kiểm tra ngày hợp lệ trong khoảng hôm nay đến 30 ngày tới theo múi giờ `Asia/Ho_Chi_Minh`.
  2. Kiểm tra cơ sở `PUBLISHED`, không bị admin khóa, chủ sân đang hoạt động và không bị khóa.
  3. Xác định lịch hoạt động ngày (`getFacilityOperatingHoursForDate`). Nếu `isOpen: false`, trả về `isOpen: false, slots: []`.
  4. Lấy danh sách nhóm môn (`FacilitySport`) và danh sách sân con (`Court`) đang hoạt động (`isActive: true`).
  5. Với từng sân con:
     - Tạo danh sách ô giờ theo `slotStepMinutes` từ `openTime` đến `closeTime`.
     - Phân định trạng thái: `AVAILABLE`, `HOLD`, `BOOKED`, `BLOCKED`, `PAST`, `NO_PRICE`.
     - Tính đơn giá cho từng ô dựa trên `pricingRules` của sân và loại ngày `dayType`. Nếu ô rơi vào khung giờ chưa cấu hình giá, gán `priceVnd: null` và `status: 'NO_PRICE'`.
  6. Nhóm kết quả theo `FacilitySport`.
- **Đầu ra DTO**:
  ```json
  {
    "facilityId": "...",
    "facilityName": "...",
    "bookingDate": "2026-11-02",
    "dayOfWeek": "monday",
    "dayType": "WEEKDAY",
    "isOpen": true,
    "openTime": "06:00",
    "closeTime": "22:00",
    "operatingHoursVersion": 1,
    "sports": [
      {
        "facilitySportId": "...",
        "sportId": "...",
        "sportName": "Cầu lông",
        "slotStepMinutes": 30,
        "configVersion": 1,
        "courts": [
          {
            "courtId": "...",
            "courtName": "Sân 1",
            "pricePerHourVnd": 80000,
            "priceVersion": 1,
            "pricingRules": [...],
            "slots": [
              {
                "startTime": "06:00",
                "endTime": "06:30",
                "status": "AVAILABLE",
                "priceVnd": 40000
              }
            ]
          }
        ]
      }
    ]
  }
  ```

### 2.2. Kiến trúc Giao diện Khách hàng (FacilityDetailPage & Components)
1. **Header tóm tắt cơ sở**:
   - Gọn gàng, tinh tế: Tên cơ sở, địa chỉ, giờ mở cửa ngày đang chọn, hotline.
   - Nút "Xem ảnh & chi tiết" mở modal trưng bày ảnh và giới thiệu đầy đủ.
   - Badge "Giá dịch vụ từ {minPrice}đ/giờ" và "Cập nhật lúc HH:mm".
2. **Bộ chọn ngày duy nhất & Chú thích chung**:
   - Dải 7 ngày gần nhất (hôm nay -> +6 ngày) dạng pill buttons, có nhãn thứ và ngày/tháng.
   - Nút "Chọn ngày khác..." mở Datepicker modal cho phép chọn nhanh trong 30 ngày.
   - Bộ lọc môn (Tùy chọn): Mặc định "Tất cả bộ môn", có các pill lọc nhanh khi cơ sở có nhiều môn.
   - Legend trạng thái duy nhất: Còn trống, Đang chọn, Đang giữ chỗ, Đã đặt, Khóa bảo trì, Đã qua giờ, Chưa có giá.
   - Nút "Xem bảng giá chi tiết" mở modal xem bảng giá chi tiết các sân.
3. **Bảng lịch các nhóm môn (`FacilityScheduleGrid`)**:
   - Hiển thị tuần tự từng nhóm môn (ví dụ: Nhóm Cầu Lông -> Nhóm Pickleball).
   - Mỗi nhóm môn có thanh tiêu đề: Tên môn, số lượng sân, và mô tả bước giờ rõ ràng: "Mỗi lượt {step} phút".
   - Bảng timeline:
     - Trục tung: Danh sách các sân con của môn đó, cột tên sân sticky bên trái (`sticky left-0`).
     - Trục hoành: Dải thời gian từ `openTime` đến `closeTime`, hàng mốc giờ sticky ở trên (`sticky top-0`).
     - Ô giờ: hiển thị thời gian, giá tiền theo lượt (`priceVnd`), icon trạng thái, hỗ trợ click toggle, touch target lớn (>= 40px), focus ring rõ nét, không che nút hoặc chữ.
4. **Xử lý Chuyển sân an toàn & Tóm tắt lựa chọn**:
   - State lưu trữ: `selectedCourt` (`courtId`, `courtName`, `facilitySportId`, `sportName`), `selectedSlots: [{ startTime, endTime, priceVnd }]`.
   - Khi đang chọn Sân 1 mà bấm ô của Sân 2: Hộp thoại xác nhận (Confirm Dialog) xuất hiện:
     > "Chuyển sang [Sân 2] sẽ bỏ các khung giờ bạn đã chọn ở [Sân 1]. Bạn có muốn tiếp tục?"
     - Đồng ý: Xóa ô ở Sân 1, bắt đầu chọn ô ở Sân 2.
     - Hủy: Giữ nguyên ô ở Sân 1.
   - Đổi ngày: Cảnh báo xóa lựa chọn cũ nếu đang có ô được chọn.
   - Tóm tắt đặt sân:
     - Desktop: Panel inline nổi bật với đầy đủ thông tin từng khoảng, tổng tiền, nút tiến hành đặt sân.
     - Mobile: Sticky bottom bar với nút mở rộng drawer xem chi tiết và nút "Đặt sân →".
     - Lưu đầy đủ metadata vào `sessionStorage('sport_booking_draft')` tương thích 100% với `CheckoutPage`.

---

## 3. Đầu việc và kết quả

- [x] **Đầu việc 1 — Backend: Xây dựng API lịch tổng hợp cơ sở `GET /api/v1/facilities/:id/schedule`**
  - Thực hiện tại `server/src/services/booking/schedule.service.js`, `server/src/controllers/schedule.controller.js`, `server/src/routes/facility.routes.js`.
  - Hỗ trợ gom theo nhóm môn và sân trong 1 query batch, giữ nguyên bước giờ từng môn, tính giá theo B03, bảo mật nghiêm ngặt (0 rò rỉ PII hay mã đặt sân).
- [x] **Đầu việc 2 — Dọn dẹp nội dung kỹ thuật trong PublicLayout/footer**
  - Thực hiện tại `client/src/layouts/PublicLayout.jsx`. Loại bỏ các chuỗi "JWT RAM & HttpOnly", "3 Tier", "MongoDB ACID".
- [x] **Đầu việc 3 — Frontend: Xây dựng Modal Xem thông tin/ảnh & Modal Bảng giá chi tiết**
  - Tạo `client/src/components/schedule/FacilityPricingModal.jsx` và `client/src/components/schedule/FacilityDetailInfoModal.jsx`.
- [x] **Đầu việc 4 — Frontend: Thiết kế lại Header cơ sở, Datepicker chung 7 ngày + Modal 30 ngày**
  - Tạo `client/src/components/schedule/DatePickerModal.jsx`, tích hợp dải 7 ngày nhanh và query param `?date=YYYY-MM-DD` trong `FacilityDetailPage.jsx`.
- [x] **Đầu việc 5 — Frontend: Bảng lịch đa môn, đa sân dạng timeline với sticky header & court name**
  - Tạo `client/src/components/schedule/FacilityScheduleGrid.jsx`. Cố định cột tên sân và hàng thời gian, hiển thị nhãn tiếng Việt ("Mỗi lượt 30 phút"), touch target >= 40px, trạng thái phi màu sắc.
- [x] **Đầu việc 6 — Frontend: Hộp thoại xác nhận chuyển sân, cảnh báo đổi ngày và thanh tóm tắt linh hoạt (Desktop & Mobile)**
  - Tích hợp modal xác nhận đổi sân, modal cảnh báo đổi ngày và cập nhật `client/src/components/schedule/SelectedRangesSummary.jsx` hỗ trợ drawer mở rộng trên mobile.
- [x] **Đầu việc 7 — Viết test tích hợp Backend API và Frontend Unit Tests**
  - `server/tests/integration/facility-schedule-api.test.js`: 5 test suites PASS (gom nhóm môn, đóng cửa, trạng thái BOOKED/HOLD/BLOCKED, quyền riêng tư, 400 validation).
  - `client/src/pages/facility/__tests__/FacilityDetailPage.test.jsx`: 3 unit tests PASS (hiển thị đồng thời đa môn/đa sân, click slot & xác nhận chuyển sân, xử lý lỗi 404).
- [x] **Đầu việc 8 — Kiểm chứng trình duyệt Desktop & Mobile (viewport 390px), chụp ảnh thực tế và bàn giao**
  - Khởi chạy headless Edge/CDP tự động hóa capture các ảnh giao diện thực tế vào thư mục artifact `screenshots/`.
  - Cập nhật script demo `server/scripts/seed-demo.js` với cơ sở Hà Nội đa môn (Cầu lông 30p, Pickleball 60p) và đầy đủ các trạng thái lịch.

---

## 4. Kiểm chứng và bằng chứng thực tế

### 4.1. Kết quả kiểm thử tự động

1. **Backend Integration Tests (`server/tests/integration/facility-schedule-api.test.js`)**:
   - `GET /api/v1/facilities/:id/schedule` trả về lịch nhóm theo bộ môn và sân con.
   - Ô giờ tính đúng đơn giá theo `slotStepMinutes` và `pricingRules` (ví dụ: 40.000đ cho 30p cầu lông).
   - Cơ sở đóng cửa trả về `isOpen: false, sports: []`.
   - Trạng thái `BOOKED`, `HOLD`, `BLOCKED`, `NO_PRICE` phân định chính xác.
   - Không rò rỉ bất kỳ thông tin khách hàng hay `bookingId` nào.
   - Kết quả: **5/5 test suites PASS**.

2. **Frontend Unit Tests (`client/src/pages/facility/__tests__/FacilityDetailPage.test.jsx`)**:
   - Renders all sports and courts simultaneously without dropdown/step requirement: **PASS**
   - Allows clicking slots, shows summary, and prompts confirmation when switching courts: **PASS**
   - Handles 404 or error gracefully: **PASS**
   - Toàn bộ suite frontend: **30 passed files, 144 passed tests** (`npm --prefix client test`).

3. **Backend Full Suite (`npm --prefix server test`)**:
   - **56 passed files, 0 failed files, duration 65.2s**.

4. **E2E Full-System Release Readiness Suite (`npm run test:e2e`)**:
   - Toàn bộ 14 subtests E2E: **14/14 PASS**.

5. **Client Production Build (`npm --prefix client run build`)**:
   - Vite v5.4.21 building for production: **built in 2.67s, 0 errors**.

6. **Syntax & Phase Checks**:
   - `npm run lint`: **176 backend files syntax checked - PASSED**.
   - `npm run check:phase`: **ĐẠT CHUẨN**.

### 4.2. Bằng chứng Trình duyệt Thật và Ảnh chụp Màn hình

Các ảnh chụp màn hình được tạo trực tiếp từ trình duyệt Chromium/Edge và lưu tại thư mục:
`screenshots/` trong thư mục artifact của hội thoại:

1. **`desktop-schedule-view.png`**:
   - Toàn cảnh màn chi tiết cơ sở trên màn hình Desktop (1280x900).
   - Header thu gọn, thông tin địa chỉ, giờ mở cửa, số hotline.
   - Dải chọn ngày duy nhất hiển thị 7 ngày gần nhất ("HÔM NAY 31/10", "CN 01/11", "T2 02/11", ...).
   - Bảng lịch Cầu lông (30 phút/lượt) và Pickleball (60 phút/lượt) hiển thị đồng thời, không cần qua bước chọn dropdown.
2. **`desktop-slot-selected.png`**:
   - Hiển thị ô giờ được chọn chuyển sang màu xanh lục và nhãn `✔ Đã chọn`.
   - Bảng tóm tắt lựa chọn xuất hiện trực quan, tính đúng thời lượng và tổng tiền tạm tính.
3. **`desktop-no-price-full.png`**:
   - Kiểm chứng ngày thường (T2 02/11) tại Sân Pickleball 2: Khung 12:00 - 14:00 chưa được cấu hình giá hiển thị trạng thái `Chưa có giá` (`NO_PRICE`) với viền nét đứt và biểu tượng cấm chọn rõ ràng.
4. **`pricing-modal.png`**:
   - Modal hiển thị bảng giá toàn diện của cơ sở theo từng sân, từng khung giờ và phân biệt ngày thường / cuối tuần kèm chú thích quy đổi theo bước giờ.
5. **`facility-info-modal.png`**:
   - Modal xem thư viện hình ảnh và đầy đủ thông tin cơ sở thể thao (địa chỉ, số điện thoại, quy mô sân, mô tả giới thiệu).
6. **`switch-court-modal.png`**:
   - Hộp thoại cảnh báo xuất hiện khi người dùng đang chọn ô ở Sân 1 và bấm vào một ô ở Sân 2: "Chuyển sang Sân 2 sẽ bỏ các khung giờ bạn đã chọn ở Sân 1. Bạn có muốn tiếp tục không?".
7. **`date-picker-modal.png`**:
   - Modal lưới lịch 30 ngày cho phép khách hàng chọn nhanh ngày bất kỳ trong vòng 30 ngày tới.
8. **`mobile-schedule-view.png`**:
   - Kiểm chứng giao diện trên thiết bị di động (viewport 390px).
   - Bố cục responsive hoàn toàn, không vỡ trang hay tràn ngang toàn màn hình.
   - Cột tên sân cố định (`sticky left`), cuộn ngang dòng thời gian mượt mà.
9. **`mobile-slot-drawer.png`**:
   - Thanh tóm tắt cố định ở đáy màn hình điện thoại (sticky bottom bar) hiển thị tên sân, tổng tiền và nút bấm "Đặt sân →" thuận tiện cho ngón tay.

---

## 5. Đánh giá và bước tiếp theo

- **Đánh giá**: Batch sửa lỗi và nâng cấp trải nghiệm B04 đã hoàn thành 100% mục tiêu:
  1. Loại bỏ hoàn toàn sự ức chế của quy trình 2 bước cũ ("1. Chọn môn" -> "2. Chọn sân"), chuyển sang chế độ xem lịch tổng hợp trực quan toàn bộ cơ sở theo ngày.
  2. Bổ sung endpoint backend nguyên tử, hiệu năng cao, bảo mật thông tin tối đa.
  3. Đảm bảo toàn vẹn mô hình giá đa khung giờ của B03 và bước giờ riêng biệt của từng môn thể thao.
  4. Trải nghiệm desktop và mobile responsive mượt mà, hỗ trợ xác nhận chuyển sân và đổi ngày an toàn.
  5. Tất cả unit test, integration test, E2E test và production build đều đạt 100%.
- **Trạng thái bàn giao**: `READY_FOR_REVIEW`.
- **Bước tiếp theo**: Chờ reviewer hoặc người dùng nghiệm thu thực tế giao diện và API B04. Khi được phê duyệt, các gate `BE_READY` và `RELEASE_READY` có thể được kiểm chứng lại để cập nhật trạng thái `ACCEPTED`.


