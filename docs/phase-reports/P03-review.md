# Báo cáo Review và Đánh giá Độc lập — Phase P03

> **Trạng thái kết luận:** `NEEDS_CHANGES`  
> **Người thực hiện review & thẩm quyền:** Reviewer độc lập (Được người dùng ủy quyền trực tiếp theo yêu cầu)  
> **Ngày review:** 29/10/2026  
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

### 1.2. Kiểm tra Phiên bản Bàn giao (Git & SHA-256 Manifest)

- **Trạng thái Git thực tế:** **KHÔNG SẠCH SẼ (DIRTY WORKING TREE)**  
  Lệnh `git status` phát hiện 8 tệp mã nguồn bị thay đổi chưa được commit (`Changes not staged for commit`):
  ```text
  modified:   server/src/jobs/send-emails.job.js
  modified:   server/src/repositories/auth-token.repository.js
  modified:   server/src/routes/auth.routes.js
  modified:   server/src/templates/emails/activate-owner.template.js
  modified:   server/src/templates/emails/index.js
  modified:   server/src/templates/emails/reset-password.template.js
  modified:   server/src/templates/emails/verify-email.template.js
  modified:   server/tests/unit/auth-token.test.js
  ```
- **So khớp với tuyên bố trong `docs/phase-reports/P03.md`:**
  - `P03.md` dòng 199 ghi: `- Trạng thái Git: Sạch sẽ (working tree clean).` -> **SAI THỰC TẾ**.
  - `P03.md` dòng 198 ghi: `- Commit mốc bàn giao: a2e8893` -> Trong khi HEAD hiện tại trên `main` là commit `b02b7ab` (`docs(p03): finalize implementation report with commit hash and Ready for Review`).
- **Kết quả kiểm tra mã băm SHA-256 nhị phân thực tế trên đĩa so với `P03-manifest.sha256`:**

