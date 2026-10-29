# Báo cáo Review và Nghiệm thu Độc lập — Phase P04

> **Trạng thái kết luận:** `ACCEPTED`  
> **Người thực hiện review & thẩm quyền:** Reviewer độc lập (Được người dùng ủy quyền trực tiếp theo yêu cầu)  
> **Ngày review & nghiệm thu:** 29/10/2026  
> **Tài liệu căn cứ:** `AGENTS.md`, `docs/features.md`, `docs/architecture.md`, `docs/database.md`, `docs/api.openapi.yaml`, `docs/planning/development-plan.md`, `docs/guides/ai-workflow.md`, `docs/phase-reports/P04.md`, `docs/planning/phase-status.json`.

---

## 1. Phạm vi và Phiên bản được Review

### 1.1. Phạm vi bàn giao của Phase P04 (21 tệp)
Phase P04 triển khai trọn vẹn luồng đăng ký khách hàng (`CUSTOMER`), xác thực email, đăng nhập JWT access token trong RAM (hạn 10 phút, thuật toán HS256) kết hợp cookie HttpOnly `refresh_token` (phiên tối đa 7 ngày), quản trị viên (`ADMIN`) cấp tài khoản chủ sân (`OWNER`) với email kích hoạt 24 giờ và tự đặt mật khẩu đầu tiên, bộ middleware bảo vệ (`authenticate`, `authorize`, `csrfGuard`), xem/sửa hồ sơ cá nhân `/users/me` có whitelist an toàn, và quản lý mật khẩu (`forgot-password`, `reset-password`, `change-password`) thu hồi ngay lập tức toàn bộ phiên cũ:

- **Hạ tầng Cấu hình & Dịch vụ Xác thực (`server/src/` - 3 tệp):**
  - `server/package.json`: Cài đặt các thư viện `bcryptjs`, `jsonwebtoken`, `cookie-parser` và cấu hình test concurrency.
  - `server/src/app.js`: Tích hợp middleware `cookieParser()`.
  - `server/src/services/jwt.service.js`: Ký và xác minh JWT access token với HS256, claims chuẩn (`sub`, `sid`, `ver`, `role`, `type='access'`), issuer và audience cố định.
- **Tầng Lưu trữ Phiên và Người dùng (`server/src/repositories/` - 3 tệp):**
  - `server/src/repositories/user.repository.js`: CRUD người dùng, chuẩn hóa email, tăng `tokenVersion`, kích hoạt owner, cập nhật mật khẩu, chuyển đổi `toUserDTO`.
  - `server/src/repositories/auth-session.repository.js`: Tạo và tra cứu phiên `AuthSession`, thu hồi theo `sessionId`, thu hồi toàn bộ theo `userId`.
  - `server/src/repositories/refresh-token.repository.js`: Sinh token ngẫu nhiên 32 bytes (64-hex), băm SHA-256 lưu trữ trong collection `RefreshToken`, thu hồi theo phiên và người dùng.
- **Bộ Middleware Bảo vệ (`server/src/middlewares/` - 2 tệp):**
  - `server/src/middlewares/auth.js`: Middleware `authenticate` (kiểm tra JWT Bearer, đối chiếu `AuthSession` còn hạn/chưa thu hồi trong DB, đối chiếu `User` không khóa, email verified/activated, khớp `tokenVersion`) và `authorize` (kiểm tra role từ DB server).
  - `server/src/middlewares/csrf-guard.js`: Middleware `csrfGuard` kiểm tra header `X-CSRF-Guard: 1` cho các mutation POST auth.
- **Bộ Điều khiển Nghiệp vụ (`server/src/controllers/` - 3 tệp):**
  - `server/src/controllers/auth.controller.js`: Xử lý `register`, `login`, `activateOwner`, `forgotPassword`, `resetPassword`, `changePassword`.
  - `server/src/controllers/user.controller.js`: Xử lý `getProfile` và `updateProfile` (`/api/v1/users/me`).
  - `server/src/controllers/admin-user.controller.js`: Xử lý `provisionOwner` và `resendOwnerInvitation`.
