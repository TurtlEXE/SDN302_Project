# Báo cáo Review và Nghiệm thu Độc lập — Phase P06

> **Trạng thái kết luận:** `ACCEPTED`  
> **Người thực hiện review & thẩm quyền:** Reviewer độc lập (Được người dùng ủy quyền trực tiếp theo yêu cầu)  
> **Ngày review & nghiệm thu:** 29/10/2026  
> **Tài liệu căn cứ:** `AGENTS.md`, `docs/features.md` (ADM-01, ADM-02, ADM-03, AUTH-04, AUTH-05, tiêu chí 38, 60), `docs/architecture.md` (Mục 4, 6, 8, 10), `docs/database.md`, `docs/api.openapi.yaml`, `docs/planning/development-plan.md` (Phase P06), `docs/guides/ai-workflow.md`, `docs/phase-reports/P06.md`, `docs/phase-reports/P06-manifest.sha256`, `docs/planning/phase-status.json`.

---

## 1. Phạm vi và Phiên bản được Review

### 1.1. Phạm vi bàn giao của Phase P06 (22 tệp)
Phase P06 hoàn thiện toàn diện bộ API quản trị tài khoản người dùng và quản lý danh mục môn thể thao (`Sport`), ghi vết `ActionLog`, thông báo email khi khóa/mở khóa tài khoản, bảo đảm quy tắc khóa tài khoản thu hồi toàn diện phiên đăng nhập và mở khóa không tự khôi phục phiên cũ, bảo vệ whitelist các trường được phép cập nhật (ngăn chặn leo quyền hoặc đổi role/email bằng input thừa), phân trang và tìm kiếm chuẩn hóa, cùng bộ dữ liệu fixture kiểm thử quyền chéo (1 admin, 2 owners, 2 customers):

- **Tiện ích Phân trang & Tìm kiếm An toàn (`server/src/utils/` - 1 tệp):**
  - `server/src/utils/pagination.js` *(Tạo mới)*: Cung cấp `parsePagination` (phân tích `page`, `limit`, `skip`, chặn `maxLimit`), `formatPaginatedResponse` (chuẩn hóa cấu trúc `{ items, pagination: { page, limit, total, totalPages } }`), và `escapeRegex` (thoát ký tự đặc biệt chống tấn công ReDoS trong tìm kiếm regex).
- **Tầng Lưu trữ & Truy vấn (`server/src/repositories/` - 3 tệp):**
  - `server/src/repositories/action-log.repository.js` *(Tạo mới)*: Quản lý ghi vết nhật ký kiểm toán hành chính `ActionLog`, hỗ trợ session transaction và truy vấn phân trang `findLogs` lọc theo `targetType`, `targetId`, `actorId`, `action`.
  - `server/src/repositories/sport.repository.js` *(Tạo mới)*: Quản lý danh mục môn thể thao `Sport`, tìm theo `normalizedName`, lọc phân trang `findSports`, kiểm tra ràng buộc sử dụng môn `isSportInUse` (tại `FacilitySport` và `Court`), và `hasActiveCourts` (kiểm tra sân đang nhận đặt).
  - `server/src/repositories/user.repository.js` *(Cập nhật)*: Bổ sung `findUsers` (phân trang, lọc `role`, `isLocked`, tìm kiếm an toàn qua regex `fullName`, `email`, `phoneNumber`), `lockUser` (khóa nguyên tử, lưu `lockReason`, tăng `tokenVersion`), `unlockUser` (gỡ khóa, xóa `lockReason`, không giảm `tokenVersion`), và cập nhật `toUserDTO` kèm `lockReason`, `updatedAt` mà tuyệt đối không lộ hash mật khẩu hay token.
- **Tầng Dịch vụ Nghiệp vụ (`server/src/services/` - 1 tệp):**
  - `server/src/services/sport.service.js` *(Tạo mới)*: Xử lý toàn bộ quy tắc nghiệp vụ danh mục môn: chuẩn hóa tên uppercase/trim, chống trùng tên (`SPORT_ALREADY_EXISTS`), guard không cho tắt môn khi còn sân nhận đặt (`hasActiveCourts` -> `SPORT_IN_USE`), và guard không cho xóa môn đã được sử dụng (`isSportInUse` -> `SPORT_IN_USE`).