| STT | Đường dẫn tệp | Hash mong đợi trong Manifest | Hash thực tế trên đĩa | Kết quả so khớp |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `server/package.json` | `302da0a476fa104292b6ea452284c34f5b13c5d3b97bd8b8590ef5951a3c9e99` | `302da0a476fa104292b6ea452284c34f5b13c5d3b97bd8b8590ef5951a3c9e99` | **MATCH (100%)** |
| 2 | `server/src/app.js` | `36c9e10b5a1cbbe6d2db6a356fe3c6945cf5a9580552cbda1591f38ec99aab37` | `36c9e10b5a1cbbe6d2db6a356fe3c6945cf5a9580552cbda1591f38ec99aab37` | **MATCH (100%)** |
| 3 | `server/src/config/email.js` | `1ef1f2260789ffc401c4dfe7bd753f5bc86700bef5b348acb05b7eb404c93af7` | `1ef1f2260789ffc401c4dfe7bd753f5bc86700bef5b348acb05b7eb404c93af7` | **MATCH (100%)** |
| 4 | `server/src/controllers/auth.controller.js` | `e0dfba1fe6a77b5b72759de21380ac78475abe89be89b4b3a197c3bab1ab2573` | `e0dfba1fe6a77b5b72759de21380ac78475abe89be89b4b3a197c3bab1ab2573` | **MATCH (100%)** |
| 5 | `server/src/errors/error-codes.js` | `2a85bb017ddd4b9d85eefc083e85818d6cdd92e7d78f57f3d6b128d3b2a2b5bf` | `2a85bb017ddd4b9d85eefc083e85818d6cdd92e7d78f57f3d6b128d3b2a2b5bf` | **MATCH (100%)** |
| 6 | `server/src/integrations/mail.client.js` | `e4f791e976cfb4d6363d883aba8fe3fa83d15369f55856f80702ec53c6b5472b` | `e4f791e976cfb4d6363d883aba8fe3fa83d15369f55856f80702ec53c6b5472b` | **MATCH (100%)** |
| 7 | `server/src/jobs/send-emails.job.js` | `c932955f12df873a5d56eece1bf1dbe05c072a6450a60c54ca657c480c7538ab` | `c561ba35f7ebbe4a9df676163b3c258f3d289adeb86a6c5ec69332b0e9bdb8f2` | ❌ **MISMATCH** |
| 8 | `server/src/middlewares/rate-limit.js` | `bbd9a9fbce5674dd59e3b47327b406219aabaf7aecf31235d39a519b699d1ff3` | `bbd9a9fbce5674dd59e3b47327b406219aabaf7aecf31235d39a519b699d1ff3` | **MATCH (100%)** |
| 9 | `server/src/models/email-outbox.model.js` | `35d7849690f3f8b749121b720006c29f783af57eea67c3aba6ee1e78b21afd9f` | `35d7849690f3f8b749121b720006c29f783af57eea67c3aba6ee1e78b21afd9f` | **MATCH (100%)** |
| 10 | `server/src/repositories/auth-token.repository.js` | `be4b8d62745d91b75bdac49c0ad16f4b5aa6852ca10b175479daa5c5bb3683a7` | `296ce3df0252d2a91188ef1ab56579874c29ce5ba0a4ce45d17dda4de4de7e0d` | ❌ **MISMATCH** |
| 11 | `server/src/repositories/email-outbox.repository.js` | `c400625d19aaa864519ec10525f27bac6e8fe885c827861db87dd80867f72b19` | `c400625d19aaa864519ec10525f27bac6e8fe885c827861db87dd80867f72b19` | **MATCH (100%)** |
| 12 | `server/src/routes/auth.routes.js` | `4d28e535d19c201cdada642f7b22e2942f7aea6e49169736cbaa59e4cb136cb4` | `75b8059e3d608a37e5c87bd60df786d3d968a1f93efed95fafcfa3a5773bc01d` | ❌ **MISMATCH** |
| 13 | `server/src/routes/index.js` | `1b9f659d9685c923ec4f1a660fbedd3348a70fa312dbb8a552691a2438e7ab84` | `1b9f659d9685c923ec4f1a660fbedd3348a70fa312dbb8a552691a2438e7ab84` | **MATCH (100%)** |
| 14 | `server/src/services/auth-token.service.js` | `34bbcd2994245e2f21a3f2d5c5d3ea1ff7066ebedd3a558088adb679da43e531` | `34bbcd2994245e2f21a3f2d5c5d3ea1ff7066ebedd3a558088adb679da43e531` | **MATCH (100%)** |
| 15 | `server/src/services/email/email.service.js` | `3d14eb5cc37cb790d0aa3c0e03757593bd060dd8475e4fadab7cd1d17d37d4b2` | `3d14eb5cc37cb790d0aa3c0e03757593bd060dd8475e4fadab7cd1d17d37d4b2` | **MATCH (100%)** |
| 16 | `server/src/templates/emails/activate-owner.template.js` | `bc6546df1976a90321e181fff0444c8675faa10dddf48cc3430cf7d81b12776b` | `6bd10b830c3404458593c3f1bdf5f1d762ce64ccf69d793dc3b3dc312b80abdf` | ❌ **MISMATCH** |
| 17 | `server/src/templates/emails/index.js` | `8afd6d1022365daf1196980644df352353e22b4f52f9ead377081ee4ed54c0eb` | `727fc21787472cf1b3ec27f57ebbd102b0843af2c5946ebb3336b4cf3a159eb3` | ❌ **MISMATCH** |
| 18 | `server/src/templates/emails/reset-password.template.js` | `704e522634f8cb923ffcdff183c9b812af374d40db5bad74db35b6465c0f1b2e` | `ba9fb57e4b7e087fea71d3303e4849fd28a317a689acff40b1aeb534b46e98f6` | ❌ **MISMATCH** |
| 19 | `server/src/templates/emails/verify-email.template.js` | `77f2396729f6e99b7795de405b13681f0d23477b26668badfd27b3ee56a6d259` | `bcb40c00a942ed076bd4ba8252d22676fc2b72a2326ae8b68b30a393b90c5e5d` | ❌ **MISMATCH** |
| 20 | `server/src/worker.js` | `2990487a3286195fd818a576f8e38710cd5a4226a20a2474cb0daaf3fc5e0d51` | `2990487a3286195fd818a576f8e38710cd5a4226a20a2474cb0daaf3fc5e0d51` | **MATCH (100%)** |
| 21 | `server/tests/integration/auth-tokens-api.test.js` | `e3cb1f9188a927081c96a6ac97c90e8a88781fff0e0072a7f30e17e59d98a7a8` | `e3cb1f9188a927081c96a6ac97c90e8a88781fff0e0072a7f30e17e59d98a7a8` | **MATCH (100%)** |
| 22 | `server/tests/integration/email-outbox-worker.test.js` | `e4d0f7760a355ba39529bdb8f6dfb7c3d1732b7b5449a2bddd0e9e872771852d` | `e4d0f7760a355ba39529bdb8f6dfb7c3d1732b7b5449a2bddd0e9e872771852d` | **MATCH (100%)** |
| 23 | `server/tests/unit/auth-token.test.js` | `01f0ab99255cbfac45d9c0f6cf76ee9c76f4e37cc619321aed501f9d27c9040e` | `0d96fe266ef95c98d8e1f78d755ee7304f1408fb00f996454e183a069a463449` | ❌ **MISMATCH** |
| 24 | `server/tests/unit/email-outbox.test.js` | `8aa48c8dc3ff8a324595799e5236345c4486153079da5cec13f05b3ac6cffaf8` | `8aa48c8dc3ff8a324595799e5236345c4486153079da5cec13f05b3ac6cffaf8` | **MATCH (100%)** |

