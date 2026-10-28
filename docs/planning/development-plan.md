# Kế hoạch phát triển platform đặt sân — backend trước, frontend sau

> Ngày: 28/10/2026.
> Công nghệ: Node.js/Express, MongoDB/Mongoose, React; kiến trúc client–server 3 tier, backend chia layer.
> Trạng thái: P00–P20 đều chưa được triển khai/nghiệm thu. Đã chuẩn bị thư mục và tài liệu trong `sport-booking/`; chưa có mã ứng dụng hoặc cấu hình chạy.

## 1. Tài liệu đầu vào và nguyên tắc triển khai

- [Đặc tả tính năng](../features.md): phạm vi, trạng thái, 64 kịch bản nghiệm thu và các quy tắc nghiệp vụ.
- [Cấu trúc dự án](../architecture.md): trách nhiệm từng layer/component; mục 10 chốt JWT, refresh cookie và phiên.
- Tài liệu này chia việc và đặt điều kiện chuyển phase; không thay đổi chính sách đã chốt ở hai tài liệu trên.
- Khi giao cho AI, áp dụng `AGENTS.md` và [hướng dẫn giao việc](../guides/ai-workflow.md); tiến độ thực tế ghi duy nhất tại `docs/planning/phase-status.json`, bằng chứng ở `docs/phase-reports/`.

**Ưu tiên bắt buộc:** P00–P14 hoàn thành backend và đạt **BE-READY**, sau đó mới bắt đầu frontend ở P15. Không làm React song song với backend chưa ổn định.

Backend được kiểm chứng qua unit/integration tests, công cụ gọi API, hợp đồng OpenAPI và dữ liệu demo. Cookie/CORS cần thêm trang HTML kiểm thử tối thiểu trong browser; VNPay cần trang return thử nghiệm tối thiểu. Đây là công cụ test backend, không phải giao diện React sản phẩm.

Trong mỗi phase, làm trọn một nhóm nghiệp vụ từ route → controller → service → repository/model → kiểm thử. Không viết toàn bộ controller trước rồi mới viết service sau. Một phase có thể chia thành nhiều commit nhỏ theo các đầu việc dưới đây.

Không ấn định số ngày khi chưa biết số thành viên và thời gian có thể dành cho đồ án. Chuyển phase theo đầu ra/kiểm thử thực tế, không theo việc đã hết thời gian dự kiến.

## 2. Các mốc chính

- **M0 — Nền tảng:** P00–P02, server và MongoDB hỗ trợ transaction.
- **M1 — Tài khoản:** P03–P05, email tài khoản và JWT/cookie/thu hồi phiên được kiểm thử.
- **M2 — Dữ liệu sân:** P06–P08, API cơ sở/sân và lịch hoạt động đúng.
- **M3 — Đặt sân:** P09–P10, chống trùng, giữ chỗ và vòng đời đơn ổn định.
- **M4 — Thanh toán:** P11–P13, VNPay, hoàn tiền hỗ trợ, email và báo cáo.
- **BE-READY:** P14, kiểm tra toàn bộ backend; là điều kiện bắt đầu React.
- **M5 — Giao diện:** P15–P19, lần lượt auth, tìm sân, đặt sân, owner, admin.
- **RELEASE-READY:** P20, kiểm thử toàn hệ thống và bàn giao.

## 3. Giai đoạn backend

### P00 — Chốt phạm vi và hợp đồng dữ liệu

**Phụ thuộc:** hai tài liệu đầu vào.

**Công việc:**

- [ ] Chốt tên trạng thái, mã lỗi, quy tắc phân quyền và các endpoint `/api/v1` trong bản đầu OpenAPI.
- [ ] Chốt cách lưu ngày/giờ: múi giờ nghiệp vụ Asia/Ho_Chi_Minh, một biểu diễn thống nhất cho khoảng và timestamp.
- [ ] Chốt Facility → FacilitySport (30/60/90 phút) → Court; BookingRequest → các Booking dạng khoảng → một PaymentOrder.
- [ ] Chốt JWT access 10 phút trong RAM, refresh ngẫu nhiên trong cookie HttpOnly, phiên tối đa 7 ngày và Origin/CSRF guard theo tài liệu cấu trúc.
- [ ] Chốt topology: local dùng proxy cùng origin; môi trường triển khai ưu tiên client và `/api` cùng origin qua HTTPS.
- [ ] Lập danh sách cấu hình cần có: MongoDB có transaction, email thử nghiệm, VNPay thử nghiệm, URL IPN công khai HTTPS và nơi lưu ảnh.
- [ ] Tạo checklist ánh xạ 64 tiêu chí với các phase; ghi rõ phần kiểm thử UI chưa thể hoàn thành ở backend.

