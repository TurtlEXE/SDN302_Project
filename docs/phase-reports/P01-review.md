# Báo cáo Review và Đánh giá Nghiệm thu Độc lập — Phase P01

> **Trạng thái kết luận:** `NEEDS_CHANGES`  
> **Người thực hiện review & thẩm quyền nghiệm thu:** Reviewer độc lập (Được người dùng ủy quyền trực tiếp theo yêu cầu)  
> **Ngày review:** 29/10/2026  
> **Tài liệu căn cứ:** `AGENTS.md`, `docs/features.md`, `docs/architecture.md`, `docs/planning/development-plan.md`, `docs/guides/ai-workflow.md` (Mục 9), `docs/phase-reports/P01.md`, `docs/planning/phase-status.json`.

---

## 1. Phạm vi và Phiên bản được Review

### 1.1. Phạm vi bàn giao của Phase P01 (28 tệp)
Phase P01 thực hiện khởi tạo workspace, Express server ES Modules, phân tách entrypoints, cấu hình bảo mật, chuẩn hóa mã lỗi và xử lý lỗi tập trung, logger che dữ liệu nhạy cảm, health/readiness endpoints, công cụ quản trị phase và bộ kiểm thử tự động.

- **Cấu hình gốc và công cụ quản trị:**
  - `.editorconfig`: Quy ước định dạng mã nguồn (UTF-8, indent 2 spaces, LF, final newline).
  - `.gitignore`: Cấu hình bỏ qua node_modules, .env, log, uploads, build outputs.
  - `package.json`: Monorepo root package với workspaces `["server", "client"]` và scripts điều phối.
  - `client/package.json`: Placeholder package cho workspace client, chặn build React trước P15.
  - `client/README.md`: Hướng dẫn cam kết ranh giới giữ chỗ frontend đến sau gate `BE_READY`.
  - `scripts/check-phase.js`: Công cụ kiểm tra tính toàn vẹn 21 phase và ranh giới frontend gate.
- **Khung ứng dụng Backend Server (`server/`):**
  - `server/package.json`: Cấu hình ES Modules (`"type": "module"`), dependencies chuẩn.
  - `server/.env.example`: File mẫu biến môi trường backend không chứa secret thật.
  - `server/README.md`: Hướng dẫn dựng môi trường, khởi chạy và kiểm thử backend từ đầu.
  - `server/src/app.js`: Cấu hình Express app độc lập (helmet, cors, rate-limit, prefix `/api/v1`, 404, error-handler), không tự động mở cổng HTTP khi import.
  - `server/src/server.js`: Tiến trình HTTP Server kết nối DB, lắng nghe cổng và xử lý graceful shutdown.
  - `server/src/worker.js`: Tiến trình Background Worker độc lập kết nối DB và xử lý shutdown.
- **Tầng cấu hình và tiện ích:**
  - `server/src/config/env.js`: Parser và validator biến môi trường fail-fast.
  - `server/src/config/cors.js`: Cấu hình CORS với allowlist `CLIENT_ORIGIN`, credentials và headers.
  - `server/src/config/database.js`: Quản lý kết nối Mongoose (`connectDB`, `disconnectDB`, `checkDatabaseHealth`).
  - `server/src/errors/app-error.js`: Lớp `AppError` kế thừa `Error` chuẩn hóa.
  - `server/src/errors/error-codes.js`: Hằng số 17 mã lỗi nghiệp vụ chuẩn hóa (ADR-08, OpenAPI).
  - `server/src/middlewares/error-handler.js`: Middleware bắt lỗi tập trung định dạng `ErrorResponse`.
  - `server/src/middlewares/not-found.js`: Middleware bắt 404 cho routes không tồn tại.
  - `server/src/middlewares/rate-limit.js`: Rate limiter cơ bản.
  - `server/src/middlewares/validate.js`: Middleware bọc validation input.
  - `server/src/routes/index.js`: Router `/api/v1` và health/readiness endpoints.
  - `server/src/utils/logger.js`: Logger che dữ liệu nhạy cảm (password, token, cookie, authorization).
- **Bộ kiểm thử tự động:**
  - `server/tests/unit/app-import.test.js`: Test import độc lập `app.js`, 404, error handler và JSON parser.
  - `server/tests/unit/env.test.js`: Test validate biến môi trường.
  - `server/tests/unit/logger.test.js`: Test che dữ liệu nhạy cảm trong log.
  - `server/tests/integration/health.test.js`: Test endpoints `/health` và `/ready`.
  - `server/tests/integration/check-phase.test.js`: Test script `check-phase.js`.
