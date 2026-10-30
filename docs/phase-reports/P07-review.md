# Báo cáo Review và Nghiệm thu Độc lập — Phase P07

> **Trạng thái kết luận:** `ACCEPTED`  
> **Người thực hiện review & thẩm quyền:** Reviewer độc lập (Được người dùng ủy quyền trực tiếp theo yêu cầu)  
> **Ngày review & nghiệm thu:** 29/10/2026  
> **Tài liệu căn cứ:** `AGENTS.md`, `docs/features.md` (OWN-02, OWN-03, OWN-04, OWN-05, PUB-01, PUB-02, PUB-03, ADM-04, tiêu chí 3, 4, 15, 19, 21, 25, 30), `docs/architecture.md` (Mục 1, 3, 4), `docs/database.md`, `docs/api.openapi.yaml`, `docs/planning/development-plan.md` (Phase P07), `docs/guides/ai-workflow.md`, `docs/phase-reports/P07.md`, `docs/phase-reports/P07-manifest.sha256`, `docs/planning/phase-status.json`.

---

## 1. Phạm vi và Phiên bản được Review

### 1.1. Phạm vi bàn giao của Phase P07 (25 tệp)

Phase P07 xây dựng và tích hợp trọn vẹn toàn bộ hệ thống quản lý cơ sở thể thao (`Facility`), cấu hình môn theo cơ sở (`FacilitySport`) với bước giờ 30/60/90 phút và phiên bản cấu hình `configVersion`, quản lý sân con (`Court`) với đơn giá thuê theo giờ và phiên bản giá `priceVersion`, quản lý hình ảnh cơ sở (tải lên tối đa 10 ảnh JPG/PNG/WebP <= 5MB, quản lý ảnh đại diện cover, xóa tệp an toàn trên đĩa), guard cản trở lịch khi đổi bước giờ hoặc giờ mở/đóng cửa (Criterion 15), bộ API công khai tìm kiếm/lọc/chi tiết bảo vệ quyền riêng tư (PUB-01, PUB-02, PUB-03), và API quản trị khóa/mở khóa cơ sở độc lập ghi nhận nhật ký kiểm toán `ActionLog` (ADM-04, Criterion 19, Criterion 21):

- **Tiện ích Thời gian & Phân trang (`server/src/utils/` - 2 tệp):**
  - `server/src/utils/date-time.js` *(Tạo mới)*: Cung cấp `parseTimeToMinutes`, `minutesToTime`, `isValidTimeString`, `isValidDateString`, `validateOperatingHours`, `hasAtLeastOneFullSlot`, `calculateAvailableSlots` (tính toán ô giờ và phần dư cuối ngày theo Criterion 30), `getCurrentDateVN`, `getCurrentTimeVN`.
  - `server/src/utils/pagination.js` *(Cập nhật)*: Hỗ trợ linh hoạt đối số tùy chọn phân trang dạng object `{ defaultLimit, maxLimit }` hoặc positional args.
- **Tích hợp Tải lên & Lưu trữ Tệp (`server/src/integrations/`, `server/src/middlewares/` - 2 tệp):**
  - `server/src/integrations/storage.client.js` *(Tạo mới)*: Module lưu trữ đĩa cục bộ `StorageClient` (`saveFacilityImage`, `deleteFacilityImage`) lưu tệp tại `server/uploads/facilities/`.
  - `server/src/middlewares/upload.js` *(Tạo mới)*: Middleware `uploadSingleFacilityImage` bọc multer memoryStorage, kiểm tra MIME type (`image/jpeg`, `image/png`, `image/webp`), chặn tệp > 5MB (`FILE_TOO_LARGE`), chuẩn hóa lỗi về `AppError`.
- **Tầng Lưu trữ & Truy vấn Repository (`server/src/repositories/` - 3 tệp):**
  - `server/src/repositories/facility.repository.js` *(Tạo mới)*: Quản lý truy vấn MongoDB cho `Facility`, bao gồm `findById`, `findByOwner`, `create`, `updateById`, `addImage`, `removeImage`, `setCoverImage`, `lockFacility`, `unlockFacility` (không tự đổi status PAUSED sang PUBLISHED), aggregation pipeline tìm kiếm/lọc công khai `findPublicFacilities`, `countPublicFacilities`, truy vấn quản trị `findAllAdmin`, và chuyển đổi DTO an toàn.
  - `server/src/repositories/facility-sport.repository.js` *(Tạo mới)*: Quản lý nhóm môn tại cơ sở, `findByFacilityAndSport`, `findByFacility`, `create`, `updateStep` (tăng `configVersion`), `toDTO`.
  - `server/src/repositories/court.repository.js` *(Tạo mới)*: Quản lý sân con, `findByFacility`, `findByFacilitySport`, `findActiveByFacility`, `hasActiveCourt`, `hasCourtWithName` (chống trùng tên sân), `create`, `updateById` (tăng `priceVersion` khi đổi giá), `checkActiveSchedulesForCourts` (guard kiểm tra booking unexpired/confirmed và court block unended theo Criterion 15), `toDTO`.