**Đầu ra:** `docs/api.openapi.yaml`, `docs/database.md`, quyết định kiến trúc ngắn gọn và cấu hình mẫu.

**Điều kiện hoàn thành:** mọi luồng đều xác định actor, input/output, trạng thái và lỗi; không còn mâu thuẫn như trả tiền tại sân hoặc lưu mỗi ô thành một Booking.

### P01 — Khởi tạo server và quy ước chung

**Phụ thuộc:** P00.

**Công việc:**

- [ ] Khởi tạo repository/workspaces và ứng dụng `server` trên bộ thư mục đã chuẩn bị; `client` hiện chỉ có README giữ chỗ, chưa build React.
- [ ] Tách `app.js`, `server.js`, `worker.js`; tạo config/env và kết nối DB.
- [ ] Thêm validate input, lỗi thống nhất, logger có che dữ liệu nhạy cảm, middleware 404, HTTP hardening và rate limit cơ bản.
- [ ] Thiết lập scripts chạy API/worker/test/lint; `.env.example` không chứa bí mật thật.
- [ ] Tạo health/readiness endpoint và shutdown đóng kết nối đúng cách.
- [ ] Thiết lập kiểm tra trạng thái/phụ thuộc/phạm vi phase và CI lint/test đã có; kiểm tra frontend trước BE-READY theo mục 9 hướng dẫn giao việc. Quyền review/merge cần cấu hình thực tế nếu dùng nền tảng Git hỗ trợ, không tuyên bố đã bật chỉ từ file workflow.

**Đầu ra:** API chạy được, README hướng dẫn một người khác dựng môi trường từ đầu.

**Kiểm thử/hoàn thành:** cấu hình thiếu báo lỗi rõ, health chạy, DB hỏng làm readiness báo không sẵn sàng; import app để test không tự mở HTTP server hoặc chạy seed. Bộ kiểm tra phase phát hiện được trạng thái sai, thiếu bằng chứng nghiệm thu và thay đổi frontend trước gate; báo rõ phần kiểm soát repository chưa cấu hình được.

### P02 — MongoDB, model nền và transaction

**Phụ thuộc:** P01.

**Công việc:**

- [ ] Dựng MongoDB có replica set và một database test tách biệt.
- [ ] Khai báo schema/index cho User, AuthToken, AuthSession, RefreshToken, Sport và các model nghiệp vụ đã thiết kế; hoàn thiện các trường đặc thù cùng phase sử dụng chúng.
- [ ] Tạo helper transaction và quy ước truyền session xuyên service/repository.
- [ ] Chuẩn bị CourtDaySchedule unique sân/ngày và cách khởi tạo nguyên tử; đánh giá cơ chế phối hợp với thay đổi Facility/FacilitySport/Court.
- [ ] Tạo script index, seed admin và fixtures kiểm thử; không seed tự động khi ứng dụng chạy.
- [ ] Chốt index nhận diện PaymentOrder/PaymentTransaction và khóa idempotency; TTL chỉ dành cho dữ liệu auth/tạm phù hợp.

**Đầu ra:** model, index, transaction helper và dữ liệu test sử dụng được.

**Kiểm thử/hoàn thành:** giao dịch nhiều document rollback được khi cố tình gây lỗi; trùng unique bị chặn; Booking/Payment không bị TTL xóa. Nếu môi trường chưa chạy transaction được, chưa chuyển sang triển khai đặt sân.

### P03 — Hạ tầng email và token dùng một lần

**Phụ thuộc:** P02.

**Công việc:**

- [ ] Tạo email client, EmailOutbox, worker nhận việc có lease, retry có giới hạn và trạng thái lỗi.
- [ ] Tạo/kiểm tra/tiêu thụ AuthToken bằng hash, đúng mục đích, có hạn và dùng một lần.
- [ ] Tạo mẫu email verify/activate/reset và endpoint gửi lại có rate limit.
- [ ] Không tiêu thụ token khi GET mở link; việc xác nhận bằng POST.
- [ ] Tách lỗi gửi email khỏi kết quả giao dịch tạo tài khoản/token.