- **Tài liệu và chứng từ bàn giao:**
  - `README.md`: Cập nhật trạng thái dự án.
  - `docs/phase-reports/P01.md`: Báo cáo thực hiện của agent triển khai.
  - `docs/phase-reports/P01-manifest.sha256`: Bảng mã băm bàn giao phiên bản.

---

### 1.2. Kiểm tra phiên bản bàn giao (Git & SHA-256 Manifest)

- **Trạng thái Git:** Repository đã được khởi tạo Git (`git init`), cấu hình branch `main`. Tuy nhiên, toàn bộ file vẫn đang ở trạng thái Untracked, chưa có commit lịch sử ban đầu (`fatal: your current branch 'main' does not have any commits yet`).
- **Chứng từ phiên bản bàn giao:** `docs/phase-reports/P01-manifest.sha256`.
- **Kết quả kiểm tra mã băm SHA-256 thực tế trên đĩa:**

| STT | Đường dẫn tệp | Hash mong đợi trong Manifest | Hash thực tế trên đĩa | Kết quả so khớp |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `.editorconfig` | `a91f1b150e3e82830fb1b4e16a9ef470daf5d71f9e1935a80fdceda8f3bccb8b` | `10627fa16d30350379f24dd5931fb4d756c50f4e007760fd28fecc2b7c47b0a9` | **MISMATCH** |
| 2 | `.gitignore` | `03d40e27ecb0650cb492a1101aa4f45cf8e1fe3cb8a318faf7c500a62dbfbeb4` | `a238f16d77942562ce611afffc4d18aac52e69a500473d6121fd96b0ebfc2296` | **MISMATCH** |
| 3 | `package.json` | `a8974ac8ad345137317284132741effcacfb0a17aaa292fb3de3afd431a9fe91` | `66f4ec3e6c0c162571b95ad4ac6aa0f8b04687bf906c994a99c4ed0111653b47` | **MISMATCH** |
| 4 | `client/package.json` | `c8859266b37c92d8e6ccacef04231d98b8202ae72fd1d16511cfa2198da096ea` | `593130d5212426e94849836f16f7d08a631dc92ce2d930a0d780d7b0145267eb` | **MISMATCH** |
| 5 | `scripts/check-phase.js` | `98086767800c283a6e71864b1491fe5b0f01fc28783e09aafefb351e8f18a52f` | `a6684d8505dd5cfb25c11f90ba1f006e176ad39047ac0ab5260b3acca3849525` | **MISMATCH** |
| 6 | `server/package.json` | `d535f784c427bfe56c34ee51038fefc09098700b23f69e549f33951e65207c58` | `8287f4f4f02614cf95467671af3c03de84f1a14977ff9a1c2f4ff9cd3ac493f1` | **MISMATCH** |
| 7 | `server/.env.example` | `7f0cef21d923ddb572cec25cdfe427495891e10255ed4a6e7beafe02e97e4dd7` | `7f0cef21d923ddb572cec25cdfe427495891e10255ed4a6e7beafe02e97e4dd7` | **MATCH (100%)** |
| 8 | `server/README.md` | `221e2fa307579dc80ac6e5378e495355837e05e186939f8afa5ce784dd874dbe` | `221e2fa307579dc80ac6e5378e495355837e05e186939f8afa5ce784dd874dbe` | **MATCH (100%)** |
| 9 | `server/src/app.js` | `1976b270bc6d9797b5dc4585935d28b9b4090e1c3658e6396d918ae66b963c2f` | `753c9ba89fd0a3f868bd4fc3bd804fd057a872313e695502780a4277faa48044` | **MISMATCH** |
| 10 | `server/src/server.js` | `ce6b49ae06efb80e4d147a29fd3d22b815f6e52ed72034b8ddb195ca48f0906d` | `211a8f22035da9bd28ccfe82fef343338e115b07886d997fee9cad1e83288e6f` | **MISMATCH** |
| 11 | `server/src/worker.js` | `a922df9a5c320003b24a16c8e093a916e1ae89c7a58b4b9fc9de4087dd38ebbf` | `8e19d123c03f48df0903c872a90492444922ca2a5e2e1a88e5fe0cd50ffbf191` | **MISMATCH** |
| 12 | `server/src/config/env.js` | `791a8b2fb1effbeb8f1250c0d0a181c3599b31352d86f8fa6d093846ee11da92` | `791a8b2fb1effbeb8f1250c0d0a181c3599b31352d86f8fa6d093846ee11da92` | **MATCH (100%)** |
| 13 | `server/src/config/cors.js` | `b94d248b66a84e820b8fad2c74702f4532fe5fd7ffdb3bc4f77241351eff1811` | `6078da42b7aa9462c98239cd8cca9d117e603914ca47c6561e90f919dcf57d43` | **MISMATCH** |
| 14 | `server/src/config/database.js` | `80b0bfe0ef502bf5fa0930f6df1466ca379cdb83fcce1be3f2bf99eebf2daa77` | `f3e9e64b70ae6c8b081a59c57f685455140efded84bf79fb1bb87c78bd59791b` | **MISMATCH** |
| 15 | `server/src/errors/app-error.js` | `40c8e1dffa45d785822c492923811f3437abd83cc2922e3132f5bcb69ee94b9d` | `511b6ac4a0dc686cb76955f009e8961c127ab4dcb3c6a86aa560c079fe2d0cb0` | **MISMATCH** |
| 16 | `server/src/errors/error-codes.js` | `b131e2717c3395124165b9e67078f8b79c54ddea33efe37f87c0282765933a61` | `cc169e0d21b621f8cd8a3b1f2dec8b5fc757997d6d3a77d0c1adf2ede4f3d98b` | **MISMATCH** |
| 17 | `server/src/middlewares/error-handler.js` | `abd6ac8599d08d39cc353a4b7193ac30a1dcdc40eb412a5dbaa22915040b61af` | `e6113e8ade40bf0e1bcf133fdfe70b87294aed8340745e4d61071a103e9b2dcc` | **MISMATCH** |
| 18 | `server/src/middlewares/not-found.js` | `a68cc26ab14079dc9bbaec6a17ae0e1cca3b3c85a8ed01146545c0fd0e9fb330` | `c75d2dedb1edc6dbd46d27c6c4e39ce7c12faae62363b80ff43539830c3cacf9` | **MISMATCH** |
| 19 | `server/src/middlewares/rate-limit.js` | `96868015970b45a56fdef804ebca00739f2d6d3324cec24103d56ab7791bd1c8` | `caf091b3d0e43a8064b17af61c8456be8296f7d27f7ae04e7637a9b72f65b0d7` | **MISMATCH** |
| 20 | `server/src/middlewares/validate.js` | `ac56d2c9b065d62414e32eaa23f5a66bdf6fed77526934bddd3c5aaf4c6cad90` | `67ca0334c81b2c22ab2313cc9a051cf65dc31e14f039cb834cdb73b91ebef34d` | **MISMATCH** |
| 21 | `server/src/routes/index.js` | `dca7ce6a89e5dc83e260fffa0b3ba7cfe13663350f99387afe022e56cf6fd48d` | `7071e0420dd08f4fc6d3622264427f48e11aa9f9d5d87a0f33707a1e3ee86899` | **MISMATCH** |
| 22 | `server/src/utils/logger.js` | `03e5a06c1b8bf2630b2fb12928f19b724fe9e92507adc0ecdd110dfb618c6ea8` | `938f3fc042c36fb712a6a1affe2a252e61d838c440f6715a14eb4c9d6c99f6fe` | **MISMATCH** |
| 23 | `server/tests/unit/app-import.test.js` | `0d556ab2189489980e93403f13c11c7b747d4377cda991bcec762454ad9f8b70` | `0d556ab2189489980e93403f13c11c7b747d4377cda991bcec762454ad9f8b70` | **MATCH (100%)** |
| 24 | `server/tests/unit/env.test.js` | `058f3f81ba2db30f34be86e12e08192fdea80546405bfafd0f2eb372ef8790d9` | `569e0c925a8d2120e3a71a37e4f7eaada98a0a9a2a9ac250d936ada1e4132321` | **MISMATCH** |
| 25 | `server/tests/unit/logger.test.js` | `f589b805a1601488e33ffd15f1c8e83e1c25e372093d9d94f3425dcb60a60657` | `7bbf466c382402ae9dd3a56c2077f936788cef0297564f3240504b1bb55736ab` | **MISMATCH** |
| 26 | `server/tests/integration/check-phase.test.js` | `48a85ab851bd2d9b85b9c8dec927ca079902454a349bf9c798a075ee8aaa3f3b` | `d4cd62bb65242dacfd9f011b057f84e0179a73261a78afa06b3503241c140f0a` | **MISMATCH** |
| 27 | `server/tests/integration/health.test.js` | `966511989c761a7938c3aed0683e515ef6b1f1224a33452667f82b1c34385d24` | `ad9bbef45973e19c2f984f3e4671a7bbbf3189b6c0c2c86df6517e3d3dc5365c` | **MISMATCH** |
| 28 | `README.md` | `5156374dcf3985e107a4cec6061894dd7483facf26d85dd9147c213b83b19775` | `5156374dcf3985e107a4cec6061894dd7483facf26d85dd9147c213b83b19775` | **MATCH (100%)** |

