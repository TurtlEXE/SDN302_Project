# Báo cáo Review và Nghiệm thu Độc lập — Phase P03

> **Trạng thái kết luận:** `ACCEPTED`  
> **Người thực hiện review & thẩm quyền:** Reviewer độc lập (Được người dùng ủy quyền trực tiếp theo yêu cầu)  
> **Ngày review ban đầu:** 29/10/2026 (`NEEDS_CHANGES`)  
> **Ngày tái review & nghiệm thu:** 29/10/2026 (`ACCEPTED`)  
> **Tài liệu căn cứ:** `AGENTS.md`, `docs/features.md`, `docs/architecture.md`, `docs/database.md`, `docs/api.openapi.yaml`, `docs/planning/development-plan.md`, `docs/guides/ai-workflow.md`, `docs/phase-reports/P03.md`, `docs/planning/phase-status.json`.

---

## 1. Phạm vi và Phiên bản được Review

### 1.1. Phạm vi bàn giao của Phase P03 (24 tệp)
Phase P03 thiết lập hạ tầng gửi email qua Nodemailer, mô hình hàng đợi `EmailOutbox` và worker xử lý nền có atomic lease lock chống xử lý đồng thời, cơ chế exponential backoff retry tối đa 3 lần, quản lý và tiêu thụ nguyên tử token một lần `AuthToken` (SHA-256, 15 phút cho verify/reset, 24 giờ cho activate owner), bộ 3 mẫu email HTML + Plain text responsive, endpoint gửi lại email có rate limit cooldown 60 giây, bảo đảm GET không tiêu thụ token và tách biệt hoàn toàn lỗi gửi email khỏi giao dịch dữ liệu nghiệp vụ:

- **Hạ tầng Email & Worker (`server/src/` - 6 tệp):**
  - `server/package.json` & `package-lock.json`: Cài đặt thư viện `nodemailer`.
  - `server/src/config/email.js`: Cấu hình module email SMTP và chế độ in-memory JSON test mode.
  - `server/src/integrations/mail.client.js`: Lớp bao bọc Nodemailer, hỗ trợ mock failure và capture email trong test harness.
  - `server/src/models/email-outbox.model.js`: Model `EmailOutbox` bổ sung `lockedUntil` và compound index `{ status: 1, nextRetryAt: 1, lockedUntil: 1 }`.
  - `server/src/repositories/email-outbox.repository.js`: CRUD outbox, thao tác atomic lease claim bằng `findOneAndUpdate`.
  - `server/src/jobs/send-emails.job.js`: Background runner định kỳ polling outbox.
  - `server/src/worker.js`: Tiến trình worker xử lý nền, điều phối graceful shutdown.
- **Hạ tầng Token dùng một lần & Email Service (`server/src/` - 3 tệp):**
  - `server/src/repositories/auth-token.repository.js`: Atomic consume bằng `findOneAndUpdate` (`usedAt: null`, `expiresAt > now`), vô hiệu token cũ cùng loại khi cấp lại.
  - `server/src/services/auth-token.service.js`: Sinh token ngẫu nhiên 32 bytes cryptographically secure (64-hex), hash SHA-256, kiểm tra mục đích, hạn dùng và atomic consume.
  - `server/src/services/email/email.service.js`: Transactional queuing, template rendering, exponential backoff (1m, 5m, 15m), kiểm tra token hết hạn trước khi gửi.
- **Mẫu Email Responsive (`server/src/templates/emails/` - 4 tệp):**
  - `verify-email.template.js`: Mẫu xác thực tài khoản khách hàng (15 phút).
  - `activate-owner.template.js`: Mẫu kích hoạt chủ sân do admin cấp (24 giờ).
  - `reset-password.template.js`: Mẫu đặt lại mật khẩu bảo mật (15 phút).
  - `index.js`: Barrel export và helper `renderEmail()`.
- **API Endpoints & Routing (`server/src/` - 5 tệp):**
  - `server/src/errors/error-codes.js`: Bổ sung mã lỗi `TOKEN_INVALID`, `TOKEN_EXPIRED`, `TOKEN_ALREADY_USED`.
  - `server/src/middlewares/rate-limit.js`: Bổ sung `emailCooldownMiddleware` (60s cooldown per email) và `clearEmailCooldowns()`.
  - `server/src/controllers/auth.controller.js`: Xử lý `resendVerification`, `inspectToken`, `verifyEmail`.
  - `server/src/routes/auth.routes.js`: Khai báo tuyến đường `/resend-verification`, `/verify-token`, GET & POST `/verify-email`.
  - `server/src/routes/index.js` & `server/src/app.js`: Tích hợp router `/api/v1/auth` và export named `{ app }`.