**Đầu ra:** email tài khoản gửi được qua hộp thư thử nghiệm; tác vụ gửi lại không tạo lại dữ liệu nghiệp vụ.

**Kiểm thử/hoàn thành:** token hết hạn/đã dùng/sai mục đích bị từ chối, gửi lại vô hiệu link cũ; gửi lỗi không mất tài khoản và worker không nhận cùng việc đồng thời. Chấp nhận khả năng email lặp khi nhà cung cấp timeout theo đặc tả, không lặp tác dụng nghiệp vụ.

### P04 — Đăng ký, kích hoạt owner và đăng nhập JWT

**Phụ thuộc:** P03.

**Công việc:**

- [ ] Register CUSTOMER, xác thực email, login và `/users/me`.
- [ ] Admin tạo OWNER; email mời, owner xác thực và tự đặt mật khẩu; không public đăng ký owner.
- [ ] Ký/xác minh access JWT với thuật toán/issuer/audience/type cố định.
- [ ] Tạo AuthSession/refresh token khi login, trả access token trong JSON và đặt cookie.
- [ ] Middleware authenticate kiểm tra User và phiên; authorize kiểm tra vai trò từ dữ liệu server.
- [ ] Cập nhật hồ sơ; forgot/reset/change password theo phạm vi đã chốt.

**Đầu ra:** API tài khoản chạy xuyên suốt bằng công cụ gọi API, có phiên JWT thật.

**Kiểm thử/hoàn thành:** chưa verify hoặc chưa kích hoạt không được cấp quyền nghiệp vụ; client không tự chọn role; JWT sửa/sai claims bị từ chối. M1 chưa đạt cho tới khi P05 hoàn thành rotation/thu hồi và bảo vệ browser.

### P05 — Refresh cookie, thu hồi phiên và bảo vệ auth

**Phụ thuộc:** P04.

**Công việc:**

- [ ] Hoàn thiện refresh rotation nguyên tử; giữ token hash đã dùng để nhận diện reuse.
- [ ] Logout hiện tại, logout-all, đổi/reset mật khẩu và khóa User làm vô hiệu phiên đúng phạm vi.
- [ ] Kiểm tra hạn tuyệt đối 7 ngày và JWT không vượt hạn phiên; không dựa vào TTL để quyết định hợp lệ.
- [ ] Cấu hình cookie local/HTTPS, Path, SameSite, host-only; xóa đúng thuộc tính khi logout.
- [ ] Thêm auth-request-guard cho POST auth: Origin allowlist, JSON, `X-CSRF-Guard: 1`; CORS credentials không wildcard.
- [ ] Chuẩn hóa mã lỗi để client sau này phân biệt access hết hạn, session bị thu hồi và không có quyền.
- [ ] Viết fixture HTML/browser smoke tối thiểu kiểm chứng cookie và origin tốt/xấu; không xây React.

**Đầu ra:** bộ auth API và quy tắc cookie hoàn chỉnh; tài liệu OpenAPI có Set-Cookie, Bearer và guard.

**Kiểm thử/hoàn thành:** tiêu chí 57–62 qua kiểm thử API/browser tương ứng; logout chặn JWT cũ ở request mới; reuse/refresh đồng thời không tạo hai phiên hợp lệ; Origin lạ bị chặn. Phần điều phối nhiều API/tab của React trong tiêu chí 63 kiểm thử thật ở P15.

### P06 — Quản trị tài khoản và danh mục môn

**Phụ thuộc:** P05.

**Công việc:**

- [ ] API admin danh sách/chi tiết/cấp owner, gửi lại mời, khóa/mở khóa và hỗ trợ reset.
- [ ] CRUD mềm danh mục Sport, chuẩn hóa tên, không xóa cứng dữ liệu đã dùng.
- [ ] Quy tắc khóa owner chặn yêu cầu mới, không xóa đơn hay bỏ qua callback tiền.
- [ ] Ghi ActionLog và email khóa/mở khóa.
- [ ] Hoàn thiện tìm kiếm, phân trang và whitelist trường được sửa.

**Đầu ra:** API quản trị nền và dữ liệu ít nhất hai owner, hai customer để test quyền chéo.

**Kiểm thử/hoàn thành:** customer/owner không gọi được API admin, mở khóa không khôi phục phiên cũ, không đổi role/email bằng input thừa.

### P07 — Cơ sở, môn tại cơ sở, sân con và ảnh