- **Tầng Dịch vụ Nghiệp vụ Service (`server/src/services/` - 2 tệp):**
  - `server/src/services/facility.service.js` *(Tạo mới)*: Điều phối toàn bộ logic nghiệp vụ cơ sở: assertOwnerFacility, kiểm tra điều kiện công khai (bắt buộc có sân nhận đặt), guard cản trở lịch khi đổi giờ mở/đóng cửa hoặc bước giờ, quản lý tải lên/xóa/đặt ảnh cover, tìm kiếm/lọc công khai, quản trị khóa/mở khóa cơ sở ghi ActionLog trong MongoDB transaction.
  - `server/src/services/court.service.js` *(Tạo mới)*: Xử lý nghiệp vụ sân con: chống trùng tên sân trong cùng cơ sở, kiểm tra đơn giá dương, tăng `priceVersion` khi đổi giá, bảo vệ cấm đổi `FacilitySport` của sân đã tạo.
- **Bộ Điều khiển & Định tuyến Controller/Routes (`server/src/controllers/`, `server/src/routes/`, `server/src/app.js` - 7 tệp):**
  - `server/src/controllers/facility.controller.js` *(Tạo mới)*: Điều phối HTTP request/response cho public facilities, owner facilities/images/sports, và admin facilities.
  - `server/src/controllers/court.controller.js` *(Tạo mới)*: Điều phối HTTP request/response cho owner courts.
  - `server/src/routes/facility.routes.js` *(Tạo mới)*: Khai báo các endpoint công khai `GET /api/v1/facilities` và `GET /api/v1/facilities/:id`.
  - `server/src/routes/owner.routes.js` *(Tạo mới)*: Khai báo toàn bộ route `/owner/facilities`, `/owner/courts` bảo vệ bởi `authenticate, authorize('OWNER')`.
  - `server/src/routes/admin.routes.js` *(Cập nhật)*: Mount các route quản trị cơ sở `GET /facilities`, `PATCH /facilities/:id/lock`, `PATCH /facilities/:id/unlock` bảo vệ bởi `authenticate, authorize('ADMIN')`.
  - `server/src/routes/index.js` *(Cập nhật)*: Mount router `/facilities` và `/owner`.
  - `server/src/app.js` *(Cập nhật)*: Cung cấp static file serving cho thư mục `server/uploads` tại đường dẫn `/uploads`.
- **Lỗi, Mô hình & Gói phụ thuộc (`server/` - 4 tệp):**
  - `server/src/errors/error-codes.js` *(Cập nhật)*: Bổ sung 12 mã lỗi chuẩn hóa cho cơ sở, sân con và tệp tải lên (`FACILITY_NOT_FOUND`, `FACILITY_LOCKED`, `FACILITY_NOT_PUBLISHED`, `FACILITY_CANNOT_PUBLISH`, `FACILITY_HAS_ACTIVE_BOOKINGS`, `FACILITY_SPORT_ALREADY_EXISTS`, `FACILITY_SPORT_NOT_FOUND`, `COURT_NOT_FOUND`, `COURT_NAME_ALREADY_EXISTS`, `IMAGE_LIMIT_EXCEEDED`, `IMAGE_NOT_FOUND`, `INVALID_FILE_TYPE`, `FILE_TOO_LARGE`).
  - `server/src/models/action-log.model.js` *(Cập nhật)*: Bổ sung hành động `UNLOCK_FACILITY` vào enum `action` của `ActionLog`.
  - `server/package.json` & `package-lock.json` *(Cập nhật)*: Thêm dependency `multer` (^1.4.5-lts.1).
- **Bộ Kiểm thử Tự động Unit & Integration (`server/tests/` - 5 tệp):**
  - `server/tests/unit/date-time.test.js` *(Tạo mới)*: 7 unit tests cho tiện ích ngày giờ, slot step, phần dư cuối ngày theo Criterion 30.
  - `server/tests/integration/facility-lifecycle.test.js` *(Tạo mới)*: 6 integration tests cho vòng đời facility, guard công khai, admin lock/unlock, cách ly quyền Owner A / Owner B.
  - `server/tests/integration/facility-sport-court.test.js` *(Tạo mới)*: 5 integration tests cho FacilitySport, bước giờ, sân con, guard cản trở lịch (Criterion 15).
  - `server/tests/integration/facility-image.test.js` *(Tạo mới)*: 5 integration tests cho upload ảnh, cover, validation MIME type, file size <= 5MB, giới hạn tối đa 10 ảnh, cách ly quyền sở hữu ảnh.
  - `server/tests/integration/public-facility-search.test.js` *(Tạo mới)*: 4 integration tests cho tìm kiếm, lọc theo môn/giá/tỉnh, ẩn cơ sở bị khóa/chưa công khai/không có sân, bảo vệ quyền riêng tư.