- **Bộ Kiểm thử Tự động (`server/tests/` - 4 tệp):**
  - `server/tests/unit/auth-token.test.js`: 5 tests cho AuthToken service & repository.
  - `server/tests/unit/email-outbox.test.js`: 7 tests cho EmailOutbox, templates và retry backoff.
  - `server/tests/integration/email-outbox-worker.test.js`: 3 tests cho worker concurrency lease & retry handling.
  - `server/tests/integration/auth-tokens-api.test.js`: 6 tests cho endpoints, rate limit 60s, link safety qua GET và transactional outbox isolation.
- **Chứng từ Bàn giao (2 tệp):**
  - `docs/phase-reports/P03.md`: Báo cáo triển khai của agent.
  - `docs/phase-reports/P03-manifest.sha256`: Bảng mã băm xác thực phiên bản.

---

### 1.2. Kiểm tra Phiên bản Bàn giao (Git & SHA-256 Manifest - Tái kiểm tra Lần 2)

- **Trạng thái Git thực tế:** **HOÀN TOÀN SẠCH SẼ (WORKING TREE CLEAN)**  
  Lệnh `git status` trả về: `On branch main, nothing to commit, working tree clean`.
- **Mốc commit bàn giao và khắc phục:**
  - `a2e8893`: `feat(p03): implement email outbox, worker with atomic lease, single-use auth tokens and rate-limited resend`
  - `103dfca`: `fix(p03): normalize file line endings, resolve review findings and set ready for re-review`
  - `51cb174`: `docs(p03): record re-review commit hash in phase report`
- **Kết quả kiểm tra mã băm SHA-256 nhị phân thực tế trên đĩa so với `P03-manifest.sha256`:**

