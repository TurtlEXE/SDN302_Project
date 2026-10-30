# Đặc tả tính năng platform đặt sân thể thao

> Phạm vi: dự án môn học Node.js, tập trung vào nghiệp vụ đặt sân cơ bản.
> Ngày biên soạn: 27/10/2026.
> Cập nhật: 28/10/2026 — email, bước giờ theo môn tại địa điểm, Booking lưu theo khoảng đã gộp và thu đủ tiền qua VNPay ngay khi đặt.
> Bổ sung: JWT/cookie theo `docs/architecture.md` mục 10; kế hoạch backend trước, frontend sau tại `docs/planning/development-plan.md`.
> Tham khảo mã nguồn SportHub tại `F:\FPT\OJT\Mock Project\SportHub\sport-hub`.
> Đây là đặc tả đề xuất cho dự án mới, không phải mô tả nguyên trạng hoặc xác nhận toàn bộ chức năng của dự án cũ đã chạy đúng.

## 1. Mục tiêu và phạm vi

Xây dựng website kết nối người có nhu cầu chơi thể thao với các chủ sân. Khách hàng tìm cơ sở, xem sân còn trống, đặt sân và quản lý lịch đặt. Chủ sân đăng thông tin cơ sở, quản lý sân con, giá thuê và lịch đặt. Admin cấp tài khoản chủ sân và quản lý hoạt động chung.

### 1.1. Các yêu cầu đã chốt theo đề bài

- Không thu hoa hồng trên đơn đặt sân.
- Chủ sân làm việc với admin bên ngoài hệ thống; sau khi thống nhất, admin cấp tài khoản có vai trò `OWNER`.
- Không có chức năng tự đăng ký làm chủ sân, gửi hồ sơ hợp tác hoặc xét duyệt hợp đồng trực tuyến.
- Không có voucher, mã giảm giá hoặc các chức năng mở rộng không phục vụ trực tiếp việc đặt sân.
- Tài liệu bao phủ đầy đủ luồng cơ bản từ đăng sân đến đặt sân, hủy và hoàn tất đơn.
- Có email xác thực đăng ký và gửi thông báo nghiệp vụ.
- Owner cấu hình bước giờ 30, 60 hoặc 90 phút theo từng môn thể thao tại từng địa điểm; các sân con cùng nhóm dùng chung cấu hình.
- Các ô giờ liên tiếp được gộp thành một khoảng khi lưu database; chỉ tách các khoảng không liền nhau. Không lưu một bản ghi chiếm lịch cho từng ô trên giao diện.
- Hệ thống thu 100% tiền thuê sân qua VNPay tại bước đặt; chỉ xác nhận đơn sau khi server xác minh thanh toán thành công. Không thu lại tiền tại sân.
- Xác thực API bằng JWT; refresh token lưu trong cookie HttpOnly, có quản lý/thu hồi phiên ở server. Hoàn thiện backend và đạt mốc BE-READY trước khi xây frontend React.

### 1.2. Các lựa chọn đơn giản hóa đề xuất cho bản đầu

Các quy tắc dưới đây là lựa chọn cho dự án mới, không phải yêu cầu có sẵn của môn học hoặc quy tắc được sao chép nguyên trạng từ SportHub:

- Chỉ có ba vai trò tài khoản: `CUSTOMER`, `OWNER`, `ADMIN`. Khách vãng lai là người chưa đăng nhập, không phải vai trò lưu trong cơ sở dữ liệu.
- Khách hàng phải xác thực email và đăng nhập để tự đặt sân trực tuyến.
- Owner đã được admin cấp tài khoản được tự đăng cơ sở; không cần thêm vòng admin duyệt từng cơ sở.
- Sau khi kiểm tra lịch, tạo đơn `PENDING_PAYMENT` và giữ các khoảng tối đa 10 phút để thanh toán. Thanh toán đủ và hợp lệ mới chuyển thành `CONFIRMED/PAID`; owner không cần duyệt từng đơn.
- Một BookingRequest có một PaymentOrder thanh toán toàn bộ tổng tiền các Booking bằng VNPay. Không trả từng phần, trả sau hoặc trả bằng tiền mặt trong phạm vi bản mới.
- Mỗi lần xác nhận đặt chọn một sân con trong một ngày, có thể chọn nhiều ô liên tiếp hoặc không liên tiếp. Server gộp từng dải liên tiếp thành một Booking riêng; một lần xác nhận có thể trả về nhiều mã đơn.
- Mỗi Booking chỉ có một khoảng `startTime–endTime`. Khi chờ thanh toán, hủy theo toàn bộ yêu cầu; sau khi đã trả tiền, các Booking được hoàn tất hoặc hủy hỗ trợ độc lập theo điều kiện tương ứng. Các đơn cùng lần xác nhận có chung mã yêu cầu để tra cứu.
- Bảng giá theo khung giờ và loại ngày (ngày thường thứ Hai–thứ Sáu, cuối tuần thứ Bảy–Chủ nhật theo Asia/Ho_Chi_Minh) của từng sân; khoảng chơi đi qua nhiều mức giá được chia đoạn tính tiền chính xác theo từng mức giá áp dụng và lưu snapshot chi tiết từng đoạn (pricingSnapshot). Báo giá chính thức do server tính.
- Cơ sở cấu hình giờ mở/đóng hoặc trạng thái nghỉ cho từng ngày trong tuần (thứ Hai đến Chủ nhật). Không hỗ trợ lịch qua đêm; giờ đóng cửa tối đa 23:00. Ô giờ bắt đầu từ giờ mở cửa của ngày được chọn; phần dư cuối ngày không đủ một bước giờ không cho đặt.
- Được đặt từ hôm nay đến hết ngày thứ 30 tính từ hôm nay; giờ bắt đầu sớm nhất phải cách thời điểm tạo yêu cầu ít nhất 15 phút để có đủ cửa sổ thanh toán 10 phút. Đây là quy tắc đề xuất cho bản mới.
- Khách tự hủy toàn bộ yêu cầu khi còn chờ thanh toán. Đơn đã trả tiền không tự hủy theo mốc 2 giờ; khách liên hệ hỗ trợ, theo phạm vi mã nguồn hiện chỉ hỗ trợ tự hủy đơn chờ. Hủy do cơ sở không thể phục vụ và hoàn tiền thủ công được mô tả ở mục 8.7.
- Dùng tiếng Việt, tiền Việt Nam và múi giờ `Asia/Ho_Chi_Minh` cho nghiệp vụ.
- Xác thực đăng ký, kích hoạt owner và khôi phục mật khẩu bằng liên kết dùng một lần gửi qua email. Không tích hợp SMS.

## 2. Khái niệm nghiệp vụ

- **Cơ sở sân thể thao — Facility:** một địa điểm kinh doanh, có tên, địa chỉ, thông tin liên hệ và giờ hoạt động. Ví dụ: Trung tâm thể thao An Bình.
- **Nhóm môn tại địa điểm — FacilitySport:** một cặp cơ sở và môn thể thao, chứa cấu hình bước giờ `slotStepMinutes ∈ {30, 60, 90}`. Ví dụ cùng địa điểm, cầu lông bước 30 phút, bóng đá bước 90 phút.
- **Sân con — Court:** sân cụ thể mà khách đặt, ví dụ Sân cầu lông số 1. Mỗi sân con thuộc đúng một FacilitySport, từ đó xác định cơ sở, môn thể thao và bước giờ. Bản đầu không cấu hình bước giờ riêng cho từng sân con trong cùng nhóm.
- **Môn thể thao — Sport:** danh mục do admin quản lý, ví dụ bóng đá, cầu lông, tennis, pickleball.
- **Ô giờ lựa chọn — Slot:** ô 30/60/90 phút được sinh trên giao diện từ cấu hình FacilitySport; không phải bản ghi bắt buộc lưu trong database.
- **Đơn đặt sân — Booking:** một khoảng liên tục trên một sân trong một ngày, có thông tin người đặt, giờ bắt đầu/kết thúc, thời lượng phút, giá tại thời điểm đặt và trạng thái xử lý.
- **Yêu cầu đặt — BookingRequest:** một lần người dùng xác nhận lựa chọn; có thể tạo một hoặc nhiều Booking nếu các khoảng được chọn rời nhau. Các Booking của yêu cầu phải được tạo cùng thành công hoặc cùng thất bại.
- **Yêu cầu thanh toán — PaymentOrder:** tổng tiền cố định của một BookingRequest, mã tham chiếu VNPay duy nhất và hạn thanh toán. Một lần thanh toán thành công xác nhận toàn bộ Booking thuộc yêu cầu; sau đó các Booking có thể hoàn tất/hủy hỗ trợ độc lập.
- **Lịch khóa sân — Court block:** khoảng thời gian owner chủ động không nhận đặt, ví dụ bảo trì hoặc nghỉ đột xuất.

Một owner có thể quản lý nhiều cơ sở. Một cơ sở có nhiều FacilitySport; mỗi FacilitySport có nhiều sân con. Mỗi cặp cơ sở/môn chỉ có một cấu hình; cùng một môn ở địa điểm khác có thể dùng bước giờ khác. Một tài khoản chỉ mang một vai trò trong bản đầu; owner muốn tự đặt sân với tư cách khách hàng dùng tài khoản customer riêng.

## 3. Tính năng dùng chung và tài khoản

### AUTH-01. Đăng ký khách hàng

- Nhập họ tên, email, số điện thoại, mật khẩu và xác nhận mật khẩu.
- Email được chuẩn hóa và không được trùng với tài khoản đã có.
- Kiểm tra định dạng email, số điện thoại; mật khẩu tối thiểu 8 ký tự.
- Server luôn gán vai trò `CUSTOMER`; người đăng ký không được tự truyền vai trò owner hoặc admin.
- Sau khi gửi đăng ký, tạo tài khoản chưa xác thực và gửi liên kết xác thực email, hiệu lực 15 phút, chỉ dùng một lần.
- Khi xác thực thành công, cập nhật `emailVerifiedAt`; khách mới được đăng nhập và sử dụng chức năng đặt sân.
- Có màn hình gửi lại email; mỗi lần cách nhau ít nhất 60 giây, giới hạn số lần theo email/IP, liên kết cũ bị vô hiệu khi cấp liên kết mới.
- Đăng ký lại email chưa xác thực không tạo thêm tài khoản hoặc tự ghi đè mật khẩu; hướng dẫn gửi lại xác thực hoặc đặt lại mật khẩu.

### AUTH-02. Đăng nhập và đăng xuất

- Đăng nhập bằng email và mật khẩu.
- Customer chưa xác thực hoặc owner chưa hoàn tất kích hoạt chỉ được dùng các luồng xác thực/kích hoạt/khôi phục tài khoản phù hợp, không được truy cập chức năng cần đăng nhập. Tài khoản admin ban đầu được thiết lập với email quản trị đã xác minh.
- Điều hướng tới khu vực phù hợp với vai trò.
- Tài khoản bị khóa không được đăng nhập; phiên đang tồn tại cũng không được tiếp tục thực hiện các thao tác cần đăng nhập.
- Đăng xuất chấm dứt phiên sử dụng hiện tại.
- Thông báo lỗi rõ ràng khi thông tin không hợp lệ hoặc phiên hết hạn.

### AUTH-03. Quản lý hồ sơ cá nhân

- Xem họ tên, email, số điện thoại và vai trò của mình.
- Cập nhật họ tên và số điện thoại; không cho tự sửa vai trò hoặc trạng thái tài khoản.
- Bản đầu không hỗ trợ tự đổi email để tránh thêm quy trình xác minh email mới.
- Thay đổi hồ sơ không sửa thông tin người liên hệ đã lưu trong các đơn cũ.

### AUTH-04. Đổi và đặt lại mật khẩu

- Người dùng đổi mật khẩu bằng cách nhập mật khẩu hiện tại và mật khẩu mới.
- Người quên mật khẩu nhập email để nhận liên kết đặt lại, hiệu lực 15 phút và dùng một lần; phản hồi chung không tiết lộ email có tồn tại hay không.
- Admin hỗ trợ bằng cách yêu cầu hệ thống gửi liên kết đặt lại; không xem, cấp hoặc gửi mật khẩu dạng văn bản qua email.
- Owner do admin tạo nhận liên kết kích hoạt hiệu lực 24 giờ để xác nhận email và tự đặt mật khẩu đầu tiên. Chỉ owner đã kích hoạt mới được quản lý cơ sở.
- Owner chưa kích hoạt sử dụng gửi lại lời mời thay cho đặt lại mật khẩu. Đổi/đặt lại mật khẩu vô hiệu tất cả token đặt lại còn tồn tại; mọi lần cấp lại token cùng mục đích đều vô hiệu token trước, có giới hạn tần suất như xác thực email.
- Token phải ngẫu nhiên, lưu dạng băm, đúng mục đích và tài khoản, có hạn dùng; thao tác sử dụng token phải nguyên tử. Đặt lại mật khẩu không tự xác thực email chưa xác thực và không mở khóa tài khoản bị admin khóa.
- Đổi hoặc đặt lại mật khẩu làm mất hiệu lực các phiên cũ. Không hiển thị mật khẩu đã lưu.

### AUTH-05. Email thông báo nghiệp vụ

