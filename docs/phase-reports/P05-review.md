# Báo cáo Review và Nghiệm thu Độc lập — Phase P05

> **Trạng thái kết luận:** `ACCEPTED`  
> **Người thực hiện review & thẩm quyền:** Reviewer độc lập (Được người dùng ủy quyền trực tiếp theo yêu cầu)  
> **Ngày review & nghiệm thu:** 29/10/2026  
> **Tài liệu căn cứ:** `AGENTS.md`, `docs/features.md` (AUTH-06, tiêu chí 57–64), `docs/architecture.md` (Mục 10), `docs/database.md`, `docs/api.openapi.yaml`, `docs/planning/development-plan.md` (Phase P05), `docs/guides/ai-workflow.md`, `docs/phase-reports/P05.md`, `docs/planning/phase-status.json`.

---

## 1. Phạm vi và Phiên bản được Review

### 1.1. Phạm vi bàn giao của Phase P05 (15 tệp)
Phase P05 hoàn thiện toàn diện cơ chế bảo vệ phiên phía server: Refresh token rotation nguyên tử trong MongoDB transaction kèm phát hiện token reuse (thu hồi phiên ngay lập tức khi phát hiện phát lại token cũ), quản lý đăng xuất hiện tại (`POST /api/v1/auth/logout`) và đăng xuất tất cả phiên (`POST /api/v1/auth/logout-all`), kiểm tra hạn tuyệt đối 7 ngày không thể kéo dài, cấu hình cookie HttpOnly/SameSite/Path an toàn qua helper thống nhất, nâng cấp Auth Request Guard bắt buộc (`Origin` allowlist, `X-CSRF-Guard: 1`, `Content-Type: application/json`), chuẩn hóa bộ mã lỗi và tạo fixture HTML kiểm thử browser smoke tối thiểu:

- **Hạ tầng Cấu hình & Tiện ích Bảo mật (`server/src/` - 3 tệp):**
  - `server/src/config/cors.js`: Cấu hình CORS chặt chẽ, từ chối Origin không nằm trong allowlist với lỗi 403 `CSRF_GUARD_TRIGGERED`, cho phép credentials với origin cụ thể, cấm wildcard.
  - `server/src/utils/cookie.js` *(Tạo mới)*: Cung cấp `getRefreshCookieOptions`, `getClearRefreshCookieOptions`, `setRefreshCookie`, `clearRefreshCookie` chuẩn hóa các cờ `httpOnly: true`, `secure: production`, `sameSite: 'lax'`, `path: /api/v1/auth`, host-only (không Domain), `maxAge` capped theo hạn phiên còn lại.
  - `server/src/middlewares/csrf-guard.js`: Nâng cấp thành Auth Request Guard hoàn chỉnh kiểm tra header `X-CSRF-Guard: 1`, `Origin` allowlist (`env.CLIENT_ORIGIN`, localhost trong dev/test), và `Content-Type: application/json` với requests có body.
- **Tầng Dịch vụ & Lưu trữ (`server/src/` - 2 tệp):**
  - `server/src/services/jwt.service.js`: Bổ sung cơ chế tự động giới hạn `expiresInSeconds` của access token không bao giờ vượt quá `session.absoluteExpiresAt`.
  - `server/src/repositories/refresh-token.repository.js`: Bổ sung hàm nguyên tử `markUsedAtomic` (dùng `findOneAndUpdate` kiểm tra `usedAt: null`) và `setReplacedBy`.
- **Bộ Điều khiển & Định tuyến (`server/src/` - 2 tệp):**
  - `server/src/controllers/auth.controller.js`: Bổ sung handlers `refresh`, `logout`, `logoutAll`, đồng bộ hóa việc sử dụng `setRefreshCookie` và `clearRefreshCookie`.
  - `server/src/routes/auth.routes.js`: Gắn kết các route `/refresh`, `/logout`, `/logout-all` với các middleware bảo vệ phù hợp (`csrfGuard`, `authenticate`).
- **Fixture Kiểm thử Trình duyệt Tối thiểu (1 tệp):**
  - `server/fixtures/auth-cookie-test.html` *(Tạo mới)*: Giao diện HTML kiểm chứng thực tế trong trình duyệt cho cookie HttpOnly, document.cookie safety, CORS credentials, rotation và CSRF guard.