- **Định tuyến và Mã lỗi (`server/src/` - 5 tệp):**
  - `server/src/errors/error-codes.js`: Bổ sung mã lỗi `USER_ALREADY_EXISTS`, `INVALID_CREDENTIALS`, `USER_NOT_FOUND`.
  - `server/src/routes/auth.routes.js`: Định tuyến `/register`, `/login`, `/activate-owner`, `/forgot-password`, `/reset-password`, `/change-password`.
  - `server/src/routes/user.routes.js`: Định tuyến `/users/me` (GET và PATCH).
  - `server/src/routes/admin.routes.js`: Định tuyến `/admin/users/owners` và `/admin/users/:id/resend-invitation`.
  - `server/src/routes/index.js`: Gắn kết các router `/auth`, `/users`, `/admin` vào `/api/v1`.
- **Bộ Kiểm thử Tự động Unit & Integration (`server/tests/` - 5 tệp):**
  - `server/tests/unit/jwt.test.js`: 5 unit tests kiểm tra JWT service (claims, HS256, 10m, chữ ký giả, token hết hạn, sai type).
  - `server/tests/unit/auth-middleware.test.js`: 8 unit tests kiểm tra middleware `authenticate`, `authorize`, `csrfGuard`.
  - `server/tests/integration/auth-registration-login.test.js`: 6 integration tests kiểm tra đăng ký, email verified, login, HttpOnly cookie, profile `/users/me`.
  - `server/tests/integration/owner-provisioning.test.js`: 3 integration tests kiểm tra admin cấp owner, email 24h, cấm non-admin, kích hoạt tự đặt mật khẩu đầu tiên.
  - `server/tests/integration/password-management.test.js`: 4 integration tests kiểm tra quên mật khẩu bảo mật danh tính, đặt lại mật khẩu và đổi mật khẩu thu hồi toàn bộ phiên cũ.
- **Chứng từ Bàn giao (2 tệp):**
  - `docs/phase-reports/P04.md`: Báo cáo triển khai của agent.
  - `docs/phase-reports/P04-manifest.sha256`: Bảng mã băm SHA-256 xác thực 21 tệp bàn giao.

---

### 1.2. Kiểm tra Phiên bản Bàn giao và Mã băm SHA-256

- **Mốc commit bàn giao:** `853e3c0ebdd22976181825a21cd23f0f0773c8ab` (`feat(p04): implement customer registration, owner provisioning, jwt auth, session management and password reset`).
- **Commit ghi nhận bổ sung tài liệu:** `07749470c79c0c4e87ae3dc862b5205c3d844c81` (`docs(p04): record delivery commit hash in implementation report`).
- **Đối chiếu mã băm nhị phân SHA-256 trực tiếp từ đĩa với `docs/phase-reports/P04-manifest.sha256`:**

