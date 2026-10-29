# Báo cáo Review và Nghiệm thu Độc lập — Phase P02

> **Trạng thái kết luận:** `ACCEPTED`  
> **Người thực hiện review & thẩm quyền:** Reviewer độc lập (Được người dùng ủy quyền trực tiếp theo yêu cầu)  
> **Ngày review ban đầu:** 29/10/2026 (`NEEDS_CHANGES`)  
> **Ngày tái review & nghiệm thu:** 29/10/2026 (`ACCEPTED`)  
> **Tài liệu căn cứ:** `AGENTS.md`, `docs/features.md`, `docs/architecture.md`, `docs/database.md`, `docs/planning/development-plan.md`, `docs/guides/ai-workflow.md`, `docs/phase-reports/P02.md`, `docs/planning/phase-status.json`.

---

## 1. Phạm vi và Phiên bản được Review

### 1.1. Phạm vi bàn giao của Phase P02 (37 tệp)
Phase P02 thiết lập hạ tầng lưu trữ MongoDB Replica Set (`rs0`), database test biệt lập, khai báo 17 Mongoose models/schemas chuẩn hóa theo `docs/database.md`, xây dựng helper `withTransaction` ACID, cơ chế phối hợp ghi lịch nguyên tử `CourtDaySchedule`, scripts sync index, seed admin độc lập và bộ dữ liệu fixtures kiểm thử:

- **Hạ tầng Replica Set & Quản trị mã nguồn (5 tệp):**
  - `scripts/ensure-mongo-rs.js`: Tiện ích tự động kiểm tra/khởi động MongoDB Replica Set trên cổng 27018.
  - `.gitignore`: Bổ sung bỏ qua thư mục dữ liệu cục bộ `.mongodb-rs/`.
  - `package.json` & `server/package.json`: Cấu hình scripts `db:ensure-rs`, `db:indexes`, `db:seed`.
  - `server/.env.example`: Cấu hình mẫu URI cổng 27018 với `replicaSet=rs0`.
  - `server/README.md` & `README.md`: Hướng dẫn vận hành DB và các lệnh CLI.
- **Tầng giao dịch và Models Mongoose (`server/src/` - 19 tệp):**
  - `server/src/database/transaction.js`: Helper `withTransaction` hỗ trợ ACID và tái sử dụng session lồng nhau.
  - `server/src/models/user.model.js`: Model `User` (`CUSTOMER`, `OWNER`, `ADMIN`).
  - `server/src/models/auth-token.model.js`: Model `AuthToken` (TTL 7 ngày sau khi hết hạn).
  - `server/src/models/auth-session.model.js`: Model `AuthSession` (TTL 1 ngày sau hạn tuyệt đối).
  - `server/src/models/refresh-token.model.js`: Model `RefreshToken` (TTL 7 ngày).
  - `server/src/models/sport.model.js`: Model `Sport`.
  - `server/src/models/facility.model.js`: Model `Facility` (tối đa 10 ảnh, text index).
  - `server/src/models/facility-sport.model.js`: Model `FacilitySport` (bước 30, 60, 90 phút).
  - `server/src/models/court.model.js`: Model `Court` (giá theo giờ > 0).
  - `server/src/models/court-day-schedule.model.js`: Model `CourtDaySchedule` (unique courtId + bookingDate).
  - `server/src/models/court-block.model.js`: Model `CourtBlock`.
  - `server/src/models/booking-request.model.js`: Model `BookingRequest` (unique createdBy + idempotencyKey).
  - `server/src/models/booking.model.js`: Model `Booking` (dạng khoảng gộp, compound index overlap, cấm TTL).
  - `server/src/models/payment-order.model.js`: Model `PaymentOrder` (unique bookingRequestId, unique vnpayTxnRef, cấm TTL).
  - `server/src/models/payment-transaction.model.js`: Model `PaymentTransaction` (partial unique vnpayTransactionNo, cấm TTL).
  - `server/src/models/refund-case.model.js`: Model `RefundCase` (cấm TTL).
  - `server/src/models/email-outbox.model.js`: Model `EmailOutbox` (unique eventKey).
  - `server/src/models/action-log.model.js`: Model `ActionLog` (audit log, cấm TTL).
  - `server/src/models/index.js`: Barrel export cho toàn bộ 17 models.