| STT | Đường dẫn tệp | Hash mong đợi trong Manifest | Hash thực tế trên đĩa | Kết quả so khớp |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `server/package.json` | `302da0a476fa104292b6ea452284c34f5b13c5d3b97bd8b8590ef5951a3c9e99` | `302da0a476fa104292b6ea452284c34f5b13c5d3b97bd8b8590ef5951a3c9e99` | **MATCH (100%)** |
| 2 | `server/src/app.js` | `36c9e10b5a1cbbe6d2db6a356fe3c6945cf5a9580552cbda1591f38ec99aab37` | `36c9e10b5a1cbbe6d2db6a356fe3c6945cf5a9580552cbda1591f38ec99aab37` | **MATCH (100%)** |
| 3 | `server/src/config/email.js` | `1ef1f2260789ffc401c4dfe7bd753f5bc86700bef5b348acb05b7eb404c93af7` | `1ef1f2260789ffc401c4dfe7bd753f5bc86700bef5b348acb05b7eb404c93af7` | **MATCH (100%)** |
| 4 | `server/src/controllers/auth.controller.js` | `e0dfba1fe6a77b5b72759de21380ac78475abe89be89b4b3a197c3bab1ab2573` | `e0dfba1fe6a77b5b72759de21380ac78475abe89be89b4b3a197c3bab1ab2573` | **MATCH (100%)** |
| 5 | `server/src/errors/error-codes.js` | `2a85bb017ddd4b9d85eefc083e85818d6cdd92e7d78f57f3d6b128d3b2a2b5bf` | `2a85bb017ddd4b9d85eefc083e85818d6cdd92e7d78f57f3d6b128d3b2a2b5bf` | **MATCH (100%)** |
| 6 | `server/src/integrations/mail.client.js` | `e4f791e976cfb4d6363d883aba8fe3fa83d15369f55856f80702ec53c6b5472b` | `e4f791e976cfb4d6363d883aba8fe3fa83d15369f55856f80702ec53c6b5472b` | **MATCH (100%)** |
| 7 | `server/src/jobs/send-emails.job.js` | `c932955f12df873a5d56eece1bf1dbe05c072a6450a60c54ca657c480c7538ab` | `c932955f12df873a5d56eece1bf1dbe05c072a6450a60c54ca657c480c7538ab` | **MATCH (100%)** |
| 8 | `server/src/middlewares/rate-limit.js` | `bbd9a9fbce5674dd59e3b47327b406219aabaf7aecf31235d39a519b699d1ff3` | `bbd9a9fbce5674dd59e3b47327b406219aabaf7aecf31235d39a519b699d1ff3` | **MATCH (100%)** |
| 9 | `server/src/models/email-outbox.model.js` | `35d7849690f3f8b749121b720006c29f783af57eea67c3aba6ee1e78b21afd9f` | `35d7849690f3f8b749121b720006c29f783af57eea67c3aba6ee1e78b21afd9f` | **MATCH (100%)** |
| 10 | `server/src/repositories/auth-token.repository.js` | `be4b8d62745d91b75bdac49c0ad16f4b5aa6852ca10b175479daa5c5bb3683a7` | `be4b8d62745d91b75bdac49c0ad16f4b5aa6852ca10b175479daa5c5bb3683a7` | **MATCH (100%)** |
| 11 | `server/src/repositories/email-outbox.repository.js` | `c400625d19aaa864519ec10525f27bac6e8fe885c827861db87dd80867f72b19` | `c400625d19aaa864519ec10525f27bac6e8fe885c827861db87dd80867f72b19` | **MATCH (100%)** |
| 12 | `server/src/routes/auth.routes.js` | `4d28e535d19c201cdada642f7b22e2942f7aea6e49169736cbaa59e4cb136cb4` | `4d28e535d19c201cdada642f7b22e2942f7aea6e49169736cbaa59e4cb136cb4` | **MATCH (100%)** |
| 13 | `server/src/routes/index.js` | `1b9f659d9685c923ec4f1a660fbedd3348a70fa312dbb8a552691a2438e7ab84` | `1b9f659d9685c923ec4f1a660fbedd3348a70fa312dbb8a552691a2438e7ab84` | **MATCH (100%)** |
| 14 | `server/src/services/auth-token.service.js` | `34bbcd2994245e2f21a3f2d5c5d3ea1ff7066ebedd3a558088adb679da43e531` | `34bbcd2994245e2f21a3f2d5c5d3ea1ff7066ebedd3a558088adb679da43e531` | **MATCH (100%)** |
| 15 | `server/src/services/email/email.service.js` | `3d14eb5cc37cb790d0aa3c0e03757593bd060dd8475e4fadab7cd1d17d37d4b2` | `3d14eb5cc37cb790d0aa3c0e03757593bd060dd8475e4fadab7cd1d17d37d4b2` | **MATCH (100%)** |
| 16 | `server/src/templates/emails/activate-owner.template.js` | `bc6546df1976a90321e181fff0444c8675faa10dddf48cc3430cf7d81b12776b` | `bc6546df1976a90321e181fff0444c8675faa10dddf48cc3430cf7d81b12776b` | **MATCH (100%)** |
| 17 | `server/src/templates/emails/index.js` | `8afd6d1022365daf1196980644df352353e22b4f52f9ead377081ee4ed54c0eb` | `8afd6d1022365daf1196980644df352353e22b4f52f9ead377081ee4ed54c0eb` | **MATCH (100%)** |
| 18 | `server/src/templates/emails/reset-password.template.js` | `704e522634f8cb923ffcdff183c9b812af374d40db5bad74db35b6465c0f1b2e` | `704e522634f8cb923ffcdff183c9b812af374d40db5bad74db35b6465c0f1b2e` | **MATCH (100%)** |
| 19 | `server/src/templates/emails/verify-email.template.js` | `77f2396729f6e99b7795de405b13681f0d23477b26668badfd27b3ee56a6d259` | `77f2396729f6e99b7795de405b13681f0d23477b26668badfd27b3ee56a6d259` | **MATCH (100%)** |
| 20 | `server/src/worker.js` | `2990487a3286195fd818a576f8e38710cd5a4226a20a2474cb0daaf3fc5e0d51` | `2990487a3286195fd818a576f8e38710cd5a4226a20a2474cb0daaf3fc5e0d51` | **MATCH (100%)** |
| 21 | `server/tests/integration/auth-tokens-api.test.js` | `e3cb1f9188a927081c96a6ac97c90e8a88781fff0e0072a7f30e17e59d98a7a8` | `e3cb1f9188a927081c96a6ac97c90e8a88781fff0e0072a7f30e17e59d98a7a8` | **MATCH (100%)** |
| 22 | `server/tests/integration/email-outbox-worker.test.js` | `e4d0f7760a355ba39529bdb8f6dfb7c3d1732b7b5449a2bddd0e9e872771852d` | `e4d0f7760a355ba39529bdb8f6dfb7c3d1732b7b5449a2bddd0e9e872771852d` | **MATCH (100%)** |
| 23 | `server/tests/unit/auth-token.test.js` | `01f0ab99255cbfac45d9c0f6cf76ee9c76f4e37cc619321aed501f9d27c9040e` | `01f0ab99255cbfac45d9c0f6cf76ee9c76f4e37cc619321aed501f9d27c9040e` | **MATCH (100%)** |
| 24 | `server/tests/unit/email-outbox.test.js` | `8aa48c8dc3ff8a324595799e5236345c4486153079da5cec13f05b3ac6cffaf8` | `8aa48c8dc3ff8a324595799e5236345c4486153079da5cec13f05b3ac6cffaf8` | **MATCH (100%)** |