- Gửi email xác thực đăng ký, kích hoạt owner và đặt lại mật khẩu theo các luồng trên.
- Chỉ sau khi server xác minh thanh toán đủ và chuyển đơn thành `CONFIRMED/PAID`, gửi xác nhận đặt sân/thanh toán cho customer và owner. Một yêu cầu nhiều Booking được thông báo chung, liệt kê mã đơn, khoảng giờ, số tiền, tổng đã trả và mã giao dịch VNPay.
- Khi hủy, hết hạn giữ chỗ, hoàn tất, đánh dấu không đến hoặc cập nhật hoàn tiền, gửi thông báo cho customer và owner; nêu trạng thái thực tế, lý do và số tiền liên quan. Không gửi xác nhận thành công chỉ vì đã tạo đơn chờ hoặc đã chuyển hướng sang VNPay.
- Gửi thông báo khóa/mở khóa tài khoản tới tài khoản liên quan; khóa/mở khóa cơ sở tới owner. Không gửi email quảng cáo hoặc nhắc lịch định kỳ trong bản đầu.
- Đơn owner tạo cho khách ngoài hệ thống chỉ gửi đến owner; không tự gửi thông tin đặt sân tới địa chỉ email chưa được xác minh hoặc tự ghép email/số điện thoại với tài khoản khác.
- Lưu sự kiện gửi email cùng giao dịch thay đổi dữ liệu, chỉ thực sự gửi sau khi giao dịch thành công. Gửi lỗi không làm mất hoặc hủy đơn đã tạo; giao diện luôn tra cứu được kết quả từ database.
- Hàng đợi gửi email lưu trạng thái, số lần thử và lỗi; tự thử lại tối đa 3 lần với khoảng chờ tăng dần, sau đó admin có thể kiểm tra/gửi lại. Không gửi liên kết đã hết hạn; người dùng phải xin liên kết mới.
- Mỗi sự kiện/người nhận có khóa duy nhất để không tạo trùng tác vụ. Nếu nhà cung cấp không hỗ trợ chống gửi trùng, timeout sau khi đã gửi có thể gây email lặp; việc thử lại tuyệt đối không tạo lại Booking hoặc đổi trạng thái lần nữa.
- Email phản ánh sự kiện tại thời điểm phát sinh, có thời điểm và liên kết xem trạng thái hiện tại; không coi một email đến chậm là nguồn trạng thái mới nhất.

### AUTH-06. JWT, refresh cookie và quản lý phiên

- Access token là JWT hạn 10 phút, client giữ trong bộ nhớ và gửi qua Authorization Bearer; không lưu vào localStorage/sessionStorage.
- Refresh token là chuỗi ngẫu nhiên, server lưu hash; client chỉ nhận qua cookie HttpOnly, Secure trên HTTPS, SameSite=Lax và Path=/api/v1/auth, không đặt Domain. Cookie không được dùng thay JWT để gọi API nghiệp vụ.
- Phiên có hạn tuyệt đối 7 ngày; refresh không kéo dài vượt hạn này. Refresh token được đổi sau mỗi lần sử dụng thành công và token cũ không sử dụng lại được.
- Server kiểm tra chữ ký/claims JWT, trạng thái AuthSession và User trong mỗi API cần đăng nhập; logout phải thu hồi sid, không chỉ xóa token trên giao diện. Đổi/reset mật khẩu, logout-all hoặc khóa tài khoản thu hồi tất cả phiên và tăng tokenVersion.
- Người dùng có thể đăng xuất phiên hiện tại hoặc tất cả phiên; mở khóa tài khoản phải đăng nhập lại. Khi phiên bị thu hồi, JWT cũ dù chưa đến exp cũng không được dùng tiếp ở yêu cầu mới.
- Tải lại trang dùng refresh cookie để lấy access token mới; client không tự tạo token hoặc tin role từ dữ liệu trình duyệt. Refresh đồng thời/reuse xử lý theo mục 10 của tài liệu cấu trúc.
- Login/refresh/logout và các POST auth có kiểm tra Origin, custom header X-CSRF-Guard và JSON; CORS giới hạn chính xác origin. VNPay IPN/return không phụ thuộc JWT/cookie này và được xác thực riêng bằng dữ liệu thanh toán.
- AuthToken email là token dùng một lần, tách biệt access/refresh token. Mở link qua GET không tự xác thực/reset; trang xác nhận gửi POST để tránh công cụ quét link tiêu thụ token.
- Thiết kế chi tiết về cookie local/production, rotation, thu hồi, CSRF và endpoint nằm tại `docs/architecture.md` mục 10; không cần thêm một cơ chế session đăng nhập khác song song.

## 4. Tính năng khách vãng lai

### PUB-01. Xem danh sách cơ sở

- Hiển thị tên, ảnh đại diện, khu vực, các môn thể thao và giá thuê từ thấp nhất theo giờ.
- Chỉ hiển thị cơ sở được công khai, không bị admin khóa, có owner đang hoạt động và có ít nhất một sân đang nhận đặt.
- Có phân trang và thông báo khi không có kết quả.

### PUB-02. Tìm kiếm và lọc

- Tìm theo tên cơ sở hoặc nội dung địa chỉ.
- Lọc theo môn thể thao và tỉnh/thành phố do dự án quản lý trong dữ liệu địa điểm.
- Lọc theo khoảng giá trên giờ; cơ sở thỏa điều kiện nếu có ít nhất một sân đang nhận đặt phù hợp với toàn bộ bộ lọc môn và giá.
- Sắp xếp theo tên hoặc giá tăng/giảm; giá dùng để sắp xếp là giá thấp nhất của các sân phù hợp bộ lọc.
- Có thể kết hợp bộ lọc và xóa bộ lọc.
- Việc tìm sân trống được thực hiện trong trang chi tiết; không bắt buộc tìm lịch trống trên toàn bộ platform.

### PUB-03. Xem chi tiết cơ sở và sân

- Xem mô tả, địa chỉ đầy đủ, số điện thoại liên hệ, giờ mở/đóng cửa và hình ảnh.
- Xem danh sách sân con, môn thể thao, mô tả và giá trên giờ.
- Hiển thị yêu cầu trả trước 100% bằng VNPay, thời hạn giữ chỗ, quy định hủy và hỗ trợ hoàn tiền.
- Không công khai dữ liệu người đặt hoặc thông tin tài khoản quản trị của owner.

### PUB-04. Xem lịch trống

- Chọn ngày và sân con để xem các ô theo bước giờ của FacilitySport tương ứng, bắt đầu từ giờ mở cửa của cơ sở.
- Một ô bị chặn nếu giao với Booking đang giữ chỗ còn hạn, Booking đã xác nhận hoặc lịch khóa còn hiệu lực; frontend dựng các ô từ khoảng đã lưu. Hiển thị rõ đang giữ chỗ và đã đặt; không tiết lộ thông tin khách.
- Ví dụ cầu lông bước 30 phút hiển thị `06:00–06:30`, `06:30–07:00`; bóng đá bước 90 phút hiển thị `06:00–07:30`, `07:30–09:00`.
- Phân biệt: còn trống, đã có người đặt, bị khóa/ngừng nhận đặt và đã qua giờ.
- Khung đã qua giờ hoặc ngoài phạm vi cho phép không chọn được.
- Khi bấm đặt sân, yêu cầu đăng nhập; giữ lựa chọn nếu có thể nhưng phải kiểm tra lại lịch sau đăng nhập.
- Lịch công khai chỉ hiển thị tình trạng, không hiển thị tên hoặc số điện thoại khách đã đặt.

## 5. Tính năng khách hàng — CUSTOMER

Khách hàng có tất cả chức năng công khai và các chức năng sau.

### CUS-01. Tạo đơn đặt sân

1. Chọn cơ sở, môn thể thao, sân con và ngày chơi.
2. Chọn một hoặc nhiều ô còn trống trên cùng sân và ngày, cho phép các dải không liền nhau.
3. Nhập hoặc xác nhận tên người liên hệ, số điện thoại và ghi chú tùy chọn.
4. Xem lại các khoảng sau khi gộp, số đơn sẽ tạo, thời lượng/đơn giá/thành tiền từng đơn và tổng tiền của lần xác nhận.
5. Xác nhận chính sách hủy và thanh toán ngay 100% tổng tiền bằng VNPay.
6. Gửi yêu cầu đặt; server kiểm tra điều kiện và tính lại tiền.
7. Server gộp các ô sát nhau; tạo BookingRequest, một Booking `PENDING_PAYMENT/UNPAID` cho mỗi dải và PaymentOrder chung trong cùng giao dịch. Các Booking chung `holdExpiresAt = createdAt + 10 phút`.
8. Hiển thị mã yêu cầu, danh sách đơn chờ và đếm ngược; chuyển sang trang VNPay để thanh toán toàn bộ số tiền đã chốt.
9. Server xử lý kết quả hợp lệ từ VNPay; thành công trong hạn thì chuyển tất cả Booking của yêu cầu sang `CONFIRMED/PAID`, lưu giao dịch và gửi email xác nhận.
10. Trang kết quả đọc trạng thái từ server; nếu chưa nhận/xử lý xong kết quả thì hiển thị đang xác minh, không tự báo thành công.

Điều kiện xử lý:

- Không cho đặt sân thuộc cơ sở/owner đang bị khóa hoặc sân ngừng nhận đặt.
- Không nhận giờ trong quá khứ, ngoài giờ mở cửa hoặc giao với lịch đã đặt/lịch khóa sân.
- Chọn ô trên giao diện chưa giữ chỗ. Tạo đơn chờ thành công mới giữ khoảng tạm thời; thanh toán đủ hợp lệ mới xác nhận đặt sân.
- Nếu một khoảng vừa bị người khác đặt, không tạo bất kỳ đơn nào của lần xác nhận đó; thông báo để khách chọn lại.
- Nếu giá, giờ hoạt động hoặc bước giờ đã thay đổi so với bước xem lại, trả cấu hình/giá mới và yêu cầu khách chọn hoặc xác nhận lại; không âm thầm đổi lựa chọn.
- Không tự lấp khoảng trống: chọn `06:00–07:00` và `08:00–09:00` phải thành hai Booking, giờ `07:00–08:00` vẫn trống.
- Chỉ gộp trong cùng yêu cầu; không ghép vào đơn đã có từ lần đặt trước, kể cả cùng khách và giờ sát nhau.
- Thành công hay thất bại đều có thông báo trên giao diện; email xác nhận chỉ phát sinh sau giao dịch ghi nhận thanh toán và xác nhận toàn bộ Booking.
- Trở lại đơn chờ có thể tiếp tục mở cùng liên kết VNPay nếu PaymentOrder còn `PENDING` và chưa hết hạn; không gia hạn hoặc tạo thêm yêu cầu thu tiền song song. Hủy ở trang ngân hàng không đồng nghĩa hệ thống đã nhận kết quả cuối cùng.
- Khi kết quả thất bại đã được server xác minh, hoặc yêu cầu đã hủy/hết hạn, muốn đặt lại phải tạo BookingRequest mới và kiểm tra lịch lại; không khôi phục yêu cầu cũ bằng cách mở lại liên kết.

### CUS-02. Xem danh sách và chi tiết đơn

- Chỉ xem các đơn gắn với tài khoản của mình.
- Chia đơn sắp tới và lịch sử; lọc theo trạng thái hoặc ngày chơi, có phân trang.
- Chi tiết gồm mã đơn, cơ sở, sân, môn thể thao, địa chỉ, số liên hệ chủ sân, ngày giờ, người liên hệ, tổng tiền và trạng thái.
- Xem lý do, người thực hiện và thời điểm hủy nếu đơn đã bị hủy.
- Đơn vẫn xem được khi cơ sở/sân ngừng công khai.
- Các đơn cùng lần xác nhận có thể hiển thị chung nhóm theo BookingRequest nhưng mỗi đơn vẫn có mã, giá và trạng thái riêng.
- Hiển thị hạn thanh toán, nút tiếp tục thanh toán của nhóm đang chờ, số tiền đã thanh toán, mã giao dịch và trạng thái hoàn tiền/hỗ trợ nếu có. Số tiền Booking là phần phân bổ của một giao dịch chung, không phải một giao dịch VNPay riêng cho mỗi dải.

### CUS-03. Hủy đơn

- Khách chỉ tự hủy khi yêu cầu của mình đang `PENDING_PAYMENT` và chưa được ghi nhận thanh toán thành công. Nhập lý do và xác nhận.
- Khi đang chờ trả tiền, hủy toàn bộ BookingRequest cùng tất cả Booking con và đóng PaymentOrder trong cùng giao dịch; không hủy riêng một dải vì liên kết VNPay đang mang tổng tiền cố định.
- Toàn bộ khoảng giữ được nhả; gửi email trạng thái. Nếu VNPay báo đã thu tiền sau khi yêu cầu đã đóng, chuyển sang hỗ trợ hoàn tiền, không phục hồi lịch.
- Đơn `CONFIRMED/PAID` không có nút tự hủy; hiển thị cách liên hệ owner/admin. Không giữ quy tắc tự hủy trước 2 giờ của bản trả tiền tại sân.
- Trường hợp cơ sở không thể phục vụ, admin xử lý hủy từng Booking đã trả tiền và tạo hồ sơ hoàn đủ tiền của Booking đó theo mục 8.7; các Booking khác đã xác nhận không bị hủy theo.
- Không đổi sân/giờ hoặc sửa tổng tiền của PaymentOrder đã phát hành. Muốn thay lựa chọn khi chưa trả tiền thì hủy cả yêu cầu và đặt lại; không cam kết giữ được lịch mới.

## 6. Tính năng chủ sân — OWNER

### OWN-01. Nhận tài khoản và truy cập khu vực owner

- Nhận email mời từ tài khoản admin đã cấp, xác nhận email và đặt mật khẩu để kích hoạt; sau đó đăng nhập khu vực owner.
- Xem/cập nhật thông tin cá nhân.
- Chỉ quản lý cơ sở, sân, lịch khóa và đơn thuộc mình; kiểm tra quyền ở server cho mọi thao tác.
- Không có chức năng tạo nhân viên hoặc phân quyền nhân viên.

### OWN-02. Quản lý cơ sở

- Xem danh sách và chi tiết các cơ sở của mình.
- Tạo cơ sở với tên, mô tả, địa chỉ, tỉnh/thành phố, số điện thoại liên hệ, giờ mở/đóng cửa và ảnh.
- Địa chỉ chi tiết có thể lưu dạng văn bản; không yêu cầu tích hợp dịch vụ bản đồ hoặc API hành chính.
- Cơ sở mới ở trạng thái `DRAFT`, owner hoàn thiện rồi công khai khi có ít nhất một sân hợp lệ đang nhận đặt.
- Sửa thông tin; chuyển sang `PUBLISHED` để công khai hoặc `PAUSED` để dừng nhận đơn mới.
- Có thể ngừng công khai mà vẫn giữ các đơn đã xác nhận và xem lịch sử.
- Không có duyệt cơ sở `PENDING/APPROVED/REJECTED` trong bản mới. Admin vẫn có quyền khóa cơ sở khi cần.
- Không xóa cứng cơ sở đã có đơn. Bản đầu dùng ngừng công khai thay cho chức năng xóa.