- **Scripts CLI vận hành (2 tệp):**
  - `server/scripts/sync-indexes.js`: Script đồng bộ hóa toàn bộ index Mongoose.
  - `server/scripts/seed-admin.js`: Script seed tài khoản Admin thủ công, có kiểm tra idempotent.
- **Dữ liệu mẫu Fixtures & Bộ kiểm thử (`server/tests/` - 9 tệp):**
  - `server/tests/fixtures/users.fixture.js`: Fixtures tài khoản mẫu.
  - `server/tests/fixtures/sports.fixture.js`: Fixtures môn thể thao.
  - `server/tests/fixtures/facilities.fixture.js`: Fixtures cơ sở thể thao.
  - `server/tests/fixtures/courts.fixture.js`: Fixtures sân con và cấu hình môn.
  - `server/tests/fixtures/index.js`: Helper `seedTestFixtures()` và `clearTestFixtures()`.
  - `server/tests/unit/models.test.js`: Unit test schemas, validations và quy tắc TTL.
  - `server/tests/integration/transaction.test.js`: Integration test multi-document ACID transactions và rollback.
  - `server/tests/integration/indexes-constraints.test.js`: Integration test unique constraints & atomic coordination.
  - `server/tests/integration/seed-admin.test.js`: Integration test seed admin và app isolation.
- **Chứng từ bàn giao (2 tệp):**
  - `docs/phase-reports/P02.md`: Báo cáo của agent triển khai.
  - `docs/phase-reports/P02-manifest.sha256`: Bảng mã băm xác thực phiên bản.

---

### 1.2. Kiểm tra Phiên bản Bàn giao (Git & SHA-256 Manifest)

- **Trạng thái Git:** Kho lưu trữ Git sạch sẽ (`nothing to commit, working tree clean`).
  - Commit mốc bàn giao: `43aa6912a65f59e4237c3beade8e585bef63a0e4` (`feat(p02): implement mongodb replica set, 17 mongoose models, acid transaction helper, indexes and fixtures`).
- **Chứng từ phiên bản bàn giao:** `docs/phase-reports/P02-manifest.sha256`.
- **Kết quả kiểm tra mã băm SHA-256 thực tế trên đĩa (Tái kiểm tra Lần 2):**