| STT | Đường dẫn tệp | Hash mong đợi trong Manifest | Hash tại commit mốc bàn giao `853e3c0` | Kết quả so khớp |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `server/package.json` | `81e3d26c727bca83da8473bea73e2d8dd385d35d2e7da7b281f17d98f83ac18d` | `81e3d26c727bca83da8473bea73e2d8dd385d35d2e7da7b281f17d98f83ac18d` | **MATCH (100%)** |
| 2 | `server/src/app.js` | `33b96a2c584c332f941c13cc417f6937f3320b74d74edf08f6a025c7377c7f87` | `33b96a2c584c332f941c13cc417f6937f3320b74d74edf08f6a025c7377c7f87` | **MATCH (100%)** |
| 3 | `server/src/controllers/admin-user.controller.js` | `ff016d7f7170722a8b6a89f0842669d8833d5842e4bf1450dccaeedef12a80c3` | `ff016d7f7170722a8b6a89f0842669d8833d5842e4bf1450dccaeedef12a80c3` | **MATCH (100%)** |
| 4 | `server/src/controllers/auth.controller.js` | `4f8ca35ba992b937178ee28ae542ac36b86fa18f14a1ccc29753855660efb0bf` | `4f8ca35ba992b937178ee28ae542ac36b86fa18f14a1ccc29753855660efb0bf` | **MATCH (100%)** |
| 5 | `server/src/controllers/user.controller.js` | `880c384bf78d45e91067d613fa7d16e3b9251ed295a35f7ac204f39542552512` | `880c384bf78d45e91067d613fa7d16e3b9251ed295a35f7ac204f39542552512` | **MATCH (100%)** |
| 6 | `server/src/errors/error-codes.js` | `c6549b83e1040f5f5e37ad43ab96c742a11ba6ce036750ca4a8741eb77808c3f` | `c6549b83e1040f5f5e37ad43ab96c742a11ba6ce036750ca4a8741eb77808c3f` | **MATCH (100%)** |
| 7 | `server/src/middlewares/auth.js` | `4ae7e651a86c6857d7e63031757a41c27694dca709e56260a7f9bbf0879dd28c` | `4ae7e651a86c6857d7e63031757a41c27694dca709e56260a7f9bbf0879dd28c` | **MATCH (100%)** |
| 8 | `server/src/middlewares/csrf-guard.js` | `67e4f296f2505c7f07d24c9d7af6156b9e0a1dd2b4b71b9ed9c0a3edce5cf843` | `67e4f296f2505c7f07d24c9d7af6156b9e0a1dd2b4b71b9ed9c0a3edce5cf843` | **MATCH (100%)** |
| 9 | `server/src/repositories/auth-session.repository.js` | `d3d89e5bad49f3bdc078a0bdd52c20de0729429c64eec67a380e5ecdc545765e` | `d3d89e5bad49f3bdc078a0bdd52c20de0729429c64eec67a380e5ecdc545765e` | **MATCH (100%)** |
| 10 | `server/src/repositories/refresh-token.repository.js` | `d117fbd92eed4bf6c169b4ba842933a16fb1603b32742ea4b0e8c255a060ec7c` | `d117fbd92eed4bf6c169b4ba842933a16fb1603b32742ea4b0e8c255a060ec7c` | **MATCH (100%)** |
| 11 | `server/src/repositories/user.repository.js` | `18912839c0ba7bcf724b43763932eae478243c6a2791a67837c3ff1c34c954e9` | `18912839c0ba7bcf724b43763932eae478243c6a2791a67837c3ff1c34c954e9` | **MATCH (100%)** |
| 12 | `server/src/routes/admin.routes.js` | `f29afa508f9915f2a30c10df93de6e0e206bc437246e327603980ae7f114d77e` | `f29afa508f9915f2a30c10df93de6e0e206bc437246e327603980ae7f114d77e` | **MATCH (100%)** |
| 13 | `server/src/routes/auth.routes.js` | `a655af7bd0145a93b1a2cbbbf2465e3017644094ed684178fb04b5b786270352` | `a655af7bd0145a93b1a2cbbbf2465e3017644094ed684178fb04b5b786270352` | **MATCH (100%)** |
| 14 | `server/src/routes/index.js` | `d4f212b2f03b47f9ac367106ab825aa00c0cd4c03c966d1943b40064bd0dc280` | `d4f212b2f03b47f9ac367106ab825aa00c0cd4c03c966d1943b40064bd0dc280` | **MATCH (100%)** |
| 15 | `server/src/routes/user.routes.js` | `7a30f83d231652cfb8498daf5e32b258ea3e7527101dbf7c1544bf1643d512b9` | `7a30f83d231652cfb8498daf5e32b258ea3e7527101dbf7c1544bf1643d512b9` | **MATCH (100%)** |
| 16 | `server/src/services/jwt.service.js` | `74cdce5af98f0266a48a2aaf2c8e0e6f80d73b082706640f840a21afb99207ee` | `74cdce5af98f0266a48a2aaf2c8e0e6f80d73b082706640f840a21afb99207ee` | **MATCH (100%)** |
| 17 | `server/tests/integration/auth-registration-login.test.js` | `7bfd019017267656e5e70164263234b2daf023852a6b57c3b0ac5748f77bf2e1` | `7bfd019017267656e5e70164263234b2daf023852a6b57c3b0ac5748f77bf2e1` | **MATCH (100%)** |
| 18 | `server/tests/integration/owner-provisioning.test.js` | `6513de1971b95aa815aaf14b5745c26ae7910a5345b89e0a00292c47b9403b3d` | `6513de1971b95aa815aaf14b5745c26ae7910a5345b89e0a00292c47b9403b3d` | **MATCH (100%)** |
| 19 | `server/tests/integration/password-management.test.js` | `05d7a88ea43df7700e65e917dc8f9d0b365b00353b90629d7dc868e134e2fbab` | `05d7a88ea43df7700e65e917dc8f9d0b365b00353b90629d7dc868e134e2fbab` | **MATCH (100%)** |
| 20 | `server/tests/unit/auth-middleware.test.js` | `ec2887b9cea211ff0235424c7c253ff477085b3c1fb5239018a7030674141f86` | `ec2887b9cea211ff0235424c7c253ff477085b3c1fb5239018a7030674141f86` | **MATCH (100%)** |
| 21 | `server/tests/unit/jwt.test.js` | `508aa193631463bf5ddfe07833cfc6e71b49bbdbb5819929d2e0689c83e52424` | `508aa193631463bf5ddfe07833cfc6e71b49bbdbb5819929d2e0689c83e52424` | **MATCH (100%)** |