### OWN-03. Quản lý hình ảnh

- Thêm/xóa ảnh cơ sở và chọn một ảnh đại diện.
- Chấp nhận JPG, PNG, WebP; tối đa 5 MB/ảnh và 10 ảnh/cơ sở.
- Khi xóa ảnh đại diện, chọn ảnh khác hoặc dùng ảnh mặc định.
- Server kiểm tra loại và kích thước tệp; chỉ owner của cơ sở được chỉnh ảnh.

### OWN-04. Quản lý sân con

- Thêm, xem và sửa sân con thuộc cơ sở của mình.
- Thông tin gồm tên/mã sân, FacilitySport, mô tả, giá theo giờ và trạng thái nhận đặt. Sân dùng bước giờ đã cấu hình cho nhóm môn tại cơ sở.
- Tên sân không trùng trong cùng cơ sở; giá là số nguyên VND lớn hơn 0.
- Bật/tắt nhận đặt riêng cho từng sân.
- Không đổi FacilitySport của sân đã tạo để tránh chuyển lịch sang nhóm khác; tạo sân mới nếu cần đổi cơ sở hoặc môn thể thao.
- Không xóa cứng sân đã có đơn; tắt nhận đặt để giữ lịch sử.

### OWN-05. Quản lý giá và giờ hoạt động

- Owner thêm môn thể thao vào cơ sở và đặt `slotStepMinutes` bằng 30, 60 hoặc 90. Mỗi cặp cơ sở/môn chỉ có một FacilitySport; tất cả sân con thuộc nhóm sử dụng cấu hình đó.
- Giờ mở cửa là mốc gốc: các ô có dạng `[openTime + n × step, openTime + (n+1) × step)`, chỉ sinh khi giờ kết thúc không vượt giờ đóng cửa.
- Bắt buộc giờ mở nhỏ hơn giờ đóng và mỗi nhóm môn đang có sân nhận đặt sinh được ít nhất một ô trọn vẹn. Từ chối cấu hình làm toàn bộ thời gian hoạt động ngắn hơn bước giờ của nhóm.
- Ví dụ mở `06:00–23:00`, bước 90 phút: ô cuối hợp lệ là `21:00–22:30`; đoạn `22:30–23:00` không đủ 90 phút nên không nhận đặt. Giao diện cấu hình phải hiển thị phần thời gian dư này.
- Đặt một mức giá theo giờ cho mỗi sân con.
- Mức giá mới áp dụng cho yêu cầu tạo đơn sau khi cập nhật; không thay đổi giá của đơn cũ.
- Để tránh đổi mốc chia ô làm hỏng lịch đã nhận, chỉ cho đổi bước giờ khi tất cả sân trong FacilitySport không còn Booking `PENDING_PAYMENT` đang giữ chỗ còn hạn, Booking `CONFIRMED` có giờ kết thúc sau hiện tại và lịch khóa hiệu lực có giờ kết thúc sau hiện tại.
- Tương tự, chỉ cho đổi giờ mở/đóng cửa khi toàn cơ sở không còn các Booking/lịch khóa chưa kết thúc nói trên. Hiển thị các lịch cản trở để owner chờ chúng kết thúc hoặc chủ động xử lý; không tự hủy đơn để đổi cấu hình.
- Không sửa thời gian hoặc chia lại Booking cũ khi cấu hình thay đổi; lưu bước giờ và mốc mở cửa tại lúc đặt để tra cứu lịch sử.
- Mỗi lần sửa cấu hình lịch tăng phiên bản; yêu cầu đặt từ màn hình dùng phiên bản cũ phải tải lại và xác nhận lại.
- Không có bảng giá theo mùa, ngày lễ, giờ cao điểm hoặc cơ chế định giá tự động.

### OWN-06. Xem lịch và khóa thời gian không nhận đặt

- Xem lịch theo ngày, cơ sở và sân con.
- Phân biệt lịch đã đặt, giờ còn trống và giờ bị khóa.
- Khóa một hoặc nhiều ô của một sân vào một ngày, kèm lý do; gộp các ô liền nhau thành một CourtBlock, tách các dải rời nhau. Chỉ khóa khoảng chưa bắt đầu và trong phạm vi lịch đặt 30 ngày.
- Có thể khóa cả ngày bằng cách chọn toàn bộ ô nhận đặt hợp lệ; phần dư cuối ngày vốn không nhận đặt. Không có lịch lặp hằng tuần.
- Không được tạo lịch khóa đè lên đơn đang giữ chỗ còn hạn, đơn đã xác nhận hoặc lịch khóa khác.
- Muốn đóng sân có lịch, owner xử lý hủy toàn bộ yêu cầu chưa thanh toán hoặc liên hệ admin hủy/hỗ trợ hoàn tiền từng đơn đã thanh toán, rồi mới tạo lịch khóa; không tự nhả lịch đã thu tiền.
- Mở lại lịch khóa khi không còn cần; việc mở khóa không khôi phục các đơn đã hủy.

### OWN-07. Quản lý đơn đặt sân

- Xem các đơn của cơ sở thuộc mình; tìm bằng mã đơn, tên hoặc số điện thoại người liên hệ.
- Lọc theo cơ sở, sân con, ngày chơi và trạng thái.
- Xem thông tin liên hệ cần thiết để phục vụ khách.
- Có thể hủy toàn bộ yêu cầu chờ thanh toán thuộc cơ sở mình, kèm lý do; không hủy lẻ một Booking khi PaymentOrder chung còn mở.
- Đơn đã trả tiền cần hủy vì cơ sở không phục vụ được phải chuyển admin xử lý hủy/hoàn tiền; owner không tự đánh dấu tiền đã hoàn. Với thay đổi gấp, liên hệ trực tiếp thêm ngoài email.
- Sau giờ kết thúc, ghi nhận đã phục vụ hoặc khách không đến; tiền đã được thu qua VNPay từ lúc đặt, không phát sinh thu thêm.
- Không sửa sân, ngày giờ, người đặt hoặc tổng tiền của đơn đã tạo. Các ngoại lệ hủy có tiền đi theo mục 8.7.

### OWN-08. Ghi nhận đơn đặt qua điện thoại/tại sân

- Owner có thể tạo đơn cho khách đặt ngoài hệ thống để lịch trực tuyến không bán trùng.
- Nhập tên, số điện thoại khách, sân, ngày và khung giờ.
- Áp dụng cùng quy tắc giá, giờ hoạt động và chống trùng lịch như đơn trực tuyến.
- Dùng cùng quy tắc gộp các ô liền nhau thành Booking riêng, tách dải rời nhau và tạo toàn bộ yêu cầu trong một giao dịch.
- Đơn tạo ở trạng thái `PENDING_PAYMENT/UNPAID`, nguồn `OWNER_CREATED`, có PaymentOrder VNPay và hạn giữ chỗ 10 phút giống đặt trực tuyến.
- Owner đưa liên kết thanh toán cho khách qua kênh liên hệ ngoài hệ thống. Trang thanh toán dùng mã truy cập ngẫu nhiên đủ mạnh gắn với yêu cầu, không cho tra cứu bằng mã đơn đoán được; chỉ lộ thông tin cần thanh toán. Thanh toán đủ mới xác nhận, không có nút owner tự đánh dấu đã trả tiền hoặc nhận tiền mặt.
- Không yêu cầu khách có tài khoản và không tự tạo tài khoản cho khách.
- Không tự ghép đơn vào tài khoản chỉ vì trùng số điện thoại; đơn này được owner quản lý, khách không tự thấy trong tài khoản.
- Bản đầu chỉ tạo cho khung giờ chưa bắt đầu; không ghi bổ sung các buổi chơi đã qua.

### OWN-09. Theo dõi thanh toán và hoàn tất buổi chơi

- Owner xem kết quả thanh toán do server xác minh từ VNPay, số tiền và mã giao dịch; không được tự sửa trạng thái đã trả tiền.
- Từ `endTime` của từng Booking trở đi, owner xác nhận đã phục vụ: `CONFIRMED/PAID` → `COMPLETED/PAID`; không phải chờ các Booking khác cùng yêu cầu kết thúc.
- Nếu khách không đến, chuyển `CONFIRMED/PAID` → `NO_SHOW/PAID`; không tự hoàn tiền. Chính sách không hoàn do khách không đến là đề xuất đơn giản hóa, phải hiển thị trước khi trả tiền.
- Lưu thời điểm hoàn tất và tài khoản xác nhận phục vụ; thời điểm thanh toán/mã giao dịch giữ nguyên từ VNPay.
- Đơn chưa trả tiền không bao giờ được hoàn tất. Không thu thêm, không trả một phần và không có tiền mặt trong bản mới.
- Platform không tính hoa hồng hoặc phí dịch vụ trên đơn. Việc chuyển tiền cho owner ngoài platform là thỏa thuận vận hành với admin; không xây module chia tiền/đối soát owner và không mặc định tiền VNPay đã tự chuyển đến từng owner.

### OWN-10. Trang tổng quan cơ bản

- Số đơn chơi hôm nay chưa hủy, số đơn đã hoàn thành và số đơn hủy trong khoảng ngày chọn.
- Tổng tiền thuê sân đã thu: cộng phần tiền của các Booking đã được phân bổ từ giao dịch VNPay thành công, theo ngày thanh toán. Hoàn thành buổi chơi không cộng thu lần nữa.
- Hiển thị riêng tiền đã hoàn, tiền chờ hoàn và tiền thu ròng = tiền đã thu − tiền đã hoàn; lọc tiền hoàn theo ngày thực hoàn. Đây là số liệu đặt sân, không phải xác nhận owner đã nhận tiền từ admin.
- Danh sách các lịch sắp diễn ra và đơn đã qua giờ nhưng chưa xử lý.
- Đếm theo số Booking sau khi gộp/tách, không đếm số ô giao diện hoặc số lần xác nhận. Tổng tiền chỉ cộng các Booking hợp lệ một lần.
- Các số liệu chỉ lấy từ cơ sở của owner, không có báo cáo phân tích nâng cao hoặc xuất Excel/PDF.

## 7. Tính năng quản trị — ADMIN

### ADM-01. Cấp tài khoản owner

1. Admin và chủ sân làm việc bên ngoài platform.
2. Admin nhập họ tên, email và số điện thoại.
3. Server tạo tài khoản `OWNER` chưa kích hoạt, không có mật khẩu mặc định, gửi email mời hiệu lực 24 giờ.
4. Owner mở liên kết dùng một lần, xác thực email và tự đặt mật khẩu; hệ thống ghi nhận kích hoạt.
5. Owner đăng nhập, tạo cơ sở, cấu hình môn/bước giờ, thêm sân con rồi công khai.

Admin có thể gửi lại lời mời khi owner chưa kích hoạt; lần gửi mới vô hiệu liên kết cũ và tuân thủ giới hạn gửi. Chỉ admin tạo được owner; email kích hoạt không phải đăng ký owner công khai.

Không lưu hợp đồng, giấy phép, tỷ lệ hoa hồng, phí hợp tác hoặc công nợ hợp tác trong hệ thống. Email đã có tài khoản phải báo trùng; bản đầu không chuyển customer thành owner tự động.

### ADM-02. Quản lý tài khoản

- Xem danh sách, tìm kiếm và lọc theo vai trò/trạng thái.
- Xem thông tin cơ bản, tạo owner, sửa thông tin liên hệ và hỗ trợ đặt lại mật khẩu.
- Không cho sửa email trực tiếp trong bản đầu, kể cả từ màn hình admin; tránh đổi chủ tài khoản mà bỏ qua xác thực. Có thể gửi lại mời kích hoạt hoặc liên kết đặt lại mật khẩu.
- Khóa/mở khóa customer hoặc owner, bắt buộc nhập lý do khi khóa.
- Khi khóa owner, toàn bộ cơ sở của owner dừng nhận đơn mới; các đơn cũ vẫn được giữ.
- Không xóa cứng tài khoản đã có dữ liệu liên quan, không đổi vai trò tùy ý.
- Admin khởi tạo bằng dữ liệu thiết lập ban đầu; giao diện không có đăng ký admin hoặc thao tác tự khóa admin.

### ADM-03. Quản lý môn thể thao

- Thêm, sửa tên/mô tả và bật/tắt danh mục môn thể thao.
- Tên môn không trùng sau chuẩn hóa.
- Owner chỉ được gắn môn đang hoạt động khi tạo sân.
- Không xóa cứng môn đã được sử dụng.
- Chỉ cho tắt môn khi không còn sân đang nhận đặt sử dụng môn đó; lịch sử đơn vẫn giữ nguyên.

### ADM-04. Quản lý cơ sở toàn hệ thống

- Xem cơ sở, sân con, owner sở hữu và trạng thái hoạt động.
- Tìm theo tên, địa điểm hoặc owner.
- Khóa/mở khóa cơ sở, lưu lý do và thời điểm.
- Cơ sở bị admin khóa không xuất hiện trong danh sách công khai và không nhận đơn mới.
- Owner không thể tự gỡ khóa của admin.
- Mở khóa chỉ gỡ hạn chế của admin; không tự bật lại cơ sở mà owner đang để `DRAFT/PAUSED`.
- Admin không thay owner sửa giá hoặc chỉnh lịch thông thường.

### ADM-05. Tra cứu và hỗ trợ đơn đặt sân