| STT | Đường dẫn tệp | Hash mong đợi trong Manifest | Hash thực tế trên đĩa | Kết quả so khớp |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `.gitignore` | `f64fc45decc58a2dfaabbf1d7a14efc1a52d1793d02cb51525b8a3517eac4fa7` | `f64fc45decc58a2dfaabbf1d7a14efc1a52d1793d02cb51525b8a3517eac4fa7` | **MATCH (100%)** |
| 2 | `README.md` | `621d8ca3b56b35a0de182d8a7dab7ff81f8e68a40381f427241bdd791712915e` | `621d8ca3b56b35a0de182d8a7dab7ff81f8e68a40381f427241bdd791712915e` | **MATCH (100%)** |
| 3 | `package.json` | `baff69aadd77a233a0f921fc9ee831f3be54152a49f605f7087ce17eb7324401` | `baff69aadd77a233a0f921fc9ee831f3be54152a49f605f7087ce17eb7324401` | **MATCH (100%)** |
| 4 | `scripts/ensure-mongo-rs.js` | `a485b68db0985c43a7d55b9b45a0cfcf46e439b7ccb8823f1290deb63ddae071` | `a485b68db0985c43a7d55b9b45a0cfcf46e439b7ccb8823f1290deb63ddae071` | **MATCH (100%)** |
| 5 | `server/.env.example` | `4c7f5e90c527eea2ba21398bfd48788dc95b05f3938a356d51ff3c83b606b613` | `4c7f5e90c527eea2ba21398bfd48788dc95b05f3938a356d51ff3c83b606b613` | **MATCH (100%)** |
| 6 | `server/README.md` | `20511e600ec83a651f92b41a80a684aee39e089c92ea4482969f9693e40345c3` | `20511e600ec83a651f92b41a80a684aee39e089c92ea4482969f9693e40345c3` | **MATCH (100%)** |
| 7 | `server/package.json` | `e7118eeffe3cc409239d036ca2423eebeab12fd17a6b9015191829fae24a2f16` | `e7118eeffe3cc409239d036ca2423eebeab12fd17a6b9015191829fae24a2f16` | **MATCH (100%)** |
| 8 | `server/scripts/seed-admin.js` | `4bc00cb0d891ca3c29208802f286457a20d1e139bf56c53fbc3d8af0b02d006b` | `4bc00cb0d891ca3c29208802f286457a20d1e139bf56c53fbc3d8af0b02d006b` | **MATCH (100%)** |
| 9 | `server/scripts/sync-indexes.js` | `dee62ade428fc8e68321c16106e17aee42e135b5ee6a1a83fefe7309c83239a5` | `dee62ade428fc8e68321c16106e17aee42e135b5ee6a1a83fefe7309c83239a5` | **MATCH (100%)** |
| 10 | `server/src/database/transaction.js` | `afaff659bb2cba1aeb9e503712860a038817d32a6b5973333d8b15c63a3dfa2a` | `afaff659bb2cba1aeb9e503712860a038817d32a6b5973333d8b15c63a3dfa2a` | **MATCH (100%)** |
| 11 | `server/src/models/action-log.model.js` | `9bd2f3bf6f8f0eb2b46cf8d803e26857bc4e65ea1914c44d258195a371140370` | `9bd2f3bf6f8f0eb2b46cf8d803e26857bc4e65ea1914c44d258195a371140370` | **MATCH (100%)** |
| 12 | `server/src/models/auth-session.model.js` | `8cc6dbcb942c66b6435804d61ca55d89c91aa0f0a83d2f621fe1ad1ed35f104f` | `8cc6dbcb942c66b6435804d61ca55d89c91aa0f0a83d2f621fe1ad1ed35f104f` | **MATCH (100%)** |
| 13 | `server/src/models/auth-token.model.js` | `e8de210233597cfca03d2c5a19d28b06d6a7e21df9e44fa6497c3cf104d25242` | `e8de210233597cfca03d2c5a19d28b06d6a7e21df9e44fa6497c3cf104d25242` | **MATCH (100%)** |
| 14 | `server/src/models/booking-request.model.js` | `f15ee9e2c779a3a1f14f3f7cdccc02801ce0e1a832d2b268fa0afeb45c6db2a5` | `f15ee9e2c779a3a1f14f3f7cdccc02801ce0e1a832d2b268fa0afeb45c6db2a5` | **MATCH (100%)** |
| 15 | `server/src/models/booking.model.js` | `c711722501a64953d8c2baaff927c967db6345859b8546df021a02e4f98d9d6a` | `c711722501a64953d8c2baaff927c967db6345859b8546df021a02e4f98d9d6a` | **MATCH (100%)** |
| 16 | `server/src/models/court-block.model.js` | `6b4b915f53715265b1c87334115647fba98406988251e403a0b0fa8ea7a00a85` | `6b4b915f53715265b1c87334115647fba98406988251e403a0b0fa8ea7a00a85` | **MATCH (100%)** |
| 17 | `server/src/models/court-day-schedule.model.js` | `548acdf0a480d2c9453b4cdd741cfedb12d8c6788ffbb0e13d6288df613b574f` | `548acdf0a480d2c9453b4cdd741cfedb12d8c6788ffbb0e13d6288df613b574f` | **MATCH (100%)** |
| 18 | `server/src/models/court.model.js` | `325d880dd9242d958bae4d3d80dc6aa643f77dad92696d3342f6e850a8cc3a19` | `325d880dd9242d958bae4d3d80dc6aa643f77dad92696d3342f6e850a8cc3a19` | **MATCH (100%)** |
| 19 | `server/src/models/email-outbox.model.js` | `9d899820e60d62d0393817b52134e78712b9c464599a78e23c54a51eab9fad2f` | `9d899820e60d62d0393817b52134e78712b9c464599a78e23c54a51eab9fad2f` | **MATCH (100%)** |
| 20 | `server/src/models/facility-sport.model.js` | `d5ad18b710d6d427b750d1c3e881c32355a45cf47e1054a9d9c60cc0c5a9a993` | `d5ad18b710d6d427b750d1c3e881c32355a45cf47e1054a9d9c60cc0c5a9a993` | **MATCH (100%)** |
| 21 | `server/src/models/facility.model.js` | `41d85098fc94e8bb2a18c55db6f90db4d46af83a4b80cdfa4cee71c9e9156a3f` | `41d85098fc94e8bb2a18c55db6f90db4d46af83a4b80cdfa4cee71c9e9156a3f` | **MATCH (100%)** |
| 22 | `server/src/models/index.js` | `0edfaa5bda3d478354bf0b475bdd3cc674a06e5aea610a92f07ad7ba53417423` | `0edfaa5bda3d478354bf0b475bdd3cc674a06e5aea610a92f07ad7ba53417423` | **MATCH (100%)** |
| 23 | `server/src/models/payment-order.model.js` | `3e4cb8377af7cacee041875696d1beddbdea87d42c73e0a4982c7969aab8b872` | `3e4cb8377af7cacee041875696d1beddbdea87d42c73e0a4982c7969aab8b872` | **MATCH (100%)** |
| 24 | `server/src/models/payment-transaction.model.js` | `d418a71c155a2ec54f69ddadd9e0d77c136c131cb39a103d67c3fd4c93251de2` | `d418a71c155a2ec54f69ddadd9e0d77c136c131cb39a103d67c3fd4c93251de2` | **MATCH (100%)** |
| 25 | `server/src/models/refresh-token.model.js` | `303f617a0a5877f33858f432b952c88a9d891b509b430f299214f5ea700f11c4` | `303f617a0a5877f33858f432b952c88a9d891b509b430f299214f5ea700f11c4` | **MATCH (100%)** |
| 26 | `server/src/models/refund-case.model.js` | `0bc5eee48648862ffbdbec9e37eaf6058b1a510dc668db97042257082824e769` | `0bc5eee48648862ffbdbec9e37eaf6058b1a510dc668db97042257082824e769` | **MATCH (100%)** |
| 27 | `server/src/models/sport.model.js` | `6147654418fcff9666ec061a700185d77a893db96caffa14da18b294e6d8c7a3` | `6147654418fcff9666ec061a700185d77a893db96caffa14da18b294e6d8c7a3` | **MATCH (100%)** |
| 28 | `server/src/models/user.model.js` | `e8e9659985b96e59d759ecff0dfda6ab50ac97fa080fe6aebf7400f80838074a` | `e8e9659985b96e59d759ecff0dfda6ab50ac97fa080fe6aebf7400f80838074a` | **MATCH (100%)** |
| 29 | `server/tests/fixtures/courts.fixture.js` | `889128fe516b5b2d8e064284dc6e0508ba63a3bbe6fa9d8cecf3a5e8867a809f` | `889128fe516b5b2d8e064284dc6e0508ba63a3bbe6fa9d8cecf3a5e8867a809f` | **MATCH (100%)** |
| 30 | `server/tests/fixtures/facilities.fixture.js` | `e1b0ef957ca24cca4cc409efc59b806505c5c1f81b7ccec2b1956ab9175f83bc` | `e1b0ef957ca24cca4cc409efc59b806505c5c1f81b7ccec2b1956ab9175f83bc` | **MATCH (100%)** |
| 31 | `server/tests/fixtures/index.js` | `f89fc668d8a1c569812d75a7e87c83258fa2f69fcfa151299bcc8f75bd2e30f8` | `f89fc668d8a1c569812d75a7e87c83258fa2f69fcfa151299bcc8f75bd2e30f8` | **MATCH (100%)** |
| 32 | `server/tests/fixtures/sports.fixture.js` | `bacba76e006486b229d170f9006faaa75b90190d580552f1660278ac0dddaf1e` | `bacba76e006486b229d170f9006faaa75b90190d580552f1660278ac0dddaf1e` | **MATCH (100%)** |
| 33 | `server/tests/fixtures/users.fixture.js` | `eca2ce152c4624ab661d8763ae29f34ac0bc2cd6ae01bd6ea8d40f445b13643a` | `eca2ce152c4624ab661d8763ae29f34ac0bc2cd6ae01bd6ea8d40f445b13643a` | **MATCH (100%)** |
| 34 | `server/tests/integration/indexes-constraints.test.js` | `56c335ceb5e017d7a789dbc7656bcbff0f124673f8d928a9b68436c933aa2d96` | `56c335ceb5e017d7a789dbc7656bcbff0f124673f8d928a9b68436c933aa2d96` | **MATCH (100%)** |
| 35 | `server/tests/integration/seed-admin.test.js` | `fa84558ee0ce5f246ff092110db2a04ace9333703dbc022d5999adb11206025f` | `fa84558ee0ce5f246ff092110db2a04ace9333703dbc022d5999adb11206025f` | **MATCH (100%)** |
| 36 | `server/tests/integration/transaction.test.js` | `e8541d1ddb82c43651b3da6afad81f2795c02c7088a3fd3247d13db6ab79e915` | `e8541d1ddb82c43651b3da6afad81f2795c02c7088a3fd3247d13db6ab79e915` | **MATCH (100%)** |
| 37 | `server/tests/unit/models.test.js` | `be528472c8a4bcaa7b5ff58dacd3c938632579a2c35433acb6056bf992322af0` | `be528472c8a4bcaa7b5ff58dacd3c938632579a2c35433acb6056bf992322af0` | **MATCH (100%)** |