> [!WARNING]
> **Phát hiện lỗi tính toàn vẹn chứng từ:** Có **23/28 tệp bàn giao bị lệch mã băm SHA-256** so với manifest `docs/phase-reports/P01-manifest.sha256` và Bảng Mục 5 của báo cáo `docs/phase-reports/P01.md`.  
> Phân tích kỹ thuật chuyên sâu của reviewer cho thấy: Sau khi agent triển khai lập manifest lúc 00:11:44 (2026-10-28T17:11:44Z), trình biên soạn / định dạng mã nguồn đã tự động áp dụng quy tắc `.editorconfig` (`insert_final_newline = true`) vào lúc 00:14:23, làm xuất hiện thêm ký tự xuống dòng `\n` ở cuối 23 tệp. Khi cắt bỏ ký tự newline thừa này, 100% (28/28 tệp) khớp hoàn toàn với chuỗi băm gốc. Tuy nhiên, theo quy chuẩn kiểm toán của dự án (tương tự lỗi `BUG-P00-02` ở Phase P00), bảng mã băm manifest phải khớp 100% với trạng thái tệp nhị phân thực tế trên đĩa trước khi được nghiệm thu chính thức.

---

## 2. Đánh giá Chi tiết Từng Tiêu chí và Đầu việc P01