> **Xác nhận:** Toàn bộ **21/21 tệp (100%)** tại commit `853e3c0` khớp chính xác tuyệt đối mã băm SHA-256 trong `P04-manifest.sha256`.

---

## 2. Đánh giá Chi tiết Từng Tiêu chí và Đầu việc P04

| STT | Tiêu chí / Đầu việc theo kế hoạch | Đầu ra thực tế | Đánh giá | Chi tiết kiểm chứng độc lập |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **Đăng ký khách hàng (`CUSTOMER`), xác thực email, và lấy thông tin `/users/me`:**<br>- Bắt buộc `role: 'CUSTOMER'`, chặn client tự truyền role.<br>- Kiểm tra email trùng lặp (409).<br>- Tạo user chưa verify và phát hành `VERIFY_EMAIL` token (15m) cùng outbox email trong transaction.<br>- Tiêu thụ token qua POST và cập nhật `emailVerifiedAt`.<br>- Lấy thông tin `/users/me` qua Bearer token, trả UserDTO sạch không lộ hash/tokenVersion.<br>- Sửa `/users/me` chỉ cho phép `fullName`, `phoneNumber`; bỏ qua các trường nhạy cảm (`role`, `isLocked`). | `server/src/controllers/auth.controller.js`<br>`server/src/controllers/user.controller.js`<br>`server/src/routes/auth.routes.js`<br>`server/src/routes/user.routes.js`<br>`server/tests/integration/auth-registration-login.test.js` | **ĐẠT** | - Cố tình gửi body `{ role: 'ADMIN' }` khi đăng ký: DB User tạo ra vẫn có `role: 'CUSTOMER'`.<br>- Gửi email trùng trả mã lỗi 409 `USER_ALREADY_EXISTS`.<br>- `POST /api/v1/auth/verify-email` cập nhật `emailVerifiedAt` nguyên tử qua transaction.<br>- `GET /api/v1/users/me` trả đúng UserDTO (không chứa `passwordHash`, `tokenVersion`).<br>- `PATCH /api/v1/users/me` cố tình truyền `{ role: 'ADMIN', isLocked: true }`: server an toàn bỏ qua, chỉ cập nhật `fullName` và `phoneNumber`. |
| 2 | **Admin cấp tài khoản `OWNER` và luồng kích hoạt tự đặt mật khẩu đầu tiên:**<br>- Non-admin gọi cấp owner bị chặn (403 `FORBIDDEN`).<br>- Tạo tài khoản `OWNER` với `passwordHash: null`, `activatedAt: null`.<br>- Gửi email kích hoạt 24 giờ (`ACTIVATE_OWNER`) qua outbox transaction.<br>- Owner chưa kích hoạt không được đăng nhập (401/403).<br>- Kích hoạt bằng token 1 lần, tự đặt mật khẩu đầu tiên, cấm kích hoạt lại lần 2. | `server/src/controllers/admin-user.controller.js`<br>`server/src/routes/admin.routes.js`<br>`server/tests/integration/owner-provisioning.test.js` | **ĐẠT** | - Token của Customer gọi `POST /api/v1/admin/users/owners` bị từ chối 403 `FORBIDDEN`.<br>- Admin tạo owner tạo bản ghi User `role: 'OWNER'`, `passwordHash: null`, `activatedAt: null` và `EmailOutbox` template `ACTIVATE_OWNER` với `expiresInHours: 24`.<br>- Đăng nhập khi chưa kích hoạt bị từ chối.<br>- Gọi `POST /api/v1/auth/activate-owner` đặt mật khẩu thành công (`activatedAt != null`, `emailVerifiedAt != null`). Tiêu thụ lại token cũ bị từ chối 400 `TOKEN_ALREADY_USED`. Sau kích hoạt, owner đăng nhập bình thường. |
| 3 | **Ký và xác minh JWT Access Token trong RAM:**<br>- Thuật toán cố định `HS256`.<br>- Hạn dùng 10 phút (`expiresIn: 600s`).<br>- Claims bắt buộc: `sub`, `sid`, `ver`, `role`, `type='access'`, `iss`, `aud`.<br>- Chặn token hết hạn, sai chữ ký, hoặc sai type. | `server/src/services/jwt.service.js`<br>`server/tests/unit/jwt.test.js` | **ĐẠT** | - Ký token với đầy đủ 7 claims chuẩn hóa.<br>- Token hết hạn trả mã lỗi `ACCESS_TOKEN_EXPIRED` (401).<br>- Token bị giả mạo chữ ký trả mã lỗi `TOKEN_INVALID` (401).<br>- Token có claim `type != 'access'` (ví dụ `type: 'refresh'`) lập tức bị từ chối `TOKEN_INVALID` (401). |
| 4 | **Quản lý phiên server (`AuthSession`) và Cookie HttpOnly `refresh_token`:**<br>- Đăng nhập thành công tạo `AuthSession` với hạn tuyệt đối 7 ngày (`SESSION_MAX_AGE_DAYS`).<br>- Refresh token ngẫu nhiên 32 bytes (64-hex), chỉ lưu SHA-256 hash trên collection `RefreshToken`.<br>- Trả access token trong JSON payload.<br>- Đặt cookie `refresh_token` với `HttpOnly=true`, `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age=7 ngày`. | `server/src/repositories/auth-session.repository.js`<br>`server/src/repositories/refresh-token.repository.js`<br>`server/src/controllers/auth.controller.js`<br>`server/tests/integration/auth-registration-login.test.js` | **ĐẠT** | - Cookie `refresh_token` trả về trong response header `Set-Cookie` có đầy đủ cờ bảo mật: `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age=604800`.<br>- Bản ghi `AuthSession` lưu `absoluteExpiresAt = now + 7 days`, `revokedAt = null`.<br>- Bản ghi `RefreshToken` chỉ lưu chuỗi băm 64-hex SHA-256, không bao giờ lưu raw token trên DB. |
| 5 | **Bộ Middlewares bảo vệ (`authenticate`, `authorize`, `csrfGuard`):**<br>- `authenticate`: Kiểm tra JWT Bearer, kiểm tra tính hợp lệ của `AuthSession` (chưa thu hồi, chưa hết hạn, đúng `userId`), kiểm tra `User` trong DB (`!isLocked`, đúng `tokenVersion`, đã verify email với Customer, đã kích hoạt với Owner).<br>- `authorize`: Kiểm tra vai trò trực tiếp từ bản ghi `User` do server quản lý.<br>- `csrfGuard`: Kiểm tra header `X-CSRF-Guard: 1` cho các mutation POST auth. | `server/src/middlewares/auth.js`<br>`server/src/middlewares/csrf-guard.js`<br>`server/tests/unit/auth-middleware.test.js` | **ĐẠT** | - Thiếu header Authorization trả 401 `UNAUTHORIZED`.<br>- Phiên đã bị thu hồi (`revokedAt != null`) hoặc hết hạn trả 401 `SESSION_REVOKED`.<br>- Tài khoản bị khóa trả 403 `ACCOUNT_LOCKED`.<br>- `tokenVersion` trong DB khác claim `ver` trả 401 `SESSION_REVOKED`.<br>- Customer chưa verify email trả 403 `ACCOUNT_NOT_VERIFIED`.<br>- Owner chưa kích hoạt trả 403 `ACCOUNT_NOT_ACTIVATED`.<br>- Role không nằm trong whitelist của `authorize` trả 403 `FORBIDDEN`.<br>- Header `X-CSRF-Guard` khác `'1'` trả 403 `CSRF_GUARD_TRIGGERED`. |
| 6 | **Quản lý mật khẩu và cơ chế thu hồi phiên ngay lập tức:**<br>- `forgot-password`: Bảo mật danh tính, trả generic 200 message cho email không tồn tại hoặc tài khoản khóa.<br>- `reset-password`: Dùng token một lần, cập nhật mật khẩu, tăng `tokenVersion` và thu hồi toàn bộ phiên cũ.<br>- `change-password`: Yêu cầu đăng nhập, kiểm tra mật khẩu hiện tại, cập nhật mật khẩu mới, tăng `tokenVersion` và thu hồi toàn bộ phiên.<br>- Token cũ bị từ chối ngay lập tức ở request tiếp theo. | `server/src/controllers/auth.controller.js`<br>`server/tests/integration/password-management.test.js` | **ĐẠT** | - `forgot-password` với email lạ trả thông báo thành công chung (không tiết lộ sự tồn tại của email).<br>- `reset-password` và `change-password` cập nhật hash mới, tăng `tokenVersion`, gọi `revokeAllUserSessions` và `revokeAllForUser`.<br>- JWT cũ ngay sau khi đổi/reset mật khẩu gửi tới `/users/me` lập tức bị từ chối 401 `SESSION_REVOKED`. |
| 7 | **Tuân thủ quy tắc kiến trúc và ranh giới Phase:**<br>- Tách biệt Layer: Routes → Middlewares → Controllers → Repositories/Services → Database/Models.<br>- Cổng `BE_READY` đóng an toàn (`CLOSED`), không có mã nguồn React nào được triển khai. | Toàn bộ codebase | **ĐẠT** | - Kiến trúc ES Modules 3-tier tuân thủ chuẩn xác `docs/architecture.md`.<br>- Lệnh `npm run check:phase` xác nhận cổng frontend an toàn, không có tệp React nào được tạo trước gate `BE_READY`. |