> **Ghi chú phân tích nguyên nhân:**  
> Khi kiểm tra blob nhị phân trong Git tại commit `a2e8893` (`git show a2e8893:<file>`), cả 24 tệp đều **khớp 100%** với mã băm trong manifest.  
> Tuy nhiên, trên thư mục làm việc thực tế (working tree), 8 tệp nói trên đã bị chèn thêm một ký tự xuống dòng trống ở cuối tệp (`\n\n`), làm thay đổi mã băm nhị phân trên đĩa và gây ra trạng thái Git bẩn (`Changes not staged for commit`).

---

## 2. Chi tiết Lỗi và Sai lệch Phát hiện được (Bugs & Deficiencies)

### BUG-P03-01: Thư mục làm việc Git bẩn (Unclean working tree)
- **Vị trí:** 8 tệp mã nguồn và kiểm thử:
  - `server/src/jobs/send-emails.job.js`
  - `server/src/repositories/auth-token.repository.js`
  - `server/src/routes/auth.routes.js`
  - `server/src/templates/emails/activate-owner.template.js`
  - `server/src/templates/emails/index.js`
  - `server/src/templates/emails/reset-password.template.js`
  - `server/src/templates/emails/verify-email.template.js`
  - `server/tests/unit/auth-token.test.js`
- **Ảnh hưởng:** Vi phạm quy tắc bàn giao tại `AGENTS.md` ("kiểm tra file thực tế, không coi lời báo hoàn thành là bằng chứng") và trái ngược hoàn toàn với tuyên bố tại Mục 5 của `docs/phase-reports/P03.md` ("Trạng thái Git: Sạch sẽ (working tree clean)").

### BUG-P03-02: Sai lệch mã băm nhị phân SHA-256 trên đĩa thực tế
- **Vị trí:** 8/24 tệp trong bảng Mục 1.2 so với `docs/phase-reports/P03-manifest.sha256`.
- **Nguyên nhân:** Ký tự xuống dòng kép (`\n\n`) ở cuối tệp trên working tree.
- **Ảnh hưởng:** Không đảm bảo tính toàn vẹn của phiên bản bàn giao khi triển khai hoặc đối chiếu độc lập trên môi trường CI/CD.

### IMP-P03-03: Không đồng nhất mốc commit bàn giao
- **Vị trí:** `docs/phase-reports/P03.md` (Mục 5).
- **Mô tả:** Báo cáo ghi `Commit mốc bàn giao: a2e8893`, nhưng commit mới nhất trên `main` hiện là `b02b7ab`. Cần chuẩn hóa sau khi commit các sửa đổi của P03.

---

## 3. Đánh giá Chi tiết Từng Tiêu chí và Đầu việc P03