| STT | Tiêu chí / Đầu việc P01 theo kế hoạch | Đầu ra thực tế | Đánh giá | Chi tiết kiểm chứng độc lập |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **Khởi tạo repository/workspaces & placeholder `client`:**<br>- Khởi tạo Git repository, cấu hình `.gitignore`, `.editorconfig`.<br>- Cấu hình npm workspaces quản lý `server` và `client`.<br>- `client` chỉ chứa README giữ chỗ, chưa build React. | `package.json`, `client/package.json`, `client/README.md`, `.gitignore`, `.editorconfig` | **ĐẠT (Có lưu ý)** | - Git đã được `git init` (branch `main`), nhưng chưa tạo initial commit.<br>- `package.json` khai báo đúng workspaces `["server", "client"]`.<br>- `client/package.json` và `client/README.md` chỉ có placeholder, script dev/build exit 1 với thông báo chặn rõ ràng; không có dependencies React nào được cài đặt. |
| 2 | **Tách biệt 3 tiến trình entrypoint:**<br>- `app.js`: Cấu hình middleware, routing, export app, không mở socket/DB.<br>- `server.js`: Nạp env, kết nối DB, listen port HTTP, graceful shutdown.<br>- `worker.js`: Tiến trình worker nền độc lập, kết nối DB, graceful shutdown. | `server/src/app.js`<br>`server/src/server.js`<br>`server/src/worker.js` | **ĐẠT** | - `app.js` export instance Express thuần, không gọi `app.listen()` hoặc `connectDB()`; kiểm chứng qua test unit `app-import.test.js` đạt 100% độc lập.<br>- `server.js` xử lý bắt signal `SIGINT`, `SIGTERM`, `uncaughtException`, `unhandledRejection` với timeout ép đóng 10s.<br>- `worker.js` chạy độc lập, quản lý vòng đời và ngắt DB an toàn. |
| 3 | **Tầng cấu hình và biến môi trường:**<br>- Validate fail-fast các biến môi trường.<br>- Ném lỗi khi thiếu biến bắt buộc hoặc sai định dạng.<br>- Cấu hình CORS chặt chẽ từ `CLIENT_ORIGIN`.<br>- Quản lý kết nối MongoDB qua Mongoose. | `server/src/config/env.js`<br>`server/src/config/cors.js`<br>`server/src/config/database.js` | **ĐẠT** | - `env.js` ném Exception rõ ràng khi `PORT` sai, thiếu `MONGODB_URI` hoặc `JWT_ACCESS_SECRET < 32` ký tự trong production.<br>- `cors.js` cho phép `CLIENT_ORIGIN`, credentials: true, headers `Content-Type, Authorization, X-CSRF-Guard`.<br>- `database.js` cung cấp `connectDB()`, `disconnectDB()` và `checkDatabaseHealth()` phản ánh chính xác trạng thái Mongoose `readyState`. |
| 4 | **Tầng lỗi và xử lý lỗi tập trung:**<br>- Lớp `AppError` kế thừa chuẩn `Error`.<br>- Khai báo đủ 17 mã lỗi nghiệp vụ đã chốt.<br>- Global `errorHandler` chuẩn hóa `ErrorResponse`.<br>- Middleware 404 cho route không tồn tại. | `server/src/errors/app-error.js`<br>`server/src/errors/error-codes.js`<br>`server/src/middlewares/error-handler.js`<br>`server/src/middlewares/not-found.js` | **ĐẠT** | - `error-codes.js` chứa đủ 17/17 mã lỗi chuẩn hóa theo ADR-08 và OpenAPI.<br>- `errorHandler` xử lý SyntaxError JSON 400, Mongoose ValidationError 422, CastError 400; che giấu stack trace ở production.<br>- `notFound` trả về 404 chuẩn với mã lỗi `NOT_FOUND`. |
| 5 | **Bảo mật và tiện ích:**<br>- Logger che dữ liệu nhạy cảm.<br>- Rate limiting cơ bản.<br>- Middleware validate request input.<br>- Hardening HTTP headers (helmet). | `server/src/utils/logger.js`<br>`server/src/middlewares/rate-limit.js`<br>`server/src/middlewares/validate.js` | **ĐẠT** | - `logger.js` che giấu triệt để các trường: `password`, `token`, `cookie`, `authorization`, `secret`, `vnp_securehash`, và chuỗi `Bearer [REDACTED]`.<br>- `rate-limit.js` trả về HTTP 429 và mã lỗi `RATE_LIMIT_EXCEEDED`.<br>- `helmet()` được gắn ngay đầu chuỗi middleware. |
| 6 | **Health & Readiness Endpoints:**<br>- `/health`: Liveness probe (200 UP không phụ thuộc DB).<br>- `/ready`: Readiness probe (200 khi DB kết nối, 503 khi DB ngắt). | `server/src/routes/index.js`<br>`server/src/app.js` | **ĐẠT** | - Lệnh gọi thử nghiệm thực tế: `GET /health` trả về 200 `{ status: "UP", uptime: ... }`.<br>- `GET /ready` khi chưa kết nối DB trả về đúng 503 `{ status: "NOT_READY", database: "disconnected" }`; khi kết nối DB trả về 200 `{ status: "READY", database: "connected" }`. |
| 7 | **Kiểm tra trạng thái phase và cổng frontend:**<br>- Kiểm tra tính toàn vẹn `phase-status.json`.<br>- Chặn file frontend React trước gate `BE_READY`. | `scripts/check-phase.js` | **ĐẠT** | - `scripts/check-phase.js` kiểm tra đủ 21 phase, thứ tự tuần tự, duy nhất 1 active phase, bắt buộc có báo cáo và thông tin nghiệm thu.<br>- Tự động quét `client/src` và `client/package.json`, chặn code JSX/TSX và dependencies React trước khi `BE_READY` là `ACCEPTED`.<br>- Bộ test `check-phase.test.js` kiểm thử 5 kịch bản giả lập bắt lỗi thành công 100%. |
| 8 | **Thiết lập Scripts chạy và Linting:**<br>- Scripts: `dev`, `start`, `worker`, `test`, `lint`.<br>- `.env.example` không chứa secret thật. | `package.json`<br>`server/package.json`<br>`server/.env.example` | **CHƯA ĐẠT (Cần sửa)** | - Các script `dev`, `start`, `worker`, `test` hoạt động tốt.<br>- `.env.example` đầy đủ và không lộ secret.<br>- **Tuy nhiên, script `lint` trong `server/package.json` hiện chỉ là stub in chuỗi giả:** `"node -e \"console.log('Linting backend files: OK')\""`. Điều này vi phạm nguyên tắc tại Mục 9 của `docs/guides/ai-workflow.md` ("Không có test thì không in thông báo giả 'tất cả test đạt'"). Cần cấu hình kiểm tra cú pháp JS thực tế (`node --check`). |
| 9 | **Bộ kiểm thử tự động (Unit & Integration):**<br>- Kiểm thử đầy đủ các thành phần P01. | `server/tests/` (5 suites) | **ĐẠT** | Toàn bộ 5 test suites (20 test cases) chạy bằng Node.js native test runner đều PASS 100%, không có lỗi hoặc skipped. |
| 10 | **Tài liệu hướng dẫn vận hành:**<br>- Hướng dẫn một người khác dựng môi trường từ đầu. | `README.md`<br>`server/README.md` | **ĐẠT** | Cung cấp chi tiết các bước cài đặt, cấu hình, khởi chạy HTTP server, worker, kiểm tra sức khỏe và chạy test suite. |
| 11 | **Chứng từ băm SHA-256 Manifest:**<br>- Lập bảng băm xác thực toàn vẹn 28 tệp bàn giao. | `docs/phase-reports/P01-manifest.sha256`<br>`docs/phase-reports/P01.md` (Mục 5) | **CHƯA ĐẠT (Lỗi chặn)** | 23/28 tệp bị lệch mã băm so với tệp thực tế trên đĩa (xem chi tiết mục 1.2). |