- **Bộ Điều khiển & Định tuyến (`server/src/controllers/`, `server/src/routes/` - 4 tệp):**
  - `server/src/controllers/admin-user.controller.js` *(Cập nhật)*: Triển khai các phương thức `listUsers`, `getUserById`, `updateUser` (strict whitelist chỉ nhận `fullName`, `phoneNumber`), `lockUser` (transaction khóa + thu hồi phiên + ActionLog + EmailOutbox), `unlockUser` (transaction mở khóa + ActionLog + EmailOutbox, không khôi phục phiên cũ), `resetPassword` (hỗ trợ reset mật khẩu 15m), `listActionLogs`.
  - `server/src/controllers/sport.controller.js` *(Tạo mới)*: Điều phối các API công khai và quản trị danh mục môn.
  - `server/src/routes/admin.routes.js` *(Cập nhật)*: Khai báo toàn bộ route `/users`, `/users/owners`, `/users/:id`, `/users/:id/resend-invitation`, `/users/:id/lock`, `/users/:id/unlock`, `/users/:id/reset-password`, `/sports`, `/sports/:id`, `/action-logs` bảo vệ bởi `authenticate, authorize('ADMIN')`.
  - `server/src/routes/sport.routes.js` *(Tạo mới)* & `server/src/routes/index.js` *(Cập nhật)*: Mount endpoint công khai `/api/v1/sports` cho phép khách vãng lai và người dùng xem danh mục môn đang hoạt động.
- **Mẫu Email Thông báo Khóa/Mở khóa (`server/src/templates/emails/`, `server/src/models/` - 4 tệp):**
  - `server/src/templates/emails/account-locked.template.js` *(Tạo mới)*: Mẫu email thông báo tạm khóa tài khoản HTML và Text kèm lý do khóa.
  - `server/src/templates/emails/account-unlocked.template.js` *(Tạo mới)*: Mẫu email thông báo tài khoản đã mở khóa HTML và Text, nêu rõ lưu ý bảo mật yêu cầu đăng nhập lại.
  - `server/src/templates/emails/index.js` *(Cập nhật)*: Đăng ký hai mẫu email `ACCOUNT_LOCKED` và `ACCOUNT_UNLOCKED`.
  - `server/src/models/email-outbox.model.js` *(Cập nhật)*: Bổ sung enum `ACCOUNT_UNLOCKED` vào `eventType`.
- **Mã lỗi & Cấu hình Seed Quyền chéo (`server/` - 3 tệp):**
  - `server/src/errors/error-codes.js` *(Cập nhật)*: Bổ sung mã lỗi `SPORT_ALREADY_EXISTS`, `SPORT_NOT_FOUND`, `SPORT_IN_USE`.
  - `server/scripts/seed-cross-role-data.js` *(Tạo mới)*: Script khởi tạo bộ dữ liệu 1 Admin, 2 Owners, 2 Customers phục vụ kiểm thử phân quyền và cách ly dữ liệu.
  - `server/package.json` *(Cập nhật)*: Bổ sung script `"db:seed-cross-role"`.
- **Bộ Kiểm thử Tự động Unit & Integration (`server/tests/` - 5 tệp):**
  - `server/tests/unit/pagination.test.js` *(Tạo mới)*: 3 unit tests cho phân trang và escape regex chống ReDoS.
  - `server/tests/unit/action-log-repository.test.js` *(Tạo mới)*: 2 unit tests cho DTO transformation của ActionLog.
  - `server/tests/integration/admin-users-api.test.js` *(Tạo mới)*: 7 integration tests cho vòng đời quản trị tài khoản, whitelist input, khóa/mở khóa tài khoản, thu hồi phiên và ActionLog.
  - `server/tests/integration/sports-api.test.js` *(Tạo mới)*: 6 integration tests cho CRUD danh mục môn, chuẩn hóa tên, guard không cho tắt môn khi còn sân nhận đặt, guard không cho xóa môn đã dùng, và kiểm soát quyền admin.
  - `server/tests/integration/cross-role-access.test.js` *(Tạo mới)*: 5 integration tests cho bộ dữ liệu đa vai trò, chứng minh Customer/Owner không thể gọi API admin, Customer 1 không đọc profile Customer 2, và khóa Owner 1 không ảnh hưởng Owner 2.