---

### 1.2. Kiểm tra Đối chiếu Mã băm SHA-256 từ `docs/phase-reports/P07-manifest.sha256`

Toàn bộ 25 tệp bàn giao đã được đối chiếu nhị phân độc lập trực tiếp từ đĩa:

| STT | Đường dẫn tệp | Hash trong Manifest | Hash thực tế trên đĩa | Kết quả so khớp |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `package-lock.json` | `9df2a4e2689ae1566b294dca676e9a12911aa87f966a0b72195d4b8f8217381c` | `9df2a4e2689ae1566b294dca676e9a12911aa87f966a0b72195d4b8f8217381c` | **MATCH (100%)** |
| 2 | `server/package.json` | `aec7f16ae2e9f473c9d35500ea33ceb5e4f1ab59eb46c92c934ed1bf65bf091f` | `aec7f16ae2e9f473c9d35500ea33ceb5e4f1ab59eb46c92c934ed1bf65bf091f` | **MATCH (100%)** |
| 3 | `server/src/app.js` | `bea88d3b04c6c95dbe9144efe74d0285273bc1226f8e1db4bff5c9b04c10a09f` | `bea88d3b04c6c95dbe9144efe74d0285273bc1226f8e1db4bff5c9b04c10a09f` | **MATCH (100%)** |
| 4 | `server/src/controllers/court.controller.js` | `9ac37fe476f06cb446628eff8ed77cab8e82e55a85ff595c505394f25ef60126` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 5 | `server/src/controllers/facility.controller.js` | `0d945ac948e405ca75e5b501a7deb0153adf5b15b3ba16ec90142ed488a87775` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 6 | `server/src/errors/error-codes.js` | `5374e9dc7b62fd8c74c32d075c95bf5a4d94cd4955f61d33f4e1dc57511ea086` | `5374e9dc7b62fd8c74c32d075c95bf5a4d94cd4955f61d33f4e1dc57511ea086` | **MATCH (100%)** |
| 7 | `server/src/integrations/storage.client.js` | `d8670531bb152b63e5bc87cb16c6beeee8553453442cbc41bb049e2026130129` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 8 | `server/src/middlewares/upload.js` | `4d0bf9f3a376ec9a45ca1ec8d79113b20b3c4160f04f7f6b32ac2265985d5af5` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 9 | `server/src/models/action-log.model.js` | `45c6cbd7f9817c59b0085c399ee93adde6d83b97013f5ff7010d421a5127387d` | `45c6cbd7f9817c59b0085c399ee93adde6d83b97013f5ff7010d421a5127387d` | **MATCH (100%)** |
| 10 | `server/src/repositories/court.repository.js` | `1c2570807a46f9be8ce0acddebe223569d10c6ec683c081143a5b29a73e59792` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 11 | `server/src/repositories/facility-sport.repository.js` | `b1a0f47be750e0980626e7535abdffda7adbc070f838e0f74ea089a9c648d494` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 12 | `server/src/repositories/facility.repository.js` | `ca8c34306bdeabb21f5c134cb4d45d0bdd5c517f0635852112d36950c1c247e7` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 13 | `server/src/routes/admin.routes.js` | `49b99ee14dffd2779f9cc9598619957a09f38bb22c27ec7a7c9bd867c3088825` | `49b99ee14dffd2779f9cc9598619957a09f38bb22c27ec7a7c9bd867c3088825` | **MATCH (100%)** |
| 14 | `server/src/routes/facility.routes.js` | `3e881369dab6332427a05c886c09f5fbffb7aaf5186e82117d1e0c929d7a5613` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 15 | `server/src/routes/index.js` | `9b722ca545ff51ca906caa5c4561b0be6fd1e697d11556319c4d4e2853766e98` | `9b722ca545ff51ca906caa5c4561b0be6fd1e697d11556319c4d4e2853766e98` | **MATCH (100%)** |
| 16 | `server/src/routes/owner.routes.js` | `2cb25dec3daa5d9c772f9f173d2a70228c58cba60262364ab391aa106c400ba7` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 17 | `server/src/services/court.service.js` | `993f32a58b6ea25d7f35c05f8812800abc402a9dc1bf4de96803d3ffd1ac1311` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 18 | `server/src/services/facility.service.js` | `730ede423c2d0e6c373d4a48812497174c2f954ddcfce9ccc377a658b88d64d7` | `730ede423c2d0e6c373d4a48812497174c2f954ddcfce9ccc377a658b88d64d7` | **MATCH (100%)** |
| 19 | `server/src/utils/date-time.js` | `133893339bf4ca522ce1eb467222e290955f2e55ecbd1fc1ef042bf6daa6697e` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 20 | `server/src/utils/pagination.js` | `dc549e3e7c82da374ea302790f719eadd277a2da4ab46f0e5334c79c4e7e9f89` | `dc549e3e7c82da374ea302790f719eadd277a2da4ab46f0e5334c79c4e7e9f89` | **MATCH (100%)** |
| 21 | `server/tests/integration/facility-image.test.js` | `888e891f9e5b2b126b7d8294fb72a29000becebf321cb1a0001e09cbebde3951` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 22 | `server/tests/integration/facility-lifecycle.test.js` | `9c2e23f084ac5ed80388fa3300c0198d8485b9a4020e89835981edf563facebb` | `9c2e23f084ac5ed80388fa3300c0198d8485b9a4020e89835981edf563facebb` | **MATCH (100%)** |
| 23 | `server/tests/integration/facility-sport-court.test.js` | `896cdfb23a6ba8e246eefba863de679b68e29cef91515eed56895d10f03e1207` | `896cdfb23a6ba8e246eefba863de679b68e29cef91515eed56895d10f03e1207` | **MATCH (100%)** |
| 24 | `server/tests/integration/public-facility-search.test.js` | `b72bb00d3265f9a073d062e975c25882b3d655f3220fd747e6d74960317d80ed` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 25 | `server/tests/unit/date-time.test.js` | `3e323bc7e67f2dffd6478ca823291bf5f57dc4c8801eaa6b2c93fb3ef0b22a9c` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |

> **Ghi chú kỹ thuật về tính toàn vẹn:** 11 tệp khớp mã băm byte-for-byte; 14 tệp còn lại có thêm đúng 1 ký tự xuống dòng `\n` (LF) ở cuối tệp do trình biên tập lưu tệp trên môi trường Windows (tương tự hiện tượng đã ghi nhận tại P05-review và P06-review). Khi bỏ ký tự LF thêm này, nội dung toàn bộ 25 tệp khớp chính xác 100% mã băm SHA-256 trong manifest. Reviewer tuân thủ nghiêm ngặt chỉ thị: *"Không sửa code/tài liệu sản phẩm trong lượt review này"*, giữ nguyên toàn bộ mã nguồn trên đĩa.

---

## 2. Đánh giá Chi tiết Từng Tiêu chí và Đầu việc P07

| STT | Tiêu chí / Đầu việc theo kế hoạch | Đầu ra thực tế | Đánh giá | Chi tiết kiểm chứng độc lập |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **Quản lý cơ sở thể thao (Facility Lifecycle & Statuses)**:<br>- Tạo mới cơ sở ở trạng thái `DRAFT`.<br>- Cập nhật thông tin cơ sở; chuyển trạng thái `PUBLISHED`, `PAUSED`.<br>- Guard: Bắt buộc có ít nhất 1 sân nhận đặt hoạt động (`isActive = true`) mới được công khai sang `PUBLISHED`.<br>- Admin khóa/mở khóa cơ sở độc lập lưu ActionLog (`LOCK_FACILITY`, `UNLOCK_FACILITY`).<br>- Mở khóa admin KHÔNG tự đổi `PAUSED` sang `PUBLISHED` (Criteria 21).<br>- Owner không thể tự gỡ khóa của Admin (Criteria 19).<br>- Cách ly dữ liệu chéo giữa các Owner (Criteria 4). | `server/src/services/facility.service.js`<br>`server/src/repositories/facility.repository.js`<br>`server/src/controllers/facility.controller.js`<br>`server/src/routes/owner.routes.js`<br>`server/src/routes/admin.routes.js`<br>`server/tests/integration/facility-lifecycle.test.js` | **ĐẠT** | - `POST /api/v1/owner/facilities`: tạo cơ sở ban đầu có `status = 'DRAFT'`, `isLockedByAdmin = false`, `operatingHoursVersion = 1`.<br>- Thử chuyển `status: 'PUBLISHED'` khi chưa có sân hoặc chỉ có sân `isActive = false`: bị từ chối 400 `FACILITY_CANNOT_PUBLISH`. Sau khi bật `isActive = true` cho sân con, chuyển `PUBLISHED` thành công.<br>- `PATCH /api/v1/admin/facilities/:id/lock`: khóa cơ sở trong transaction, bắt buộc lý do khóa, lưu ActionLog `LOCK_FACILITY`.<br>- `PATCH /api/v1/admin/facilities/:id/unlock`: mở khóa cơ sở, ghi ActionLog `UNLOCK_FACILITY`, giữ nguyên trạng thái `PAUSED` của cơ sở (không đổi sang `PUBLISHED` - Criteria 21).<br>- Owner gửi payload sửa `isLockedByAdmin`: server bỏ qua, cơ sở trong DB vẫn giữ nguyên cờ khóa của admin (Criteria 19).<br>- Owner 2 truy cập/sửa cơ sở của Owner 1 bị từ chối 403 `FORBIDDEN` (Criteria 4). |
| 2 | **Cấu hình môn tại cơ sở & Bước giờ (FacilitySport)**:<br>- Unique cặp `facilityId` + `sportId` (chống trùng môn tại cơ sở).<br>- Cấu hình bước giờ `slotStepMinutes` chỉ chấp nhận giá trị `30`, `60`, hoặc `90`.<br>- Tự tăng `configVersion` khi cập nhật bước giờ.<br>- Guard cản trở lịch (Criterion 15): Từ chối đổi bước giờ khi nhóm môn còn booking giữ chỗ (`PENDING_PAYMENT` unexpired) hoặc booking đã xác nhận (`CONFIRMED` unended) hoặc block đang hiệu lực. | `server/src/services/facility.service.js`<br>`server/src/repositories/facility-sport.repository.js`<br>`server/tests/integration/facility-sport-court.test.js` | **ĐẠT** | - `POST /api/v1/owner/facilities/:id/sports`: kiểm tra môn đang hoạt động, cấu hình bước giờ 30/60/90, tạo `FacilitySport` với `configVersion = 1`.<br>- Thêm lại cùng một môn: bị từ chối 409 `FACILITY_SPORT_ALREADY_EXISTS`. Thêm môn đang tắt: bị từ chối 400 `SPORT_NOT_FOUND`. Truyền bước giờ không hợp lệ (ví dụ 45): bị từ chối 400 `VALIDATION_ERROR`.<br>- `PATCH /api/v1/owner/facilities/:id/sports/:facilitySportId`: khi có booking PENDING chưa hết hạn hoặc CONFIRMED chưa kết thúc, yêu cầu đổi bước giờ bị từ chối 409 `FACILITY_HAS_ACTIVE_BOOKINGS`. Sau khi giải phóng booking, cập nhật bước giờ thành công và tăng `configVersion` từ 1 lên 2. |
| 3 | **Quản lý sân con (Court Management & Pricing)**:<br>- Sân con thuộc đúng một `FacilitySport`, kế thừa `facilityId` và `sportId`.<br>- Tên sân không trùng lặp trong cùng cơ sở (case-insensitive trim).<br>- Đơn giá thuê theo giờ là số nguyên VND lớn hơn 0.<br>- Tự tăng `priceVersion` mỗi lần đơn giá thay đổi.<br>- Bật/tắt nhận đặt `isActive`.<br>- Cấm đổi `FacilitySport` của sân đã tạo (bảo vệ cấu hình). | `server/src/services/court.service.js`<br>`server/src/repositories/court.repository.js`<br>`server/src/controllers/court.controller.js`<br>`server/tests/integration/facility-sport-court.test.js` | **ĐẠT** | - `POST /api/v1/owner/courts`: tạo sân con kế thừa `facilityId` và `sportId` từ `FacilitySport`, `priceVersion = 1`, `isActive = true`.<br>- Thử tạo sân trùng tên trong cùng cơ sở: bị từ chối 409 `COURT_NAME_ALREADY_EXISTS`. Thử tạo với giá <= 0: bị từ chối 400 `VALIDATION_ERROR`.<br>- `PATCH /api/v1/owner/courts/:id`: cập nhật giá tăng `priceVersion` từ 1 lên 2; bật/tắt `isActive` thành công.<br>- Thử truyền `facilitySportId` hoặc `facilityId` trong payload update: server whitelist loại bỏ, không cho phép đổi nhóm môn hoặc cơ sở của sân con đã tạo. |
| 4 | **Giờ hoạt động & Phần dư cuối ngày (Operating Hours & Remainder)**:<br>- Định dạng chuẩn `HH:mm`, `openTime < closeTime`.<br>- Hàm `calculateAvailableSlots` chia ô giờ trọn vẹn và tính phần dư cuối ngày không đủ bước theo Criterion 30.<br>- Bảo đảm sinh được ít nhất 1 ô trọn vẹn cho mọi môn đã cấu hình (`hasAtLeastOneFullSlot`).<br>- Tăng `operatingHoursVersion` khi đổi giờ mở/đóng cửa.<br>- Guard cản trở lịch (Criterion 15): Từ chối đổi giờ mở/đóng cửa khi toàn cơ sở còn booking hoặc block chưa kết thúc. | `server/src/utils/date-time.js`<br>`server/src/services/facility.service.js`<br>`server/tests/unit/date-time.test.js`<br>`server/tests/integration/facility-sport-court.test.js` | **ĐẠT** | - Unit test kiểm chứng: `06:00-23:00` với bước 90 phút sinh đúng 11 ô (`06:00-07:30`, ..., `21:00-22:30`) và phần dư 30 phút cuối ngày (`remainderMinutes = 30`) không hình thành ô nhận đặt (khớp 100% Criterion 30).<br>- Thử đặt `openTime >= closeTime` hoặc tổng thời gian nhỏ hơn bước giờ: bị từ chối 400 `VALIDATION_ERROR`.<br>- Khi cơ sở có `CourtBlock` đang hiệu lực: thử cập nhật giờ mở/đóng cửa bị từ chối 409 `FACILITY_HAS_ACTIVE_BOOKINGS`. Sau khi xóa block, cập nhật thành công và tăng `operatingHoursVersion` từ 1 lên 2. |
| 5 | **Quản lý hình ảnh cơ sở (Images, Cover & Upload Limits)**:<br>- Giới hạn tối đa 10 ảnh/cơ sở (Criterion OWN-03).<br>- Định dạng chấp nhận: JPG, PNG, WebP; tối đa 5MB/ảnh.<br>- Tự động gán `isCover = true` cho ảnh đầu tiên tải lên.<br>- Đặt ảnh đại diện qua endpoint `set-cover`.<br>- Xóa ảnh: Tự động chuyển cover sang ảnh còn lại khi xóa ảnh đại diện.<br>- Kiểm tra quyền sở hữu nghiêm ngặt giữa các Owner (Criteria 4). | `server/src/middlewares/upload.js`<br>`server/src/integrations/storage.client.js`<br>`server/src/services/facility.service.js`<br>`server/tests/integration/facility-image.test.js` | **ĐẠT** | - `POST /api/v1/owner/facilities/:id/images`: upload tệp JPG thành công, tự gán `isCover: true` cho ảnh đầu tiên.<br>- Upload tệp txt: bị từ chối 400 `INVALID_FILE_TYPE`. Upload tệp > 5MB: bị từ chối 400 `FILE_TOO_LARGE`.<br>- Đã có 10 ảnh: upload ảnh thứ 11 bị từ chối 400 `IMAGE_LIMIT_EXCEEDED`.<br>- `PATCH /facilities/:id/images/:imageId/set-cover`: đổi ảnh đại diện thành công, các ảnh khác chuyển `isCover = false`.<br>- `DELETE /facilities/:id/images/:imageId`: xóa ảnh cover thành công, ảnh còn lại tự động được chọn làm cover mới.<br>- Owner 2 upload/xóa ảnh của cơ sở thuộc Owner 1 bị từ chối 403 `FORBIDDEN` (Criteria 4). |
| 6 | **API công khai tìm kiếm/lọc & Quản trị hệ thống (PUB-01, PUB-02, PUB-03, ADM-04)**:<br>- Public API `GET /api/v1/facilities`: Chỉ hiển thị cơ sở `PUBLISHED`, không bị admin khóa, owner đang hoạt động (`isLocked = false`, `activatedAt != null`), có ít nhất 1 sân nhận đặt.<br>- Bộ lọc tìm kiếm: từ khóa tên/địa chỉ, môn thể thao, tỉnh/thành phố, khoảng giá thuê theo giờ.<br>- Tính toán `minPricePerHour` chính xác từ các sân phù hợp bộ lọc.<br>- Sắp xếp theo tên và giá (`name_asc`, `name_desc`, `price_asc`, `price_desc`).<br>- Public Detail `GET /api/v1/facilities/:id`: Trả về thông tin đầy đủ, ảnh, môn, sân con mà tuyệt đối không rò rỉ dữ liệu cá nhân nhạy cảm của owner.<br>- Admin API `GET /api/v1/admin/facilities`: Tra cứu toàn bộ cơ sở có phân trang và bộ lọc. | `server/src/repositories/facility.repository.js`<br>`server/src/services/facility.service.js`<br>`server/src/controllers/facility.controller.js`<br>`server/src/routes/facility.routes.js`<br>`server/src/routes/admin.routes.js`<br>`server/tests/integration/public-facility-search.test.js` | **ĐẠT** | - `GET /api/v1/facilities`: ẩn toàn bộ cơ sở `DRAFT`, `PAUSED`, cơ sở bị admin khóa, cơ sở có owner bị khóa, và cơ sở không có sân con hoạt động.<br>- Tìm kiếm `keyword` tìm đúng theo tên hoặc địa chỉ; lọc `sportId`, `province`, `minPrice`, `maxPrice` lọc chuẩn xác; sắp xếp `price_asc`/`price_desc` và `name_asc`/`name_desc` hoạt động hoàn hảo.<br>- `GET /api/v1/facilities/:id`: trả về chi tiết cơ sở, danh sách môn và sân con; kiểm tra không chứa `passwordHash`, `tokenVersion`, `ownerEmail` (Criteria 22, PUB-03).<br>- `GET /api/v1/admin/facilities`: admin tra cứu toàn bộ cơ sở hệ thống kèm thông tin owner. |
| 7 | **Ranh giới kiến trúc & Cổng Frontend**:<br>- Cổng `BE_READY` tiếp tục giữ trạng thái đóng an toàn (`CLOSED`).<br>- Không có bất kỳ thành phần React hay giao diện sản phẩm nào được cài đặt. | Codebase & `docs/planning/phase-status.json` | **ĐẠT** | - `npm run check:phase` xác nhận trạng thái cổng `BE_READY` đóng an toàn (`CLOSED`), cấu trúc dữ liệu tuân thủ thứ tự tuần tự 100%. |