- Tra cứu đơn toàn hệ thống theo mã đơn, cơ sở, owner, khách hàng, ngày và trạng thái.
- Xem chi tiết và lịch sử thao tác để hỗ trợ tranh chấp hoặc sự cố.
- Admin hỗ trợ hủy toàn bộ yêu cầu đang chờ; xử lý hủy Booking đã trả tiền do cơ sở không thể phục vụ, ghi nhận hoàn tiền thủ công và xử lý giao dịch đến muộn/sai số tiền theo mục 8.7.
- Trong trường hợp owner bị khóa/không thể thao tác, admin hỗ trợ hoàn tất/không đến theo cùng điều kiện của owner. Mọi thao tác có lý do; hoàn tất phải có bằng chứng đã phục vụ và đơn đã được VNPay xác nhận trả tiền.
- Không thay đổi giá đã chốt, không tự đánh dấu VNPay thành công và không tạo tiền hoa hồng.

### ADM-06. Tổng quan vận hành

- Hiển thị số customer, owner, cơ sở công khai và sân đang nhận đặt.
- Hiển thị số đơn theo ngày chơi/trạng thái trong khoảng ngày chọn.
- Không có dashboard doanh thu hoa hồng, đối soát hoặc thanh toán cho owner.

### ADM-07. Theo dõi email lỗi

- Xem loại email, người nhận, mã sự kiện/đơn liên quan, trạng thái và số lần thử gửi.
- Cho gửi lại email lỗi còn hợp lệ; liên kết hết hạn phải được cấp lại qua đúng luồng xác thực/kích hoạt/đặt lại mật khẩu.
- Không hiển thị token hoặc mật khẩu trong nhật ký; gửi lại email không tạo lại đơn hoặc sự kiện nghiệp vụ.

## 8. Trạng thái và quy tắc nghiệp vụ bắt buộc

### 8.1. Trạng thái đơn

- `PENDING_PAYMENT`: đã tạo đơn, đang giữ khoảng đến holdExpiresAt, chưa trả tiền thành công.
- `CONFIRMED`: VNPay đã xác nhận trả đủ tiền trong hạn, lịch được xác nhận, chưa hoàn tất.
- `CANCELLED`: đã hủy, có lý do và người hủy.
- `EXPIRED`: hết thời hạn giữ chỗ mà chưa được xác nhận thanh toán; khoảng không còn bị giữ.
- `COMPLETED`: buổi chơi đã kết thúc, chủ sân xác nhận đã phục vụ; tiền đã thu trước qua VNPay.
- `NO_SHOW`: sau giờ kết thúc, owner/admin xác nhận khách không đến; giữ nguyên khoản tiền đã trả, không tự hoàn.

Các chuyển trạng thái được phép:

- Tạo yêu cầu → tất cả Booking `PENDING_PAYMENT`.
- `PENDING_PAYMENT` → `CONFIRMED`: chỉ qua xử lý VNPay thành công, đủ tiền, đúng yêu cầu và còn hạn; toàn bộ Booking của một PaymentOrder chuyển cùng giao dịch.
- `PENDING_PAYMENT` → `CANCELLED`: hủy cả yêu cầu khi chưa xác nhận trả tiền hoặc nhận kết quả thanh toán thất bại đã được xác minh.
- `PENDING_PAYMENT` → `EXPIRED`: hết hạn, áp dụng toàn bộ Booking của yêu cầu.
- `CONFIRMED` → `CANCELLED`: chỉ admin xử lý ngoại lệ do cơ sở không phục vụ được, trước endTime, bắt buộc lý do và tạo hồ sơ hoàn đủ tiền của Booking đó.
- `CONFIRMED` → `COMPLETED`: owner/admin từ giờ kết thúc trở đi, xác nhận đã phục vụ; không đổi tiền đã trả.
- `CONFIRMED` → `NO_SHOW`: owner/admin từ giờ kết thúc trở đi, xác nhận khách không đến.
- `CANCELLED`, `EXPIRED`, `COMPLETED`, `NO_SHOW` là trạng thái cuối về lịch; không phục hồi vì một callback tới muộn. Trạng thái hoàn tiền có thể tiếp tục thay đổi riêng.

Không có trạng thái chờ owner duyệt. Có giữ chỗ chờ thanh toán và hết hạn thanh toán. Không tự đổi đơn sang hoàn thành chỉ vì thời gian đã qua.

### 8.2. Trạng thái thanh toán

- `UNPAID`: Booking chưa được phân bổ khoản thanh toán thành công.
- `PAID`: đã thu đủ phần tiền của Booking từ giao dịch VNPay xác nhận cả BookingRequest.
- `REFUND_PENDING`: Booking đã trả tiền bị admin hủy do không phục vụ được, đã tạo yêu cầu hoàn nhưng chưa xác nhận hoàn thực tế.
- `REFUNDED`: admin đã ghi nhận hoàn đủ tiền của Booking và bằng chứng giao dịch hoàn bên ngoài.
- Cặp hợp lệ: `PENDING_PAYMENT/UNPAID`, `CONFIRMED/PAID`, `COMPLETED/PAID`, `NO_SHOW/PAID`, `CANCELLED/UNPAID`, `EXPIRED/UNPAID`, `CANCELLED/REFUND_PENDING`, `CANCELLED/REFUNDED`.
- Giao dịch đến muộn/sai tiền được ghi ở PaymentOrder/PaymentTransaction và hồ sơ xử lý riêng, không phân bổ vào Booking đã hủy/hết hạn; Booking đó vẫn `UNPAID` kèm cảnh báo có khoản thu cần xử lý. Không được hiển thị đơn thuần "chưa thu tiền" khi thực tế có giao dịch ngoại lệ.
- PaymentOrder có trạng thái `PENDING`, `PAID`, `CLOSED` (hủy/thất bại/hết hạn, có lý do) hoặc `REVIEW` (đã nhận bằng chứng thu tiền nhưng không đủ điều kiện xác nhận lịch). Hoàn tiền không xóa lịch sử thu; số đã thu/đã hoàn được lưu riêng.
- Không dùng `PARTIAL` hoặc `DEPOSIT` cho một lần trả đúng 100% tiền sân của dự án mới. Một giao dịch được nhận diện duy nhất; gửi lại callback hoặc hoàn tất buổi chơi không cộng tiền lần nữa.

### 8.3. Chống trùng lịch và tính toàn vẹn

#### 8.3.1. Kiểm tra và gộp trước khi lưu

1. Nhận danh sách ô đã chọn không rỗng, courtId, ngày chơi, phiên bản cấu hình và mã yêu cầu. Mỗi ô gồm giờ bắt đầu/kết thúc.
2. Server xác định FacilitySport từ sân, đọc bước giờ/giờ mở cửa hiện hành và kiểm tra quyền, trạng thái nhận đặt.
3. Kiểm tra từng ô có đúng độ dài bước giờ và đúng mốc `openTime + n × step`, nằm trọn trong giờ hoạt động; với đặt sân, giờ bắt đầu sớm nhất phải cách hiện tại ít nhất 15 phút. Khóa bảo trì chỉ cần chưa bắt đầu vì không có thanh toán; không tin các ô frontend tự gửi lên.
4. Loại các ô trùng hệt nhau để không tính tiền hai lần; sắp xếp tăng theo giờ. Từ chối ô chồng một phần hoặc sai mốc thay vì tự sửa lựa chọn của khách.
5. Nếu `endTime` của dải hiện tại bằng `startTime` ô tiếp theo thì nối thành cùng dải. Nếu có khoảng trống thì tạo dải mới; không nối qua ô khách chưa chọn hoặc ô bị khóa.
6. Kiểm tra xung đột và tính tiền từng dải. Tạo đúng một Booking chờ thanh toán cho mỗi dải, lưu `startTime`, `endTime`, `durationMinutes`, `holdExpiresAt` và thông tin chốt lúc đặt; PaymentOrder chung thu tổng tiền tất cả dải.

Ví dụ dữ liệu thực tế sau khi lưu:

- Bước 30 phút, chọn `06:00–06:30`, `06:30–07:00` → một Booking `06:00–07:00`, 60 phút.
- Bước 30 phút, chọn tất cả ô từ `08:00` đến `12:00` → một Booking `08:00–12:00`, 240 phút; không có 8 bản ghi slot đi kèm.
- Chọn `06:00–06:30`, `06:30–07:00`, `08:00–08:30` → hai Booking `06:00–07:00` và `08:00–08:30` cùng BookingRequest; `07:00–08:00` không bị chiếm.
- Bước 90 phút, mở lúc `06:00`, chọn `06:00–07:30`, `07:30–09:00` → một Booking `06:00–09:00`, 180 phút.
- Chỉ gộp các ô của cùng sân, cùng ngày, cùng yêu cầu. Không gộp các đơn đã lưu trước đó hoặc gộp giữa khách khác nhau.

#### 8.3.2. Kiểm tra giao nhau giữa các khoảng

- Thời gian dùng quy ước `[startTime, endTime)`, luôn có `startTime < endTime`; hai khoảng chỉ chạm biên không trùng.
- Hai khoảng trên cùng sân/ngày xung đột khi và chỉ khi `newStart < existingEnd AND newEnd > existingStart`.
- Ví dụ đã có `08:00–12:00`: các khoảng `09:00–10:00`, `07:30–08:30`, `11:30–12:30`, `07:00–13:00` đều xung đột; `07:00–08:00` hoặc `12:00–13:00` không xung đột về thời gian. Chúng vẫn phải hợp lệ với bước giờ trước khi được đặt.
- Kiểm tra từng dải mới với Booking `PENDING_PAYMENT` chưa hết hạn, `CONFIRMED`, lịch sử `COMPLETED/NO_SHOW` và CourtBlock còn hiệu lực trên cùng sân/ngày; các dải mới cũng không được chồng nhau. Lịch sử đã qua không thể được đặt lại vì quy tắc giới hạn thời gian.
- Với thao tác khóa sân cũng kiểm tra ô, gộp dải và ghi toàn bộ cùng giao dịch như khi đặt; chỉ một dải lỗi thì không lưu dải khóa nào. Một bản ghi CourtBlock được gỡ toàn bộ, không gỡ một phần hoặc tự tác động đến các CourtBlock khác.
- Booking `CANCELLED`, `EXPIRED`, hold đã hết hạn và CourtBlock đã gỡ không chặn lịch. Khi gặp hold đã hết hạn nhưng tác vụ nền chưa cập nhật, xử lý đóng toàn bộ yêu cầu hết hạn trong giao dịch phối hợp lịch trước khi nhận đặt mới; không phụ thuộc riêng vào chu kỳ tác vụ nền.
- Không dùng unique theo giờ bắt đầu để thay thế kiểm tra giao nhau: `08:00–12:00` và `09:00–10:00` khác giờ bắt đầu nhưng vẫn trùng.
- Không cần `BookingSlot` hoặc `SlotOccupancy` theo từng ô 30/60/90 phút. Booking và CourtBlock dạng khoảng là nguồn dữ liệu lịch; các ô giao diện được sinh từ cấu hình rồi đối chiếu các khoảng này.

#### 8.3.3. Giao dịch và yêu cầu đồng thời

- Chỉ đọc lịch rồi ghi Booking trong một giao dịch thông thường vẫn chưa đủ: hai yêu cầu có thể cùng thấy trống. Mọi thao tác thay đổi lịch phải được tuần tự hóa bằng cơ chế khóa/giao dịch ở database cho cùng sân/ngày, dùng chung cho mọi instance ứng dụng.
- Mô hình đề xuất: một bản ghi `CourtDaySchedule` duy nhất theo `courtId + bookingDate` làm điểm phối hợp. Trong cùng giao dịch, khóa ghi/cập nhật phiên bản bản ghi này, sau đó đọc lại lịch, kiểm tra giao nhau, tạo toàn bộ Booking hoặc CourtBlock và ghi sự kiện email. Nếu xung đột giao dịch thì thử lại từ đầu và đọc lại lịch, không tiếp tục dùng kết quả kiểm tra cũ.
- Bản ghi sân/ngày phải được tạo hoặc lấy một cách nguyên tử kể cả khi chưa có lịch nào; không dựa vào khóa một truy vấn rỗng. Cách hiện thực khóa phụ thuộc database được chọn, nhưng bắt buộc bảo đảm chỉ một thao tác ghi lịch cùng sân/ngày thành công tại một thời điểm.
- `CourtDaySchedule` chỉ là bản ghi phối hợp cho cả ngày, không chứa hoặc sinh các slot nhỏ. Ràng buộc duy nhất của nó không tự ngăn khoảng giao nhau; vẫn bắt buộc kiểm tra khoảng sau khi đã lấy quyền ghi độc quyền.
- Customer đặt, owner đặt hộ, tạo/gỡ lịch khóa, hủy, hết hạn, xác nhận VNPay và cập nhật trạng thái Booking đều dùng cùng cơ chế. Không chỉ khóa bằng biến trong bộ nhớ Node.js.
- Một yêu cầu có nhiều dải: tạo BookingRequest, tất cả Booking chờ và PaymentOrder cùng giao dịch. Nếu một dải xung đột hoặc bất kỳ bước nào thất bại, không lưu lại Booking nào của yêu cầu đó. Giao dịch xác nhận trả tiền sau đó cập nhật toàn bộ Booking và ghi email thành công cùng nhau.
- Hủy đơn chỉ cần chuyển trạng thái trong giao dịch để toàn bộ khoảng không còn chặn lịch; không tách/xóa các slot. Giữ nguyên dữ liệu khoảng để tra cứu lịch sử.
- Mã yêu cầu chống lặp duy nhất theo người thực hiện và thao tác; lưu dấu vân tay nội dung đã chuẩn hóa. Gửi lại cùng mã/cùng nội dung trả lại danh sách Booking đã tạo, kể cả khi chúng đã đổi trạng thái; cùng mã/khác nội dung bị từ chối.
- Yêu cầu thất bại không được để lại kết quả thành công hoặc đơn một phần. Nếu giao dịch đã thành công nhưng mất phản hồi, gửi lại mã cũ phải lấy được đúng kết quả đã lưu.
- Khóa sân/ngày không tự bảo vệ thay đổi giá, bước giờ, giờ mở cửa hoặc khóa tài khoản/cơ sở. Các đường ghi cấu hình/trạng thái này phải có cơ chế phối hợp giao dịch hoặc kiểm tra phiên bản có bảo vệ ghi với đường tạo đơn; thay đổi trước khi đơn được chốt phải được nhận biết. Không chỉ đọc lại một lần rồi mặc định dữ liệu sẽ không đổi.
- Đổi cấu hình và tạo lịch đồng thời phải được tuần tự hóa theo nhóm/cơ sở liên quan, để không thể vừa đổi bước giờ vừa tạo đơn theo bước cũ. Nếu dùng nhiều khóa thì luôn lấy theo một thứ tự cố định để tránh chờ khóa vòng nhau.
- Hai thao tác cùng sửa trạng thái một Booking chỉ được có một thao tác thắng, dựa trên trạng thái/phiên bản hiện tại; thao tác còn lại trả kết quả hiện tại hoặc lỗi chuyển trạng thái, không phát sinh sự kiện email nghiệp vụ lần hai.
- Callback, hủy và hết hạn cùng yêu cầu phải phối hợp trên cả PaymentOrder và lịch sân/ngày. Nếu thanh toán đã xác nhận trước thì tác vụ hết hạn không được nhả lịch; nếu hủy/hết hạn thắng thì callback sau chỉ ghi khoản thu ngoại lệ, không lấy lại khoảng đã nhả.