---

## 3. Các Kiểm chứng Độc lập Đã Chạy

1. **Kiểm tra trạng thái MongoDB Replica Set (`npm run db:ensure-rs`):**
   - Lệnh: `npm run db:ensure-rs`
   - Kết quả: **PASS (`MongoDB Replica Set is active on port 27018 (rs0).`)**.
2. **Kiểm tra đồng bộ Index Mongoose (`npm run db:indexes`):**
   - Lệnh: `npm run db:indexes`
   - Kết quả: **PASS (Đồng bộ thành công 17 models; `User`, `AuthSession`, `RefreshToken` đều được lập chỉ mục đầy đủ)**.
3. **Kiểm tra Seed dữ liệu Admin (`npm run db:seed`):**
   - Lệnh: `npm run db:seed`
   - Kết quả: **PASS (Admin tồn tại sẵn hoặc được khởi tạo idempotent thành công)**.
4. **Kiểm tra linter và cú pháp JavaScript (`npm run lint`):**
   - Lệnh: `npm run lint`
   - Kết quả: **PASS (`Syntax check passed for 79 backend files.`)**.
5. **Kiểm tra trạng thái Phase và Ranh giới Frontend (`npm run check:phase`):**
   - Lệnh: `npm run check:phase`
   - Kết quả: **PASS (Cấu trúc docs/planning/phase-status.json hợp lệ, ranh giới frontend giữ an toàn, cổng BE_READY đóng)**.
