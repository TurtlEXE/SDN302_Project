# Báo cáo Review và Đánh giá Độc lập — Phase P02

> **Trạng thái kết luận:** `NEEDS_CHANGES`  
> **Người thực hiện review & thẩm quyền:** Reviewer độc lập (Được người dùng ủy quyền trực tiếp theo yêu cầu)  
> **Ngày review:** 29/10/2026  
> **Tài liệu căn cứ:** `AGENTS.md`, `docs/features.md`, `docs/architecture.md`, `docs/database.md`, `docs/planning/development-plan.md`, `docs/guides/ai-workflow.md`, `docs/phase-reports/P02.md`, `docs/planning/phase-status.json`.

---

## 1. Phạm vi và Phiên bản được Review

### 1.1. Phạm vi bàn giao của Phase P02 (37 tệp)
Phase P02 thiết lập hạ tầng lưu trữ MongoDB Replica Set (`rs0`), database test biệt lập, khai báo 17 Mongoose models/schemas chuẩn hóa theo `docs/database.md`, xây dựng helper `withTransaction` ACID, cơ chế phối hợp ghi lịch nguyên tử `CourtDaySchedule`, scripts sync index, seed admin độc lập và bộ dữ liệu fixtures kiểm thử:

- **Hạ tầng Replica Set & Quản trị mã nguồn:**
  - `scripts/ensure-mongo-rs.js`: Tiện ích tự động kiểm tra/khởi động MongoDB Replica Set trên cổng 27018.
  - `.gitignore`: Bổ sung bỏ qua thư mục dữ liệu cục bộ `.mongodb-rs/`.
  - `package.json` & `server/package.json`: Cấu hình scripts `db:ensure-rs`, `db:indexes`, `db:seed`.
  - `server/.env.example`: Cấu hình mẫu URI cổng 27018 với `replicaSet=rs0`.
  - `server/README.md` & `README.md`: Hướng dẫn vận hành DB và các lệnh CLI.
- **Tầng giao dịch và Models Mongoose (`server/src/`):**
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
- **Scripts CLI vận hành:**
  - `server/scripts/sync-indexes.js`: Script đồng bộ hóa toàn bộ index Mongoose.
  - `server/scripts/seed-admin.js`: Script seed tài khoản Admin thủ công, có kiểm tra idempotent.
- **Dữ liệu mẫu Fixtures & Bộ kiểm thử (`server/tests/`):**
  - `server/tests/fixtures/users.fixture.js`: Fixtures tài khoản mẫu.
  - `server/tests/fixtures/sports.fixture.js`: Fixtures môn thể thao.
  - `server/tests/fixtures/facilities.fixture.js`: Fixtures cơ sở thể thao.
  - `server/tests/fixtures/courts.fixture.js`: Fixtures sân con và cấu hình môn.
  - `server/tests/fixtures/index.js`: Helper `seedTestFixtures()` và `clearTestFixtures()`.
  - `server/tests/unit/models.test.js`: Unit test schemas, validations và quy tắc TTL.
  - `server/tests/integration/transaction.test.js`: Integration test multi-document ACID transactions và rollback.
  - `server/tests/integration/indexes-constraints.test.js`: Integration test unique constraints & atomic coordination.
  - `server/tests/integration/seed-admin.test.js`: Integration test seed admin và app isolation.
- **Chứng từ bàn giao:**
  - `docs/phase-reports/P02.md`: Báo cáo của agent triển khai.
  - `docs/phase-reports/P02-manifest.sha256`: Bảng mã băm xác thực phiên bản.

---

### 1.2. Kết quả So khớp Mã băm SHA-256 Manifest Thực tế trên Đĩa

Kiểm tra đối chiếu độc lập từng tệp thực tế trên đĩa nhị phân so với mã băm trong `docs/phase-reports/P02-manifest.sha256`:

| STT | Đường dẫn tệp | Hash mong đợi trong Manifest | Hash thực tế trên đĩa | Kết quả so khớp |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `.gitignore` | `f64fc45decc58a2dfaabbf1d7a14efc1a52d1793d02cb51525b8a3517eac4fa7` | `f64fc45decc58a2dfaabbf1d7a14efc1a52d1793d02cb51525b8a3517eac4fa7` | **MATCH** |
| 2 | `README.md` | `621d8ca3b56b35a0de182d8a7dab7ff81f8e68a40381f427241bdd791712915e` | `621d8ca3b56b35a0de182d8a7dab7ff81f8e68a40381f427241bdd791712915e` | **MATCH** |
| 3 | `package.json` | `baff69aadd77a233a0f921fc9ee831f3be54152a49f605f7087ce17eb7324401` | `baff69aadd77a233a0f921fc9ee831f3be54152a49f605f7087ce17eb7324401` | **MATCH** |
| 4 | `scripts/ensure-mongo-rs.js` | `a485b68db0985c43a7d55b9b45a0cfcf46e439b7ccb8823f1290deb63ddae071` | `c304c66a35decdf131f6faa5575a23f79dae7be0c5f9da0c3e91ee3907d35485` | **MISMATCH (Extra `\n`)** |
| 5 | `server/.env.example` | `4c7f5e90c527eea2ba21398bfd48788dc95b05f3938a356d51ff3c83b606b613` | `4c7f5e90c527eea2ba21398bfd48788dc95b05f3938a356d51ff3c83b606b613` | **MATCH** |
| 6 | `server/README.md` | `20511e600ec83a651f92b41a80a684aee39e089c92ea4482969f9693e40345c3` | `20511e600ec83a651f92b41a80a684aee39e089c92ea4482969f9693e40345c3` | **MATCH** |
| 7 | `server/package.json` | `e7118eeffe3cc409239d036ca2423eebeab12fd17a6b9015191829fae24a2f16` | `e7118eeffe3cc409239d036ca2423eebeab12fd17a6b9015191829fae24a2f16` | **MATCH** |
| 8 | `server/scripts/seed-admin.js` | `4bc00cb0d891ca3c29208802f286457a20d1e139bf56c53fbc3d8af0b02d006b` | `ab438fd04d514e3d228b93d5c27c233fc6177485c0c6ffa5139ed2ff8f02d3b1` | **MISMATCH (Extra `\n`)** |
| 9 | `server/scripts/sync-indexes.js` | `dee62ade428fc8e68321c16106e17aee42e135b5ee6a1a83fefe7309c83239a5` | `f6b62ba2c82e9607d57096f5b156d40af3c25504c6149181e43a5314b565394d` | **MISMATCH (Extra `\n`)** |
| 10 | `server/src/database/transaction.js` | `afaff659bb2cba1aeb9e503712860a038817d32a6b5973333d8b15c63a3dfa2a` | `e804abc1ab08dc176d826bb03c40a753a365a9ae9ee346bf86f87d63fa77c6ab` | **MISMATCH (Extra `\n`)** |
| 11 | `server/src/models/action-log.model.js` | `9bd2f3bf6f8f0eb2b46cf8d803e26857bc4e65ea1914c44d258195a371140370` | `9a8bfa6c642f47cb5579bdd63a70b7777f64fd9de0ed495d160e86068fb40d0f` | **MISMATCH (Extra `\n`)** |
| 12 | `server/src/models/auth-session.model.js` | `8cc6dbcb942c66b6435804d61ca55d89c91aa0f0a83d2f621fe1ad1ed35f104f` | `ae7d767c8c3849018e609cb3c20d0e963e40a271f664370b7cb1fef346b615ba` | **MISMATCH (Extra `\n`)** |
| 13 | `server/src/models/auth-token.model.js` | `e8de210233597cfca03d2c5a19d28b06d6a7e21df9e44fa6497c3cf104d25242` | `e2d94917a828256ea03ef3d81ab0f6bd3c2391f5efe7560a0427d43eaeb0ca5b` | **MISMATCH (Extra `\n`)** |
| 14 | `server/src/models/booking-request.model.js` | `f15ee9e2c779a3a1f14f3f7cdccc02801ce0e1a832d2b268fa0afeb45c6db2a5` | `c622698fe533c202da5a8c724d4c1fa315b74d035933f89f2b73eec48541f24c` | **MISMATCH (Extra `\n`)** |
| 15 | `server/src/models/booking.model.js` | `c711722501a64953d8c2baaff927c967db6345859b8546df021a02e4f98d9d6a` | `e9046faaa44a5f15c29817ce94d4c7b37ce4157ca396effe95fc078e86a34353` | **MISMATCH (Extra `\n`)** |
| 16 | `server/src/models/court-block.model.js` | `6b4b915f53715265b1c87334115647fba98406988251e403a0b0fa8ea7a00a85` | `1c32dcde1fc7e79a9f4291b7a489099a6e49b7b910daa02a6116ca46fc5f267d` | **MISMATCH (Extra `\n`)** |
| 17 | `server/src/models/court-day-schedule.model.js` | `548acdf0a480d2c9453b4cdd741cfedb12d8c6788ffbb0e13d6288df613b574f` | `30cb204e504b04041626e9ba1eb22ec310497b62f6e6b71c792463d2228fa6fd` | **MISMATCH (Extra `\n`)** |
| 18 | `server/src/models/court.model.js` | `325d880dd9242d958bae4d3d80dc6aa643f77dad92696d3342f6e850a8cc3a19` | `3f98f5e97dceec51e31f367e10ca2ddc131441d28448f368d6bea8b9a873af27` | **MISMATCH (Extra `\n`)** |
| 19 | `server/src/models/email-outbox.model.js` | `9d899820e60d62d0393817b52134e78712b9c464599a78e23c54a51eab9fad2f` | `9d48dc42a2a06bec5a649ad2b58cc403795267eb0239a7803ab43baa9a43db16` | **MISMATCH (Extra `\n`)** |
| 20 | `server/src/models/facility-sport.model.js` | `d5ad18b710d6d427b750d1c3e881c32355a45cf47e1054a9d9c60cc0c5a9a993` | `d39e09dcd8c5c920c43e8f753ab906a6a47e75179d0760f02813407ae6a53fc0` | **MISMATCH (Extra `\n`)** |
| 21 | `server/src/models/facility.model.js` | `41d85098fc94e8bb2a18c55db6f90db4d46af83a4b80cdfa4cee71c9e9156a3f` | `b766204f1b356a0f5141d2cba8b40dea39ed3e0dff10e2adbb224ee37729b05f` | **MISMATCH (Extra `\n`)** |
| 22 | `server/src/models/index.js` | `0edfaa5bda3d478354bf0b475bdd3cc674a06e5aea610a92f07ad7ba53417423` | `d4ae75a4ee033f30770f49ae2e9700bd2aa8de3a611cbb10260492e40f2dec2f` | **MISMATCH (Extra `\n`)** |
| 23 | `server/src/models/payment-order.model.js` | `3e4cb8377af7cacee041875696d1beddbdea87d42c73e0a4982c7969aab8b872` | `cba923de1dcf3931ff6b55e1cf752a3b2b85b66ede5a9dac3983b1e88dce3936` | **MISMATCH (Extra `\n`)** |
| 24 | `server/src/models/payment-transaction.model.js` | `d418a71c155a2ec54f69ddadd9e0d77c136c131cb39a103d67c3fd4c93251de2` | `7d2de98659a8bda1cecc1f49afc6fc72a6e20e6b302198cb1896378e1065e1a5` | **MISMATCH (Extra `\n`)** |
| 25 | `server/src/models/refresh-token.model.js` | `303f617a0a5877f33858f432b952c88a9d891b509b430f299214f5ea700f11c4` | `bc8e88e9e7a8a3240afd579436898859ef8d131c6868befddbd624ee78e112aa` | **MISMATCH (Extra `\n`)** |
| 26 | `server/src/models/refund-case.model.js` | `0bc5eee48648862ffbdbec9e37eaf6058b1a510dc668db97042257082824e769` | `bb964808b19f08eb9932f8b1c82b3ad7cca32f8846960ebcc30b8db8c5c69250` | **MISMATCH (Extra `\n`)** |
| 27 | `server/src/models/sport.model.js` | `6147654418fcff9666ec061a700185d77a893db96caffa14da18b294e6d8c7a3` | `39a828d9020cc2fd5c082e4755d43ceaec938a0797c07c6c463ac08eb9ab4376` | **MISMATCH (Extra `\n`)** |
| 28 | `server/src/models/user.model.js` | `e8e9659985b96e59d759ecff0dfda6ab50ac97fa080fe6aebf7400f80838074a` | `dd5326d93f39635cce6359a59e594af8338f8ad3fc0766e33233204ceaa4a419` | **MISMATCH (Extra `\n`)** |
| 29 | `server/tests/fixtures/courts.fixture.js` | `889128fe516b5b2d8e064284dc6e0508ba63a3bbe6fa9d8cecf3a5e8867a809f` | `b7b09cff6b469459453cc3bb8f1e534e74652fb9414ef21aa86797bb62e7bd17` | **MISMATCH (Extra `\n`)** |
| 30 | `server/tests/fixtures/facilities.fixture.js` | `e1b0ef957ca24cca4cc409efc59b806505c5c1f81b7ccec2b1956ab9175f83bc` | `2984572e5eeaa5feac69ed6c079487e541d1605650e955c36ca776b8074593f3` | **MISMATCH (Extra `\n`)** |
| 31 | `server/tests/fixtures/index.js` | `f89fc668d8a1c569812d75a7e87c83258fa2f69fcfa151299bcc8f75bd2e30f8` | `164295b7ef4be970ab5e485f45fcebbfd77039ed3759bb96ee577f675612f210` | **MISMATCH (Extra `\n`)** |
| 32 | `server/tests/fixtures/sports.fixture.js` | `bacba76e006486b229d170f9006faaa75b90190d580552f1660278ac0dddaf1e` | `1ed74e91f64dba5871498c13ab60486689deda5f3d5576708c8564e3202fc9a6` | **MISMATCH (Extra `\n`)** |
| 33 | `server/tests/fixtures/users.fixture.js` | `eca2ce152c4624ab661d8763ae29f34ac0bc2cd6ae01bd6ea8d40f445b13643a` | `23c950526407d663b85d9a3128852ca581d51188120dad105f59d99b0ed19a81` | **MISMATCH (Extra `\n`)** |
| 34 | `server/tests/integration/indexes-constraints.test.js` | `3af190b8c2c8f80f129800d4a197e982cf402a5ff22e9f202cd6c678a31ce0fa` | `3af190b8c2c8f80f129800d4a197e982cf402a5ff22e9f202cd6c678a31ce0fa` | **MATCH** |
| 35 | `server/tests/integration/seed-admin.test.js` | `fa84558ee0ce5f246ff092110db2a04ace9333703dbc022d5999adb11206025f` | `fa84558ee0ce5f246ff092110db2a04ace9333703dbc022d5999adb11206025f` | **MATCH** |
| 36 | `server/tests/integration/transaction.test.js` | `e8541d1ddb82c43651b3da6afad81f2795c02c7088a3fd3247d13db6ab79e915` | `e8541d1ddb82c43651b3da6afad81f2795c02c7088a3fd3247d13db6ab79e915` | **MATCH** |
| 37 | `server/tests/unit/models.test.js` | `be528472c8a4bcaa7b5ff58dacd3c938632579a2c35433acb6056bf992322af0` | `565ef650b9ff5f8a22cd6f13a263ade301aeaa48c1e10cf19bece7ea2fca08e6` | **MISMATCH (Extra `\n`)** |