> **Xác nhận:** Toàn bộ **24/24 tệp (100%)** mã nguồn và kiểm thử trên đĩa đã khớp chính xác với mã băm trong `P03-manifest.sha256`.

---

## 2. Lịch sử Review và Xử lý Lỗi

### Lần 1 (29/10/2026): `NEEDS_CHANGES`
- **BUG-P03-01:** Thư mục làm việc Git bẩn (`Changes not staged for commit` trên 8 tệp mã nguồn).
- **BUG-P03-02:** Lệch mã băm SHA-256 thực tế trên đĩa ở 8/24 tệp do ký tự xuống dòng kép ở cuối tệp.
- **IMP-P03-03:** Mốc commit bàn giao trong báo cáo chưa đồng nhất với HEAD Git.

### Lần 2 (29/10/2026 — Sau sửa): Đã giải quyết triệt để 100%
- **Khắc phục BUG-P03-01 & BUG-P03-02:** Đã chuẩn hóa ký tự kết thúc của toàn bộ 8 tệp về đúng 1 ký tự LF (`\n`). Kết quả đối chiếu mã băm nhị phân SHA-256 từ đĩa đạt **24/24 tệp khớp 100%**.
- **Khắc phục IMP-P03-03:** Đã commit toàn bộ thay đổi lên nhánh `main` với các commit `103dfca` và `51cb174`. Working tree hoàn toàn sạch sẽ (`clean`).

---

## 3. Đánh giá Chi tiết Từng Tiêu chí và Đầu việc P03