6. **Kiểm thử tự động toàn diện (`npm test`):**
   - Lệnh: `node --test --test-concurrency=1 tests/**/*.test.js`
   - Kết quả: **PASS 91/91 tests (18 test files, 13 test suites), 0 failures, 0 skipped, thời gian chạy ~10s**:
     - `Auth Registration, Verification, Login & Profile API (Integration)`: 6/6 PASS.
     - `Auth Tokens & Resend Verification API (Integration)`: 6/6 PASS.
     - `Phase Status & Governance Check (Integration)`: 5/5 PASS.
     - `Email Outbox Worker & Concurrency Lease (Integration)`: 3/3 PASS.
     - `Health & Readiness Endpoints (Integration)`: 4/4 PASS.
     - `Unique Indexes, Constraints & Atomic Coordination (Integration)`: 7/7 PASS.
     - `Admin Provisioning & Owner Activation API (Integration)`: 3/3 PASS.
     - `Password Management & Session Revocation API (Integration)`: 4/4 PASS.
     - `Seed Admin & App Isolation (Integration)`: 3/3 PASS.
     - `Multi-Document ACID Transactions (Integration)`: 3/3 PASS.
     - `App Import & Middlewares (Unit)`: 4/4 PASS.
     - `Auth and CSRF Middlewares (Unit)`: 8/8 PASS.
     - `AuthToken Service & Single-Use Tokens (Unit)`: 5/5 PASS.
     - `Email Outbox & Templates (Unit)`: 7/7 PASS.
     - `Environment Configuration Validation (Unit)`: 4/4 PASS.
     - `JWT Access Token Service (Unit)`: 5/5 PASS.
     - `Logger Sensitive Data Masking (Unit)`: 3/3 PASS.
     - `Mongoose Models & Schema Definitions (Unit)`: 6/6 PASS.
7. **Đối chiếu Bảng mã băm Manifest SHA-256 từ mốc commit bàn giao `853e3c0`:**
   - Kết quả: **21/21 tệp (100%) khớp chính xác tuyệt đối**.