- **Tổng kết đối chiếu mã băm:**
  - Khớp (MATCH): **9/37 tệp (24.3%)**
  - Sai lệch (MISMATCH): **28/37 tệp (75.7%)**
  - Phân tích kỹ thuật: Toàn bộ 28 tệp bị sai lệch đều có nội dung kết thúc bằng hai ký tự xuống dòng (`\n\n`) thay vì một ký tự (`\n`). Khi cắt bỏ đúng 1 ký tự `\n` thừa ở cuối, mã băm tính toán lại khớp **100% (28/28 tệp)** với giá trị manifest.

---

## 2. Chi tiết Lỗi và Phân tích Nguyên nhân

### BUG-P02-01 (Sai lệch mã băm SHA-256 bàn giao trên 28/37 tệp)
- **Vị trí:** `docs/phase-reports/P02-manifest.sha256` và Bảng Mục 5 của `docs/phase-reports/P02.md`.
- **Mô tả:** Có 28 tệp mã nguồn JavaScript (18 file models, 5 fixtures, 3 scripts, 1 helper transaction, 1 unit test) trên đĩa kết thúc bằng ký tự xuống dòng kép `\n\n` khiến mã băm SHA-256 thực tế trên đĩa không khớp với manifest bàn giao.
- **Ảnh hưởng:** Không đảm bảo tính toàn vẹn chứng từ bàn giao theo quy chuẩn mục 9 của `docs/guides/ai-workflow.md`.
- **Hướng khắc phục cho agent triển khai:**
  1. Chuẩn hóa lại định dạng tệp (bỏ ký tự xuống dòng thừa ở cuối tệp để kết thúc bằng duy nhất 1 ký tự `\n` theo `.editorconfig`).
  2. Hoặc tính toán lại toàn bộ mã băm SHA-256 trực tiếp từ file trên đĩa và cập nhật đồng bộ vào `P02-manifest.sha256` cùng Bảng Mục 5 của `P02.md`.