---

## 2. Lịch sử Review và Xử lý Lỗi

### Lần 1 (29/10/2026): `NEEDS_CHANGES`
- **BUG-P02-01:** File manifest `docs/phase-reports/P02-manifest.sha256` bị lệch mã băm so với các tệp thực tế trên đĩa (28/37 tệp lệch do ký tự xuống dòng kép `\n\n`).
- **BUG-P02-02:** Race condition giữa `indexes-constraints.test.js` và `transaction.test.js` do lệnh `PaymentOrder.deleteMany({})` không lọc, làm mất dữ liệu commit và gây fail chập chờn (`AssertionError: PaymentOrder must be committed`).
- **IMP-P02-03:** Chưa tạo commit cho kho lưu trữ Git trên branch `main`.

### Lần 2 (29/10/2026 — Sau sửa): Đã giải quyết triệt để 100%
- **Khắc phục BUG-P02-01:** Đã chuẩn hóa ký tự kết thúc của toàn bộ 37 tệp về đúng 1 ký tự LF (`\n`) theo quy chuẩn `.editorconfig`. Mã băm tính toán lại khớp **100% (37/37 tệp)** với manifest bàn giao và Bảng Mục 5 của `docs/phase-reports/P02.md`.
- **Khắc phục BUG-P02-02:** Đã cập nhật hook `beforeEach` trong `server/tests/integration/indexes-constraints.test.js` sử dụng các bộ lọc scoped (`FS_TEST_FACILITY_ID`, `COURT_DAY_DATE`, prefix `PO-INDEX`, `BR-IDEMP`, `REF-00`), cô lập hoàn toàn với `transaction.test.js`. Chạy kiểm thử song song lặp lại 2 lần: **39/39 tests PASS ổn định 100%**.
- **Khắc phục IMP-P02-03:** Đã thực hiện `git add` và commit mã nguồn cùng tài liệu lên branch `main` (`43aa6912a65f59e4237c3beade8e585bef63a0e4`). Working tree hoàn toàn sạch sẽ.

