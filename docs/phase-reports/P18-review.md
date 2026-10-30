# Báo cáo Review Độc lập Phase P18 & Quyết định Nghiệm thu

> Trạng thái nghiệm thu Phase P18: **ACCEPTED**  
> Người review: Independent Reviewer (Được ủy quyền nghiệm thu trực tiếp bởi người dùng)  
> Ngày review: 31/10/2026  
> Tài liệu căn cứ: `AGENTS.md`, `docs/features.md` (Mục 6 Vận hành của chủ sân; Tiêu chí 1–4, 6, 7, 9, 15, 16, 20, 21, 24, 25, 27, 28, 30, 31, 35, 42, 46, 52, 53), `docs/architecture.md` (Mục 5 Layer kiến trúc, Mục 8 Khoảng thời gian liên tục, Mục 10.3 Phân quyền RBAC), `docs/database.md`, `docs/api.openapi.yaml`, `docs/planning/development-plan.md` (Phase P18), `docs/guides/ai-workflow.md`, `docs/planning/phase-status.json`, `docs/phase-reports/P18.md`, `docs/phase-reports/P18-manifest.sha256`.

---

## 1. Phạm vi & Phiên bản Review (Tái Nghiệm Thu)

### 1.1. Phạm vi công việc được đánh giá
Đánh giá độc lập toàn diện mã nguồn thực tế và kết quả khắc phục khiếm khuyết của Phase P18 (Giao diện chủ sân — Owner Dashboard, Operations & Facility Management):
1. **Dịch vụ API Frontend (`owner.service.js` & `payment.service.js`):**
   - Kết nối đầy đủ các endpoint thuộc `/api/v1/owner/*` và `/api/v1/payments/*`.
2. **Trang Tổng quan Doanh thu & Vận hành (`OwnerDashboardPage.jsx`):**
   - 4 thẻ KPI tài chính phân bổ VNPay (`totalRevenueVnd`), số đơn hôm nay, đã phục vụ, đơn đã hủy.
   - Bộ lọc theo cơ sở thể thao và khoảng ngày.
   - Danh sách đơn quá giờ chơi chưa xử lý kèm nút bấm hoàn tất/no-show thao tác nhanh.
   - Danh sách trận đấu sắp tới hôm nay.
3. **Trang Quản lý Cơ sở, Sân & Bước giờ (`OwnerFacilitiesPage.jsx`):**
   - **CRUD mềm cơ sở:** Chế độ chỉnh sửa thông tin cơ sở (tên, địa chỉ, tỉnh/thành, giờ mở/đóng cửa, hotline, mô tả) qua `ownerService.updateFacility`; nút chuyển đổi trạng thái tức thì giữa `PUBLISHED` (Công khai) và `PAUSED` (Tạm dừng nhận khách); xử lý lỗi xung đột lịch hoạt động (`FACILITY_HAS_ACTIVE_BOOKINGS`).
   - **CRUD mềm sân thi đấu:** Thêm sân, sửa sân con (tên sân, giá theo giờ `pricePerHourVnd`, mô tả, toggle `isActive`), nút toggle nhanh trạng thái nhận đặt trên từng thẻ sân qua `ownerService.updateCourt`; hiển thị nguyên tắc bảo lưu giá cũ (OWN-05).
   - **Cấu hình FacilitySport & Bước giờ:** Thêm môn vào cơ sở; nút đổi bước giờ `slotStepMinutes` (30/60/90m) qua `ownerService.updateFacilitySportStep`.
   - **Preview bước giờ & Hộp cảnh báo thời gian dư (Tiêu chí 30, OWN-05):** Tính toán và hiển thị trực quan các ô slot sẽ sinh ra; hiển thị hộp cảnh báo khoảng thời gian dư không đủ 1 slot ở cuối ngày không nhận đặt.
   - **Thông báo cản trở đổi cấu hình (Tiêu chí 15):** Bắt lỗi `FACILITY_HAS_ACTIVE_BOOKINGS`, hiển thị hộp cảnh báo cản trở kèm 2 link điều hướng nhanh sang kiểm tra đơn đặt sân và lịch khóa sân.
   - **Quản lý ảnh:** Upload ảnh multipart FormData, chọn ảnh cover, xóa ảnh.