---

### BUG-P02-02 (Race Condition / Thiếu cô lập dữ liệu gây lỗi chập chờn kiểm thử Integration)
- **Vị trí:**
  - `server/tests/integration/indexes-constraints.test.js` (dòng 34, 36, 39):
    ```javascript
    FacilitySport.deleteMany({}),
    CourtDaySchedule.deleteMany({}),
    PaymentOrder.deleteMany({}),
    ```
  - `server/tests/integration/transaction.test.js` (dòng 204):
    ```javascript
    const foundPo = await PaymentOrder.findById(paymentOrderId);
    assert.ok(foundPo, 'PaymentOrder must be committed');
    ```
- **Mô tả:** Node.js native test runner (`node --test tests/**/*.test.js`) thực thi các tệp test song song trên cùng một cơ sở dữ liệu kiểm thử `sport_booking_test`. Trong khi `transaction.test.js` đang thực thi giao dịch commit `PaymentOrder` (dòng 177-189), hook `beforeEach` của `indexes-constraints.test.js` được gọi song song và thực hiện `PaymentOrder.deleteMany({})` không có bộ lọc, xóa sạch bản ghi `PaymentOrder` mà `transaction.test.js` vừa commit. Kết quả là `foundPo` bị null và test fail với lỗi:
  ```text
  AssertionError: PaymentOrder must be committed
    at TestContext.<anonymous> (server/tests/integration/transaction.test.js:204:12)
  ```