### 8.4. Tính tiền và lưu lịch sử

- `durationMinutes = endTime − startTime` tính bằng phút cho từng Booking đã gộp.
- `Thành tiền Booking = làm tròn đến đồng gần nhất(giá VND/giờ tại lúc đặt × durationMinutes / 60)`; phần lẻ đúng 0,5 đồng làm tròn lên. Dùng phép tính tiền chính xác, không cộng tiền đã làm tròn từng ô.
- `Tổng tiền lần xác nhận = tổng thành tiền của các Booking trong BookingRequest`; không tính thời gian trống giữa các dải.
- Ví dụ giá 120.000 đồng/giờ: 30 phút = 60.000 đồng, 90 phút = 180.000 đồng; `06:00–07:00` và `08:00–08:30` thành hai đơn 120.000 + 60.000 = 180.000 đồng.
- Giá và tổng tiền do server tính từ dữ liệu hợp lệ; không tin số tiền client gửi lên.
- Lưu bản chụp tên cơ sở, tên sân, môn thể thao, địa chỉ chơi, thông tin liên hệ khách, giá, bước giờ, giờ mở cửa và phiên bản cấu hình tại lúc đặt.
- Đơn cũ không bị đổi giá hoặc nội dung đã chốt khi owner chỉnh thông tin sau đó.
- Số điện thoại liên hệ hiện tại của cơ sở có thể hiển thị thêm, phân biệt với dữ liệu lúc đặt.
- Tiền lưu bằng số nguyên VND; tổng tiền không có giảm giá, hoa hồng hoặc phí platform.
- `VNPay amount = tổng tiền BookingRequest × 100` theo cách mã nguồn tạo `vnp_Amount`; đây là chuyển đơn vị tham số thanh toán, không phải thu gấp 100 lần hoặc trả thêm 100%.
- Số tiền PaymentOrder và giá từng Booking được chốt lúc giữ chỗ, không đổi nếu owner sửa giá trong lúc khách trả tiền. Hủy một đơn đã trả tiền chỉ tạo nghĩa vụ hoàn riêng, không sửa số tiền giao dịch thu gốc.

### 8.5. Tạm ngừng, khóa và dữ liệu liên quan

- Tạm ngừng sân/cơ sở hoặc khóa owner chỉ chặn yêu cầu mới, không tự hủy đơn đã xác nhận hoặc PaymentOrder còn giữ chỗ hợp lệ. Callback vẫn phải được xử lý khi tài khoản bị khóa; muốn ngừng cả yêu cầu đang chờ thì owner/admin đóng rõ từng yêu cầu trước khi nhả lịch.
- Các đơn hiện hữu vẫn phải được phục vụ hoặc hủy có lý do; admin hỗ trợ nếu owner không đăng nhập được.
- Mở lại sân/cơ sở không được vô tình gỡ lịch bảo trì hoặc phục hồi đơn đã hủy.
- Điều kiện nhận đơn phải đồng thời thỏa: owner đã kích hoạt và không bị khóa, cơ sở công khai và không bị khóa, sân đang nhận đặt, môn đang hoạt động, cấu hình FacilitySport hợp lệ, các khoảng hợp lệ và không giao lịch đang chiếm.
- Người dùng bị khóa không tiếp tục thao tác bằng phiên cũ; khóa customer không tự xóa/hủy các đơn của họ, owner/admin hỗ trợ các đơn còn lại.

### 8.6. Luồng thu đủ tiền qua VNPay

Các quy tắc dưới đây là thiết kế cho bản mới, kế thừa luồng mã nguồn và sửa các điểm chưa nhất quán; xem mục 16.1 để phân biệt với hành vi gốc.

1. **Tạo yêu cầu thu:** server tính tổng tiền các khoảng đã gộp, giữ chúng 10 phút và tạo PaymentOrder `PENDING`. Dùng mã tham chiếu riêng duy nhất ánh xạ về PaymentOrder, không dùng id Booking con làm mã giao dịch chung.
2. **Tạo URL:** đưa mã tham chiếu, tổng tiền, nội dung, tiền tệ VND, thời điểm tạo/hết hạn, URL trở về và thông tin merchant vào tham số VNPay; ký bằng bí mật trên server. `vnp_ExpireDate` phải đúng cùng `holdExpiresAt`, không kéo dài thành 15 phút như hàm gốc. Không nhận tổng tiền từ frontend làm căn cứ thu.
3. **Thanh toán:** chuyển khách sang VNPay. Liên kết còn hạn được mở lại để tiếp tục, không kéo dài hold và không thay tổng tiền. Việc mở lại không tạo PaymentOrder hoặc Booking mới.
4. **Nhận kết quả:** endpoint IPN nhận thông báo server-to-server; endpoint return nhận khách quay lại. IPN không phụ thuộc phiên đăng nhập hoặc khách có quay về trang hay không. Trang return chỉ hiển thị trạng thái lưu ở server; nếu return cũng xử lý callback thì bắt buộc dùng cùng hàm kiểm tra và cùng khóa chống lặp như IPN.
5. **Xác minh:** kiểm tra chữ ký, merchant, mã tham chiếu tồn tại, số tiền chính xác bằng tổng đã chốt, tiền tệ theo dữ liệu tích hợp và các mã kết quả thành công. Không tin cờ `success` trên URL trình duyệt, không dùng số tiền mặc định nếu dữ liệu tiền thiếu/sai.
6. **Xác nhận:** khi PaymentOrder còn `PENDING`, toàn bộ Booking còn giữ chỗ và thời điểm xử lý trước holdExpiresAt, lưu PaymentTransaction duy nhất, đặt PaymentOrder `PAID`, phân bổ đúng thành tiền cho từng Booking và chuyển tất cả sang `CONFIRMED/PAID` trong một giao dịch. Sau commit mới gửi email từ outbox.
7. **Chống ghi nhận lặp:** Return và IPN có thể tới nhiều lần hoặc đồng thời. Unique mã giao dịch VNPay, kiểm tra trạng thái có khóa và ràng buộc một khoản thu được chấp nhận cho PaymentOrder phải ngăn cộng tiền/ghi email hai lần. Cùng mã giao dịch nhưng nội dung khác phải báo lỗi/xem xét, không coi là một lần trả tiền mới.
8. **Chưa rõ kết quả:** khách đóng tab hoặc mạng lỗi không đủ căn cứ hủy/đánh dấu thanh toán thất bại. Giữ trạng thái chờ đến khi nhận kết quả đáng tin hoặc hết hạn; khách xem lại đơn và tiếp tục nếu còn hạn.
9. **Thất bại hoặc hết hạn:** callback thất bại hợp lệ chỉ được đóng PaymentOrder còn `PENDING` và hủy toàn bộ đơn chờ; không hạ trạng thái đơn đã trả tiền khi callback thất bại tới sau thành công. Hết hạn thì chuyển đơn thành `EXPIRED`, đóng PaymentOrder và nhả khoảng. Có tác vụ nền kiểm tra khoảng 30 giây/lần như code cũ, đồng thời kiểm tra hạn ngay ở các thao tác đặt/callback.
10. **Kết quả đến muộn/ngoại lệ:** nếu có bằng chứng thu tiền sau khi yêu cầu đã hủy, hết hạn hoặc khoảng đã được nhả, ghi PaymentOrder `REVIEW` cùng giao dịch và hồ sơ xử lý; không xác nhận lại Booking, kể cả `vnp_PayDate` cho thấy khách đã trả trước hạn nhưng server nhận quá muộn. Nếu tại lúc nhận đã quá hạn nhưng Booking còn `PENDING_PAYMENT`, chuyển toàn bộ sang `EXPIRED` trong cùng giao dịch. Bản cơ bản chọn hoàn tiền hỗ trợ để không lấy lại lịch của người khác.
11. **Sai số tiền/thu thêm:** có bằng chứng thu sai số tiền khi yêu cầu còn chờ thì chuyển PaymentOrder `REVIEW`, hủy toàn bộ Booking chờ và nhả lịch trong cùng giao dịch, lưu khoản thu thực tế để hoàn hỗ trợ. Nếu PaymentOrder đã có khoản thu được chấp nhận, một giao dịch thu thêm khác mã được lưu ngoại lệ riêng; giữ `PAID` và các Booking đã xác nhận, chỉ xử lý khoản dư, không xác nhận thêm lịch hoặc hủy nhầm các đơn hợp lệ.

Phản hồi IPN chỉ xác nhận xử lý sau khi kết quả đã lưu thành công hoặc đã nhận diện là bản gửi lại; lỗi ghi database phải cho phép VNPay thử thông báo lại. Callback chữ ký sai không được thay đổi dữ liệu hoặc tạo nghĩa vụ hoàn tiền. Tiền đã nhận không rõ tham chiếu cần ghi nhận sự kiện đối chiếu cho admin; không gắn tùy tiện vào đơn khác.

### 8.7. Hủy sau thanh toán và hoàn tiền tối thiểu

- Mã nguồn được đọc chưa có luồng hoàn tiền hoàn chỉnh trong controller/service; các trường refund trong Invoice không chứng minh đã tích hợp hoàn tiền VNPay. Vì vậy phần này là phạm vi xử lý ngoại lệ đề xuất cho bản mới, không phải tính năng sẵn có được sao chép.
- Để giữ dự án cơ bản, không có tự hủy đơn đã trả tiền theo mốc 2 giờ, không đổi lịch sau thanh toán và không tự gọi API hoàn tiền VNPay.
- Khi cơ sở không thể phục vụ trước endTime, admin xác minh với owner, hủy toàn bộ khoảng của Booking đó và tạo RefundCase bằng đúng tiền Booking đã phân bổ. Cập nhật `CANCELLED/REFUND_PENDING`, nhả lịch và gửi email trong cùng giao dịch. Không hủy một phần thời lượng trong một Booking.
- Nếu một PaymentOrder trả cho nhiều Booking, có thể hoàn toàn bộ một Booking mà giữ các Booking còn lại. Đó là hoàn một phần của giao dịch tổng, không phải khách trả một phần lúc đặt.
- Admin thực hiện hoàn tiền qua kênh vận hành bên ngoài, sau đó lưu số tiền, mã/bằng chứng hoàn, người xử lý và thời điểm thực hoàn. Chỉ khi đã có bằng chứng mới chuyển RefundCase sang `REFUNDED` và Booking liên quan sang `CANCELLED/REFUNDED`.
- Khoản thu đến muộn/sai tiền được xử lý bằng RefundCase gắn PaymentTransaction, không chuyển Booking hết hạn thành đã trả tiền. Khi đã xác minh khoản thu không thể dùng để xác nhận lịch, đề xuất hoàn đủ số thực nhận của giao dịch ngoại lệ.
- Mỗi khoản thu chỉ hoàn tối đa số thực nhận; không hoàn trùng cùng Booking/giao dịch, không tính khoản hoàn giao dịch tổng lần nữa nếu đã hoàn các Booking thành phần. Các hồ sơ đang chờ hoàn cũng phải giữ hạn mức hoàn để hai admin không phê duyệt vượt tiền đã nhận.
- Đơn đã hoàn thành hoặc khách không đến không tự phát sinh hoàn tiền. Các tranh chấp ngoài tình huống nêu trên do admin xử lý vận hành, không bổ sung luồng giảm giá/phạt/khấu trừ trong bản đầu.
- Dashboard phân biệt số đã thu, đã hoàn, chờ hoàn và khoản thu chưa phân bổ cần xử lý; trạng thái lịch và trạng thái tiền không được đánh đồng.

## 9. Các luồng sử dụng hoàn chỉnh

### 9.1. Đưa một chủ sân lên platform

Admin làm việc ngoài hệ thống → tạo owner → gửi email mời → owner kích hoạt và đặt mật khẩu → tạo cơ sở nháp → thêm môn và bước giờ → thêm ảnh/sân/giá → công khai → khách thấy cơ sở và lịch trống.

### 9.2. Đặt sân và hoàn tất

Khách xác thực email và đăng nhập → chọn sân/ngày/ô giờ → xem các dải đã gộp và tổng tiền → tạo các Booking chờ và PaymentOrder, giữ lịch 10 phút → chuyển sang VNPay trả đủ tổng tiền → server xác minh và xác nhận toàn bộ Booking → gửi email đã thanh toán/đặt thành công → khách đến chơi → sau endTime từng Booking, owner xác nhận hoàn tất, không thu tiền lần nữa.

### 9.3. Khách hủy hợp lệ

Khách mở yêu cầu còn chờ thanh toán → chọn hủy cả yêu cầu → server phối hợp với xử lý VNPay, kiểm tra chưa xác nhận trả tiền → đóng PaymentOrder và hủy toàn bộ Booking con → nhả các khoảng và gửi email. Nếu thanh toán đã được xác nhận trước, không cho tự hủy và chuyển sang hướng dẫn hỗ trợ.

### 9.4. Sân phải nghỉ đột xuất