---

## 3. Các Kiểm chứng Độc lập Đã Chạy

Reviewer đã chạy lại toàn bộ bộ kiểm tra độc lập trên môi trường thực tế (Windows 11, Node.js v22.14.0):

1. **Kiểm tra cú pháp tĩnh toàn bộ mã nguồn JavaScript:**
   - Lệnh:
     ```powershell
     Get-ChildItem -Path "server/src", "server/tests", "scripts" -Recurse -Filter "*.js" | ForEach-Object { node --check $_.FullName }
     ```
   - Kết quả: **PASS (100% file JS hợp lệ cú pháp, 0 lỗi cú pháp).**

2. **Chạy toàn bộ Test Suites tự động (`npm test`):**
   - Lệnh:
     ```powershell
     npm test
     ```
   - Kết quả: **PASS (20/20 test cases đạt, 5/5 test suites đạt, thời gian thực thi: 479ms).**
     - `Phase Status & Governance Check (Integration)`: 5/5 PASS.
     - `Health & Readiness Endpoints (Integration)`: 4/4 PASS.
     - `App Import & Middlewares (Unit)`: 4/4 PASS.
     - `Environment Configuration Validation (Unit)`: 4/4 PASS.
     - `Logger Sensitive Data Masking (Unit)`: 3/3 PASS.