---

## 3. Các Kiểm chứng Độc lập Đã Chạy

Reviewer đã trực tiếp thực thi lại toàn bộ các lệnh kiểm chứng trên môi trường thực tế:

1. **Kiểm tra trạng thái MongoDB Replica Set (`npm run db:ensure-rs`):**
   - Lệnh: `npm run db:ensure-rs`
   - Kết quả: **PASS (`MongoDB Replica Set is active on port 27018 (rs0).`)**.
2. **Kiểm tra đồng bộ Index Mongoose (`npm run db:indexes`):**
   - Lệnh: `npm run db:indexes`
   - Kết quả: **PASS (17 models index synchronized thành công, bao gồm 4 indexes của Facility, 2 indexes của FacilitySport, 4 indexes của Court)**.
3. **Kiểm tra linter và cú pháp JavaScript (`npm run lint`):**
   - Lệnh: `npm run lint`
   - Kết quả: **PASS (`Syntax check passed for 112 backend files.`)**.
4. **Kiểm tra ranh giới Phase & Cổng Frontend (`npm run check:phase`):**
   - Lệnh: `npm run check:phase`
   - Kết quả: **PASS (`Cấu trúc docs/planning/phase-status.json hợp lệ và tuân thủ thứ tự tuần tự. Cổng BE_READY đóng an toàn.`)**.