- **Ảnh hưởng:** Test suite không đạt tính cô lập (deterministic test execution). Lệnh `npm test` bị fail chập chờn (38/39 PASS, 1 FAIL) tùy thuộc vào thứ tự luồng I/O.
- **Hướng khắc phục cho agent triển khai:**
  1. Trong `indexes-constraints.test.js`, thay vì gọi `PaymentOrder.deleteMany({})` toàn bộ collection, chỉ xóa các bản ghi liên quan đến test case đó (ví dụ: `PaymentOrder.deleteMany({ vnpayTxnRef: { $regex: /REF-|PO-IDEMP/ } })`).
  2. Áp dụng tương tự cho `FacilitySport` và `CourtDaySchedule` trong `indexes-constraints.test.js` để tránh xóa dữ liệu giao dịch của `transaction.test.js`.
  3. Hoặc đảm bảo các ID và query xóa trong mỗi test suite hoàn toàn biệt lập (namespaced).

---

### IMP-P02-03 (Chưa commit mã nguồn và tài liệu P02 vào kho Git)
- **Vị trí:** Git repository working tree (`git status`).
- **Mô tả:** Toàn bộ 37 tệp của Phase P02 hiện tại đang ở trạng thái modified (7 tệp) hoặc untracked (30 tệp), chưa được tạo commit trên branch `main`.
- **Ảnh hưởng:** Thiếu mốc kiểm soát phiên bản (commit hash) phục vụ nghiệm thu chính thức và audit trail.
- **Hướng khắc phục:** Sau khi sửa xong 2 lỗi trên, agent triển khai cần thực hiện `git add` và commit với thông điệp chuẩn mực (ví dụ: `feat(p02): implement mongodb replica set, 17 mongoose models, acid transaction helper, indexes and fixtures`).

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
| 7 | **Độ tin cậy kiểm thử tự động (Unit & Integration Tests):**<br>- Toàn bộ test suite phải PASS 100% một cách ổn định, không chập chờn. | `server/tests/` | **CHƯA ĐẠT** | - Lỗi BUG-P02-02: `npm test` bị lỗi ngẫu nhiên `PaymentOrder must be committed` do lệnh `deleteMany({})` không lọc trong `indexes-constraints.test.js`. |
| 8 | **Chứng từ băm SHA-256 Manifest:**<br>- Khớp 100% mã băm nhị phân các tệp trên đĩa. | `docs/phase-reports/P02-manifest.sha256`<br>`docs/phase-reports/P02.md` | **CHƯA ĐẠT** | - Lỗi BUG-P02-01: 28/37 tệp bị lệch mã băm SHA-256 do ký tự xuống dòng kép ở cuối tệp. |
| 9 | **Kiểm soát phiên bản Git:**<br>- Commit mã nguồn sạch sẽ trên branch `main`. | Git repository | **CHƯA ĐẠT** | - Lỗi IMP-P02-03: Mã nguồn và tài liệu P02 chưa được commit vào Git. |

---

## 4. Các Kiểm chứng Độc lập Đã Chạy

1. **Kiểm tra cú pháp JavaScript thực tế (`npm run lint`):**
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
   - Kết quả: **PASS (Đồng bộ thành công toàn bộ indexes cho 17 models)**.