3. **Chạy Script kiểm tra trạng thái Phase và Frontend Gate (`npm run check:phase`):**
   - Lệnh:
     ```powershell
     npm run check:phase
     ```
   - Kết quả: **PASS (Cấu trúc phase-status.json hợp lệ, tuân thủ cổng frontend).**

4. **Kiểm tra trực tiếp vòng đời HTTP Server và Endpoints `/health` & `/ready`:**
   - Khởi động HTTP server trên cổng tạm, gọi endpoint `/health`: trả về HTTP 200 `{ status: "UP", uptime: ... }`.
   - Gọi endpoint `/ready` khi chưa kết nối database: trả về HTTP 503 `{ status: "NOT_READY", database: "disconnected" }`.
   - Kết nối MongoDB cục bộ (`127.0.0.1:27017`), gọi `/ready`: trả về HTTP 200 `{ status: "READY", database: "connected" }`.
   - Đóng kết nối DB và HTTP server an toàn (`disconnectDB()`, `server.close()`).

5. **Kiểm tra so khớp Bảng mã băm Manifest SHA-256:**
   - Lệnh: So sánh mã băm của 28 file trong `P01-manifest.sha256` với tệp nhị phân trên đĩa.
   - Kết quả: **FAIL (Chỉ 5/28 file trùng khớp, 23/28 file bị lệch mã băm do ký tự xuống dòng).**

---

## 4. Danh sách Lỗi Phát hiện Cần Sửa (Defects & Issues)