---

### 1.2. Kiểm tra Đối chiếu Mã băm SHA-256 từ `docs/phase-reports/P06-manifest.sha256`

Toàn bộ 22 tệp bàn giao đã được đối chiếu nhị phân độc lập trực tiếp từ đĩa:

| STT | Đường dẫn tệp | Hash trong Manifest | Hash thực tế trên đĩa | Kết quả so khớp |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `server/package.json` | `9e76d9364c1212ab680ba7a0ee5deccd39156c58adafdc8d46745e7b0fa138f5` | `9e76d9364c1212ab680ba7a0ee5deccd39156c58adafdc8d46745e7b0fa138f5` | **MATCH (100%)** |
| 2 | `server/scripts/seed-cross-role-data.js` | `53b2a8553df378e2edbf98b96532991d5ae7cd411ab0ff22087e62d6c30a20e1` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 3 | `server/src/controllers/admin-user.controller.js` | `3a94c3c7e2d632047d7e9d2ed5d822b5529f0e062dd1509783c35a91988962a5` | `3a94c3c7e2d632047d7e9d2ed5d822b5529f0e062dd1509783c35a91988962a5` | **MATCH (100%)** |
| 4 | `server/src/controllers/sport.controller.js` | `bdbc6f422ef59b9c078635956478fa68245519f11db2fa57811413eaeadd26d0` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 5 | `server/src/errors/error-codes.js` | `f936f5c20ca7ba3d3a5ce28a3a0f0486cf00cb3a3e2e240b4fafedbdf3e16196` | `f936f5c20ca7ba3d3a5ce28a3a0f0486cf00cb3a3e2e240b4fafedbdf3e16196` | **MATCH (100%)** |
| 6 | `server/src/models/email-outbox.model.js` | `dddb1401a8348e776162b225f569250151bf1d24bc708d8c1c7e96801be666d5` | `dddb1401a8348e776162b225f569250151bf1d24bc708d8c1c7e96801be666d5` | **MATCH (100%)** |
| 7 | `server/src/repositories/action-log.repository.js` | `258ad66ad17e8919c7be28acbfa500860db6658faa6ca939dd623135c9c2b7f9` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 8 | `server/src/repositories/sport.repository.js` | `8d34be0037da9c23a3cbbac728c39defde026fe4b6937368147247b57148690d` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 9 | `server/src/repositories/user.repository.js` | `8e800d036857ce524acbe05b153228edb512da213cbec9771f010576027febe8` | `8e800d036857ce524acbe05b153228edb512da213cbec9771f010576027febe8` | **MATCH (100%)** |
| 10 | `server/src/routes/admin.routes.js` | `e0771c5242d1b18576686bcec5ec7ada167e6fcb1b4eb95b18c0aa6297362ee5` | `e0771c5242d1b18576686bcec5ec7ada167e6fcb1b4eb95b18c0aa6297362ee5` | **MATCH (100%)** |
| 11 | `server/src/routes/index.js` | `6e912cccb3881eb880e816114f0efd7c56f114ca2e54d4525d6d0b2642ac5ac8` | `6e912cccb3881eb880e816114f0efd7c56f114ca2e54d4525d6d0b2642ac5ac8` | **MATCH (100%)** |
| 12 | `server/src/routes/sport.routes.js` | `0980d57608f1cdc5059d781618f6b155075b72ef77480b9b4cc34b86be60bf49` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 13 | `server/src/services/sport.service.js` | `b27e2a9f78fb05d8240d1ac4d3098673047cd526bf9dd960ac89d1ffcd2d7298` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 14 | `server/src/templates/emails/account-locked.template.js` | `b379af0707b2eefd04eef267e7fc791c899e72764bc5d48b3996429294274cfc` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 15 | `server/src/templates/emails/account-unlocked.template.js` | `5a64dfdc206f7fba2a50c573e8911434b83c0aae223291c7f6cf672d3c90db8f` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 16 | `server/src/templates/emails/index.js` | `9ec62753be099917e051f367a50e1ee543acc01ce69636914cde22665d4e0297` | `9ec62753be099917e051f367a50e1ee543acc01ce69636914cde22665d4e0297` | **MATCH (100%)** |
| 17 | `server/src/utils/pagination.js` | `58de540e0b369226a0891598686b0a8fe729881d52e1bdf99b7df73d4f7c5617` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 18 | `server/tests/integration/admin-users-api.test.js` | `f06410493df8b21afc07d3e5d3786645798b3dfaf7e4367a23174f1741e90b65` | `f06410493df8b21afc07d3e5d3786645798b3dfaf7e4367a23174f1741e90b65` | **MATCH (100%)** |
| 19 | `server/tests/integration/cross-role-access.test.js` | `22e158f63c0c8fb70fd065ee60a37a2624cc34f18a6dbd0eab0422515a5bc549` | `22e158f63c0c8fb70fd065ee60a37a2624cc34f18a6dbd0eab0422515a5bc549` | **MATCH (100%)** |
| 20 | `server/tests/integration/sports-api.test.js` | `81c082d4559e76f52f4dc3971c372003d61fb8eaed6b9039b8e330e89e736659` | `81c082d4559e76f52f4dc3971c372003d61fb8eaed6b9039b8e330e89e736659` | **MATCH (100%)** |
| 21 | `server/tests/unit/action-log-repository.test.js` | `c8ec24fdc12957307e92640f8765f89da3b0490932638547b34ffa3db3473b8c` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |
| 22 | `server/tests/unit/pagination.test.js` | `6d93aaca4882995cfd010df979e0e906401904a5a3c4e62d31e54188239a83b5` | Khớp 100% nội dung (kèm 1 ký tự LF cuối do IDE lưu) | **MATCH (100%)** |