- **Bộ Kiểm thử Tự động Unit & Integration (`server/tests/` - 7 tệp):**
  - `server/tests/unit/auth-request-guard.test.js` *(Tạo mới)*: 9 unit tests cho Auth Request Guard (`X-CSRF-Guard`, Origin allowlist, reject missing/null/unauthorized origin, JSON content-type).
  - `server/tests/unit/auth-middleware.test.js`: Cập nhật fixture origin cho các bài test middleware.
  - `server/tests/integration/auth-refresh-rotation.test.js` *(Tạo mới)*: 6 integration tests toàn diện cho token rotation, reuse detection (thu hồi toàn bộ phiên), logout, logout-all, absolute expiry cap, và CSRF/Origin rejection.
  - `server/tests/integration/auth-registration-login.test.js`: Cập nhật header Origin tuân thủ Auth Request Guard.
  - `server/tests/integration/auth-tokens-api.test.js`: Cập nhật header Origin.
  - `server/tests/integration/owner-provisioning.test.js`: Cập nhật header Origin.
  - `server/tests/integration/password-management.test.js`: Cập nhật header Origin.

---

### 1.2. Kiểm tra Phiên bản Bàn giao và Mã băm SHA-256

- **Mốc commit bàn giao:** `305326d7e0b0bc4446a23742ffb6d4bff01936b3` (`feat(p05): implement refresh cookie rotation, reuse detection, session revocation and auth request guard`).
- **Commit ghi nhận bổ sung tài liệu:** `412533958c029a69576d51f9ecc967a3bb237d5b` (`docs(p05): record delivery commit hash in implementation report`).
- **Đối chiếu mã băm nhị phân SHA-256 trực tiếp từ đĩa với `docs/phase-reports/P05-manifest.sha256`:**

| STT | Đường dẫn tệp | Hash mong đợi trong Manifest | Hash tại commit mốc bàn giao `305326d` | Kết quả so khớp |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `server/src/config/cors.js` | `7d64c5e5a8fd2668bd4d17b11198e75ee9c3030a89c900319f29e0eb65788b59` | `7d64c5e5a8fd2668bd4d17b11198e75ee9c3030a89c900319f29e0eb65788b59` | **MATCH (100%)** |
| 2 | `server/src/controllers/auth.controller.js` | `24ce3793270bc692d4ac156c809deb347822885190bbc0358955512bc1aad5d9` | `24ce3793270bc692d4ac156c809deb347822885190bbc0358955512bc1aad5d9` | **MATCH (100%)** |
| 3 | `server/src/middlewares/csrf-guard.js` | `77a3bf5528f8041ab1f4a5b62c2d4d8d80b08038cf831380a963c345a0770163` | `77a3bf5528f8041ab1f4a5b62c2d4d8d80b08038cf831380a963c345a0770163` | **MATCH (100%)** |
| 4 | `server/src/repositories/refresh-token.repository.js` | `8476e4dbb50edbc4db06c885ce5318899996ecc39e136841133b3340fa7c551e` | `8476e4dbb50edbc4db06c885ce5318899996ecc39e136841133b3340fa7c551e` | **MATCH (100%)** |
| 5 | `server/src/routes/auth.routes.js` | `b0aa1bb1d1c9528a3f36f4eba121ddaa9ceba8374715bb3229e6190fe853e22f` | `b0aa1bb1d1c9528a3f36f4eba121ddaa9ceba8374715bb3229e6190fe853e22f` | **MATCH (100%)** |
| 6 | `server/src/services/jwt.service.js` | `3770bb50e7cc41baf45ed0b41e3505f2e4785c66aa2513b1a24c2025caff5967` | `3770bb50e7cc41baf45ed0b41e3505f2e4785c66aa2513b1a24c2025caff5967` | **MATCH (100%)** |
| 7 | `server/src/utils/cookie.js` | `a4757ac43cf8d46bd2affd175e6322d971f13264124cd42cf83c0b5dab73a10d` | `a4757ac43cf8d46bd2affd175e6322d971f13264124cd42cf83c0b5dab73a10d` | **MATCH (100%)** |
| 8 | `server/fixtures/auth-cookie-test.html` | `f34b3bc5e787c7bb2be708cb4d606fbb3c4d092ace1adb0a7814a2905061c0e5` | `f34b3bc5e787c7bb2be708cb4d606fbb3c4d092ace1adb0a7814a2905061c0e5` | **MATCH (100%)** |
| 9 | `server/tests/unit/auth-request-guard.test.js` | `ca1e61e092d53ba7f014678c5eedc10d23f7427e08b55b054db3386ad324a527` | `ca1e61e092d53ba7f014678c5eedc10d23f7427e08b55b054db3386ad324a527` | **MATCH (100%)** |
| 10 | `server/tests/unit/auth-middleware.test.js` | `be5d8cf9207a6d8f0bd327b0c2d237d67cee424503b03be54a6008fa826b2bcf` | `be5d8cf9207a6d8f0bd327b0c2d237d67cee424503b03be54a6008fa826b2bcf` | **MATCH (100%)** |
| 11 | `server/tests/integration/auth-refresh-rotation.test.js` | `05b9e3aee603f0bc4ab1f9bbfa32443d97b3b1f81ae2ad32f37aa1bd963cd8a1` | `05b9e3aee603f0bc4ab1f9bbfa32443d97b3b1f81ae2ad32f37aa1bd963cd8a1` | **MATCH (100%)** |
| 12 | `server/tests/integration/auth-registration-login.test.js` | `d6f254f7e2f189d8465e9c54e71de294e7d870d1e1ae6fe29fd3432a9c80532b` | `d6f254f7e2f189d8465e9c54e71de294e7d870d1e1ae6fe29fd3432a9c80532b` | **MATCH (100%)** |
| 13 | `server/tests/integration/auth-tokens-api.test.js` | `31efaaa21b9c5851b7ab55637831a69a15014e054633bc80f4ea16620ec76d23` | `31efaaa21b9c5851b7ab55637831a69a15014e054633bc80f4ea16620ec76d23` | **MATCH (100%)** |
| 14 | `server/tests/integration/owner-provisioning.test.js` | `4cb16354ae3b01fd87034e65987de5966cd69c9a29009beb0e6e2510120b0528` | `4cb16354ae3b01fd87034e65987de5966cd69c9a29009beb0e6e2510120b0528` | **MATCH (100%)** |
| 15 | `server/tests/integration/password-management.test.js` | `0bd938c5bc8191e802b24f8159f772f72615d2dc732dcd8f0cc0e74249ff6c3e` | `0bd938c5bc8191e802b24f8159f772f72615d2dc732dcd8f0cc0e74249ff6c3e` | **MATCH (100%)** |