---

## 3. Đánh giá Chi tiết Từng Tiêu chí và Đầu việc P02

| STT | Tiêu chí / Đầu việc P02 theo kế hoạch | Đầu ra thực tế | Đánh giá | Chi tiết kiểm chứng độc lập |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **Dựng MongoDB có Replica Set & DB test tách biệt:**<br>- Replica set (`rs0`) hỗ trợ transactions.<br>- Tách biệt DB `sport_booking` và `sport_booking_test`. | `scripts/ensure-mongo-rs.js`<br>`server/.env.example`<br>`server/src/config/env.js` | **ĐẠT** | - Script `ensure-mongo-rs.js` khởi động và kiểm tra replica set trên cổng 27018 thành công.<br>- Database dev (`sport_booking`) và test (`sport_booking_test`) được cấu hình độc lập qua `env.js`. |
| 2 | **Khai báo 17 Mongoose schemas/models:**<br>- Khai báo đủ 17 models theo `docs/database.md`.<br>- Thuộc tính, validations, enums, defaults chuẩn. | `server/src/models/` (17 models)<br>`server/src/models/index.js` | **ĐẠT** | - Đầy đủ 17/17 models và barrel export `index.js`.<br>- Các validations quan trọng (User role enum, FacilitySport slotStepMinutes `[30, 60, 90]`, Court pricePerHourVnd min 1, Facility tối đa 10 ảnh) đều đã được kiểm tra unit test. |
| 3 | **Helper transaction và quy ước session:**<br>- Helper `withTransaction` ACID.<br>- Hỗ trợ truyền session và tái sử dụng session lồng nhau. | `server/src/database/transaction.js`<br>`server/tests/integration/transaction.test.js` | **ĐẠT** | - `withTransaction` bọc `session.withTransaction` chuẩn, xử lý `session.endSession()` trong `finally`.<br>- Nhận tham số `existingSession` thứ hai giúp lồng transaction không gây lỗi MongoDB.<br>- Kiểm chứng rollback và commit chạy độc lập thành công. |
| 4 | **CourtDaySchedule unique sân/ngày & điều phối nguyên tử:**<br>- Unique compound `{ courtId: 1, bookingDate: 1 }`.<br>- Cơ chế upsert nguyên tử tăng `scheduleVersion`. | `server/src/models/court-day-schedule.model.js`<br>`server/tests/integration/indexes-constraints.test.js` | **ĐẠT** | - Model khai báo unique index `{ courtId: 1, bookingDate: 1 }`.<br>- Kiểm chứng thao tác `findOneAndUpdate` với `{ upsert: true, $inc: { scheduleVersion: 1 } }` hoạt động nguyên tử: khởi tạo version 1 và tự động tăng dần khi có thay đổi. |
| 5 | **Scripts index, seed admin và fixtures:**<br>- `sync-indexes.js` đồng bộ index 17 models.<br>- `seed-admin.js` chạy CLI, idempotent, không auto-run khi import app.<br>- Bộ fixtures kiểm thử. | `server/scripts/sync-indexes.js`<br>`server/scripts/seed-admin.js`<br>`server/tests/fixtures/` | **ĐẠT** | - `npm run db:indexes` đồng bộ thành công toàn bộ indexes cho 17 models.<br>- `npm run db:seed` tạo admin lần đầu và bỏ qua (idempotent) lần 2.<br>- Import `app.js` không tự động seed và không mở socket HTTP. |
| 6 | **Chốt index PaymentOrder, PaymentTransaction, idempotency & TTL:**<br>- Partial index cho `vnpayTransactionNo`.<br>- Idempotency `{ createdBy: 1, idempotencyKey: 1 }`.<br>- Tuyệt đối cấm TTL trên Booking, Payment, Refund, ActionLog. | `server/src/models/`<br>`server/tests/unit/models.test.js`<br>`server/tests/integration/indexes-constraints.test.js` | **ĐẠT** | - `PaymentTransaction` dùng partial unique index cho phép nhiều giá trị null nhưng chặn trùng lặp mã chuỗi ngân hàng.<br>- Quét tự động schema xác nhận: CHỈ `auth_tokens`, `auth_sessions`, `refresh_tokens` có TTL; các model chứng từ/tài chính có đúng 0 TTL index. |
| 7 | **Độ tin cậy kiểm thử tự động (Unit & Integration Tests):**<br>- Toàn bộ test suite phải PASS 100% một cách ổn định, không chập chờn. | `server/tests/` (9 test suites) | **ĐẠT** | Toàn bộ 9 test suites (39 test cases) chạy bằng Node.js native test runner đều PASS 100% ổn định qua nhiều lần chạy liên tiếp. |
| 8 | **Chứng từ băm SHA-256 Manifest:**<br>- Khớp 100% mã băm nhị phân các tệp trên đĩa. | `docs/phase-reports/P02-manifest.sha256`<br>`docs/phase-reports/P02.md` | **ĐẠT** | 37/37 tệp bàn giao khớp 100% với mã băm thực tế trên đĩa. |
| 9 | **Kiểm soát phiên bản Git:**<br>- Commit mã nguồn sạch sẽ trên branch `main`. | Git repository | **ĐẠT** | Working tree sạch sẽ; commit mốc `43aa691` trên branch `main`. |