| STT | Tiêu chí / Đầu việc P03 theo kế hoạch | Đầu ra thực tế | Đánh giá kỹ thuật | Chi tiết kiểm chứng độc lập |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **Hạ tầng email client, EmailOutbox, worker có lease & retry:**<br>- Nodemailer client bọc cấu hình SMTP / in-memory test.<br>- Worker atomic lease chống nhận trùng.<br>- Retry tối đa 3 lần với exponential backoff (1m, 5m, 15m), chuyển FAILED. | `server/src/integrations/mail.client.js`<br>`server/src/models/email-outbox.model.js`<br>`server/src/repositories/email-outbox.repository.js`<br>`server/src/services/email/email.service.js`<br>`server/src/jobs/send-emails.job.js`<br>`server/src/worker.js` | **ĐẠT (Về mặt mã nguồn & logic)** | - `mail.client.js` chuyển đổi mượt mà giữa SMTP và JSON in-memory test transport.<br>- Thao tác `claimPendingMessage` dùng `findOneAndUpdate` trên `{ status: 'PENDING', nextRetryAt: { $lte: now }, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] }` với `$set: { lockedUntil }` đảm bảo phân phối độc quyền công việc giữa nhiều worker song song.<br>- Đã kiểm chứng 2 worker song song chia sẻ chính xác 8/8 email không trùng lặp.<br>- Retry 3 lần với backoff chuẩn xác, đánh dấu FAILED khi đạt giới hạn. |
| 2 | **Quản lý AuthToken dùng 1 lần (Hash, Hạn dùng, Mục đích, Tiêu thụ nguyên tử):**<br>- Chuỗi ngẫu nhiên mật mã 64-hex, chỉ lưu SHA-256 hash trên DB.<br>- Thời hạn 15m (verify/reset) và 24h (activate owner).<br>- Cấm dùng sai mục đích hoặc hết hạn.<br>- Cấp lại vô hiệu hóa token cũ chưa dùng.<br>- Tiêu thụ nguyên tử duy nhất 1 lần. | `server/src/repositories/auth-token.repository.js`<br>`server/src/services/auth-token.service.js`<br>`server/tests/unit/auth-token.test.js` | **ĐẠT (Về mặt mã nguồn & logic)** | - Sinh ngẫu nhiên 32 bytes (`crypto.randomBytes(32).toString('hex')`), băm SHA-256 đối chiếu.<br>- Hàm `consumeToken` cập nhật `usedAt: now` nguyên tử bằng `findOneAndUpdate` có điều kiện `usedAt: null` và `expiresAt > now`. Tiêu thụ lần 2 trả lỗi `TOKEN_ALREADY_USED`.<br>- Cấp token mới tự động gọi `invalidateActiveTokens` vô hiệu các token cũ cùng loại của user. |
| 3 | **Mẫu email HTML/Text responsive & Endpoint gửi lại có Rate Limit:**<br>- 3 mẫu email tiếng Việt chuẩn responsive (`verify-email`, `activate-owner`, `reset-password`).<br>- Endpoint resend có cooldown 60s per email. | `server/src/templates/emails/`<br>`server/src/middlewares/rate-limit.js`<br>`server/src/controllers/auth.controller.js`<br>`server/src/routes/auth.routes.js` | **ĐẠT (Về mặt mã nguồn & logic)** | - Cả 3 mẫu email render đầy đủ HTML có style nội dòng và plain-text fallback, chứa cảnh báo bảo mật và thời hạn tương ứng.<br>- `emailCooldownMiddleware` chặn yêu cầu gửi lại trong vòng 60s, trả HTTP 429 kèm số giây còn lại.<br>- `POST /api/v1/auth/resend-verification` phản hồi generic 200 bảo vệ danh tính khi email không tồn tại. |
| 4 | **Bảo vệ Token không bị tiêu thụ bởi GET (Xác nhận bằng POST):**<br>- Mở link qua GET không đổi `usedAt`.<br>- Xác nhận kích hoạt bằng POST. | `server/src/controllers/auth.controller.js`<br>`server/src/routes/auth.routes.js`<br>`server/tests/integration/auth-tokens-api.test.js` | **ĐẠT (Về mặt mã nguồn & logic)** | - `GET /api/v1/auth/verify-token` và `GET /api/v1/auth/verify-email` gọi `inspectToken()`, chỉ kiểm tra tính hợp lệ và trả về `{ valid: true }`, tuyệt đối không cập nhật `usedAt`.<br>- Chỉ khi gọi `POST /api/v1/auth/verify-email` thì token mới được tiêu thụ và cập nhật `emailVerifiedAt` cho User. |
| 5 | **Tách rời lỗi gửi email khỏi giao dịch dữ liệu (Transactional Outbox):**<br>- Sự cố SMTP không làm rollback tài khoản hay token.<br>- Email nằm lại outbox chờ retry. | `server/src/controllers/auth.controller.js`<br>`server/src/services/email/email.service.js`<br>`server/tests/integration/auth-tokens-api.test.js` | **ĐẠT (Về mặt mã nguồn & logic)** | - `generateToken` và `queueEmail` được thực thi trong cùng một MongoDB transaction ACID (`withTransaction`).<br>- Khi mô phỏng SMTP offline hoàn toàn, request resend verification vẫn trả 200 OK thành công, token và outbox record vẫn được commit bền vững vào DB. |
| 6 | **Từ chối gửi liên kết đã hết hạn (Link Expiration Safety):**<br>- Worker từ chối chuyển phát nếu token đã hết hạn trước khi gửi. | `server/src/services/email/email.service.js`<br>`server/tests/unit/email-outbox.test.js` | **ĐẠT (Về mặt mã nguồn & logic)** | - Trong `processMessage()`, kiểm tra `templateData.expiresAt <= new Date()`. Nếu đã quá hạn, đánh dấu terminal FAILED ngay lập tức và từ chối gửi qua SMTP. |
| 7 | **Tính toàn vẹn Chứng từ & Trạng thái Git:**<br>- Bảng mã băm SHA-256 khớp 100% trên đĩa.<br>- Thư mục làm việc Git sạch sẽ. | `docs/phase-reports/P03-manifest.sha256`<br>Git working tree | ❌ **CHƯA ĐẠT** | - 8/24 tệp bị lệch mã băm trên đĩa (BUG-P03-02).<br>- Working tree có 8 tệp bị sửa đổi chưa commit (BUG-P03-01). |

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
   - Lệnh: `npm test` (Chạy độc lập lặp lại 2 lần liên tiếp để loại trừ race condition)
   - Kết quả: **PASS 60/60 tests (13 test suites), thời gian chạy ~910ms, 0 failures**:
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
   - Kết quả: **FAIL (8/24 tệp bị lệch mã băm do ký tự xuống dòng kép ở cuối tệp)**.