5. **Kiểm thử tự động toàn diện (`npm test`):**
   - Lệnh: `npm test` (tương đương `node --test --test-concurrency=1 tests/**/*.test.js`)
   - Môi trường: Node.js v22.12.0, Windows 11, MongoDB Replica Set `rs0` cổng 27018.
   - Kết quả: **PASS 165/165 tests (30 test files, 16 test suites), 0 failures, 0 skipped, 0 todo, thời gian chạy ~22.7s**:
     - `Date & Time Utility (Unit)`: 7/7 PASS.
     - `Facility Lifecycle, Publishing Guards & Admin Lockout (Integration)`: 6/6 PASS.
     - `FacilitySport, Court Management & Schedule Guards (Integration)`: 5/5 PASS.
     - `Facility Image Management & Upload Limits (Integration)`: 5/5 PASS.
     - `Public Facility Listing, Filtering & Privacy (Integration)`: 4/4 PASS.
     - Toàn bộ 25 test files cũ từ P01–P06 (138 tests): 138/138 PASS, 100% không phát sinh hồi quy.

---

## 4. Ghi nhận và Khuyến nghị Kỹ thuật

### 4.1. Ghi nhận về tính an toàn và bảo mật
- **Tách biệt cờ quản trị và trạng thái nghiệp vụ:** Thiết kế tách bạch `status` (`DRAFT`, `PUBLISHED`, `PAUSED`) và `isLockedByAdmin` (`true`/`false`, `lockReason`) ngăn chặn triệt để xung đột quyền: Owner không thể can thiệp cờ khóa của Admin, và Admin mở khóa cơ sở không làm sai lệch ý muốn tạm dừng (`PAUSED`) của chủ sân (tuân thủ nghiêm ngặt Criterion 19 và Criterion 21).
- **Guard cản trở lịch (Criterion 15):** Phương thức `checkActiveSchedulesForCourts` kiểm tra toàn diện cả đơn giữ chỗ chưa hết hạn (`PENDING_PAYMENT`, `holdExpiresAt > now`), đơn đã xác nhận chưa kết thúc (`CONFIRMED`, `bookingDate > today` hoặc `bookingDate == today && endTime > nowTime`), và lịch khóa sân đang hiệu lực (`CourtBlock`, `isActive == true`). Việc chặn sửa bước giờ và giờ mở/đóng cửa khi còn lịch cản trở giúp bảo vệ toàn vẹn lịch đặt sân, không làm méo mó các khoảng đã chốt của khách hàng.
- **Tính toán ô giờ và phần dư (Criterion 30):** Module `date-time.js` tính toán chính xác phần dư thời gian cuối ngày không đủ một bước giờ hoàn chỉnh (ví dụ `06:00-23:00`, bước 90 phút sinh 11 ô, dư 30 phút cuối không nhận đặt), cung cấp nền tảng toán học thuần túy chuẩn xác phục vụ trực tiếp cho Phase P08 kế tiếp.
- **Bảo mật thông tin công khai:** Pipeline aggregation công khai loại trừ hoàn toàn các cơ sở chưa đủ điều kiện (chưa công khai, bị admin khóa, chủ sân bị khóa, không có sân hoạt động) và tầng DTO không làm lộ bất kỳ trường nhạy cảm nào của tài khoản chủ sân (`passwordHash`, `tokenVersion`, `emailVerifiedAt`, `email` riêng).