**Phụ thuộc:** P06.

**Công việc:**

- [ ] Facility nháp/công khai/tạm ngừng, khóa quản trị riêng với trạng thái owner.
- [ ] FacilitySport unique cơ sở/môn, step 30/60/90 phút và phiên bản cấu hình.
- [ ] Court thuộc một FacilitySport, giá/giờ, trạng thái nhận đặt, không chuyển nhóm tùy ý.
- [ ] Giờ mở/đóng, phần dư cuối ngày, ít nhất một ô trọn vẹn; guard khi đổi cấu hình có lịch.
- [ ] Upload/xóa/chọn ảnh đại diện, giới hạn định dạng/số lượng/dung lượng và kiểm tra ownership.
- [ ] API public danh sách/tìm kiếm/lọc/chi tiết với các trường trả về được chọn lọc.

**Đầu ra:** API dữ liệu sân đủ để dựng giao diện tìm sân sau này.

**Kiểm thử/hoàn thành:** owner A không sửa dữ liệu B; chưa đủ điều kiện không công khai; mở khóa admin không tự đổi PAUSED; giá lọc phù hợp môn và sân; không lộ thông tin riêng của owner/khách.

### P08 — Sinh lịch, gộp khoảng và tính giá

**Phụ thuộc:** P07.

**Công việc:**

- [ ] Viết các hàm thuần slot-merger, pricing và booking-policy.
- [ ] Sinh ô từ mốc mở cửa với bước của FacilitySport; bỏ phần dư không đủ bước.
- [ ] Sắp xếp/loại ô trùng, gộp liền nhau, tách dải rời nhau; kiểm tra không tự lấp khoảng trống.
- [ ] API lịch sân/ngày phân biệt trống, hold còn hạn, đã đặt, khóa và quá giờ; dùng dữ liệu fixtures để kiểm tra trạng thái trước khi tạo đơn thật.
- [ ] Tính giá theo phút, làm tròn sau khi gộp mỗi Booking và cộng tổng yêu cầu.
- [ ] Quy tắc 30 ngày, tối thiểu 15 phút trước giờ đầu tiên và kiểm tra phiên bản cấu hình.

**Đầu ra:** API lịch và bộ quy tắc đặt sân có unit tests độc lập.

**Kiểm thử/hoàn thành:** toàn bộ ví dụ 30/60/90 phút, `08:00–12:00`, dải rời, giao một phần/bao trùm/chạm biên và ví dụ làm tròn trong đặc tả đều đúng. Không tạo collection theo từng ô nhỏ.

### P09 — Tạo yêu cầu đặt và chống trùng đồng thời

**Phụ thuộc:** P08 và transaction P02.

**Công việc:**

- [ ] Tạo BookingRequest, Booking dạng khoảng và PaymentOrder PENDING cùng giao dịch.
- [ ] Chốt giá/cấu hình, giữ khoảng 10 phút, tất cả Booking chung một hạn.
- [ ] Phối hợp ghi sân/ngày trước truy vấn overlap; xử lý trường hợp document phối hợp chưa tồn tại.
- [ ] Bảo vệ đồng thời với cập nhật giá/cấu hình/khóa tài khoản-cơ sở; không chỉ khóa lịch rồi đọc dữ liệu cấu hình không bảo vệ.
- [ ] Idempotency key theo actor/thao tác và fingerprint nội dung; retry trả kết quả đã có.
- [ ] API owner tạo hộ dùng cùng service và quy tắc, chỉ khác actor/nguồn/thông tin khách.
- [ ] Chưa phát hành URL VNPay thật nếu chưa tới P11; không dùng endpoint giả "mark paid" trong ứng dụng để vượt qua luồng.

**Đầu ra:** tạo đơn chờ nguyên tử và giữ đúng các khoảng bằng API.

**Kiểm thử/hoàn thành:** hai request giao giờ chỉ một request giữ được lịch; một dải lỗi thì không lưu dải còn lại; retry không tạo đơn trùng; chọn rời tạo nhiều Booking nhưng chỉ một PaymentOrder.

### P10 — Hủy chờ, hết hạn, khóa lịch và vận hành Booking

**Phụ thuộc:** P09.

**Công việc:**