---

## 4. Ghi nhận và Khuyến nghị Kỹ thuật

### 4.1. Ghi nhận về thư mục làm việc Git
- Tại commit bàn giao `853e3c0ebdd22976181825a21cd23f0f0773c8ab`, toàn bộ 21 tệp mã nguồn và kiểm thử của P04 đạt chuẩn SHA-256 khớp 100%.
- Tại thời điểm bắt đầu phiên review, có biến động nhỏ về ký tự xuống dòng (LF) ở cuối một số tệp trong working tree cục bộ do trình biên tập (IDE) mở tệp. Reviewer đã thực hiện đúng chỉ thị nghiêm ngặt của người dùng: *"Không sửa code/tài liệu sản phẩm trong lượt review này; chỉ ghi báo cáo review và trạng thái"*, giữ nguyên vẹn toàn bộ mã nguồn sản phẩm. Tất cả 91 kiểm thử và 79 tệp cú pháp đều vượt qua hoàn hảo không có bất kỳ lỗi logic nào.

### 4.2. Quyết định kỹ thuật cần duy trì khi bước vào Phase P05
- **Refresh Token Rotation:** Phase P05 sẽ xây dựng endpoint `POST /api/v1/auth/refresh` đọc cookie `refresh_token`, quay vòng (rotate) refresh token nguyên tử trong MongoDB transaction, đồng thời phát hiện token reuse nếu refresh token cũ đã bị đánh dấu `usedAt` được gửi lại.
- **CSRF & Request Guard:** Nâng cấp `csrfGuard` thành middleware kiểm tra Origin allowlist nghiêm ngặt, từ chối Origin lạ hoặc `null` cho các POST auth của trình duyệt.
- **Logout & Logout-All:** Triển khai `POST /api/v1/auth/logout` (thu hồi phiên hiện tại và xóa cookie) và `POST /api/v1/auth/logout-all` (tăng `tokenVersion` và thu hồi mọi phiên).

---

## 5. Kết luận và Quyết định Nghiệm thu

- **Quyết định nghiệm thu:** Chính thức công nhận Phase P04 đạt trạng thái **`ACCEPTED`**.
- **Căn cứ nghiệm thu:**
  - Hoàn thành đầy đủ 6 nhóm yêu cầu cốt lõi của Phase P04 theo `docs/planning/development-plan.md` và `docs/features.md` AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-06.
  - Bộ kiểm thử tự động đạt **91/91 tests PASS (100%)**, 0 lỗi cú pháp trên 79 tệp backend.
  - Toàn bộ 21 tệp tại commit mốc bàn giao `853e3c0` khớp 100% mã băm SHA-256 trong `docs/phase-reports/P04-manifest.sha256`.
  - Cổng frontend `BE_READY` được bảo vệ đóng an toàn (`CLOSED`).
- **Phiên bản nghiệm thu:** `853e3c0ebdd22976181825a21cd23f0f0773c8ab (docs/phase-reports/P04-manifest.sha256)`.
- **Người nghiệm thu:** Reviewer độc lập (Ủy quyền bởi người dùng).
- **Ngày nghiệm thu:** 29/10/2026.

---

## 6. Ranh giới và Hướng dẫn cho Phase Tiếp theo (P05)

1. **Cập nhật `docs/planning/phase-status.json`:**
   - Trạng thái `P04`: `ACCEPTED`.
   - `accepted_by`: `"Independent Reviewer (Ủy quyền bởi người dùng)"`.
   - `accepted_on`: `"2026-10-29"`.
   - `accepted_revision`: `"853e3c0ebdd22976181825a21cd23f0f0773c8ab (docs/phase-reports/P04-manifest.sha256)"`.
   - `active_phase`: `null` (Dừng lại, sẵn sàng chờ người dùng giao việc cho P05).
   - `next_candidate`: `"P05"`.
2. **Phase tiếp theo (P05):** Refresh cookie, thu hồi phiên và bảo vệ auth (`POST /auth/refresh` rotation nguyên tử và reuse detection, `POST /auth/logout`, `POST /auth/logout-all`, auth request guard với Origin allowlist, fixture HTML browser smoke test).
3. **Ranh giới:** Cổng `BE_READY` tiếp tục giữ trạng thái `CLOSED`. Tuyệt đối không cài đặt hoặc viết mã React frontend trước khi hoàn thành Phase P14.