> **Xác nhận:** Toàn bộ **15/15 tệp (100%)** tại commit bàn giao `305326d` khớp chính xác tuyệt đối mã băm SHA-256 trong `P05-manifest.sha256`.

---

## 2. Đánh giá Chi tiết Từng Tiêu chí và Đầu việc P05

| STT | Tiêu chí / Đầu việc theo kế hoạch | Đầu ra thực tế | Đánh giá | Chi tiết kiểm chứng độc lập |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **Refresh Token Rotation nguyên tử (`POST /api/v1/auth/refresh`)**:<br>- Đọc cookie `refresh_token`.<br>- Quay vòng token trong MongoDB transaction.<br>- Đánh dấu token cũ đã dùng (`usedAt: now`) và liên kết `replacedByTokenId`.<br>- Sinh refresh token mới và access token mới. | `server/src/controllers/auth.controller.js`<br>`server/src/repositories/refresh-token.repository.js`<br>`server/tests/integration/auth-refresh-rotation.test.js` | **ĐẠT** | - Gọi `POST /api/v1/auth/refresh` với cookie hợp lệ trả về access token mới và đặt cookie `refresh_token` mới.<br>- DB cập nhật token cũ với `usedAt != null` và `replacedByTokenId` trỏ đúng vào token mới.<br>- Thao tác cập nhật `markUsedAtomic` bằng `findOneAndUpdate({ _id, usedAt: null })` đảm bảo chống xung đột ghi đồng thời. |
| 2 | **Phát hiện Token Reuse (Phát lại token đã dùng)**:<br>- Nếu refresh token gửi lên đã có `usedAt != null`, kích hoạt cơ chế tự vệ thu hồi toàn bộ session (`REUSE_DETECTED`).<br>- Thu hồi tất cả refresh token của session.<br>- Xóa cookie và trả về 401 `SESSION_REVOKED`. | `server/src/controllers/auth.controller.js`<br>`server/tests/integration/auth-refresh-rotation.test.js` | **ĐẠT** | - Cố tình gửi lại refresh token cũ đã qua rotation: server lập tức trả mã lỗi 401 `SESSION_REVOKED`.<br>- Kiểm tra DB: bản ghi `AuthSession` bị đánh dấu `revokedAt != null` với `revokedReason = 'REUSE_DETECTED'`, toàn bộ refresh token thuộc session bị thu hồi (`revokedAt != null`).<br>- Token mới nhất vừa sinh trước đó cũng lập tức bị vô hiệu hóa, bảo vệ tuyệt đối tài khoản bị tấn công trộm token. |
| 3 | **Đăng xuất hiện tại (`POST /api/v1/auth/logout`) và Đăng xuất tất cả (`POST /api/v1/auth/logout-all`)**:<br>- `logout`: Đọc cookie, thu hồi `AuthSession` (`LOGOUT`), thu hồi các token thuộc session, xóa cookie, trả 204 No Content idempotent.<br>- `logout-all`: Yêu cầu Bearer auth, tăng `tokenVersion` trên User, thu hồi toàn bộ sessions và refresh tokens của user, xóa cookie, trả 204. | `server/src/controllers/auth.controller.js`<br>`server/src/routes/auth.routes.js`<br>`server/tests/integration/auth-refresh-rotation.test.js` | **ĐẠT** | - Sau khi gọi `POST /api/v1/auth/logout`, access token cũ gửi tới `/users/me` lập tức bị từ chối 401 `SESSION_REVOKED`. Response trả header xóa cookie và status 204.<br>- Gọi lại logout khi cookie đã xóa vẫn trả 204 (idempotent).<br>- Tạo 2 phiên trên 2 thiết bị khác nhau; gọi `POST /api/v1/auth/logout-all` từ thiết bị 1: cả hai token trên thiết bị 1 và 2 đều bị từ chối 401 `SESSION_REVOKED`, `tokenVersion` trong DB tăng từ 0 lên 1. |
| 4 | **Giới hạn hạn phiên tuyệt đối 7 ngày (`SESSION_MAX_AGE_DAYS`)**:<br>- Refresh token mới không kéo dài hạn vượt quá `session.absoluteExpiresAt`.<br>- Access JWT cuối phiên được giới hạn tự động `exp <= session.absoluteExpiresAt`. | `server/src/services/jwt.service.js`<br>`server/src/controllers/auth.controller.js`<br>`server/tests/integration/auth-refresh-rotation.test.js` | **ĐẠT** | - Tạo phiên còn đúng 120 giây là hết hạn 7 ngày; gọi `POST /api/v1/auth/refresh`: access token trả về có `expiresInSeconds <= 120s` (thay vì 600s mặc định).<br>- Bản ghi `RefreshToken` mới tạo trong DB có `expiresAt` bị khóa chặt đúng bằng `session.absoluteExpiresAt`. |
| 5 | **Cấu hình Cookie an toàn & Helper thống nhất**:<br>- `httpOnly: true`, `secure: production`, `sameSite: 'lax'`, `path: /api/v1/auth`, host-only (không đặt Domain), `maxAge` tính theo thời gian còn lại của session.<br>- Xóa cookie đúng thuộc tính. | `server/src/utils/cookie.js`<br>`server/tests/integration/auth-refresh-rotation.test.js` | **ĐẠT** | - Module `server/src/utils/cookie.js` tập trung hóa toàn bộ logic cookie.<br>- Mọi response `Set-Cookie` cho `refresh_token` đều có đầy đủ `HttpOnly`, `Path=/api/v1/auth`, `SameSite=Lax`.<br>- `clearRefreshCookie` xóa đúng tên và thuộc tính, đặt `Max-Age=0` và thời điểm hết hạn về quá khứ. |
| 6 | **Auth Request Guard toàn diện (`csrfGuard`)**:<br>- Yêu cầu `X-CSRF-Guard: 1`.<br>- Yêu cầu `Origin` nằm trong allowlist (`env.CLIENT_ORIGIN`, localhost trong dev/test).<br>- Từ chối Origin lạ, `null`, hoặc thiếu.<br>- Yêu cầu `Content-Type: application/json` khi có body.<br>- CORS credentials không wildcard. | `server/src/middlewares/csrf-guard.js`<br>`server/src/config/cors.js`<br>`server/tests/unit/auth-request-guard.test.js`<br>`server/tests/integration/auth-refresh-rotation.test.js` | **ĐẠT** | - Thiếu header `X-CSRF-Guard` hoặc truyền `'0'` bị từ chối 403 `CSRF_GUARD_TRIGGERED`.<br>- Thiếu header `Origin` hoặc `Origin: 'null'` bị từ chối 403 `CSRF_GUARD_TRIGGERED`.<br>- Origin lạ `http://attacker-site.com` bị từ chối 403 `CSRF_GUARD_TRIGGERED`.<br>- Gửi body với content-type `text/plain` hoặc `application/x-www-form-urlencoded` bị từ chối 403 `CSRF_GUARD_TRIGGERED`. |
| 7 | **Chuẩn hóa mã lỗi Auth**:<br>- Phân biệt rõ ràng lỗi hết hạn token, thu hồi phiên, không có quyền, khóa tài khoản, CSRF guard. | `server/src/errors/error-codes.js`<br>`server/src/middlewares/auth.js`<br>`server/src/controllers/auth.controller.js` | **ĐẠT** | - `ACCESS_TOKEN_EXPIRED` (401 khi JWT hết 10m).<br>- `SESSION_REVOKED` (401 khi phiên bị thu hồi/hết hạn/reuse/đổi mật khẩu/logout).<br>- `CSRF_GUARD_TRIGGERED` (403 khi vi phạm Origin hoặc header guard).<br>- `ACCOUNT_LOCKED` (403 khi admin khóa tài khoản).<br>- `ACCOUNT_NOT_VERIFIED` (403) và `ACCOUNT_NOT_ACTIVATED` (403). |
| 8 | **Fixture HTML & Browser Smoke Test độc lập**:<br>- Tệp HTML smoke test tối thiểu kiểm chứng cookie HttpOnly không bị JS đọc, kiểm tra CORS credentials và CSRF. | `server/fixtures/auth-cookie-test.html` | **ĐẠT** | - Tệp HTML fixture độc lập, chạy trực tiếp trong browser, cung cấp 5 nút bấm kiểm thử cookie và CSRF.<br>- Không cài đặt hoặc chứa bất kỳ thành phần React / frontend sản phẩm nào. |
| 9 | **Ranh giới kiến trúc & Cổng Frontend**:<br>- Cổng `BE_READY` đóng an toàn (`CLOSED`), không có React hay frontend sản phẩm. | Codebase & `docs/planning/phase-status.json` | **ĐẠT** | - `npm run check:phase` xác nhận trạng thái cổng an toàn 100%. |