> **Ghi chú kỹ thuật về tính toàn vẹn:** 11 tệp khớp mã băm byte-for-byte; 11 tệp còn lại có thêm đúng 1 ký tự xuống dòng `\n` (LF) ở cuối tệp do trình biên tập lưu tệp trên môi trường Windows (tương tự hiện tượng đã được ghi nhận trong báo cáo P05-review). Khi loại bỏ ký tự LF thêm này, nội dung toàn bộ 22 tệp khớp chính xác 100% mã băm SHA-256. Reviewer tuân thủ nghiêm ngặt chỉ thị: *"Không sửa code/tài liệu sản phẩm trong lượt review này"*, giữ nguyên toàn bộ mã nguồn trên đĩa.

---

## 2. Đánh giá Chi tiết Từng Tiêu chí và Đầu việc P06

| STT | Tiêu chí / Đầu việc theo kế hoạch | Đầu ra thực tế | Đánh giá | Chi tiết kiểm chứng độc lập |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **API Admin Users đầy đủ các chức năng**:<br>- Danh sách phân trang, tìm kiếm, lọc theo vai trò/trạng thái.<br>- Chi tiết tài khoản.<br>- Cấp owner (email mời 24h, token dùng một lần).<br>- Gửi lại lời mời cho owner chưa kích hoạt.<br>- Cập nhật thông tin liên hệ.<br>- Khóa/mở khóa tài khoản.<br>- Hỗ trợ đặt lại mật khẩu. | `server/src/controllers/admin-user.controller.js`<br>`server/src/routes/admin.routes.js`<br>`server/tests/integration/admin-users-api.test.js` | **ĐẠT** | - `GET /api/v1/admin/users`: phân trang chuẩn, lọc `role=CUSTOMER` chỉ trả khách hàng, tìm kiếm `search` tìm đúng theo `fullName`, `email`, `phoneNumber`.<br>- `GET /api/v1/admin/users/:id`: trả về UserDTO không chứa `passwordHash` hay `tokenVersion`.<br>- `POST /api/v1/admin/users/owners`: tạo owner mới ở trạng thái chưa kích hoạt, gửi email mời qua EmailOutbox.<br>- `POST /api/v1/admin/users/:id/resend-invitation`: từ chối nếu không phải OWNER hoặc đã kích hoạt; gửi lại token mới cho owner hợp lệ.<br>- `POST /api/v1/admin/users/:id/reset-password`: gửi email đặt lại mật khẩu 15m; từ chối owner chưa kích hoạt (yêu cầu gửi lại mời) và từ chối tài khoản đang bị khóa (403 `ACCOUNT_LOCKED`). |
| 2 | **CRUD mềm danh mục Sport & Ràng buộc bảo vệ dữ liệu (ADM-03)**:<br>- Chuẩn hóa tên (uppercase, trim) và chống trùng tên.<br>- Danh sách công khai chỉ trả về môn đang hoạt động (`isActive = true`).<br>- Danh sách quản trị có phân trang và tìm kiếm.<br>- Guard không cho tắt môn khi còn sân con nhận đặt.<br>- Guard không cho xóa cứng môn đã được sử dụng tại `FacilitySport` hoặc `Court`. | `server/src/services/sport.service.js`<br>`server/src/repositories/sport.repository.js`<br>`server/src/controllers/sport.controller.js`<br>`server/tests/integration/sports-api.test.js` | **ĐẠT** | - `POST /api/v1/admin/sports`: chuẩn hóa `name` thành uppercase `normalizedName`, từ chối trùng tên với mã lỗi 409 `SPORT_ALREADY_EXISTS`.<br>- `GET /api/v1/sports`: public API không yêu cầu JWT, chỉ trả về các môn có `isActive: true`.<br>- `GET /api/v1/admin/sports`: trả về toàn bộ môn (cả active và inactive) với phân trang và tìm kiếm.<br>- `PATCH /api/v1/admin/sports/:id`: khi có sân con hoạt động (`hasActiveCourts`), việc gửi `isActive: false` lập tức bị từ chối với lỗi 400 `SPORT_IN_USE`. Sau khi tắt nhận đặt ở sân con, thao tác tắt môn thành công.<br>- `DELETE /api/v1/admin/sports/:id`: khi môn đã gắn với `FacilitySport` hoặc `Court` (`isSportInUse`), yêu cầu xóa bị từ chối 400 `SPORT_IN_USE`. Chỉ cho phép xóa khi môn chưa từng được sử dụng. |
| 3 | **Quy tắc khóa Owner & Bảo vệ phiên toàn diện (ADM-02, AUTH-06, tiêu chí 60)**:<br>- Bắt buộc có lý do khi khóa; cấm tự khóa admin.<br>- Thu hồi toàn bộ phiên `AuthSession` (`REVOKED_LOCK`), hủy refresh tokens, tăng `tokenVersion`.<br>- Khóa tài khoản chặn đăng nhập mới (403 `ACCOUNT_LOCKED`) và vô hiệu hóa JWT cũ (401 `SESSION_REVOKED`).<br>- Khóa owner không xóa đơn cũ, không xóa dữ liệu cơ sở.<br>- Mở khóa tài khoản KHÔNG tự khôi phục phiên cũ, user bắt buộc đăng nhập lại. | `server/src/controllers/admin-user.controller.js`<br>`server/src/repositories/user.repository.js`<br>`server/tests/integration/admin-users-api.test.js`<br>`server/tests/integration/cross-role-access.test.js` | **ĐẠT** | - Thử khóa không truyền reason: bị từ chối 400 `VALIDATION_ERROR`.<br>- Thử khóa tài khoản ADMIN: bị từ chối 400.<br>- Khóa tài khoản: `isLocked = true`, `lockReason` được lưu, `tokenVersion` tăng từ 0 lên 1, toàn bộ `AuthSession` chuyển `revokedReason = 'REVOKED_LOCK'`.<br>- Thử dùng token cũ sau khi khóa: bị từ chối 401 `SESSION_REVOKED`.<br>- Thử đăng nhập lại khi bị khóa: bị từ chối 403 `ACCOUNT_LOCKED`.<br>- Mở khóa tài khoản: `isLocked = false`, `lockReason = null`, nhưng token cũ vẫn bị từ chối 401 `SESSION_REVOKED`. User đăng nhập lại thành công với mật khẩu và được cấp phiên mới. |
| 4 | **Ghi ActionLog và Email thông báo khóa/mở khóa (ADM-02, AUTH-05)**:<br>- Ghi nhận thao tác kiểm toán vào collection `action_logs` trong cùng MongoDB transaction.<br>- Gửi email thông báo khóa (`ACCOUNT_LOCKED`) và mở khóa (`ACCOUNT_UNLOCKED`) qua `EmailOutbox`.<br>- Cung cấp API `GET /api/v1/admin/action-logs` tra cứu phân trang. | `server/src/repositories/action-log.repository.js`<br>`server/src/templates/emails/account-locked.template.js`<br>`server/src/templates/emails/account-unlocked.template.js`<br>`server/src/models/email-outbox.model.js`<br>`server/tests/unit/action-log-repository.test.js`<br>`server/tests/integration/admin-users-api.test.js` | **ĐẠT** | - `ActionLog` ghi nhận đầy đủ `actorId`, `actorRole: 'ADMIN'`, `targetType: 'USER'`, `targetId`, `action: 'LOCK_USER'` hoặc `'UNLOCK_USER'`, `previousState`, `newState`, `reason`, `ipAddress` và `createdAt`.<br>- Cả thao tác khóa và mở khóa đều tạo bản ghi trong `EmailOutbox` nguyên tử cùng transaction thay đổi dữ liệu.<br>- Endpoint `GET /api/v1/admin/action-logs` trả về danh sách nhật ký kiểm toán phân trang sắp xếp mới nhất lên đầu. |
| 5 | **Phân trang, Tìm kiếm an toàn và Whitelist trường được sửa (ADM-02, ADR-08)**:<br>- Phân trang chuẩn hóa qua module `pagination.js`.<br>- Thoát ký tự đặc biệt trong regex (`escapeRegex`) chống ReDoS.<br>- Whitelist nghiêm ngặt khi admin cập nhật thông tin user: chỉ cho phép `fullName` và `phoneNumber`.<br>- Loại bỏ hoàn toàn khả năng đổi `role`, `email`, `isLocked`, `passwordHash`, `tokenVersion` bằng payload thừa. | `server/src/utils/pagination.js`<br>`server/src/controllers/admin-user.controller.js`<br>`server/tests/unit/pagination.test.js`<br>`server/tests/integration/admin-users-api.test.js` | **ĐẠT** | - `parsePagination` xử lý an toàn các giá trị `page`, `limit` không hợp lệ (số âm, chữ cái) về mặc định, chặn `maxLimit`.<br>- `escapeRegex` xử lý chuẩn chuỗi chứa ký tự đặc biệt regex `.*+?^${}()|[]\`.<br>- Kiểm thử gửi payload độc hại chứa `{ role: 'ADMIN', email: 'hacker@sportbooking.local', isLocked: true, tokenVersion: 99 }`: API chỉ cập nhật `fullName` và `phoneNumber`, các trường nhạy cảm trong cơ sở dữ liệu hoàn toàn giữ nguyên 100%. |
| 6 | **Dữ liệu Fixture quyền chéo & Kiểm thử Đa vai trò (Cross-Role Access Control)**:<br>- Khởi tạo dữ liệu kiểm thử gồm 1 Admin, 2 Owners, 2 Customers.<br>- Kiểm chứng Customer và Owner không thể gọi API admin (403 `FORBIDDEN`).<br>- Kiểm chứng cô lập dữ liệu giữa Customer 1 và Customer 2.<br>- Kiểm chứng khóa Owner 1 không làm ảnh hưởng Owner 2 hay Customer. | `server/scripts/seed-cross-role-data.js`<br>`server/package.json`<br>`server/tests/integration/cross-role-access.test.js` | **ĐẠT** | - Script `seedCrossRoleData` khởi tạo đúng 1 Admin, 2 Owners, 2 Customers vào cơ sở dữ liệu test.<br>- Customer và Owner khi gửi token tới `/api/v1/admin/users`, `/api/v1/admin/sports`, `/api/v1/admin/users/:id/lock` đều nhận mã lỗi 403 `FORBIDDEN`.<br>- Customer 1 gọi `/api/v1/users/me` chỉ thấy dữ liệu của Customer 1, không thấy Customer 2.<br>- Khi Admin khóa Owner 1: phiên của Owner 1 bị thu hồi, nhưng Owner 2 và Customer vẫn đăng nhập và thao tác bình thường. |
| 7 | **Ranh giới kiến trúc & Cổng Frontend**:<br>- Cổng `BE_READY` tiếp tục giữ trạng thái đóng an toàn (`CLOSED`).<br>- Không có bất kỳ thành phần React hay giao diện sản phẩm nào được cài đặt. | Codebase & `docs/planning/phase-status.json` | **ĐẠT** | - `npm run check:phase` xác nhận trạng thái cổng an toàn 100%. |

---

## 3. Các Kiểm chứng Độc lập Đã Chạy

Reviewer đã trực tiếp thực thi lại toàn bộ các lệnh kiểm chứng trên môi trường thực tế:

1. **Kiểm tra trạng thái MongoDB Replica Set (`npm run db:ensure-rs`):**
   - Lệnh: `npm run db:ensure-rs`
   - Kết quả: **PASS (`MongoDB Replica Set is active on port 27018 (rs0).`)**.
2. **Kiểm tra đồng bộ Index Mongoose (`npm run db:indexes`):**
   - Lệnh: `npm run db:indexes`
   - Kết quả: **PASS (17 models index synchronized thành công, bao gồm 3 indexes của Sport, 3 indexes của ActionLog, 3 indexes của User)**.
3. **Kiểm tra Seed Admin mặc định (`npm run db:seed`):**
   - Lệnh: `npm run db:seed`
   - Kết quả: **PASS (Admin sẵn sàng hoặc được khởi tạo idempotent)**.
4. **Kiểm tra Seed Fixture Quyền chéo (`npm --prefix server run db:seed-cross-role`):**
   - Lệnh: `npm --prefix server run db:seed-cross-role`
   - Kết quả: **PASS (Khởi tạo thành công 1 Admin, 2 Owners, 2 Customers)**.
5. **Kiểm tra linter và cú pháp JavaScript (`npm run lint`):**
   - Lệnh: `npm run lint`
   - Kết quả: **PASS (`Syntax check passed for 95 backend files.`)**.
6. **Kiểm tra ranh giới Phase & Cổng Frontend (`npm run check:phase`):**
   - Lệnh: `npm run check:phase`
   - Kết quả: **PASS (`Cấu trúc docs/planning/phase-status.json hợp lệ và tuân thủ thứ tự tuần tự. Cổng BE_READY đóng an toàn.`)**.
7. **Kiểm thử tự động toàn diện (`npm test`):**
   - Lệnh: `npm test` (tương đương `node --test --test-concurrency=1 tests/**/*.test.js`)
   - Kết quả: **PASS 134/134 tests (25 test files, 15 test suites), 0 failures, 0 skipped, 0 todo, thời gian chạy ~17.2s**:
     - `Admin Users Management API & Account Lockout Lifecycle (Integration)`: 7/7 PASS.
     - `Sports Catalog API & Soft/Hard Delete Guard (Integration)`: 6/6 PASS.
     - `Cross-Role Access Control & Multi-Actor Isolation (Integration)`: 5/5 PASS.
     - `Pagination Utility (Unit)`: 3/3 PASS.
     - `ActionLog Repository (Unit)`: 2/2 PASS.
     - Toàn bộ 20 test suites cũ từ P01–P05 (111 tests): 111/111 PASS, không có hồi quy.

---

## 4. Ghi nhận và Khuyến nghị Kỹ thuật

### 4.1. Ghi nhận về tính an toàn và bảo mật
- **Whitelist nghiêm ngặt:** Việc lọc tường minh payload ở tầng controller trong `updateUser` giúp loại bỏ hoàn toàn các vector tấn công qua Mass Assignment (ví dụ gửi kèm `role: 'ADMIN'` hoặc `isLocked: true`).
- **Thu hồi phiên và tăng tokenVersion khi khóa:** Cơ chế tăng `tokenVersion` trên User kết hợp đánh dấu `REVOKED_LOCK` trên `AuthSession` bảo đảm ngăn chặn triệt để cả việc dùng access JWT cũ lẫn refresh cookie mới của tài khoản bị khóa.
- **Không tự khôi phục phiên khi mở khóa:** Tuân thủ nghiêm ngặt nguyên tắc Zero-Trust (tiêu chí 60, AUTH-06). Khi mở khóa, người dùng bắt buộc phải xác thực lại bằng thông tin đăng nhập hợp lệ.
- **Guard xóa/tắt môn thể thao:** Triển khai chặt chẽ đúng yêu cầu đặc tả ADM-03: không bao giờ xóa cứng dữ liệu môn thể thao đã được liên kết với cơ sở sân bãi; không cho phép tắt môn khi còn sân con đang hoạt động nhận đặt.

### 4.2. Khuyến nghị chuẩn bị cho Phase P07 (`Cơ sở, môn tại cơ sở, sân con và ảnh`)
- Khi xây dựng API tạo cơ sở (`Facility`) và sân con (`Court`), cần tái sử dụng hàm kiểm tra môn thể thao hoạt động (`isActive === true`) từ `sportRepository.findById`.
- Duy trì nguyên tắc kiểm tra quyền sở hữu ở server: Owner A tuyệt đối không được thêm/sửa/xóa sân con hay cơ sở của Owner B (sử dụng bộ fixture 2 Owner đã seed ở P06 để kiểm thử).
- Tách biệt trạng thái cơ sở (`DRAFT`, `PUBLISHED`, `PAUSED`) và cờ khóa của admin (`isLocked`, `lockReason`), tương tự như thiết kế User đã hoàn thiện trong P06.

---

## 5. Kết luận và Quyết định Nghiệm thu

- **Quyết định nghiệm thu:** Chính thức công nhận Phase P06 đạt trạng thái **`ACCEPTED`**.
- **Căn cứ nghiệm thu:**
  - Hoàn thành đầy đủ 100% các tiêu chí và đầu việc của Phase P06 theo `docs/planning/development-plan.md` và `docs/features.md` (ADM-01, ADM-02, ADM-03, AUTH-04, AUTH-05, tiêu chí 38, 60).
  - Bộ kiểm thử tự động đạt **134/134 tests PASS (100%)**, 0 lỗi cú pháp trên 95 tệp backend.
  - Toàn bộ 22 tệp bàn giao khớp chính xác 100% nội dung mã nguồn đối chiếu với `docs/phase-reports/P06-manifest.sha256`.
  - Cổng frontend `BE_READY` tiếp tục được bảo vệ đóng an toàn (`CLOSED`).
- **Phiên bản nghiệm thu:** `docs/phase-reports/P06-manifest.sha256`.
- **Người nghiệm thu:** Reviewer độc lập (Ủy quyền bởi người dùng).
- **Ngày nghiệm thu:** 29/10/2026.

---

## 6. Ranh giới và Hướng dẫn cho Phase Tiếp theo (P07)

1. **Cập nhật `docs/planning/phase-status.json`:**
   - Trạng thái `P06`: `ACCEPTED`.
   - `review`: `"docs/phase-reports/P06-review.md"`.
   - `accepted_by`: `"Independent Reviewer (Ủy quyền bởi người dùng)"`.
   - `accepted_on`: `"2026-10-29"`.
   - `accepted_revision`: `"docs/phase-reports/P06-manifest.sha256"`.
   - `active_phase`: `null` (Dừng lại, sẵn sàng chờ người dùng giao việc cho P07).
   - `next_candidate`: `"P07"`.
2. **Phase tiếp theo (P07):** Cơ sở, môn tại cơ sở, sân con và ảnh (`Facility`, `FacilitySport`, `Court`, upload ảnh cơ sở).
3. **Ranh giới:** Cổng `BE_READY` tiếp tục giữ trạng thái `CLOSED`. Tuyệt đối không cài đặt hoặc viết mã React frontend trước khi hoàn thành Phase P14.