| STT | Tiêu chí / Đầu việc P03 theo kế hoạch | Đầu ra thực tế | Đánh giá | Chi tiết kiểm chứng độc lập |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **Hạ tầng email client, EmailOutbox, worker có lease & retry:**<br>- Nodemailer client bọc cấu hình SMTP / in-memory test.<br>- Worker atomic lease chống nhận trùng.<br>- Retry tối đa 3 lần với exponential backoff (1m, 5m, 15m), chuyển FAILED. | `server/src/integrations/mail.client.js`<br>`server/src/models/email-outbox.model.js`<br>`server/src/repositories/email-outbox.repository.js`<br>`server/src/services/email/email.service.js`<br>`server/src/jobs/send-emails.job.js`<br>`server/src/worker.js` | **ĐẠT** | - `mail.client.js` chuyển đổi mượt mà giữa SMTP và JSON in-memory test transport.<br>- Thao tác `claimPendingMessage` dùng `findOneAndUpdate` trên `{ status: 'PENDING', nextRetryAt: { $lte: now }, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] }` với `$set: { lockedUntil }` đảm bảo phân phối độc quyền công việc giữa nhiều worker song song.<br>- Đã kiểm chứng 2 worker song song chia sẻ chính xác 8/8 email không trùng lặp.<br>- Retry 3 lần với backoff chuẩn xác, đánh dấu FAILED khi đạt giới hạn. |
| 2 | **Quản lý AuthToken dùng 1 lần (Hash, Hạn dùng, Mục đích, Tiêu thụ nguyên tử):**<br>- Chuỗi ngẫu nhiên mật mã 64-hex, chỉ lưu SHA-256 hash trên DB.<br>- Thời hạn 15m (verify/reset) và 24h (activate owner).<br>- Cấm dùng sai mục đích hoặc hết hạn.<br>- Cấp lại vô hiệu hóa token cũ chưa dùng.<br>- Tiêu thụ nguyên tử duy nhất 1 lần. | `server/src/repositories/auth-token.repository.js`<br>`server/src/services/auth-token.service.js`<br>`server/tests/unit/auth-token.test.js` | **ĐẠT** | - Sinh ngẫu nhiên 32 bytes (`crypto.randomBytes(32).toString('hex')`), băm SHA-256 đối chiếu.<br>- Hàm `consumeToken` cập nhật `usedAt: now` nguyên tử bằng `findOneAndUpdate` có điều kiện `usedAt: null` và `expiresAt > now`. Tiêu thụ lần 2 trả lỗi `TOKEN_ALREADY_USED`.<br>- Cấp token mới tự động gọi `invalidateActiveTokens` vô hiệu các token cũ cùng loại của user. |
| 3 | **Mẫu email HTML/Text responsive & Endpoint gửi lại có Rate Limit:**<br>- 3 mẫu email tiếng Việt chuẩn responsive (`verify-email`, `activate-owner`, `reset-password`).<br>- Endpoint resend có cooldown 60s per email. | `server/src/templates/emails/`<br>`server/src/middlewares/rate-limit.js`<br>`server/src/controllers/auth.controller.js`<br>`server/src/routes/auth.routes.js` | **ĐẠT** | - Cả 3 mẫu email render đầy đủ HTML có style nội dòng và plain-text fallback, chứa cảnh báo bảo mật và thời hạn tương ứng.<br>- `emailCooldownMiddleware` chặn yêu cầu gửi lại trong vòng 60s, trả HTTP 429 kèm số giây còn lại.<br>- `POST /api/v1/auth/resend-verification` phản hồi generic 200 bảo vệ danh tính khi email không tồn tại. |
| 4 | **Bảo vệ Token không bị tiêu thụ bởi GET (Xác nhận bằng POST):**<br>- Mở link qua GET không đổi `usedAt`.<br>- Xác nhận kích hoạt bằng POST. | `server/src/controllers/auth.controller.js`<br>`server/src/routes/auth.routes.js`<br>`server/tests/integration/auth-tokens-api.test.js` | **ĐẠT** | - `GET /api/v1/auth/verify-token` và `GET /api/v1/auth/verify-email` gọi `inspectToken()`, chỉ kiểm tra tính hợp lệ và trả về `{ valid: true }`, tuyệt đối không cập nhật `usedAt`.<br>- Chỉ khi gọi `POST /api/v1/auth/verify-email` thì token mới được tiêu thụ và cập nhật `emailVerifiedAt` cho User. |
| 5 | **Tách rời lỗi gửi email khỏi giao dịch dữ liệu (Transactional Outbox):**<br>- Sự cố SMTP không làm rollback tài khoản hay token.<br>- Email nằm lại outbox chờ retry. | `server/src/controllers/auth.controller.js`<br>`server/src/services/email/email.service.js`<br>`server/tests/integration/auth-tokens-api.test.js` | **ĐẠT** | - `generateToken` và `queueEmail` được thực thi trong cùng một MongoDB transaction ACID (`withTransaction`).<br>- Khi mô phỏng SMTP offline hoàn toàn, request resend verification vẫn trả 200 OK thành công, token và outbox record vẫn được commit bền vững vào DB. |
| 6 | **Từ chối gửi liên kết đã hết hạn (Link Expiration Safety):**<br>- Worker từ chối chuyển phát nếu token đã hết hạn trước khi gửi. | `server/src/services/email/email.service.js`<br>`server/tests/unit/email-outbox.test.js` | **ĐẠT** | - Trong `processMessage()`, kiểm tra `templateData.expiresAt <= new Date()`. Nếu đã quá hạn, đánh dấu terminal FAILED ngay lập tức và từ chối gửi qua SMTP. |
| 7 | **Tính toàn vẹn Chứng từ & Trạng thái Git:**<br>- Bảng mã băm SHA-256 khớp 100% trên đĩa.<br>- Thư mục làm việc Git sạch sẽ. | `docs/phase-reports/P03-manifest.sha256`<br>Git working tree | **ĐẠT** | - 24/24 tệp khớp 100% mã băm trên đĩa.<br>- Working tree hoàn toàn sạch sẽ (`clean`). |

---

## 4. Các Kiểm chứng Độc lập Đã Chạy

1. **Kiểm tra trạng thái MongoDB Replica Set (`npm run db:ensure-rs`):**
   - Lệnh: `npm run db:ensure-rs`
   - Kết quả: **PASS (`MongoDB Replica Set is active on port 27018 (rs0).`)**.
2. **Kiểm tra linter và cú pháp JavaScript (`npm run lint`):**
   - Lệnh: `npm run lint`
   - Kết quả: **PASS (`Syntax check passed for 64 backend files.`)**.