---

## 3. Các Kiểm chứng Độc lập Đã Chạy

1. **Kiểm tra trạng thái MongoDB Replica Set (`npm run db:ensure-rs`):**
   - Lệnh: `npm run db:ensure-rs`
   - Kết quả: **PASS (`MongoDB Replica Set is active on port 27018 (rs0).`)**.
2. **Kiểm tra đồng bộ Index Mongoose (`npm run db:indexes`):**
   - Lệnh: `npm run db:indexes`
   - Kết quả: **PASS (17 models index synchronized thành công)**.
3. **Kiểm tra Seed Admin (`npm run db:seed`):**
   - Lệnh: `npm run db:seed`
   - Kết quả: **PASS (Admin sẵn sàng hoặc được khởi tạo idempotent)**.
4. **Kiểm tra linter và cú pháp JavaScript (`npm run lint`):**
   - Lệnh: `npm run lint`
   - Kết quả: **PASS (`Syntax check passed for 82 backend files.`)**.
5. **Kiểm tra ranh giới Phase & Cổng Frontend (`npm run check:phase`):**
   - Lệnh: `npm run check:phase`
   - Kết quả: **PASS (Cấu trúc docs/planning/phase-status.json hợp lệ, ranh giới frontend giữ an toàn, cổng BE_READY đóng)**.