4. **Trang Khóa Lịch Bảo Trì Sân (`OwnerCourtBlocksPage.jsx`):**
   - Sơ đồ slot trực quan, chọn slot khóa, lý do bắt buộc, tạo block và mở lại sân (`deleteCourtBlock`), cảnh báo bảo vệ lịch.
5. **Trang Vận hành Đơn Đặt Sân (`OwnerBookingsPage.jsx`):**
   - Lọc đa chiều (cơ sở, sân, ngày, trạng thái), hiển thị thông tin liên hệ khách (`contactName`, `contactPhone`), hoàn tất/no-show (đơn `CONFIRMED`), hủy giữ chỗ (đơn `PENDING_PAYMENT`), cảnh báo quy chuẩn 100% VNPay.
6. **Trang Đặt Sân Hộ Khách Vãng Lai & GuestPay (`OwnerOnBehalfPage.jsx` & `GuestPayPage.jsx`):**
   - Giữ chỗ 10 phút, mở VNPay tại quầy, sao chép liên kết `guestAccessLink`. Trang thanh toán công khai xác thực bằng `accessCode` bí mật.
7. **Tích hợp Tuyến đường (`App.jsx`):**
   - Phân quyền `RoleRoute allowedRoles={['OWNER']}` bọc toàn bộ các trang Owner; cung cấp route công khai `/guest-pay/:paymentOrderId`.

---

### 1.2. Kiểm tra tính toàn vẹn tệp bàn giao (SHA-256 Manifest)

Reviewer đã đối chiếu độc lập bảng mã băm tại [`docs/phase-reports/P18-manifest.sha256`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/docs/phase-reports/P18-manifest.sha256) so với các tệp thực tế đang lưu trữ trên đĩa:

| STT | Đường dẫn tệp | SHA-256 Khai báo (Manifest) | SHA-256 Thực tế trên đĩa (Authoritative) | Đánh giá |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `client/src/services/owner.service.js` | `7c07db56a4067f5e4db8a5134d3e4577e876b9d89a073fb90288af2158960ffd` | `7c07db56a4067f5e4db8a5134d3e4577e876b9d89a073fb90288af2158960ffd` | ✅ Khớp 100% |
| 2 | `client/src/services/payment.service.js` | `677565e18f9030aaff8730fe656c196fb954b14b508b9ab9267d8a6f9586f1ea` | `677565e18f9030aaff8730fe656c196fb954b14b508b9ab9267d8a6f9586f1ea` | ✅ Khớp 100% |
| 3 | `client/src/pages/owner/OwnerDashboardPage.jsx` | `5e509b009006c78a9b7d2da54463c30c0da5add8d707ee2de6765c305424f074` | `5e509b009006c78a9b7d2da54463c30c0da5add8d707ee2de6765c305424f074` | ✅ Khớp 100% |
| 4 | `client/src/pages/owner/OwnerFacilitiesPage.jsx` | `674c12a0c1ff974868444563a25daf51b0ac73e876c3c977b19d564c705f22e9` | `674c12a0c1ff974868444563a25daf51b0ac73e876c3c977b19d564c705f22e9` | ✅ Khớp 100% |
| 5 | `client/src/pages/owner/OwnerCourtBlocksPage.jsx` | `bc0b206e70e74072adc859ee6d3b484ef368a0dd25e7d50fad4a9041a230d62c` | `bc0b206e70e74072adc859ee6d3b484ef368a0dd25e7d50fad4a9041a230d62c` | ✅ Khớp 100% |
| 6 | `client/src/pages/owner/OwnerBookingsPage.jsx` | `13b19fb73014bcc7dc7d56ae83f7781c838770bd05895652a0ae3512a642cd3c` | `13b19fb73014bcc7dc7d56ae83f7781c838770bd05895652a0ae3512a642cd3c` | ✅ Khớp 100% |
| 7 | `client/src/pages/owner/OwnerOnBehalfPage.jsx` | `74fac2aec1472868a0acfbcde73b0a8f79fcda04c76f4b2ba0abd60082250235` | `74fac2aec1472868a0acfbcde73b0a8f79fcda04c76f4b2ba0abd60082250235` | ✅ Khớp 100% |
| 8 | `client/src/pages/payment/GuestPayPage.jsx` | `bd5f3af924ebc63e5b4f73791a243230c8fd21b24affb8cbe2f371436af47879` | `bd5f3af924ebc63e5b4f73791a243230c8fd21b24affb8cbe2f371436af47879` | ✅ Khớp 100% |
| 9 | `client/src/App.jsx` | `fbf92bc08beec4fa0fc301d8888d37bd7617623e2e8259fc9fd4c3abb76c80e0` | `fbf92bc08beec4fa0fc301d8888d37bd7617623e2e8259fc9fd4c3abb76c80e0` | ✅ Khớp 100% |
| 10 | `client/src/services/__tests__/owner.service.test.js` | `1763d99bd5493f75b49aae5079a3d244556748a087463379ef7ae0164e88c4bd` | `1763d99bd5493f75b49aae5079a3d244556748a087463379ef7ae0164e88c4bd` | ✅ Khớp 100% |
| 11 | `client/src/pages/owner/__tests__/OwnerDashboardPage.test.jsx` | `3fe8ede9a19085a01d77b62c74a7bf435f3d4c13ee7cfe09eaa92959d2a0adc4` | `3fe8ede9a19085a01d77b62c74a7bf435f3d4c13ee7cfe09eaa92959d2a0adc4` | ✅ Khớp 100% |
| 12 | `client/src/pages/owner/__tests__/OwnerFacilitiesPage.test.jsx` | `6d251d48edf7f32b168dc10649d101bc199d6387d536792178ceebf2ad62f444` | `6d251d48edf7f32b168dc10649d101bc199d6387d536792178ceebf2ad62f444` | ✅ Khớp 100% |
| 13 | `client/src/pages/owner/__tests__/OwnerCourtBlocksPage.test.jsx` | `dba21b9c6cc3d6bfdd3f2177152ddb0ddc52389cb8b0096d69d6a9c5ecb3c60f` | `dba21b9c6cc3d6bfdd3f2177152ddb0ddc52389cb8b0096d69d6a9c5ecb3c60f` | ✅ Khớp 100% |
| 14 | `client/src/pages/owner/__tests__/OwnerBookingsPage.test.jsx` | `df7e76a06879f60c78af7a84dca7e701c89b2279d87ff1b2efb60a162edb3715` | `df7e76a06879f60c78af7a84dca7e701c89b2279d87ff1b2efb60a162edb3715` | ✅ Khớp 100% |
| 15 | `client/src/pages/owner/__tests__/OwnerOnBehalfPage.test.jsx` | `65a9e671a480e815515a682717e8eb23a7e8ebdce9c94c6ffe733fe56d9cbc7e` | `65a9e671a480e815515a682717e8eb23a7e8ebdce9c94c6ffe733fe56d9cbc7e` | ✅ Khớp 100% |

**Nhận xét:** Toàn bộ 15/15 tệp deliverables **khớp 100% từng byte** so với bảng mã băm SHA-256 chính thức. Khiếm khuyết sai lệch mã băm tại vòng review trước đã được giải quyết triệt để.

---

## 2. Đánh giá Chi tiết Từng Tiêu chí của Phase P18

Căn cứ `docs/planning/development-plan.md` (Phase P18) và `docs/features.md` (Mục 6, Tiêu chí 1–4, 6, 7, 9, 15, 16, 20, 21, 24, 25, 27, 28, 30, 31, 35, 42, 46, 52, 53):