3. **Kiểm tra trạng thái Phase và Ranh giới Frontend (`npm run check:phase`):**
   - Lệnh: `npm run check:phase`
   - Kết quả: **PASS (Cấu trúc hợp lệ, ranh giới frontend giữ an toàn, cổng BE_READY đóng)**.
4. **Kiểm tra đồng bộ Index Mongoose (`npm run db:indexes`):**
   - Lệnh: `npm run db:indexes`
   - Kết quả: **PASS (Đồng bộ thành công toàn bộ indexes cho 17 models, `EmailOutbox` có đủ 3 indexes gồm compound `{ status, nextRetryAt, lockedUntil }`)**.
5. **Kiểm thử tự động toàn diện (`npm test`):**
   - Lệnh: `npm test`
   - Kết quả: **PASS 60/60 tests (13 test suites), thời gian chạy ~950ms, 0 failures**:
     - `Auth Tokens & Resend Verification API (Integration)`: 6/6 PASS.
     - `Phase Status & Governance Check (Integration)`: 5/5 PASS.
     - `Health & Readiness Endpoints (Integration)`: 4/4 PASS.
     - `Email Outbox Worker & Concurrency Lease (Integration)`: 3/3 PASS.
     - `Unique Indexes, Constraints & Atomic Coordination (Integration)`: 7/7 PASS.
     - `Seed Admin & App Isolation (Integration)`: 3/3 PASS.
     - `Multi-Document ACID Transactions (Integration)`: 3/3 PASS.
     - `App Import & Middlewares (Unit)`: 4/4 PASS.
     - `AuthToken Service & Single-Use Tokens (Unit/Integration)`: 5/5 PASS.
     - `Email Outbox & Templates (Unit)`: 7/7 PASS.
     - `Environment Configuration Validation (Unit)`: 4/4 PASS.
     - `Logger Sensitive Data Masking (Unit)`: 3/3 PASS.
     - `Mongoose Models & Schema Definitions (Unit)`: 6/6 PASS.
6. **Kiểm tra so khớp Bảng mã băm Manifest SHA-256 từ đĩa:**
   - Kết quả: **PASS (24/24 tệp khớp 100%)**.
7. **Kiểm tra trạng thái Git:**
   - Lệnh: `git status`
   - Kết quả: **PASS (Working tree clean; commit HEAD: `51cb174`)**.

---

## 5. Kết luận và Quyết định Nghiệm thu

- **Quyết định nghiệm thu:** Chính thức công nhận Phase P03 đạt trạng thái **`ACCEPTED`**.
- **Căn cứ nghiệm thu:**
  - Hoàn thành đầy đủ 6 đầu việc cốt lõi của Phase P03 theo kế hoạch phát triển `docs/planning/development-plan.md`.
  - Khắc phục triệt để các tồn tại phát hiện ở Lần 1 (BUG-P03-01, BUG-P03-02, IMP-P03-03).
  - Toàn bộ 60 tests tự động PASS ổn định, 64 files lint cú pháp đạt chuẩn.
  - Mã băm 24/24 tệp khớp 100% với `docs/phase-reports/P03-manifest.sha256`.
  - Mã nguồn đã được commit an toàn vào Git (`51cb174`).
- **Phiên bản nghiệm thu:** `51cb1745778b2e818addfe560cfcf4976f01b221 (docs/phase-reports/P03-manifest.sha256)`.
- **Người nghiệm thu:** Reviewer độc lập (Ủy quyền bởi người dùng).
- **Ngày nghiệm thu:** 29/10/2026.

---

## 6. Ranh giới và Hướng dẫn cho Phase Tiếp theo (P04)

1. Cập nhật `docs/planning/phase-status.json`:
   - Đánh dấu `P03` là `ACCEPTED`.
   - `next_candidate`: `P04`.
   - `active_phase`: `null` (chờ người dùng giao việc chính thức cho P04).
2. **Phase tiếp theo (P04):** Đăng ký khách hàng, kích hoạt owner và đăng nhập JWT (`CUSTOMER register/verify`, `Admin create OWNER/activate`, ký JWT access HS256, AuthSession, refresh token cookie HttpOnly).
3. **Ranh giới:** Cổng `BE_READY` tiếp tục giữ trạng thái `CLOSED`. Tuyệt đối không xây dựng React hoặc đụng chạm frontend trước khi toàn bộ backend hoàn tất nghiệm thu ở P14.