6. **Kiểm thử tự động toàn diện (`npm test`):**
   - Lệnh: `node --test --test-concurrency=1 tests/**/*.test.js`
   - Kết quả: **PASS 108/108 tests (20 test files, 13 test suites), 0 failures, 0 skipped, thời gian chạy ~12.8s**:
     - `Auth Refresh Rotation, Session Revocation & Cookie Security (Integration)`: 6/6 PASS.
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
     - `Auth Request Guard Middleware (Unit)`: 9/9 PASS.
     - `AuthToken Service & Single-Use Tokens (Unit)`: 5/5 PASS.
     - `Email Outbox & Templates (Unit)`: 7/7 PASS.
     - `Environment Configuration Validation (Unit)`: 4/4 PASS.
     - `JWT Access Token Service (Unit)`: 5/5 PASS.
     - `Logger Sensitive Data Masking (Unit)`: 3/3 PASS.
     - `Mongoose Models & Schema Definitions (Unit)`: 6/6 PASS.
7. **Đối chiếu Bảng mã băm Manifest SHA-256 từ mốc commit bàn giao `305326d`:**
   - Kết quả: **15/15 tệp (100%) khớp chính xác tuyệt đối**.

---

## 4. Ghi nhận và Khuyến nghị Kỹ thuật

### 4.1. Ghi nhận về thư mục làm việc Git
- Tại commit mốc bàn giao `305326d7e0b0bc4446a23742ffb6d4bff01936b3`, toàn bộ 15 tệp bàn giao của Phase P05 khớp chính xác tuyệt đối mã băm SHA-256.
- Tại thời điểm bắt đầu phiên review, có biến động nhỏ về ký tự xuống dòng (LF) ở cuối 4 tệp do trình biên tập (IDE) mở tệp. Reviewer đã thực hiện đúng chỉ thị nghiêm ngặt của người dùng: *"Không sửa code/tài liệu sản phẩm trong lượt review này; chỉ ghi báo cáo review và trạng thái"*, giữ nguyên vẹn toàn bộ mã nguồn sản phẩm. Tất cả 108 bài kiểm thử tự động và 82 tệp cú pháp đều vượt qua hoàn hảo không có bất kỳ lỗi logic nào.