Owner xem các đơn bị ảnh hưởng → tắt nhận đặt mới nếu cần → hủy toàn bộ yêu cầu chưa trả tiền hoặc nhờ admin hủy từng Booking đã trả tiền và tạo hồ sơ hoàn → gửi email → khóa các dải chưa bắt đầu không phục vụ. Admin hoàn tiền bên ngoài và ghi nhận bằng chứng sau khi thực hiện; nhả lịch không đồng nghĩa tiền đã được hoàn. Nếu khoảng đã bắt đầu thì không tạo lịch khóa hồi tố; các sự cố sau endTime đi qua hỗ trợ vận hành, không tự sửa lịch sử đơn.

### 9.5. Khách đặt qua điện thoại

Owner nhận thông tin khách → tạo yêu cầu và các Booking chờ → đưa liên kết VNPay cho khách → khách trả đủ trong hạn → server xác nhận toàn bộ Booking, gửi email cho owner → xử lý từng buổi chơi như đơn trực tuyến. Khách không thanh toán đúng hạn thì lịch được nhả.

### 9.6. Khách đóng trình duyệt hoặc callback đến muộn

Khách trả tiền và đóng tab → VNPay gửi IPN → server xác minh, lưu tiền và xác nhận nếu yêu cầu còn hạn → email gửi không phụ thuộc khách quay về. Nếu yêu cầu đã hết hạn/hủy, server lưu khoản thu cần xử lý, không chiếm lại lịch → admin kiểm tra và hoàn tiền theo mục 8.7.

## 10. Danh sách màn hình cần có

### 10.1. Khu vực công khai và khách hàng

- Trang chủ/danh sách cơ sở, có tìm kiếm và bộ lọc.
- Chi tiết cơ sở, danh sách sân và lịch trống.
- Đăng ký, chờ xác thực email, kết quả xác thực, gửi lại email và đăng nhập.
- Hồ sơ cá nhân, đổi mật khẩu, quên mật khẩu và đặt mật khẩu qua liên kết email.
- Xác nhận thông tin đặt sân và màn hình kết quả đặt.
- Chờ thanh toán với đếm ngược, chuyển/tiếp tục VNPay và trang kết quả đọc trạng thái server; hiển thị đang xác minh, thành công, thất bại, hết hạn hoặc cần hỗ trợ.
- Đơn của tôi, chi tiết đơn và hộp thoại hủy.

### 10.2. Khu vực owner

- Tổng quan và lịch đặt trong ngày.
- Kích hoạt tài khoản và đặt mật khẩu qua liên kết email mời.
- Danh sách cơ sở, tạo/sửa/chi tiết cơ sở, quản lý ảnh.
- Danh sách sân con, tạo/sửa sân và giá thuê.
- Danh sách môn tại cơ sở và cấu hình bước giờ 30/60/90 phút, xem trước các ô giờ và phần dư cuối ngày.
- Lịch theo sân/ngày, tạo và gỡ lịch khóa.
- Danh sách/chi tiết đơn, tạo đơn ngoài hệ thống.
- Theo dõi thanh toán, hủy yêu cầu chờ, yêu cầu admin hỗ trợ đơn đã trả tiền, hoàn tất buổi chơi và đánh dấu không đến.

### 10.3. Khu vực admin

- Tổng quan vận hành.
- Danh sách/chi tiết tài khoản, tạo owner, khóa/mở khóa và đặt lại mật khẩu.
- Quản lý môn thể thao.
- Danh sách/chi tiết cơ sở và khóa/mở khóa cơ sở.
- Tra cứu/chi tiết đơn, lịch sử thao tác và xử lý hỗ trợ.
- Theo dõi email gửi lỗi, thử gửi lại hoặc gửi lại lời mời owner.
- Tra cứu PaymentOrder/giao dịch VNPay, khoản thu ngoại lệ và hồ sơ hoàn tiền; ghi nhận bằng chứng hoàn thủ công.

Các chức năng tạo/sửa/chi tiết có thể dùng chung trang hoặc hộp thoại; không bắt buộc mỗi chức năng là một trang riêng.

## 11. Nhóm dữ liệu tối thiểu cho dự án Node.js

Đây là mô hình logic để thiết kế database, không bắt buộc sử dụng cơ sở dữ liệu hoặc thư viện cụ thể.

- **User:** id, họ tên, email chuẩn hóa duy nhất, `emailVerifiedAt`, `activatedAt` cho owner, mật khẩu đã băm (có thể rỗng trước khi kích hoạt owner), số điện thoại, vai trò, cờ bị khóa, tokenVersion, lý do khóa, ngày tạo/cập nhật. Chưa xác thực/chưa kích hoạt khác với bị admin khóa; không gộp cả ba vào một cờ mơ hồ.
- **AuthToken:** userId, loại `VERIFY_EMAIL/ACTIVATE_OWNER/RESET_PASSWORD`, token đã băm, hạn dùng, thời điểm sử dụng/vô hiệu; không lưu token thô trong log hoặc API quản trị.
- **AuthSession:** id là sid trong JWT, userId, createdAt, absoluteExpiresAt, revokedAt và lý do thu hồi; một User có nhiều phiên.
- **RefreshToken:** sessionId, tokenHash duy nhất, createdAt, expiresAt, usedAt, revokedAt, replacedBy; giữ dấu token đã dùng đến hết phiên để phát hiện reuse. JWT access token không cần lưu nguyên chuỗi trong database.
- **Sport:** id, tên duy nhất, mô tả, trạng thái hoạt động.
- **Facility:** id, ownerId, tên, mô tả, địa chỉ, tỉnh/thành phố, số liên hệ, giờ mở/đóng cửa, phiên bản cấu hình giờ, trạng thái `DRAFT/PUBLISHED/PAUSED`, cờ khóa của admin, lý do khóa.
- **FacilityImage:** id, facilityId, đường dẫn ảnh, cờ ảnh đại diện, thứ tự hiển thị; có thể nhúng vào Facility.
- **FacilitySport:** id, facilityId, sportId, slotStepMinutes (30/60/90), phiên bản cấu hình; unique cặp facilityId/sportId. Không thay đổi cặp cơ sở/môn của nhóm đã có sân; tạo nhóm mới nếu cần.
- **Court:** id, facilitySportId, tên sân, mô tả, giá VND/giờ, phiên bản giá, trạng thái nhận đặt. Cơ sở và môn được suy ra từ FacilitySport, tránh lưu trùng các liên kết có thể mâu thuẫn.
- **BookingRequest:** id, người thực hiện, mã yêu cầu chống lặp duy nhất theo người/thao tác, dấu vân tay nội dung đã chuẩn hóa, courtId, ngày chơi, tổng tiền ban đầu, holdExpiresAt, thời điểm tạo. Tổng tiền không thay đổi khi một Booking đã trả tiền bị hủy; số cần hoàn được lưu riêng. Lưu nguyên tử cùng Booking chờ và PaymentOrder.
- **Booking:** id/mã đơn duy nhất, bookingRequestId, customerId có thể rỗng cho đơn owner tạo, createdBy, nguồn đơn, courtId, ngày, startTime, endTime, durationMinutes, đơn giá chốt, thành tiền, dữ liệu chụp lúc đặt (gồm bước giờ và mốc mở cửa), holdExpiresAt giống yêu cầu cha, ghi chú, trạng thái đơn/thanh toán, phần tiền đã phân bổ, thông tin hủy/hoàn tất, phiên bản trạng thái. Một bản ghi biểu diễn đúng một dải liên tục, không kèm các bản ghi ô nhỏ.
- **PaymentOrder:** id, bookingRequestId duy nhất, mã tham chiếu VNPay duy nhất, merchant/currency, expectedAmountVnd, createdAt, expiresAt bằng hạn giữ chỗ, trạng thái `PENDING/PAID/CLOSED/REVIEW`, lý do đóng/xem xét và phiên bản xử lý. Đường thanh toán cho khách không có tài khoản dùng mã truy cập bí mật riêng có hạn, lưu dạng băm; không dùng id công khai làm quyền truy cập.
- **PaymentTransaction:** id, paymentOrderId nếu xác định được, mã giao dịch VNPay duy nhất khi có mã hợp lệ (không dùng giá trị rỗng/mặc định làm mã thu duy nhất), số tiền thực tế, thời điểm trả, mã kết quả, kết quả xác minh, loại được chấp nhận/ngoại lệ, dữ liệu đối chiếu đã lọc và thời điểm ghi nhận. Một PaymentOrder chỉ được phân bổ một giao dịch thành công; khoản thu thêm phải được lưu làm ngoại lệ, không bỏ qua. Trường hợp không rõ tham chiếu cần bản ghi sự kiện đối chiếu riêng trước khi gắn đơn.
- **RefundCase:** id, paymentTransactionId, bookingId nếu hoàn do hủy Booking, số tiền cần hoàn, lý do, trạng thái `PENDING/REFUNDED`, người tạo/xử lý, bằng chứng và thời điểm hoàn thực tế. Chống tạo trùng nghĩa vụ hoàn và kiểm soát tổng đã hoàn + đang chờ không vượt số thực nhận; không lưu thông tin thẻ của khách.
- **CourtBlock:** id, courtId, ngày, giờ bắt đầu/kết thúc, lý do, người tạo, trạng thái đã gỡ hoặc còn hiệu lực.
- **CourtDaySchedule:** courtId, ngày, phiên bản phối hợp ghi; unique cặp courtId/ngày. Chỉ dùng để tuần tự hóa giao dịch của cùng sân/ngày, không lưu danh sách slot và không thay cho kiểm tra khoảng.
- **EmailOutbox:** id sự kiện, loại sự kiện, người nhận, BookingRequest/Booking liên quan nếu có, nội dung tại thời điểm sự kiện, trạng thái chờ/đã gửi/lỗi, số lần thử, thời điểm gửi tiếp và lỗi gần nhất; unique khóa sự kiện/người nhận. Dữ liệu chứa liên kết xác thực phải được bảo vệ, chỉ bộ gửi email được truy cập, không đưa vào log hoặc màn hình admin.
- **ActionLog:** người thực hiện, loại đối tượng, id đối tượng, hành động, trạng thái trước/sau, lý do và thời điểm; ghi cho cấp/khóa tài khoản, khóa cơ sở và xử lý trạng thái đơn.

Quan hệ chính: User(owner) → nhiều Facility → nhiều FacilitySport → nhiều Court; Sport → nhiều FacilitySport; BookingRequest → một hoặc nhiều Booking và đúng một PaymentOrder; PaymentOrder → các PaymentTransaction được nhận diện, tối đa một khoản được phân bổ cho các Booking; PaymentTransaction → các RefundCase khi cần. Court → nhiều Booking/CourtBlock và tối đa một CourtDaySchedule cho mỗi ngày; User → nhiều AuthToken. EmailOutbox liên kết sự kiện nghiệp vụ tương ứng.

Chỉ mục tra cứu lịch cần hỗ trợ lọc theo sân, ngày và trạng thái rồi kiểm tra startTime/endTime; chỉ mục này cải thiện truy vấn, không tự bảo đảm các khoảng không giao nhau. Không tạo bảng/collection theo từng ô 30/60/90 phút để chống trùng.

Không cần bảng/collection hoa hồng, voucher, sản phẩm, giỏ hàng, nhân viên, ví hoặc đối soát trả tiền owner. PaymentOrder đảm nhiệm chứng từ yêu cầu thanh toán đơn giản, không bắt buộc thêm Invoice riêng. Trạng thái trên Booking phục vụ hiển thị; bằng chứng số tiền đã thu/hoàn nằm trong PaymentTransaction và RefundCase, không chỉ là một cờ do owner chỉnh.

## 12. Yêu cầu chất lượng và phân quyền

- Mật khẩu phải được băm; không trả mật khẩu hoặc dữ liệu nhạy cảm trong API.
- Kiểm tra đăng nhập, vai trò và quyền sở hữu ở server, kể cả khi người dùng tự thay id trên URL hoặc nội dung yêu cầu.
- Giới hạn thử đăng nhập liên tục; kiểm tra dữ liệu đầu vào và giới hạn độ dài nội dung.
- Dữ liệu công khai không chứa danh tính người đặt. Owner chỉ xem khách trong đơn thuộc cơ sở của mình.
- Các danh sách có phân trang, trạng thái tải dữ liệu, không có dữ liệu và thông báo lỗi dễ hiểu.
- Giao diện dùng được trên máy tính và điện thoại, lịch có chú giải màu/trạng thái rõ ràng.
- Thời gian dùng thống nhất múi giờ nghiệp vụ; timestamp hệ thống có thể lưu UTC nhưng phải chuyển đúng khi hiển thị và kiểm tra ngày đặt.
- Không dùng thao tác xóa dây chuyền làm mất đơn và lịch sử.
- Link email chỉ dùng qua HTTPS khi triển khai; cấu hình dịch vụ email và bí mật nằm ngoài mã nguồn. Email có thể tới chậm, trạng thái nghiệp vụ phải đọc từ hệ thống.
- URL return/IPN phải được cấu hình đúng môi trường, bí mật VNPay chỉ có ở server, không lưu trong tài liệu/log/frontend. Kiểm thử bằng môi trường thử nghiệm trước khi sử dụng tài khoản merchant thật.
- IPN không yêu cầu đăng nhập người dùng nhưng bắt buộc xác minh chữ ký và giao dịch; các API xem đơn/tiếp tục thanh toán vẫn phải kiểm tra quyền. Không lưu thông tin thẻ/ngân hàng nhạy cảm do VNPay xử lý.
- Đối với dự án Node.js, tách phần xử lý xác thực, cơ sở/sân, lịch và booking để quy tắc đặt sân được dùng chung cho customer và owner.

## 13. Những chức năng loại khỏi phạm vi