- [ ] Hủy toàn bộ yêu cầu chờ và đóng PaymentOrder, không hủy một dải khi tổng tiền đang chờ trả.
- [ ] Cleanup khoảng 30 giây/lần và kiểm tra hạn trực tiếp trong thao tác đặt mới.
- [ ] Tạo/gỡ CourtBlock theo dải, dùng cùng phối hợp ghi với đặt sân.
- [ ] API danh sách/chi tiết Booking của customer, owner và admin theo quyền.
- [ ] Điều kiện completed/no-show từ CONFIRMED/PAID sau endTime; giai đoạn này test bằng fixture DB trong môi trường test, không thêm đường bỏ qua thanh toán.
- [ ] Đồng bộ ActionLog và các sự kiện trạng thái cần email; job gọi service, không tự đổi model theo đường riêng.

**Đầu ra:** backend vòng đời lịch đủ điều kiện tích hợp thanh toán.

**Kiểm thử/hoàn thành:** hold hết hạn nhả đúng, lịch sử không mất, khóa/đặt/hủy tranh chấp không tạo chồng khoảng; PENDING không thể hoàn tất; đơn đã PAID không bị cleanup nhả lịch.

### P11 — VNPay thu đủ 100% và callback đáng tin cậy

**Phụ thuộc:** P10; cấu hình merchant thử nghiệm và endpoint IPN truy cập được.

**Công việc:**

- [ ] Integration tạo/ký URL, quy đổi tổng VND × 100; hạn URL bằng holdExpiresAt.
- [ ] Tiếp tục cùng PaymentOrder còn hạn, không đổi giá/hạn hoặc tạo khoản thu song song.
- [ ] Return và IPN dùng chung logic xác minh chữ ký, merchant, tham chiếu, tiền, mã kết quả và trạng thái.
- [ ] Phân bổ một giao dịch thành công cho tất cả Booking; ghi PaymentTransaction, CONFIRMED/PAID và outbox trong transaction.
- [ ] Chống callback trùng/đồng thời, callback thất bại sau thành công, tranh chấp hủy/hết hạn và kết quả tới muộn.
- [ ] Lưu tiền sai/tiền tới muộn/thu thêm để admin xử lý; không khôi phục lịch đã nhả và không bỏ qua khoản thực nhận.
- [ ] Ngoại lệ IPN/return không yêu cầu JWT, cookie hoặc Origin SPA; mọi API khác giữ nguyên bảo vệ.
- [ ] Chạy một luồng VNPay thử nghiệm qua liên kết API và trang return tối thiểu, không cần React.

**Đầu ra:** thanh toán thử nghiệm từ đầu tới cuối, có bằng chứng callback và database.

**Kiểm thử/hoàn thành:** tiêu chí thanh toán 44–56 tương ứng qua test, gồm đóng tab vẫn nhận IPN. Chưa có credentials/IPN công khai thì ghi rõ phần tích hợp còn thiếu, làm tiếp việc không phụ thuộc nhưng không đánh dấu BE-READY.

### P12 — Hồ sơ hoàn tiền và hỗ trợ ngoại lệ

**Phụ thuộc:** P11.

**Công việc:**

- [ ] Admin hủy hỗ trợ Booking đã trả tiền theo điều kiện, tạo RefundCase và nhả lịch cùng giao dịch.
- [ ] Giữ các Booking khác trong cùng giao dịch thu vẫn hợp lệ.
- [ ] Kiểm soát tổng đã hoàn + chờ hoàn không vượt thực nhận, chống hai admin thao tác cùng lúc.
- [ ] Luồng ghi nhận bằng chứng hoàn bên ngoài và chuyển REFUNDED; không gọi API hoàn tiền tự động.
- [ ] Tra cứu khoản tới muộn/sai tiền/thu thêm, không gán nhầm tiền cho đơn khác.

**Đầu ra:** API xử lý ngoại lệ có audit, số tiền và trạng thái rõ ràng.

**Kiểm thử/hoàn thành:** không hoàn trùng/vượt tiền, không đánh dấu đã hoàn nếu thiếu bằng chứng, hủy một Booking không sửa tổng thu gốc hoặc hủy các Booking đã trả khác.

### P13 — Email nghiệp vụ, báo cáo và hoàn thiện API quản trị

**Phụ thuộc:** P12.

**Công việc:**