| STT | Tiêu chí / Yêu cầu theo kế hoạch | Hiện trạng mã nguồn & Đánh giá kiểm chứng | Kết luận |
| :---: | :--- | :--- | :---: |
| **1** | **Dashboard chủ sân** (Doanh thu VNPay, đơn hôm nay, hoàn tất, hủy, lịch sắp tới, đơn quá hạn chưa xử lý) | [`OwnerDashboardPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/owner/OwnerDashboardPage.jsx) hiển thị 4 KPI cards, bộ lọc ngày & cơ sở, danh sách lịch thi đấu hôm nay, hộp cảnh báo đơn quá giờ chơi chưa xử lý kèm nút "Hoàn tất" và "No-show" thao tác nhanh. Test component PASS. | **ĐẠT** |
| **2** | **CRUD mềm cơ sở** (Xem, tạo mới, chỉnh sửa thông tin, cập nhật trạng thái `DRAFT` / `PUBLISHED` / `PAUSED`) | [`OwnerFacilitiesPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/owner/OwnerFacilitiesPage.jsx) (Tab `INFO`) đã bổ sung form chỉnh sửa tương tác đầy đủ (`btn-edit-facility`, `btn-save-facility-info`) gọi `ownerService.updateFacility`. Cung cấp nút chuyển đổi trạng thái tức thì `PUBLISHED` / `PAUSED` (`btn-publish-facility`, `btn-pause-facility`). Bắt lỗi `FACILITY_HAS_ACTIVE_BOOKINGS` hiển thị cảnh báo hướng dẫn. Test PASS. | **ĐẠT** |
| **3** | **Quản lý hình ảnh cơ sở** (Upload ảnh, chọn ảnh bìa, xóa ảnh) | [`OwnerFacilitiesPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/owner/OwnerFacilitiesPage.jsx) (Tab `IMAGES`) hỗ trợ tải ảnh qua multipart FormData, chọn ảnh đại diện (`setCoverImage`), xóa ảnh (`deleteFacilityImage`). | **ĐẠT** |
| **4** | **CRUD mềm sân con** (Xem, thêm sân con, sửa tên sân, cập nhật đơn giá giờ `pricePerHourVnd`, bật/tắt nhận đặt `isActive`) | [`OwnerFacilitiesPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/owner/OwnerFacilitiesPage.jsx) (Tab `COURTS`) bổ sung nút "Sửa sân" (`btn-edit-court-${id}`) mở modal sửa tên, đổi giá giờ, mô tả, toggle nhận đặt. Có nút toggle nhanh `isActive` trên thẻ sân (`btn-toggle-court-${id}`). Gọi `ownerService.updateCourt`. Hiển thị thông báo lưu ý giá mới chỉ áp dụng cho đơn sau này (OWN-05). Test PASS. | **ĐẠT** |
| **5** | **Form bước giờ/giờ hoạt động có preview và thông báo các lịch cản trở đổi cấu hình** (Tiêu chí 15, 30) | [`OwnerFacilitiesPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/owner/OwnerFacilitiesPage.jsx) (Tab `SPORTS`):<br>1. Có nút "Đổi bước giờ" (`btn-change-step-${id}`) mở modal chọn đổi giữa 30, 60, 90 phút qua `ownerService.updateFacilitySportStep`.<br>2. Component preview trực quan hiển thị các slot sinh ra và hiển thị rõ ràng hộp cảnh báo "Khoảng thời gian dư không nhận đặt: XX:XX - YY:YY" nếu thời lượng hoạt động không chia hết cho bước giờ (Criterion 30, OWN-05).<br>3. Khi backend từ chối đổi cấu hình do có đơn đang hoạt động (`FACILITY_HAS_ACTIVE_BOOKINGS`), UI hiển thị hộp cảnh báo cản trở đổi cấu hình kèm liên kết sang Bookings và CourtBlocks (Criterion 15). Test PASS. | **ĐẠT** |
| **6** | **Lịch theo sân/ngày, tạo/gỡ block bảo trì** (OWN-06, Tiêu chí 9, 31) | [`OwnerCourtBlocksPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/owner/OwnerCourtBlocksPage.jsx) kết nối `courtService.getCourtSchedule` hiển thị sơ đồ slot trực quan, chọn các slot cần khóa, bắt buộc nhập lý do, gọi `createCourtBlock`. Bảng danh sách lịch khóa có nút "Mở lại sân" (`deleteCourtBlock`). Hiển thị cảnh báo bảo vệ lịch. | **ĐẠT** |
| **7** | **Vận hành đơn đặt sân & Quy chuẩn 100% VNPay** (OWN-07, OWN-09, Tiêu chí 35, 53) | [`OwnerBookingsPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/owner/OwnerBookingsPage.jsx) lọc theo cơ sở, sân, ngày, trạng thái. Hiển thị thông tin liên hệ khách hàng (`contactName`, `contactPhone`). Hỗ trợ Hoàn tất phục vụ, No-show cho đơn `CONFIRMED`; Hủy giữ chỗ cho đơn `PENDING_PAYMENT`. Cảnh báo quy chuẩn 100% VNPay, hướng dẫn admin hỗ trợ đối với đơn đã trả tiền. | **ĐẠT** |
| **8** | **Tạo hộ khách vãng lai & Trang thanh toán GuestPay** (OWN-08, Tiêu chí 46, 52) | [`OwnerOnBehalfPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/owner/OwnerOnBehalfPage.jsx) tạo đơn giữ chỗ 10 phút, hiển thị nút mở VNPay thanh toán tại quầy và `guestAccessLink` kèm nút sao chép. Tuyệt đối không có nút tự đánh dấu tiền mặt. Trang [`GuestPayPage.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/pages/payment/GuestPayPage.jsx) xác thực `accessCode`, cho phép khách vãng lai thanh toán VNPay an toàn trên điện thoại. | **ĐẠT** |
| **9** | **Tích hợp Routes trong App.jsx** | [`App.jsx`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/client/src/App.jsx) phân quyền `RoleRoute allowedRoles={['OWNER']}` bọc toàn bộ 5 trang Owner. Đăng ký route công khai `/guest-pay/:paymentOrderId`. | **ĐẠT** |
| **10** | **Kiểm thử tự động & Biên dịch sản phẩm** | Vitest Client: 23 test files (90/90 tests) PASS 100%. Vite build: Hoàn tất trong 3.04s, 0 lỗi. Backend lint: 172 files đạt chuẩn. Backend tests: 52/52 test files PASS thành công trong 82.3s. | **ĐẠT** |

---

## 3. Kiểm chứng Độc lập Đã Chạy

Reviewer đã trực tiếp thực thi các lệnh kiểm chứng độc lập trên môi trường phát triển (Node.js v22.14.0, Vite v5.4.21, Vitest v2.1.9, Windows 11):

### 3.1. Đối chiếu mã băm SHA-256
- **Lệnh thực hiện:** Node.js script băm SHA-256 toàn bộ 15 tệp deliverable của Phase P18.
- **Kết quả:** **15/15 tệp khớp 100% tuyệt đối** với bản manifest bàn giao.

### 3.2. Bộ kiểm thử tự động Frontend Vitest (`npm --prefix client test`)
- **Lệnh thực hiện:** `npm --prefix client test`
- **Kết quả:**
  ```text
  Test Files  23 passed (23)
       Tests  90 passed (90)
    Duration  6.76s
  ```
- **Đánh giá:** **PASS 100%**. Bộ test `OwnerFacilitiesPage.test.jsx` đã được bổ sung bao phủ toàn diện 5 kịch bản (xem chi tiết, chỉnh sửa cơ sở & chuyển trạng thái PAUSED/PUBLISHED, xem preview bước giờ & đổi bước giờ 90m, cảnh báo xung đột lịch cản trở Tiêu chí 15, và chỉnh sửa sân con & đổi giá giờ theo OWN-05).

### 3.3. Kiểm tra Biên dịch Vite Production (`npm --prefix client run build`)
- **Lệnh thực hiện:** `npm --prefix client run build`
- **Kết quả:**
  ```text
  vite v5.4.21 building for production...
  transforming...
  ✓ 2090 modules transformed.
  rendering chunks...
  computing gzip size...
  dist/index.html                   0.88 kB │ gzip:   0.53 kB
  dist/assets/index-DW21AZ2w.css   45.23 kB │ gzip:   7.76 kB
  dist/assets/index-Cko5oez3.js   441.60 kB │ gzip: 109.36 kB
  ✓ built in 3.04s
  ```
- **Đánh giá:** **PASS 100%** (0 lỗi cú pháp hoặc đóng gói).

### 3.4. Kiểm tra Ranh giới Phase & Kiểm tra Cú pháp Backend
- **Lệnh thực hiện:** `npm run check:phase` và `npm run lint`
- **Kết quả:**
  ```text
  --- Kiểm tra trạng thái phase và cấu trúc dự án (check-phase) ---
  ✅ Cấu trúc docs/planning/phase-status.json hợp lệ và tuân thủ thứ tự tuần tự.
  ✅ Kiểm tra cổng frontend: Tuân thủ quy định không triển khai React trước gate BE_READY.
  🎉 Toàn bộ kiểm tra phase và ranh giới hệ thống: ĐẠT CHUẨN.

  Syntax check passed for 172 backend files.
  ```
- **Đánh giá:** **PASS**.

### 3.5. Kiểm tra Hồi quy Toàn bộ Bộ Kiểm thử Backend (`npm test`)
- **Lệnh thực hiện:** `npm test` (`node scripts/run-tests.js`)
- **Kết quả:**
  ```text
  ========================================
  Test Execution Summary:
  Total Files:  52
  Passed Files: 52
  Failed Files: 0
  Duration:     82.3s
  ========================================
  All 52 test files PASSED successfully!
  ```
- **Đánh giá:** **PASS 100%** (Hoàn toàn không có regression lên backend).

---

## 4. Quyết định Nghiệm thu Phase P18

Căn cứ vào quyền nghiệm thu được người dùng ủy quyền trực tiếp theo yêu cầu giao việc:
1. Toàn bộ 4 khiếm khuyết được chỉ ra tại vòng review trước (CRUD mềm cơ sở, CRUD mềm sân con, Form đổi bước giờ có preview thời gian dư Tiêu chí 30 và thông báo lịch cản trở Tiêu chí 15, Toàn vẹn mã băm SHA-256) đã được **khắc phục triệt để và kiểm chứng hoàn chỉnh**.
2. 15/15 tệp deliverable khớp 100% mã băm SHA-256 từ đĩa.
3. Bộ kiểm thử Vitest 23/23 test files (90/90 tests) PASS 100%; Vite build production 0 lỗi; toàn bộ 52 file test backend PASS 100%.
4. Tuân thủ nghiêm ngặt các ranh giới kiến trúc và nghiệp vụ: 100% doanh thu qua VNPay, không có nút tự đánh dấu tiền mặt, bảo vệ phân quyền RBAC `OWNER`, không lưu token vào localStorage.

**KẾT LUẬN NGHIỆM THU: ACCEPTED**

- Cập nhật [`docs/planning/phase-status.json`](file:///f:/FPT/Ky7/SDN302/Project/sport-booking/docs/planning/phase-status.json):
  - `phases[P18].status = "ACCEPTED"`
  - `phases[P18].review = "docs/phase-reports/P18-review.md"`
  - `phases[P18].accepted_by = "Independent Reviewer (Ủy quyền bởi người dùng)"`
  - `phases[P18].accepted_on = "2026-10-31"`
  - `phases[P18].accepted_revision = "docs/phase-reports/P18-manifest.sha256 (Khớp 100% 15/15 files thực tế trên đĩa)"`
  - `active_phase = null` (chờ người dùng chính thức giao tiếp Phase P19)
  - `next_candidate = "P19"`
  - Cổng `RELEASE_READY` tiếp tục giữ `CLOSED` cho tới khi hoàn tất Phase P20.
- Không tự ý triển khai mã nguồn của Phase P19 trong lượt review này.