### 4.2. Quyết định kỹ thuật cần duy trì khi bước vào Phase P06
- **Quản trị tài khoản & Danh mục môn (P06):**
  - Xây dựng API quản trị cho Admin (`GET/PATCH /api/v1/admin/users`, khóa/mở khóa tài khoản, ghi `ActionLog`).
  - Khi khóa tài khoản Owner, tăng `tokenVersion` và thu hồi mọi `AuthSession`, nhưng không hủy các đơn đặt sân đã xác nhận thanh toán (`CONFIRMED/PAID`) hoặc bỏ qua các callback tiền VNPay đang tới.
  - CRUD danh mục môn thể thao (`Sport`): Chuẩn hóa tên (trim, case-insensitive unique), chỉ hỗ trợ xóa mềm (`isActive = false`), không xóa cứng dữ liệu đã được tham chiếu bởi các sân con.

---

## 5. Kết luận và Quyết định Nghiệm thu

- **Quyết định nghiệm thu:** Chính thức công nhận Phase P05 đạt trạng thái **`ACCEPTED`**.
- **Căn cứ nghiệm thu:**
  - Hoàn thành đầy đủ 6 nhóm yêu cầu cốt lõi của Phase P05 theo `docs/planning/development-plan.md` và `docs/features.md` AUTH-06 (tiêu chí 57–64).
  - Bộ kiểm thử tự động đạt **108/108 tests PASS (100%)**, 0 lỗi cú pháp trên 82 tệp backend.
  - Toàn bộ 15 tệp tại commit mốc bàn giao `305326d` khớp 100% mã băm SHA-256 trong `docs/phase-reports/P05-manifest.sha256`.
  - Cổng frontend `BE_READY` được bảo vệ đóng an toàn (`CLOSED`).
- **Phiên bản nghiệm thu:** `305326d7e0b0bc4446a23742ffb6d4bff01936b3 (docs/phase-reports/P05-manifest.sha256)`.
- **Người nghiệm thu:** Reviewer độc lập (Ủy quyền bởi người dùng).
- **Ngày nghiệm thu:** 29/10/2026.

---

## 6. Ranh giới và Hướng dẫn cho Phase Tiếp theo (P06)

1. **Cập nhật `docs/planning/phase-status.json`:**
   - Trạng thái `P05`: `ACCEPTED`.
   - `review`: `"docs/phase-reports/P05-review.md"`.
   - `accepted_by`: `"Independent Reviewer (Ủy quyền bởi người dùng)"`.
   - `accepted_on`: `"2026-10-29"`.
   - `accepted_revision`: `"305326d7e0b0bc4446a23742ffb6d4bff01936b3 (docs/phase-reports/P05-manifest.sha256)"`.
   - `active_phase`: `null` (Dừng lại, sẵn sàng chờ người dùng giao việc cho P06).
   - `next_candidate`: `"P06"`.
2. **Phase tiếp theo (P06):** Quản trị tài khoản và danh mục môn (`GET/PATCH /api/v1/admin/users`, khóa/mở khóa tài khoản, ghi `ActionLog`, CRUD mềm danh mục `Sport`).
3. **Ranh giới:** Cổng `BE_READY` tiếp tục giữ trạng thái `CLOSED`. Tuyệt đối không cài đặt hoặc viết mã React frontend trước khi hoàn thành Phase P14.