- [ ] Kết nối mọi sự kiện đặt thành công/hủy/hết hạn/hoàn tất/no-show/hoàn tiền với outbox.
- [ ] Email thành công chỉ sau xác minh PAID; một yêu cầu nhiều Booking có một email xác nhận cho mỗi người nhận.
- [ ] Màn hình tương lai lấy dữ liệu từ API dashboard owner/admin, thống kê đơn và tiền theo đúng bộ lọc/ngày nghiệp vụ.
- [ ] Tách số đã thu, hoàn, chờ hoàn, thu ròng; không cộng cả giao dịch tổng và Booking phân bổ hai lần.
- [ ] API email lỗi, gửi lại, tra cứu giao dịch/log và các bộ lọc/phân trang còn thiếu.
- [ ] Cập nhật ví dụ request/response, tập lệnh seed demo và OpenAPI thực tế.

**Đầu ra:** mọi chức năng backend trong phạm vi có API và tài liệu.

**Kiểm thử/hoàn thành:** đối chiếu thống kê với dữ liệu seed có đơn hủy/hoàn/không đến; lỗi mail không đổi trạng thái tiền; không lộ thông tin khách ở API công khai.

### P14 — Kiểm tra backend tổng thể và mốc BE-READY

**Phụ thuộc:** P00–P13 hoàn thành, không bỏ qua tích hợp VNPay/email.

**Công việc:**

- [ ] Chạy toàn bộ unit/integration tests trên database hỗ trợ transaction, kiểm tra lại bằng seed sạch.
- [ ] Chạy các bài tranh chấp lặp có kiểm soát: đặt–đặt, đặt–block, đặt–đổi cấu hình, callback–callback, callback–hủy, callback–hết hạn, refresh–refresh, refund–refund.
- [ ] Kiểm tra JWT/cookie/CORS/CSRF trong browser bằng fixture và cấu hình HTTPS tương đương staging; API client/Postman không thay thế bài test này.
- [ ] Kiểm thử quyền chéo giữa hai owner/hai customer và các input tự thay id/role/giá/trạng thái.
- [ ] Kiểm tra server/worker restart, job nhận lại sau lease hết hạn, callback/email gửi lại và lỗi DB; không mất lịch sử hoặc nhân đôi tiền.
- [ ] Kiểm tra API thực khớp OpenAPI, code lỗi thống nhất, log không chứa token/bí mật, lỗi không lộ stack nội bộ cho client.
- [ ] Dựng backend staging và chạy VNPay thử nghiệm với URL return/IPN thật, email thử nghiệm có nhận được.
- [ ] Lập báo cáo BE-READY ngắn có kết quả, giới hạn còn lại và bằng chứng; không chỉ ghi "đã test".

**Chỉ được bắt đầu P15 khi thỏa tất cả:**

1. Các API nghiệp vụ/auth/admin theo phạm vi đã có và test được không phụ thuộc React.
2. Không còn lỗi đã biết làm trùng sân, sai tiền, vượt quyền, sống lại phiên bị thu hồi hoặc mất dữ liệu.
3. Test tự động backend bắt buộc đều đạt; kiểm thử đồng thời kiểm tra cả dữ liệu sau cùng, không chỉ HTTP response.
4. VNPay thử nghiệm và email có luồng chạy thực; giả lập chỉ bổ sung cho các tình huống biên.
5. Refresh cookie có kiểm thử browser; JWT thu hồi và Origin/CORS có kiểm thử phủ định.
6. Seed, README, biến môi trường mẫu và OpenAPI cho phép frontend bắt đầu mà không phải đoán API.
7. 64 tiêu chí đã được ánh xạ: phần backend đã đạt; phần UI còn lại ghi rõ P15–P20, không tuyên bố hoàn tất sớm.

Nếu còn lỗi dữ liệu, phân quyền hoặc tiền, quay lại phase sở hữu lỗi và kiểm tra lại phần liên quan. Các chỉnh sửa nhỏ từ frontend sau BE-READY vẫn có thể xảy ra nhưng phải cập nhật hợp đồng và test, không đổi âm thầm.

## 4. Giai đoạn frontend — chỉ bắt đầu sau BE-READY

### P15 — Nền React, layouts và xác thực

**Phụ thuộc:** P14 đạt BE-READY.

- [ ] Khởi tạo React/Vite; router, providers, UI cơ bản, Public/Customer/Dashboard layouts.
- [ ] API client, access token trong RAM, credentials cho auth cookie, Origin/guard theo hợp đồng.
- [ ] AuthContext và bootstrap refresh; single-flight trong tab, phối hợp nhiều tab, xử lý reuse/mất phản hồi theo chính sách.
- [ ] RouteGuard/menu theo role; không coi chúng là phân quyền thay server.
- [ ] Trang login/register/verify/activate/forgot/reset/profile; GET link không tự tiêu thụ token.
- [ ] Logout hiện tại/tất cả, hiển thị session hết hạn/bị khóa và chuyển về login hợp lý.