### BUG-P01-01 (Lỗi Chặn Nghiệm thu — Blocker): Lệch mã băm SHA-256 Manifest
- **Vị trí:** `docs/phase-reports/P01-manifest.sha256` và Bảng Mục 5 của `docs/phase-reports/P01.md`.
- **Mô tả:** Có 23 trên tổng số 28 tệp bàn giao không trùng khớp mã băm SHA-256 thực tế trên đĩa (do khác biệt ký tự newline `\n\n` vs `\n` sau khi IDE tự động lưu theo `.editorconfig`).
- **Ảnh hưởng:** Phá vỡ tính toàn vẹn chứng từ bàn giao phiên bản của phase. Kiểm toán tự động không thể xác nhận tính xác thực của mã nguồn đã review so với bản bàn giao.
- **Hướng khắc phục:** Agent triển khai chạy script đọc trực tiếp các tệp thực tế trên đĩa, tính toán lại giá trị SHA-256 chính xác và cập nhật lại cả hai tệp `docs/phase-reports/P01-manifest.sha256` và `docs/phase-reports/P01.md`.

### BUG-P01-02 (Lỗi Kỹ thuật / Quy ước — Medium): Script `lint` là placeholder giả lập
- **Vị trí:** `server/package.json` (dòng 12).
- **Mô tả:** Script lint hiện tại chỉ in console giả: `"node -e \"console.log('Linting backend files: OK')\""`.
- **Ảnh hưởng:** Vi phạm quy tắc tại Mục 9 của `docs/guides/ai-workflow.md` ("Không có test thì không in thông báo giả 'tất cả test đạt'"). Khi người dùng hoặc CI chạy `npm run lint`, hệ thống không thực sự kiểm tra lỗi cú pháp của tệp mã nguồn nào.
- **Hướng khắc phục:** Thay thế bằng script kiểm tra cú pháp thực tế sử dụng Node.js built-in, ví dụ:
  ```json
  "lint": "node -e \"const { execSync } = require('child_process'); execSync('node --check src/app.js src/server.js src/worker.js'); console.log('Syntax check: OK');\""
  ```
  hoặc một script nhỏ duyệt kiểm tra cú pháp toàn bộ file `.js` trong `src/` và `tests/`.

### IMP-P01-03 (Lưu ý Vận hành — Low): Chưa tạo Initial Git Commit
- **Vị trí:** Git repository gốc.
- **Mô tả:** Kho lưu trữ Git đã được `git init` nhưng toàn bộ 28 file vẫn ở trạng thái `Untracked`, chưa có commit ban đầu trên branch `main`.
- **Ảnh hưởng:** Chưa tạo được mốc lịch sử phiên bản (`commit hash`) trong Git.
- **Hướng khắc phục:** Sau khi sửa xong các lỗi trên và xác nhận mã băm, thực hiện `git add .` và commit đầu tiên cho Phase P01.

---

## 5. Kết luận Nghiệm thu Chính thức

- **Quyết định nghiệm thu:** **`NEEDS_CHANGES`**  
  Khung ứng dụng Express, các layer kiến trúc, xử lý lỗi, bảo mật, health check, kiểm soát cổng frontend và bộ test tự động của Phase P01 được xây dựng **rất bài bản, chất lượng cao và vận hành chính xác 100%**.  
  Tuy nhiên, do tồn tại lỗi chặn **BUG-P01-01** (sai lệch mã băm bàn giao SHA-256 trên 23 tệp) và **BUG-P01-02** (script lint là stub giả lập), Phase P01 **chưa đủ điều kiện nghiệm thu `ACCEPTED` ngay trong lượt này**.

---

## 6. Danh mục Công việc Cần Sửa Cho Agent Triển Khai (Fix Turn)

1. Cập nhật script `"lint"` trong `server/package.json` để kiểm tra cú pháp JavaScript thực tế (loại bỏ stub console.log giả).
2. Tính toán lại toàn bộ mã băm SHA-256 từ các tệp thực tế trên đĩa và cập nhật đồng bộ vào `docs/phase-reports/P01-manifest.sha256` cũng như Bảng Mục 5 của `docs/phase-reports/P01.md`.
3. Chạy lại `npm test`, `npm run lint` và `npm run check:phase` để xác nhận toàn bộ kiểm tra đều xanh.
4. Bàn giao lại trạng thái `READY_FOR_REVIEW` trong `docs/planning/phase-status.json` để tiến hành tái nghiệm thu.