- Hoa hồng, bậc hoa hồng, doanh thu platform, đối soát hoặc thanh toán chia tiền cho owner.
- Gói thuê bao, thu phí cấp tài khoản, quản lý hợp đồng hoặc công nợ giữa owner với admin.
- Owner tự đăng ký, gửi giấy tờ, quy trình duyệt hồ sơ và duyệt từng cơ sở.
- Voucher, mã giảm giá, khuyến mãi, điểm thưởng, hạng thành viên hoặc giới thiệu bạn bè.
- Cổng thanh toán khác ngoài VNPay, tiền mặt tại sân, đặt cọc một phần, trả sau, thu nhiều đợt và API hoàn tiền tự động. Thanh toán đủ 100% qua VNPay và theo dõi hoàn tiền thủ công cho ngoại lệ nằm trong phạm vi.
- Nhân viên, ca làm, chấm công và phân quyền nhân viên.
- Bán nước, đồ ăn, dụng cụ, thuê thiết bị, dịch vụ kèm theo và quản lý kho.
- Đánh giá/bình luận, sân yêu thích, mạng xã hội, blog hoặc bảng xếp hạng.
- Chat trực tuyến, chatbot, SMS, push notification, email marketing/nhắc lịch định kỳ và cập nhật lịch qua WebSocket. Email xác thực, kích hoạt, khôi phục mật khẩu và thông báo nghiệp vụ nằm trong phạm vi.
- Đăng nhập Google/Facebook và OTP SMS; bản đầu dùng liên kết email dùng một lần thay cho mã OTP.
- Bản đồ tương tác, định vị khoảng cách, chỉ đường hoặc gợi ý sân bằng AI.
- Đặt nhiều sân hoặc nhiều ngày trong một lần xác nhận, đặt định kỳ hoặc gói tháng. Chọn các dải rời nhau trên cùng sân/ngày được hỗ trợ và tách thành Booking riêng.
- Giá ngày lễ, lịch ngày lễ đặc thù và lịch qua đêm (Bảng giá theo khung giờ và loại ngày thường/cuối tuần cùng lịch mở cửa theo từng thứ trong tuần được hỗ trợ chính thức từ batch B03).
- Check-in bằng QR, xử lý vào/ra riêng cho từng slot, phụ thu chơi quá giờ.
- Báo cáo chuyên sâu, xuất Excel/PDF, hóa đơn điện tử và đa ngôn ngữ.

## 14. Tiêu chí nghiệm thu và kịch bản kiểm tra

1. Khách tự đăng ký chỉ nhận vai trò customer, không thể gửi yêu cầu để trở thành owner/admin.
2. Admin cấp được owner; owner phải xác thực email và tự đặt mật khẩu qua liên kết kích hoạt trước khi tạo cơ sở. Không gửi mật khẩu dạng văn bản.
3. Owner tạo cơ sở, cấu hình môn/bước giờ, sân và giá rồi công khai; khách tìm thấy đúng theo bộ lọc.
4. Owner A không đọc/sửa cơ sở, sân, ảnh, lịch khóa hoặc đơn của owner B dù thay id trực tiếp.
5. Customer A không đọc hoặc hủy đơn của customer B.
6. Bước 30 phút, chọn `06:00–06:30` và `06:30–07:00`: database chỉ có một Booking `06:00–07:00`, 60 phút. Với giá 120.000 đồng/giờ, thành tiền 120.000 đồng.
7. Hai khách đồng thời đặt các khoảng giao nhau nhưng khác giờ bắt đầu: đúng một yêu cầu thành công, yêu cầu còn lại báo trùng lịch; kiểm tra cả khi sân/ngày chưa có bản ghi phối hợp.
8. Một yêu cầu có nhiều dải mà một dải đã bận: không lưu BookingRequest thành công, Booking một phần hoặc email xác nhận của yêu cầu đó.
9. Đặt sân đồng thời với khóa lịch: không có Booking và CourtBlock cùng giao một khoảng thời gian.
10. Gửi lại cùng mã yêu cầu/cùng nội dung trả đúng danh sách Booking đã tạo; cùng mã nhưng khác nội dung bị từ chối.
11. Từ chối giờ đã qua, còn dưới 15 phút tới giờ bắt đầu đầu tiên, ngoài giờ mở cửa, ô sai mốc/sai độ dài, khác sân/ngày hoặc quá giới hạn 30 ngày. Các dải không liên tiếp trên cùng sân/ngày được chấp nhận và tách riêng.
12. Khách tự hủy được toàn bộ yêu cầu chờ chưa xác nhận trả tiền; không hủy riêng một dải khi PaymentOrder còn mở, không tự hủy đơn đã trả tiền dù còn hơn 2 giờ trước giờ chơi.
13. Hủy yêu cầu chờ nhả tất cả khoảng của yêu cầu. Hủy hỗ trợ một Booking đã trả tiền phải do admin, tạo nghĩa vụ hoàn đủ tiền Booking đó và không ảnh hưởng Booking đã xác nhận khác cùng yêu cầu.
14. Giá đổi trước khi tạo hold phải yêu cầu xem lại; giá đổi sau khi hold/PaymentOrder được tạo không làm đổi tiền VNPay hoặc tiền Booking đã chốt.
15. Đổi bước giờ bị từ chối khi nhóm môn còn hold chưa hết hạn, Booking đã xác nhận/lịch khóa hiệu lực chưa kết thúc; đổi giờ mở/đóng cửa áp dụng kiểm tra toàn cơ sở. Không tự hủy lịch để sửa.
16. Owner tạo đơn qua điện thoại phải dùng cùng lịch với đơn trực tuyến và không tự ghép khách theo số điện thoại.
17. Chưa đến endTime hoặc chưa `CONFIRMED/PAID` thì không được hoàn tất/đánh dấu không đến. Chỉ callback hợp lệ ghi nhận tiền; thời gian trôi qua không thay thế thanh toán.
18. Hoàn tất chuyển `CONFIRMED/PAID` thành `COMPLETED/PAID`, không sửa thời điểm/tiền thu hoặc tạo giao dịch lần hai; `NO_SHOW` vẫn giữ khoản đã trả.
19. Khóa owner/cơ sở chặn đặt mới nhưng không xóa đơn cũ; owner không tự gỡ khóa của admin.
20. Khóa tài khoản hoặc đặt lại mật khẩu làm phiên cũ không còn sử dụng được.
21. Mở khóa cơ sở không tự chuyển cơ sở `PAUSED` thành `PUBLISHED`.
22. Lịch công khai không tiết lộ tên hoặc số điện thoại khách đã đặt.
23. Admin hỗ trợ đơn có lưu lý do, người thực hiện và thời điểm; vẫn phải tuân thủ điều kiện chuyển trạng thái.
24. Không có khoản thu hoa hồng, áp voucher hoặc phí platform ở giao diện và công thức tính tiền.
25. Một địa điểm có cầu lông bước 30 phút, tennis 60 phút, bóng đá 90 phút; các sân trong mỗi nhóm dùng đúng cấu hình nhóm. Cùng môn ở địa điểm khác được đặt bước khác.
26. Bước 30 phút, chọn toàn bộ ô `08:00–12:00`: chỉ lưu một Booking dài 240 phút, không sinh các bản ghi chiếm lịch theo ô nhỏ.
27. Chọn `06:00–07:00` và `08:00–08:30`: tạo hai Booking cùng một BookingRequest; `07:00–08:00` vẫn trống, giá chỉ tính 90 phút thực đặt.
28. Ô chọn bị đảo thứ tự hoặc gửi trùng hệt nhau: sau chuẩn hóa vẫn gộp đúng và không tính tiền hai lần. Ô chồng một phần hoặc sai cấu hình bị từ chối.
29. Bước 90 phút từ 06:00: hai ô `06:00–07:30` và `07:30–09:00` gộp thành một Booking 180 phút; không cho tự gửi ô `06:30–08:00` vì sai mốc.
30. Giờ đóng 23:00, bước 90 phút từ 06:00: không xuất hiện ô đặt vượt 23:00 hoặc ô rút ngắn `22:30–23:00`.
31. Đã có `08:00–12:00`: từ chối khoảng nằm trong, bao trùm hoặc giao một phần; cho phép khoảng chỉ chạm biên nếu đúng cấu hình và các điều kiện còn lại.
32. Giá 100.001 đồng/giờ, hai ô 30 phút liền nhau phải gộp rồi tính thành 100.001 đồng, không làm tròn từng ô thành tổng 100.002 đồng. Hai dải 30 phút rời nhau là hai Booking, mỗi đơn 50.001 đồng theo quy tắc làm tròn, tổng 100.002 đồng; bước xem lại phải thể hiện đúng từng đơn.
33. Đơn cũ giữ nguyên khoảng, giá và bước giờ đã chốt sau khi đủ điều kiện đổi cấu hình. Màn hình đặt dùng phiên bản cũ phải tải lại trước khi xác nhận.
34. Tạo đơn đồng thời với đổi cấu hình/giá/khóa cơ sở phải cho kết quả tuần tự nhất quán; không tạo đơn bằng cấu hình đã hết hiệu lực trước khi đơn được chốt.
35. Hai Booking rời nhau cùng yêu cầu được thanh toán chung đủ 100% một lần; sau xác nhận có thể hoàn tất từng Booking độc lập. Thống kê đơn theo Booking, thống kê tiền không cộng lặp giao dịch chung và phần phân bổ.
36. Customer chưa xác thực email không đặt được; liên kết đúng và còn hạn xác thực được đúng một lần, liên kết hết hạn hoặc đã dùng không có tác dụng.
37. Gửi lại liên kết xác thực/kích hoạt làm vô hiệu liên kết cũ, không tạo tài khoản thứ hai và bị giới hạn tần suất.
38. Liên kết đặt lại mật khẩu không dùng thay liên kết kích hoạt/xác thực; đổi mật khẩu không mở khóa tài khoản và làm mất hiệu lực các phiên cũ.
39. Tạo các Booking chờ chưa gửi email đặt thành công. Sau khi thanh toán đủ, chỉ sinh một email xác nhận cho mỗi người nhận, liệt kê mã đơn/khoảng/giá và giao dịch VNPay; hủy hỗ trợ một đơn gửi đúng đơn đó.
40. Gửi email lỗi sau khi giao dịch xác nhận thanh toán thành công: Booking vẫn `CONFIRMED/PAID` và xem được, email có tác vụ thử lại; giao dịch ghi nhận thất bại không gửi email xác nhận.
41. Gửi lại yêu cầu hoặc xử lý đồng thời cùng trạng thái không tạo trùng sự kiện email; thử lại email không tạo thêm Booking hoặc ghi nhận tiền lần nữa.
42. Đơn owner tạo cho khách ngoài hệ thống chỉ gửi email tới owner; không tự ghép tài khoản hoặc gửi tới email khách chưa xác thực.
43. Email thông báo đến chậm ghi rõ thời điểm sự kiện và có liên kết xem trạng thái hiện tại; nhật ký quản trị không lộ token xác thực/đặt lại mật khẩu.
44. Tổng tiền yêu cầu 180.000 đồng phải gửi `vnp_Amount = 18000000`; server đối chiếu số tiền callback đúng với tổng chốt trước khi xác nhận toàn bộ Booking.
45. Chữ ký sai, merchant sai, mã tham chiếu không tồn tại hoặc dữ liệu tiền không hợp lệ không thể tạo `CONFIRMED/PAID`; không dùng số tiền dự phòng để chấp nhận.
46. Hạn giữ chỗ và hạn VNPay đều là cùng mốc tạo + 10 phút; mở lại thanh toán không kéo dài hạn. Đúng tại holdExpiresAt được coi là hết hạn.
47. IPN và return lặp/đồng thời với cùng giao dịch chỉ ghi nhận tiền và email một lần; cùng mã giao dịch nhưng dữ liệu khác không được ghi thêm tiền.
48. Khách trả tiền rồi đóng tab: IPN vẫn xác nhận và gửi email mà không cần phiên đăng nhập hoặc truy cập return.
49. Hết hạn hoặc hủy thắng trước callback thành công: không phục hồi Booking và không chiếm lại lịch, lưu khoản thu cần xử lý/hoàn tiền. Thanh toán được xác nhận trước thì cleanup không nhả lịch.
50. VNPay báo thất bại hợp lệ đóng yêu cầu còn chờ và nhả toàn bộ khoảng; callback thất bại đến sau thành công không hạ đơn đã trả tiền xuống chưa trả.
51. Tác vụ nền chưa chạy nhưng hold đã hết hạn: yêu cầu đặt mới vẫn xử lý đóng hold cũ và kiểm tra lịch nguyên tử; không phải chờ 30 giây mới có thể nhận đặt.
52. Owner tạo hộ cũng phải chờ VNPay thành công, không có nút tự xác nhận tiền mặt. Liên kết khách không tài khoản cần mã truy cập bí mật, không truy cập được chỉ bằng id đơn.
53. Admin hủy một Booking 120.000 đồng trong giao dịch tổng 180.000 đồng: chỉ chờ hoàn 120.000, Booking 60.000 còn lại giữ `CONFIRMED/PAID`; số đã thu gốc vẫn là 180.000.
54. Chỉ sau bằng chứng hoàn thực tế mới đánh dấu `REFUNDED`; hai yêu cầu/admin đồng thời không tạo nghĩa vụ hoàn hoặc ghi hoàn vượt số tiền thực nhận.
55. Sai số tiền nhưng có bằng chứng thu hợp lệ hoặc phát sinh giao dịch thu thứ hai phải có bản ghi ngoại lệ để xử lý; không âm thầm bỏ tiền nhận hoặc tạo thêm lịch.
56. Khóa owner/customer sau khi đã tạo hold không ngăn xử lý IPN; nếu admin muốn dừng hold phải đóng rõ yêu cầu. Callback sau đóng không được tự mở lại.
57. JWT bị sửa chữ ký, sai issuer/audience/type hoặc hết hạn không truy cập API được; gửi refresh token thay Bearer access token cũng bị từ chối.
58. Login trả JWT trong JSON và refresh trong cookie đúng thuộc tính; không có refresh token trong response JSON/log, không lưu token vào localStorage/sessionStorage.
59. Refresh token hợp lệ chỉ rotate thành công một lần; token cũ phát lại thu hồi phiên đó và không ảnh hưởng phiên khác. Refresh đồng thời, mất phản hồi và nhiều tab có hành vi được kiểm thử theo chính sách đã chốt.
60. Logout hiện tại làm access JWT có sid đó không dùng được ở yêu cầu mới dù chưa hết hạn; logout-all/đổi/reset mật khẩu/khóa tài khoản vô hiệu toàn bộ phiên. Mở khóa không làm sống lại phiên cũ.
61. Phiên và refresh không sống quá 7 ngày từ login; kiểm tra hạn trực tiếp ngay cả khi TTL chưa dọn dữ liệu. Access JWT cuối phiên không vượt hạn phiên.
62. Auth POST từ Origin lạ/thiếu/null, thiếu custom header hoặc gửi form không hợp lệ bị từ chối; origin hợp lệ gửi JSON/guard hoạt động. Kiểm tra thực trong browser, không chỉ Postman.
63. Tải lại trang khôi phục đăng nhập qua refresh cookie; nhiều API hết access cùng lúc không gây vòng lặp refresh. 403 không kích hoạt refresh; request ghi thử lại giữ idempotency key.
64. VNPay IPN hợp lệ vẫn xử lý được khi không có JWT/cookie hoặc user đã bị khóa; không thể lợi dụng ngoại lệ callback để bỏ qua xác thực ở API khác. GET link email không tiêu thụ token trước POST xác nhận.