**Đầu ra/kiểm thử:** tải lại trang giữ đăng nhập qua cookie; refresh tối đa một lần khi access hết hạn, không refresh 403; nhiều tab không tạo vòng lặp; không có token trong local/session storage. Hoàn tất phần UI của tiêu chí 63.

### P16 — Tìm sân, chi tiết và chọn ô giờ

**Phụ thuộc:** P15.

- [ ] Danh sách/lọc/phân trang cơ sở; bộ lọc URL và các trạng thái loading/empty/error.
- [ ] Chi tiết ảnh, thông tin, môn và sân con; không tạo ảnh/mức giá giả để lấp dữ liệu thiếu.
- [ ] CourtSchedule, TimeSlotCell, chú giải, chọn ngày/sân và SelectedRanges theo bước API trả về.
- [ ] Hiển thị giờ giữ chỗ/đã đặt/khóa/quá hạn đúng; chọn/bỏ chọn nhiều dải, không lấp gap.
- [ ] Chuyển sang trang xem lại với dữ liệu lựa chọn; server sẽ xác nhận lại và chốt giá.

**Đầu ra/kiểm thử:** thao tác tốt trên máy tính/điện thoại; có ví dụ 30/60/90 phút, dải liền/rời, phần dư cuối ngày và lỗi lịch đã đổi.

### P17 — Checkout, VNPay và đơn của khách

**Phụ thuộc:** P16.

- [ ] Checkout hiển thị số Booking sẽ tạo, từng dải, thành tiền, tổng tiền và chính sách.
- [ ] Tạo yêu cầu với idempotency key ổn định; retry cùng thao tác không tạo khóa mới.
- [ ] Màn chờ/đếm ngược theo expiresAt server, nút VNPay/tiếp tục/hủy cả yêu cầu chờ.
- [ ] Trang return lấy trạng thái server, có trạng thái đang xác minh/cần hỗ trợ; không tin success từ query string.
- [ ] Polling có giới hạn/tạm dừng khi rời trang, dừng khi trạng thái cuối; quay lại sau khi đóng tab vẫn xem được kết quả.
- [ ] Danh sách/chi tiết đơn, nhóm theo yêu cầu; hiển thị tiền đã trả, trạng thái hỗ trợ/hoàn và hạn chế hủy phù hợp.

**Đầu ra/kiểm thử:** một luồng React → backend → VNPay thử nghiệm → đơn PAID/email thực chạy được; mất mạng, double-click, access hết hạn và trở lại trang không sinh đơn/thu trùng.

### P18 — Giao diện owner

**Phụ thuộc:** P17.

- [ ] Dashboard, CRUD mềm cơ sở/sân, ảnh và cấu hình FacilitySport.
- [ ] Form bước giờ/giờ hoạt động có preview và thông báo các lịch cản trở đổi cấu hình.
- [ ] Lịch theo sân/ngày, tạo/gỡ block và danh sách/chi tiết đơn.
- [ ] Tạo hộ khách, hiển thị liên kết VNPay để bàn giao; không có nút tự đánh dấu tiền mặt.
- [ ] Hủy yêu cầu chờ, hoàn tất/no-show và hướng dẫn admin hỗ trợ đơn đã trả tiền.

**Đầu ra/kiểm thử:** owner vận hành cơ sở qua UI đúng quyền, không chỉnh được sân của owner khác khi thay URL; đơn/tiền hiển thị khớp API.

### P19 — Giao diện admin

**Phụ thuộc:** P18.

- [ ] Dashboard, danh mục môn, tài khoản/cấp owner, khóa/mở khóa, gửi lại mời/reset.
- [ ] Tra cứu cơ sở/Booking/Payment và audit, lọc/phân trang.
- [ ] Hồ sơ hủy hỗ trợ và hoàn tiền: xem số cần hoàn, ghi nhận bằng chứng, phân biệt đang chờ và đã hoàn.
- [ ] EmailOutbox lỗi và thao tác gửi lại/cấp link mới đúng luồng.
- [ ] Hộp thoại xác nhận hành động quan trọng, lý do bắt buộc và lỗi quyền/trạng thái đã thay đổi.