7. **Kiểm tra trạng thái Git:**
   - Lệnh: `git status`
   - Kết quả: **FAIL (8 tệp modified chưa staged/commit)**.

---

## 5. Yêu cầu Cần Sửa đổi (Action Items cho Triển khai)

Trước khi Phase P03 có thể được chính thức nghiệm thu `ACCEPTED`, agent triển khai cần thực hiện:

1. **Chuẩn hóa ký tự kết thúc tệp trên đĩa:**
   - Chuẩn hóa đúng 1 ký tự LF (`\n`) ở cuối tệp, loại bỏ dòng trắng thừa (`\n\n`) đối với 8 tệp:
     - `server/src/jobs/send-emails.job.js`
     - `server/src/repositories/auth-token.repository.js`
     - `server/src/routes/auth.routes.js`
     - `server/src/templates/emails/activate-owner.template.js`
     - `server/src/templates/emails/index.js`
     - `server/src/templates/emails/reset-password.template.js`
     - `server/src/templates/emails/verify-email.template.js`
     - `server/tests/unit/auth-token.test.js`
2. **Đảm bảo tính nhất quán của Bảng mã băm SHA-256:**
   - Sau khi chuẩn hóa, tính toán lại mã băm SHA-256 nhị phân trên đĩa và đảm bảo khớp 100% (24/24 tệp) với `docs/phase-reports/P03-manifest.sha256` và Bảng Mục 5 của `docs/phase-reports/P03.md`.
3. **Commit Git sạch sẽ:**
   - Đưa các thay đổi vào Git và tạo commit rõ ràng trên nhánh `main`.
   - Đảm bảo lệnh `git status` trả về `nothing to commit, working tree clean`.
4. **Cập nhật Báo cáo Triển khai (`docs/phase-reports/P03.md`):**
   - Cập nhật đúng mã commit mới nhất tại Mục 5.
   - Cập nhật trạng thái `READY_FOR_REVIEW` sẵn sàng cho lượt tái review.

---

## 6. Kết luận của Reviewer Độc lập

- **Kết luận:** **`NEEDS_CHANGES`**.
- **Lý do:** Về mặt nghiệp vụ và kiểm thử chức năng, mã nguồn của P03 đã hoàn thiện xuất sắc và vượt qua 60/60 tests tự động. Tuy nhiên, theo quy chuẩn nghiệm thu nghiêm ngặt tại `AGENTS.md`, việc để lại thư mục làm việc Git bẩn và 8 tệp lệch mã băm so với manifest là vi phạm tiêu chí bàn giao chứng từ. Không được phép hạ tiêu chuẩn hoặc nhân nhượng để bỏ qua tính toàn vẹn phiên bản.
- **Cập nhật tiến độ:**
  - Ghi nhận trạng thái `NEEDS_CHANGES` cho Phase `P03` trong `docs/planning/phase-status.json`.
  - `active_phase`: tiếp tục giữ `P03`.
  - Ranh giới: Tuyệt đối **KHÔNG** bắt đầu Phase P04 hoặc mở cổng Frontend cho tới khi P03 hoàn thành khắc phục và đạt `ACCEPTED`.