---

## 4. Các Kiểm chứng Độc lập Đã Chạy

1. **Kiểm tra linter và cú pháp JavaScript thực tế (`npm run lint`):**
   - Lệnh: `npm run lint`
   - Kết quả: **PASS (`Syntax check passed for 47 backend files.`)**.
2. **Kiểm tra trạng thái Phase và Ranh giới Frontend (`npm run check:phase`):**
   - Lệnh: `npm run check:phase`
   - Kết quả: **PASS (Cấu trúc hợp lệ, thư mục client/ giữ chỗ, không vi phạm ranh giới frontend)**.
3. **Kiểm tra trạng thái MongoDB Replica Set (`npm run db:ensure-rs`):**
   - Lệnh: `npm run db:ensure-rs`
   - Kết quả: **PASS (`MongoDB Replica Set is active on port 27018 (rs0).`)**.
4. **Kiểm tra đồng bộ Index (`npm run db:indexes`):**
   - Lệnh: `npm run db:indexes`
   - Kết quả: **PASS (Đồng bộ thành công hơn 50 indexes cho 17 models)**.
5. **Kiểm tra Seed Admin thủ công & Idempotent (`npm run db:seed`):**
   - Lệnh: `npm run db:seed`
   - Kết quả: **PASS (`Admin user already exists: admin@sportbooking.local. Skipping creation.`)**.