5. **Kiểm tra Seed Admin thủ công & Idempotent (`npm run db:seed`):**
   - Lệnh: `npm run db:seed`
   - Kết quả: **PASS (`Admin user already exists: admin@sportbooking.local. Skipping creation.`)**.
6. **Kiểm thử tự động toàn diện (`npm test`):**
   - Lệnh: `npm test`
   - Kết quả: **FAIL CHẬP CHỜN (38 tests passed, 1 test failed)**:
     - `Phase Status & Governance Check (Integration)`: 5/5 PASS.
     - `Health & Readiness Endpoints (Integration)`: 4/4 PASS.
     - `App Import & Middlewares (Unit)`: 4/4 PASS.
     - `Environment Configuration Validation (Unit)`: 4/4 PASS.
     - `Logger Sensitive Data Masking (Unit)`: 3/3 PASS.
     - `Mongoose Models & Schema Definitions (Unit)`: 6/6 PASS.
     - `Unique Indexes, Constraints & Atomic Coordination (Integration)`: 7/7 PASS.
     - `Seed Admin & App Isolation (Integration)`: 3/3 PASS.
     - `Multi-Document ACID Transactions (Integration)`: 2/3 PASS (1 FAIL tại `PaymentOrder must be committed` do xung đột `deleteMany({})` từ `indexes-constraints.test.js`).
7. **Kiểm tra so khớp Bảng mã băm Manifest SHA-256:**
   - Lệnh: Đọc nhị phân và băm SHA-256 cho toàn bộ 37 tệp.
   - Kết quả: **CHƯA ĐẠT (Chỉ 9/37 tệp khớp; 28 tệp lệch do ký tự xuống dòng kép `\n\n`)**.

---

## 5. Kết luận và Kế hoạch Tiếp theo

### 5.1. Kết luận Đánh giá
Phase P02 đã đạt chất lượng rất tốt về mặt kiến trúc: 17 models được khai báo chi tiết và chuẩn hóa theo `docs/database.md`, helper `withTransaction` hoạt động chính xác với ACID và session lồng, replica set `rs0` cùng các script vận hành index/seed admin đã được chuẩn bị đầy đủ.

Tuy nhiên, phase **CHƯA ĐỦ ĐIỀU KIỆN NGHIỆM THU (`ACCEPTED`)** do còn tồn tại:
1. **BUG-P02-01:** Sai lệch mã băm SHA-256 trên 28/37 tệp bàn giao.
2. **BUG-P02-02:** Xung đột xóa dữ liệu giữa các integration test chạy song song làm chập chờn test suite.
3. **IMP-P02-03:** Chưa commit mã nguồn vào Git repository.

Trạng thái kết luận chính thức: **`NEEDS_CHANGES`**.

---

### 5.2. Yêu cầu Cụ thể cho Agent Triển khai (Kế hoạch Khắc phục)

1. **Sửa BUG-P02-02:**
   - Cập nhật hook `beforeEach` trong `server/tests/integration/indexes-constraints.test.js`: thay thế `PaymentOrder.deleteMany({})`, `FacilitySport.deleteMany({})`, `CourtDaySchedule.deleteMany({})` bằng các bộ lọc scoped cụ thể, không xóa toàn bộ collection dùng chung với `transaction.test.js`.
   - Chạy lại `npm test` nhiều lần để đảm bảo 39/39 tests PASS 100% ổn định.
2. **Sửa BUG-P02-01:**
   - Chuẩn hóa ký tự kết thúc của 28 tệp mã nguồn về đúng 1 ký tự LF (`\n`).
   - Tính toán lại mã băm SHA-256 cho toàn bộ 37 tệp trực tiếp từ đĩa, cập nhật chính xác vào `docs/phase-reports/P02-manifest.sha256` và Bảng Mục 5 của `docs/phase-reports/P02.md`.
3. **Sửa IMP-P02-03:**
   - Thực hiện `git add` toàn bộ các tệp P02 và commit với thông điệp rõ ràng theo quy ước conventional commit.
4. **Cập nhật Báo cáo và Trạng thái:**
   - Bổ sung nhật ký sửa lỗi vào `docs/phase-reports/P02.md`.
   - Cập nhật `docs/planning/phase-status.json` sang `READY_FOR_REVIEW` và gửi yêu cầu tái review độc lập.
5. **Ranh giới nghiêm ngặt:**
   - **Tuyệt đối KHÔNG bắt đầu triển khai Phase P03** hoặc xây dựng bất kỳ thành phần React frontend nào trước khi Phase P02 được tái review và nghiệm thu chính thức `ACCEPTED`.