**Đầu ra/kiểm thử:** admin hoàn thành kịch bản vận hành toàn hệ thống, hai tab thao tác cùng hồ sơ không ghi trùng hoàn tiền; không lộ token/bí mật trong UI.

## 5. Tích hợp, bàn giao và phát hành thử nghiệm

### P20 — Kiểm thử cuối và RELEASE-READY

**Phụ thuộc:** P15–P19 hoàn thành.

- [ ] Chạy lại toàn bộ 64 tiêu chí với bằng chứng phù hợp, gồm phần frontend và tích hợp.
- [ ] E2E các vai trò từ cấp owner → công khai sân → khách trả tiền → phục vụ/ngoại lệ; có kiểm thử hủy chờ và hết hạn.
- [ ] Kiểm tra responsive, lỗi tải ảnh/API, timezone, giá/làm tròn, thông tin email và refresh nhiều tab.
- [ ] Kiểm tra HTTPS, reverse proxy, cookie Secure/SameSite, CORS/Origin, URL email và return/IPN ở môi trường triển khai thật.
- [ ] Kiểm tra restart API/worker, cách xem log/khôi phục môi trường test và sao lưu dữ liệu phù hợp.
- [ ] Tạo bộ dữ liệu demo, README chạy dự án, tài liệu API/database, tài khoản test bàn giao an toàn và kịch bản trình bày môn học.
- [ ] Chạy build/lint/tests bắt buộc; ghi rõ giới hạn còn lại, không đưa tính năng ngoài phạm vi vào cuối kỳ.

**Điều kiện hoàn thành:** luồng cốt lõi chạy trên môi trường bàn giao, 64 tiêu chí đã có kết quả, không còn lỗi nghiêm trọng về lịch/tiền/quyền; người khác có thể dựng và demo theo README. Không chạy kiểm thử tự động bằng tiền thật.

## 6. Cách theo dõi tiến độ

Tiến độ thực tế ghi tại `docs/planning/phase-status.json` theo các trạng thái `NOT_STARTED / IN_PROGRESS / VERIFYING / READY_FOR_REVIEW / NEEDS_CHANGES / BLOCKED / ACCEPTED`. Ý nghĩa, quyền chuyển trạng thái và các mẫu prompt nằm trong [hướng dẫn giao việc AI](../guides/ai-workflow.md). Không tick checklist chỉ vì đã có file hoặc endpoint.

Agent triển khai kết thúc ở `READY_FOR_REVIEW`; người dùng hoặc reviewer được giao quyền nghiệm thu riêng mới ghi `ACCEPTED`. Mặc định chỉ giao một phase mỗi lần; không tự chuyển phase. Trạng thái gate BE-READY/RELEASE-READY lưu bằng khóa `BE_READY`/`RELEASE_READY`; báo cáo đúng phiên bản là điều kiện để mở gate, không chỉ đổi giá trị JSON.

Trước khi thực hiện, tạo hợp đồng và checklist của phase trong `docs/phase-reports/Pxx.md` từ `TEMPLATE.md`. Mỗi đầu việc gắn đầu ra/cách kiểm chứng; khi bàn giao ghi phiên bản, lệnh thực chạy, môi trường, kết quả và phần còn thiếu. Review riêng ghi tại `Pxx-review.md`.

Đầu ra của một phase nên kèm:

- Mã nguồn hoàn chỉnh cho nhóm nghiệp vụ, không có nhánh giả bỏ qua auth/thanh toán.
- Tài liệu API và ví dụ cập nhật cùng thay đổi.
- Kiểm thử có ý nghĩa cho quy tắc hoặc rủi ro của phase.
- Kết quả chạy thực và ghi chú môi trường/phần chưa xác minh.

Mặc định làm tuần tự P00 → P20 và nghiệm thu phase trước rồi mới triển khai phase sau. Nếu người dùng yêu cầu nhiều agent, chia các đầu việc trong cùng phase theo nhóm nghiệp vụ xuyên layer, chỉ định phạm vi file và một agent tích hợp; không cho hai agent tự sửa hợp đồng/status đồng thời. Việc phân công không mở đường làm frontend trước BE-READY.

**Điểm bắt đầu tiếp theo:** P00 — chốt hợp đồng và môi trường. Tài liệu kế hoạch không tự tạo goal, lịch chạy nền hoặc triển khai code; thực hiện phase khi bắt đầu công việc phát triển tương ứng.