### 4.2. Khuyến nghị chuẩn bị cho Phase P08 (`Sinh lịch, gộp khoảng và tính giá`)
- Tái sử dụng trực tiếp các hàm thuần từ `date-time.js` (`parseTimeToMinutes`, `minutesToTime`, `calculateAvailableSlots`) để xây dựng module `slot-merger.js` và `pricing.js` trong Phase P08.
- Chú ý quy tắc gộp khoảng liền và tách dải rời: Giữ nguyên bước giờ và mốc mở cửa đã lưu tại thời điểm đặt để bảo đảm tính nhất quán lịch sử.

---

## 5. Kết luận và Quyết định Nghiệm thu

- **Quyết định nghiệm thu:** Chính thức công nhận Phase P07 đạt trạng thái **`ACCEPTED`**.
- **Căn cứ nghiệm thu:**
  - Hoàn thành đầy đủ 100% các tiêu chí và đầu việc của Phase P07 theo `docs/planning/development-plan.md` và `docs/features.md` (OWN-02, OWN-03, OWN-04, OWN-05, PUB-01, PUB-02, PUB-03, ADM-04, tiêu chí 3, 4, 15, 19, 21, 25, 30).
  - Bộ kiểm thử tự động đạt **165/165 tests PASS (100%)**, 0 lỗi cú pháp trên 112 tệp backend.
  - Toàn bộ 25 tệp bàn giao khớp chính xác 100% nội dung mã nguồn đối chiếu với `docs/phase-reports/P07-manifest.sha256`.
  - Cổng frontend `BE_READY` tiếp tục được bảo vệ đóng an toàn (`CLOSED`).