## 15. Thứ tự triển khai đề xuất

1. P00–P02: chốt hợp đồng, dựng server, MongoDB replica set, transaction, schema/index và dữ liệu test.
2. P03–P05: email nền, tài khoản, JWT/refresh cookie, bảo vệ phiên và phân quyền.
3. P06–P10: API quản trị/cơ sở/sân, cấu hình bước giờ, lịch, gộp khoảng, chống trùng, giữ chỗ và vòng đời Booking.
4. P11–P13: VNPay, ngoại lệ/hoàn tiền thủ công, email nghiệp vụ và báo cáo cơ bản.
5. P14: kiểm thử backend tổng thể, cookie trong browser, VNPay thử nghiệm, tài liệu API và mốc BE-READY. Chưa đạt thì tiếp tục sửa backend, không chuyển sang xây React.
6. P15–P19: sau BE-READY mới dựng frontend React, auth, tìm sân/lịch, đặt/thanh toán, khu vực owner và admin.
7. P20: kiểm thử xuyên suốt, triển khai thử nghiệm và bàn giao/demo.

Chi tiết công việc, đầu ra, phụ thuộc và điều kiện hoàn thành từng phase nằm trong `docs/planning/development-plan.md`. Chỉ lập kế hoạch trong bước này, chưa tạo ứng dụng hoặc đánh dấu phase đã hoàn thành.

Hoàn thành các mục này là hoàn thành phạm vi bản cơ bản; các chức năng tại mục 13 không phải yêu cầu còn thiếu.

## 16. Căn cứ tham khảo từ dự án SportHub

Đã đọc README, các phần mã nguồn nghiệp vụ liên quan và cấu trúc SQL để chọn phạm vi. Không chạy ứng dụng cũ để kiểm thử toàn bộ hệ thống. Các đường dẫn dưới đây tính từ thư mục gốc SportHub đã nêu đầu tài liệu:

- `README.md`: xác định dự án gốc dùng Java/Spring Boot và cấu trúc ứng dụng; dự án mới sẽ xây dựng bằng Node.js theo đề bài.
- `src/main/java/com/mvc/mock_project/service/OwnerFacilityService.java`: quản lý cơ sở, sân con, môn thể thao, ảnh, khung giờ và bảng giá; bản mới giữ nhóm môn tại cơ sở để cấu hình bước 30/60/90 phút và giản lược giá cố định theo sân.
- `src/main/java/com/mvc/mock_project/service/AdminFacilityService.java`: mã nguồn có duyệt cơ sở; bản mới bỏ bước duyệt này và giữ quyền quản lý/khóa của admin.
- `src/main/java/com/mvc/mock_project/service/impl/FacilityServiceImpl.java`: danh sách cơ sở và lọc theo tên, môn, địa điểm, giá; bỏ lọc yêu thích và dịch vụ.
- `src/main/java/com/mvc/mock_project/service/BookingService.java` và `service/impl/BookingServiceImpl.java`: lịch sân, tạo booking, giá do server tính, giữ lịch, đơn tại sân, check-in/out và thanh toán; bản mới giữ luồng chờ thanh toán VNPay, bỏ dịch vụ/voucher/hoa hồng và chuyển dữ liệu lịch sang khoảng đã gộp.
- `src/main/java/com/mvc/mock_project/controller/api/booking/CustomerBookingApiController.java`: xem đơn, tự hủy đơn `PENDING` và tiếp tục thanh toán khi còn hạn; đây là căn cứ bỏ giả định tự hủy trước 2 giờ của bản đặc tả trả tiền tại sân.
- `src/main/java/com/mvc/mock_project/controller/api/booking/OwnerBookingApiController.java`: quản lý timeline và đơn tại sân; bản mới dùng ba vai trò và không có staff.
- `src/main/java/com/mvc/mock_project/service/impl/AccountServiceImpl.java`: tham khảo quản lý tài khoản; bản mới admin cấp owner rồi gửi email kích hoạt để owner tự đặt mật khẩu, không dùng mật khẩu mặc định.
- `src/main/java/com/mvc/mock_project/entities/Booking.java`, `BookingSlot.java`, `Court.java` và `entities/enums/`: tham khảo quan hệ và trạng thái; các trạng thái trong tài liệu là thiết kế mới đã giản lược.
- `database/sport_booking_marketplace.sql`: tham khảo mô hình cơ sở/sân/booking, ràng buộc slot và nhận diện các nhóm bảng mở rộng cần loại bỏ. Việc có bảng trong SQL không đồng nghĩa tính năng đó đã được triển khai hoàn chỉnh.

Phần yêu cầu gộp khoảng, chống giao lịch, xử lý đồng thời, email xác thực/thông báo và các tình huống biên trong tài liệu là tiêu chí cho dự án mới; không khẳng định mã nguồn SportHub hiện tại đã đáp ứng đầy đủ các tiêu chí này. Mô hình BookingRequest và Booking dạng khoảng thay thế cách lưu theo từng ô ở đặc tả trước.

### 16.1. Tính năng VNPay tìm thấy trong mã nguồn

**Kết luận từ code:** luồng đặt trực tuyến thu toàn bộ tiền sân sau giảm giá ngay khi đặt. Dự án gốc có thêm tiền dịch vụ nên không thể gọi đây là thu đủ toàn bộ hóa đơn có dịch vụ; với dự án mới đã loại dịch vụ và voucher, tiền sân chính là 100% tổng tiền cần trả.

1. **Khởi tạo và giữ sân:** `createBookingTransaction()` tạo Booking `PENDING`, đặt `holdExpiredAt = now + 10 phút`, tính tiền sân trên server, lưu giá tại thời điểm đặt và tạo Invoice `UNPAID`, `paidAmount = 0`, `depositPercent = 100`. Xem [BookingServiceImpl.java — giữ chỗ](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/service/impl/BookingServiceImpl.java:297>) và [khởi tạo hóa đơn](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/service/impl/BookingServiceImpl.java:454>).
2. **Số tiền gửi VNPay:** endpoint `POST /api/payment/create-payment` lấy `courtPayable = invoice.courtAmount − invoice.discountAmount`, chặn tối thiểu 0, dùng id Invoice làm mã tham chiếu rồi redirect sang URL do VNPayService tạo. Không có phép nhân tỷ lệ đặt cọc 20%/30%/50%; trường tên `deposit` không thay đổi công thức thu đủ tiền sân. Xem [PaymentController.java](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/controller/web/booking_process/PaymentController.java:71>).
3. **Tạo đường dẫn thanh toán:** `createOrder()` đặt phiên bản `2.1.0`, lệnh `pay`, tiền tệ `VND`, `vnp_Amount = courtPayable × 100`, mã tham chiếu, nội dung, URL trở về và ngày tạo/hết hạn. Sắp xếp tham số, mã hóa và ký HMAC-SHA512 để tạo `vnp_SecureHash`. Code hiện tạo URL hết hạn sau 15 phút. Xem [VNPayServiceImpl.java](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/service/impl/VNPayServiceImpl.java:31>).
4. **Nhận kết quả:** có cả `GET /api/payment/vnpay-return` cho khách quay về và `GET /api/payment/vnpay-ipn` cho thông báo tới server. `orderReturn()` tính lại chữ ký; chữ ký đúng và `vnp_TransactionStatus == "00"` được xem là thành công trong code hiện tại. Cả hai endpoint gọi `processPaymentSuccess()`. Xem [return](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/controller/web/booking_process/PaymentController.java:80>), [IPN](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/controller/web/booking_process/PaymentController.java:133>) và [kiểm tra kết quả](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/service/impl/VNPayServiceImpl.java:108>).
5. **Cập nhật khi trả tiền thành công:** `processPaymentSuccess()` tìm Invoice, bỏ qua nếu đã có Payment `PAID/PARTIAL`, chuyển số tiền callback về VND bằng cách chia 100, ghi `paidAmount`, đổi Booking sang `CONFIRMED`, lưu giao dịch gồm mã VNPay, số tiền, thời điểm và phương thức `VNPAY`. Tuy nhiên Invoice và Payment bị gán `PARTIAL`, loại `DEPOSIT`, kể cả khi không có dịch vụ. Xem [BookingServiceImpl.java — xử lý thành công](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/service/impl/BookingServiceImpl.java:510>).
6. **Vì sao hiển thị PARTIAL:** màn hình return ghi rõ đã trả tiền sân, chưa trả dịch vụ kèm theo; `checkOutAndSettle()` còn tính phần tiền còn lại khi khách chơi xong. Đây là cách phân chia của dự án gốc, không phải chỉ thu một phần tiền sân. Bản mới không mang theo dịch vụ, `PARTIAL`, `DEPOSIT`, voucher hoặc đoạn tạo PlatformCommission. Xem [thông báo kết quả gốc](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/controller/web/booking_process/PaymentController.java:110>) và [xử lý tiền còn lại](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/service/impl/BookingServiceImpl.java:1093>).
7. **Tiếp tục thanh toán và hết hạn:** customer có endpoint `continue-payment`, chỉ chấp nhận đơn thuộc mình còn `PENDING` và chưa hết hold. Tác vụ chạy mỗi 30 giây gọi `cancelExpiredBookings()`, chuyển đơn/hóa đơn hết hạn sang hủy và xóa các bản ghi giữ slot; đơn đã có Payment `PAID/PARTIAL` được bỏ qua. Bản mới giữ hành vi nhả lịch nhưng dùng `EXPIRED` riêng và dữ liệu khoảng thay vì xóa slot. Xem [CustomerBookingApiController.java](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/controller/api/booking/CustomerBookingApiController.java:164>), [BookingCleanupTask.java](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/task/BookingCleanupTask.java:17>) và [cleanup](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/service/impl/BookingServiceImpl.java:478>).
8. **Email:** code gọi `sendPaymentSuccessEmail()` khi tham số email được truyền vào có giá trị. Luồng IPN hiện truyền `null`, trong khi return lấy email theo phiên đăng nhập. Bản mới phải lấy người nhận từ dữ liệu yêu cầu đã lưu và dùng outbox để việc gửi không phụ thuộc khách quay lại website. Xem [lệnh gửi email](<F:/FPT/OJT/Mock Project/SportHub/sport-hub/src/main/java/com/mvc/mock_project/service/impl/BookingServiceImpl.java:643>).

### 16.2. Các điểm phải điều chỉnh khi áp dụng cho bản mới

- **Thời hạn:** hold 10 phút nhưng URL VNPay gốc 15 phút; thống nhất cùng một mốc 10 phút, kể cả khi tiếp tục thanh toán.
- **Trạng thái tiền:** code gán `PARTIAL/DEPOSIT` sau thanh toán; bản chỉ có tiền sân phải là `PAID`, hoàn tất buổi chơi không thu lần nữa.
- **Xác minh tiền và trạng thái:** trong hàm thành công đã đọc chưa có đối chiếu số tiền callback bằng số phải trả và chưa chặn xác nhận lại Booking đã hủy/hết hạn. Bản mới bắt buộc các kiểm tra ở mục 8.6; không sao chép hành vi dùng tiền mặc định khi parse lỗi.
- **Chống lặp đồng thời:** kiểm tra "đã có Payment hay chưa" ở đầu hàm gốc chưa đủ để chứng minh chống race giữa return/IPN; thiết kế mới yêu cầu ràng buộc giao dịch duy nhất và khóa trạng thái như mục 8.3.
- **Kết quả giao diện:** return gốc bắt exception rồi vẫn có đường hiển thị SUCCESS. Bản mới chỉ hiển thị kết quả xác nhận đã lưu, còn lỗi xử lý phải hiện đang xác minh/cần hỗ trợ.
- **Email:** IPN đi trước có thể lưu Payment mà không gửi mail; return tới sau bị chặn ghi lại nên cũng không gửi. Bản mới tạo sự kiện email cùng giao dịch xác nhận, lấy người nhận từ BookingRequest.
- **Hủy và hoàn tiền:** customer controller gốc chỉ chuyển trạng thái khi đơn `PENDING`; chưa tìm thấy triển khai hoàn tiền trong các controller/service đã tìm. Các trường refund chỉ là dữ liệu. Hỗ trợ hoàn tiền thủ công ở mục 8.7 là thiết kế mới để xử lý khoản đã thu mà không phục vụ được.
- **Đơn tại sân:** code gốc có nhánh tạo đơn onsite và ghi nhận phương thức khác. Bản mới thống nhất yêu cầu thu qua VNPay cho cả đơn owner tạo hộ, không giữ nhánh xác nhận tiền mặt.

Các nhận xét trên dựa trên đọc mã nguồn, chưa chạy giao dịch VNPay thực tế. Tài liệu mô tả hành vi và yêu cầu cho dự án Node.js; không sửa mã nguồn Java hoặc thực hiện thu/hoàn tiền thật.