6. **Kiểm thử tự động toàn diện (`npm test`):**
   - Lệnh: `npm test` (chạy độc lập nhiều lần)
   - Kết quả: **PASS 100% (39 tests passed, 0 failed, 9 suites passed)**:
     - `Phase Status & Governance Check (Integration)`: 5/5 PASS.
     - `Health & Readiness Endpoints (Integration)`: 4/4 PASS.
     - `App Import & Middlewares (Unit)`: 4/4 PASS.
     - `Environment Configuration Validation (Unit)`: 4/4 PASS.
     - `Logger Sensitive Data Masking (Unit)`: 3/3 PASS.
     - `Mongoose Models & Schema Definitions (Unit)`: 6/6 PASS.
     - `Unique Indexes, Constraints & Atomic Coordination (Integration)`: 7/7 PASS.
     - `Seed Admin & App Isolation (Integration)`: 3/3 PASS.
     - `Multi-Document ACID Transactions (Integration)`: 3/3 PASS.
7. **Kiểm tra so khớp Bảng mã băm Manifest SHA-256:**
   - Lệnh: Đọc nhị phân và băm SHA-256 cho toàn bộ 37 tệp.
   - Kết quả: **PASS (37/37 tệp khớp 100%)**.
8. **Kiểm tra trạng thái Git:**
   - Lệnh: `git status` và `git log -n 1 --oneline`
   - Kết quả: **PASS (Working tree clean; commit HEAD: `43aa691`)**.

---

## 5. Kết luận và Quyết định Nghiệm thu

- **Quyết định nghiệm thu:** Chính thức công nhận Phase P02 đạt trạng thái **`ACCEPTED`**.
- **Căn cứ nghiệm thu:**
  - Hoàn thành đầy đủ 6 đầu việc cốt lõi của Phase P02 theo kế hoạch phát triển `docs/planning/development-plan.md`.
  - Khắc phục triệt để lỗi race condition (BUG-P02-02) và sai lệch mã băm (BUG-P02-01).
  - Toàn bộ 39 tests tự động PASS ổn định, 47 files lint cú pháp đạt chuẩn.
  - Mã băm 37/37 tệp khớp 100% với `docs/phase-reports/P02-manifest.sha256`.
  - Mã nguồn đã được commit an toàn vào Git (`43aa691`).
- **Phiên bản nghiệm thu:** `43aa6912a65f59e4237c3beade8e585bef63a0e4 (docs/phase-reports/P02-manifest.sha256)`.
- **Người nghiệm thu:** Reviewer độc lập (Ủy quyền bởi người dùng).
- **Ngày nghiệm thu:** 29/10/2026.

---

## 6. Ranh giới và Hướng dẫn cho Phase Tiếp theo (P03)

1. Cập nhật `docs/planning/phase-status.json`:
   - Đánh dấu `P02` là `ACCEPTED`.
   - `next_candidate`: `P03`.
   - `active_phase`: `null` (chờ người dùng giao việc chính thức cho P03).
2. **Phase tiếp theo (P03):** Hạ tầng email và token dùng một lần (`EmailOutbox`, worker gửi mail có lease/retry, `AuthToken` hash verify/activate/reset).
3. **Ranh giới:** Cổng `BE_READY` tiếp tục giữ trạng thái `CLOSED`. Tuyệt đối không xây dựng React hoặc đụng chạm frontend trước khi toàn bộ backend hoàn tất nghiệm thu ở P14.