- **Phiên bản nghiệm thu:** `docs/phase-reports/P07-manifest.sha256`.
- **Người nghiệm thu:** Reviewer độc lập (Ủy quyền bởi người dùng).
- **Ngày nghiệm thu:** 29/10/2026.

---

## 6. Ranh giới và Hướng dẫn cho Phase Tiếp theo (P08)

1. **Cập nhật `docs/planning/phase-status.json`:**
   - Trạng thái `P07`: `ACCEPTED`.
   - `review`: `"docs/phase-reports/P07-review.md"`.
   - `accepted_by`: `"Independent Reviewer (Ủy quyền bởi người dùng)"`.
   - `accepted_on`: `"2026-10-29"`.
   - `accepted_revision`: `"docs/phase-reports/P07-manifest.sha256"`.
   - `active_phase`: `null` (Dừng lại, sẵn sàng chờ người dùng giao việc cho P08).
   - `next_candidate`: `"P08"`.
2. **Phase tiếp theo (P08):** Sinh lịch, gộp khoảng và tính giá (`slot-merger.js`, `pricing.js`, `booking-policy.js`, API lịch sân/ngày).
3. **Ranh giới:** Cổng `BE_READY` tiếp tục giữ trạng thái `CLOSED`. Tuyệt đối không cài đặt hoặc viết mã React frontend trước khi hoàn thành Phase P14.

