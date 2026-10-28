# Cấu trúc dự án đặt sân — React, Node.js và MongoDB

> Đề xuất ngày 28/10/2026, dựa trên `docs/features.md` trong dự án.
> Đã tạo thư mục gốc `sport-booking/`, các thư mục backend theo layer và vị trí giữ chỗ cho client/test. Cây bên dưới mô tả cấu trúc đích; các file mã nguồn, package và cấu hình chạy chưa được triển khai.
> Mặc định dùng JavaScript ES Modules, React với Vite, Node.js với Express và Mongoose. Có thể chuyển sang TypeScript nếu nhóm muốn, nhưng không bắt buộc cho đồ án.
> Xác thực: JWT access token + refresh token trong cookie HttpOnly; thiết kế chi tiết tại mục 10. Triển khai backend trước theo `docs/planning/development-plan.md`, chỉ xây frontend sau khi đạt mốc BE-READY.

## 1. Kiến trúc đề xuất

Một repository chứa hai ứng dụng `client` và `server`. Backend là một ứng dụng được chia theo layer; mỗi layer đặt tên file theo nghiệp vụ. Frontend chia theo trách nhiệm và nhóm component theo chức năng. Chưa cần microservices hoặc các lớp abstract/factory phức tạp.

Ba tier của hệ thống:

1. **Presentation tier — React:** trang, component, tương tác, biểu mẫu, gọi HTTP API và hiển thị kết quả.
2. **Application tier — Node.js/Express:** xác thực, phân quyền, quy tắc đặt sân, tính tiền, xác nhận VNPay, email và xử lý tác vụ nền.
3. **Data tier — MongoDB:** lưu tài khoản, cơ sở, sân, khoảng đặt, giao dịch và các ràng buộc dữ liệu.

Phân biệt **tier** với **layer**: ba tier là cách phân chia hệ thống; `controller/service/repository` là các layer bên trong server. React không gọi MongoDB trực tiếp. Mongoose chạy trong server để truy cập data tier, không phải một tier thứ tư.

```text
React client
    │ HTTPS / JSON
    ▼
Express routes + middleware
    ▼
Controllers
    ▼
Services / business rules
    ├── Integrations → VNPay, email, image storage
    ▼
Repositories → Mongoose models
    ▼
MongoDB

Background jobs → cùng Services → Repositories → MongoDB
VNPay IPN → payment route → controller → payment service
```

Các tên thư mục bên dưới là quy ước đề xuất cho dự án này, không phải cấu trúc bắt buộc của React hoặc Express.

## 2. Cấu trúc tổng thể

```text
sport-booking/
├── AGENTS.md                       # Quy tắc chính cho AI agent
├── .cursor/rules/                  # Rule dẫn tới AGENTS.md
├── client/                         # Giữ chỗ; triển khai React từ P15
├── server/                         # Đã chuẩn bị thư mục; code từ phase phù hợp
├── docs/
│   ├── README.md                   # Mục lục tài liệu
│   ├── features.md                 # Đặc tả tính năng đã chốt
│   ├── architecture.md             # Hướng dẫn kiến trúc này
│   ├── planning/
│   │   ├── development-plan.md     # P00–P20, backend trước frontend
│   │   └── phase-status.json       # Trạng thái phase và gate
│   ├── guides/
│   │   └── ai-workflow.md          # Prompt và quy trình giao việc AI
│   ├── phase-reports/
│   │   └── TEMPLATE.md             # Mẫu; báo cáo thực tạo khi làm phase
│   ├── database.md                 # Tạo ở P00: collection, quan hệ, index
│   ├── api.openapi.yaml            # Tạo ở P00: hợp đồng API
│   └── testing.md                  # Bổ sung theo phase: kiểm thử và demo
├── tests/
│   └── e2e/                        # Luồng xuyên suốt client → API → DB
├── package.json                    # Scripts chung và npm workspaces
├── package-lock.json               # Lockfile chung nếu dùng workspaces
├── .gitignore
├── .editorconfig
└── README.md                       # Cách chạy client, API, worker và DB
```

Đề xuất npm workspaces cho `client` và `server` để quản lý trong cùng repository. Mỗi bên sẽ có `package.json`, biến môi trường và cách build riêng khi đến phase triển khai. Tài liệu hiện đã chuyển vào `docs/` theo cây trên; package/lockfile, cấu hình chạy và mã ứng dụng chưa được tạo. Đọc `README.md` ở gốc để xem chính xác cấu trúc hiện có; không coi toàn bộ cây đích là code đã triển khai.

## 3. Cấu trúc backend theo layer

```text
server/
├── src/
│   ├── app.js                      # Tạo Express app, middleware và routes
│   ├── server.js                   # Nạp config, kết nối DB, mở HTTP server
│   ├── worker.js                   # Chạy cleanup và gửi email nền
│   │
│   ├── config/
│   │   ├── env.js                  # Đọc/kiểm tra biến môi trường
│   │   ├── database.js             # Kết nối MongoDB
│   │   ├── auth.js
│   │   ├── cookies.js              # Cookie theo môi trường
│   │   ├── cors.js                 # Origin được phép, credentials
│   │   ├── vnpay.js
│   │   └── email.js
│   │
│   ├── routes/
│   │   ├── index.js                # Gắn API prefix /api/v1
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── sport.routes.js
│   │   ├── facility.routes.js
│   │   ├── court.routes.js
│   │   ├── schedule.routes.js
│   │   ├── booking.routes.js
│   │   ├── payment.routes.js
│   │   ├── refund.routes.js
│   │   └── admin.routes.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── sport.controller.js
│   │   ├── facility.controller.js
│   │   ├── court.controller.js
│   │   ├── schedule.controller.js
│   │   ├── booking.controller.js
│   │   ├── payment.controller.js
│   │   ├── refund.controller.js
│   │   └── admin.controller.js
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── session.service.js      # Tạo/rotate/thu hồi phiên đăng nhập
│   │   ├── user.service.js
│   │   ├── sport.service.js
│   │   ├── facility.service.js
│   │   ├── court.service.js
│   │   ├── dashboard.service.js
│   │   ├── booking/
│   │   │   ├── booking.service.js  # Tạo yêu cầu, hủy và kết thúc buổi chơi
│   │   │   ├── schedule.service.js # Xem lịch, phối hợp ghi, khóa và nhả lịch
│   │   │   ├── slot-merger.js      # Hàm thuần: kiểm tra/sắp xếp/gộp dải giờ
│   │   │   ├── pricing.js          # Hàm thuần: tính tiền theo số phút
│   │   │   └── booking-policy.js   # Quy tắc thời gian và chuyển trạng thái
│   │   ├── payment/
│   │   │   ├── payment.service.js  # PaymentOrder, callback, phân bổ khoản thu
│   │   │   └── refund.service.js   # Hồ sơ hoàn tiền hỗ trợ và hạn mức hoàn
│   │   └── email/
│   │       └── email.service.js    # Tạo/nhận việc/gửi lại tác vụ email
│   │
│   ├── repositories/
│   │   ├── user.repository.js
│   │   ├── auth-token.repository.js
│   │   ├── session.repository.js   # AuthSession và RefreshToken
│   │   ├── sport.repository.js
│   │   ├── facility.repository.js
│   │   ├── facility-sport.repository.js
│   │   ├── court.repository.js
│   │   ├── booking.repository.js
│   │   ├── booking-request.repository.js
│   │   ├── schedule.repository.js  # CourtBlock và CourtDaySchedule
│   │   ├── payment.repository.js   # PaymentOrder và PaymentTransaction
│   │   ├── refund.repository.js
│   │   ├── email-outbox.repository.js
│   │   └── action-log.repository.js
│   │
│   ├── models/
│   │   ├── user.model.js
│   │   ├── auth-token.model.js
│   │   ├── auth-session.model.js
│   │   ├── refresh-token.model.js
│   │   ├── sport.model.js
│   │   ├── facility.model.js
│   │   ├── facility-sport.model.js
│   │   ├── court.model.js
│   │   ├── booking-request.model.js
│   │   ├── booking.model.js
│   │   ├── court-block.model.js
│   │   ├── court-day-schedule.model.js
│   │   ├── payment-order.model.js
│   │   ├── payment-transaction.model.js
│   │   ├── refund-case.model.js
│   │   ├── email-outbox.model.js
│   │   └── action-log.model.js
│   │
│   ├── validators/
│   │   ├── auth.validator.js
│   │   ├── facility.validator.js
│   │   ├── court.validator.js
│   │   ├── schedule.validator.js
│   │   ├── booking.validator.js
│   │   ├── payment.validator.js
│   │   └── refund.validator.js
│   │
│   ├── middlewares/
│   │   ├── authenticate.js
│   │   ├── authorize.js
│   │   ├── auth-request-guard.js   # Origin + custom header cho auth mutation
│   │   ├── validate.js
│   │   ├── upload.js
│   │   ├── rate-limit.js
│   │   ├── not-found.js
│   │   └── error-handler.js
│   │
│   ├── integrations/
│   │   ├── vnpay.client.js         # Tạo/chứng thực dữ liệu giao tiếp VNPay
│   │   ├── mail.client.js          # Gửi email qua nhà cung cấp
│   │   └── storage.client.js       # Lưu/xóa ảnh
│   │
│   ├── jobs/
│   │   ├── expire-bookings.job.js
│   │   └── send-emails.job.js
│   ├── templates/
│   │   └── emails/                 # Xác thực, kích hoạt, kết quả đặt, hủy...
│   ├── database/
│   │   └── transaction.js          # Helper mở transaction và truyền session
│   ├── constants/
│   │   ├── roles.js
│   │   ├── booking-status.js
│   │   └── payment-status.js
│   ├── errors/
│   │   ├── app-error.js
│   │   └── error-codes.js
│   └── utils/
│       ├── jwt.js                  # Ký/xác minh JWT với cấu hình cố định
│       ├── date-time.js
│       ├── pagination.js
│       └── logger.js
│
├── scripts/
│   ├── seed.js                     # Admin và dữ liệu demo, không chạy khi boot
│   └── create-indexes.js            # Tạo/kiểm tra index cần thiết
├── tests/
│   ├── unit/                       # Gộp giờ, tính tiền, policy
│   ├── integration/                # API + MongoDB có transaction
│   └── fixtures/                   # Dữ liệu kiểm thử
├── .env.example                    # Tên biến và giá trị mẫu không có bí mật
└── package.json
```

Đây là cây đích theo phạm vi đã chốt. Chỉ tạo file khi triển khai nghiệp vụ tương ứng; không cần tạo ngay hàng loạt file rỗng. Một repository có thể quản lý vài model liên quan chặt chẽ như phần payment; không bắt buộc mỗi collection phải có controller, service và repository riêng.

## 4. Trách nhiệm và ranh giới backend

### 4.1. Routes và middleware

Routes khai báo đường dẫn, HTTP method, middleware và controller. Middleware xác thực, kiểm tra vai trò chung, kiểm tra cấu trúc input hoặc xử lý lỗi. Express hỗ trợ tách các nhóm đường dẫn bằng `Router`; đây là cơ sở cho cách chia `*.routes.js`. [Tài liệu Express Routing](https://expressjs.com/en/guide/routing/)

- Ví dụ `POST /api/v1/booking-requests`: authenticate → authorize customer → validate input → booking controller.
- Đường owner tạo hộ gọi cùng nghiệp vụ đặt sân nhưng truyền actor và nguồn `OWNER_CREATED`; không nhân đôi thuật toán gộp giờ/tính tiền.
- Route VNPay IPN không yêu cầu phiên đăng nhập customer; controller và payment service vẫn phải xác minh nguồn dữ liệu qua chữ ký/thông tin giao dịch.
- Quyền "owner này có sở hữu sân này không" được kiểm tra trong service sau khi lấy dữ liệu, không chỉ kiểm tra role ở route.

### 4.2. Controllers

Nhận dữ liệu đã kiểm tra, lấy actor từ phiên, gọi service, trả HTTP status và response được chọn lọc. Không dùng Mongoose trực tiếp, không tính tổng tiền hoặc tự chuyển trạng thái Booking.

Controller trả DTO rõ ràng thay vì toàn bộ document Mongoose; ví dụ không trả password hash, token, bí mật thanh toán hoặc thông tin khách khác. Bản đầu có thể viết hàm chuyển response cạnh controller; chỉ tách `serializers/` khi thực sự có nhiều định dạng dùng lại.

### 4.3. Services

Chứa quy tắc nghiệp vụ và điều phối transaction. Service nhận dữ liệu thuần cùng actor, không nhận `req`/`res`, không chọn HTTP status. Nhờ đó cùng một service dùng được từ controller hoặc job.

- `booking.service`: kiểm tra quyền, tạo toàn bộ yêu cầu đặt, hủy theo trạng thái, hoàn tất/no-show.
- `schedule.service`: lịch trống, khóa lịch, cùng cơ chế phối hợp ghi sân/ngày cho đặt, thanh toán và cleanup.
- `slot-merger`: sắp xếp, loại ô trùng, gộp liền nhau, giữ dải rời nhau; không truy cập DB.
- `pricing`: tính tiền chính xác theo phút và quy tắc làm tròn; không gọi VNPay.
- `payment.service`: phát hành PaymentOrder, xác minh nghiệp vụ callback, chốt khoản thu và phân bổ vào Booking.
- `refund.service`: kiểm tra điều kiện hỗ trợ, số tiền còn được hoàn và ghi bằng chứng hoàn bên ngoài.
- `email.service`: tạo outbox và điều phối gửi email; không trực tiếp quyết định một Booking đã trả tiền hay chưa.

Tránh phụ thuộc vòng: `booking.service` và `payment.service` dùng chung `schedule.service` và các hàm policy; không gọi ngược lẫn nhau. Booking service có thể tạo PaymentOrder chờ thông qua repository trong transaction của nó; payment service chịu trách nhiệm tạo URL và xử lý kết quả sau đó. Không tạo service riêng chỉ để chuyển tiếp một hàm.

### 4.4. Repositories và models

Repository chứa truy vấn MongoDB, update có điều kiện, aggregation và thao tác phối hợp ghi. Các thao tác thuộc một transaction nhận cùng tham số `session` do service truyền xuống; repository không tự mở transaction lồng bên trong.

Model khai báo schema, kiểu dữ liệu, các ràng buộc và index. Không đặt nghiệp vụ VNPay/email trong model hook vì khó kiểm soát retry, thứ tự và transaction.

Ví dụ giao diện repository theo mục đích: `findOverlappingBookings`, `createMany`, `transitionIfCurrentStatus`, `findByVnpayReference`; tránh dựng generic repository có quá nhiều abstract chỉ để bọc lại toàn bộ Mongoose.

### 4.5. Integrations, jobs và utils

- `integrations`: giao tiếp bên ngoài. `vnpay.client` ký/kiểm tra chữ ký và chuẩn hóa tham số; quyết định có xác nhận Booking hay không thuộc payment service.
- `jobs`: lịch gọi service định kỳ. Không tự lặp lại quy tắc hết hạn hoặc truy vấn thẳng model để đổi trạng thái.
- `utils`: hàm dùng chung không gắn với nghiệp vụ cụ thể. Gộp slot/tính tiền sân nằm trong nhóm booking, không gom mọi thứ vào utils.
- `worker.js`: tiến trình Node chạy job, vẫn thuộc application tier và dùng cùng mã nguồn server. Nếu chạy nhiều worker, nhận việc bằng thao tác nguyên tử/lease có hạn trên database để tránh nhiều worker cùng gửi; trạng thái Booking/Payment vẫn cần chống xử lý lặp.

Tách `app.js` khỏi `server.js` để kiểm thử API bằng app mà không cần tự mở cổng trong mỗi test. Worker không khởi động lại HTTP server. Không tự chạy seed hoặc tạo lại dữ liệu mỗi khi ứng dụng mở.

## 5. Cấu trúc frontend theo trách nhiệm và component

```text
client/
├── public/                         # Tệp tĩnh phục vụ nguyên trạng
├── src/
│   ├── main.jsx
│   ├── app/
│   │   ├── App.jsx
│   │   ├── router.jsx              # Đăng ký các route/trang
│   │   └── providers.jsx           # Ghép provider dùng chung
│   ├── layouts/
│   │   ├── PublicLayout.jsx
│   │   ├── CustomerLayout.jsx
│   │   └── DashboardLayout.jsx     # Khung chung cho owner/admin
│   ├── pages/
│   │   ├── public/
│   │   │   ├── FacilityListPage.jsx
│   │   │   └── FacilityDetailPage.jsx
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── VerifyEmailPage.jsx
│   │   │   ├── ActivateOwnerPage.jsx
│   │   │   ├── ForgotPasswordPage.jsx
│   │   │   └── ResetPasswordPage.jsx
│   │   ├── account/
│   │   │   └── ProfilePage.jsx
│   │   ├── customer/
│   │   │   ├── BookingCheckoutPage.jsx
│   │   │   ├── MyBookingsPage.jsx
│   │   │   └── BookingDetailPage.jsx
│   │   ├── payment/
│   │   │   ├── PaymentPendingPage.jsx
│   │   │   └── PaymentResultPage.jsx
│   │   ├── owner/
│   │   │   ├── OwnerDashboardPage.jsx
│   │   │   ├── OwnerFacilitiesPage.jsx
│   │   │   ├── FacilityEditorPage.jsx
│   │   │   ├── CourtManagementPage.jsx
│   │   │   ├── FacilitySportSettingsPage.jsx
│   │   │   ├── OwnerSchedulePage.jsx
│   │   │   ├── OwnerBookingsPage.jsx
│   │   │   └── CreateOnBehalfBookingPage.jsx
│   │   ├── admin/
│   │   │   ├── AdminDashboardPage.jsx
│   │   │   ├── UserManagementPage.jsx
│   │   │   ├── SportManagementPage.jsx
│   │   │   ├── FacilityManagementPage.jsx
│   │   │   ├── BookingManagementPage.jsx
│   │   │   ├── PaymentManagementPage.jsx
│   │   │   ├── RefundManagementPage.jsx
│   │   │   └── EmailOutboxPage.jsx
│   │   └── errors/
│   │       ├── ForbiddenPage.jsx
│   │       └── NotFoundPage.jsx
│   ├── components/
│   │   ├── ui/                     # Button, Input, Modal, Select, Table...
│   │   ├── feedback/               # LoadingState, EmptyState, ErrorState
│   │   ├── navigation/             # Header, Sidebar, Pagination
│   │   ├── auth/                   # LoginForm, RegisterForm, RouteGuard
│   │   ├── facilities/             # FacilityCard, FacilityFilter, FacilityForm
│   │   ├── courts/                 # CourtForm, CourtSelector, SlotStepForm
│   │   ├── scheduling/
│   │   │   ├── CourtSchedule.jsx
│   │   │   ├── TimeSlotCell.jsx
│   │   │   ├── ScheduleLegend.jsx
│   │   │   └── SelectedRanges.jsx
│   │   ├── bookings/               # BookingSummary, BookingStatus, BookingList
│   │   └── payments/               # PaymentCountdown, PaymentStatus, RefundInfo
│   ├── api/
│   │   ├── http-client.js          # Base URL, credentials, lỗi HTTP chung
│   │   ├── token-memory.js         # Access token trong RAM, không lưu bền
│   │   ├── refresh-coordinator.js  # Một luồng refresh, phối hợp nhiều tab
│   │   ├── auth.api.js
│   │   ├── user.api.js
│   │   ├── sport.api.js
│   │   ├── facility.api.js
│   │   ├── court.api.js
│   │   ├── schedule.api.js
│   │   ├── booking.api.js
│   │   ├── payment.api.js
│   │   ├── refund.api.js
│   │   └── admin.api.js
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useFacilities.js
│   │   ├── useCourtSchedule.js
│   │   ├── useBookingSelection.js
│   │   └── usePaymentStatus.js
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── validators/                 # Kiểm tra biểu mẫu để phản hồi nhanh
│   ├── constants/                  # Nhãn trạng thái, menu và route
│   ├── utils/                      # formatCurrency, formatDateTime...
│   ├── assets/                     # Ảnh/icon được import và bundle
│   └── styles/                     # Theme, reset và styles dùng chung
├── tests/
│   └── components/                 # Chọn giờ, hiển thị lỗi, trạng thái trả tiền
├── index.html
├── vite.config.js
├── .env.example                    # Chỉ biến cấu hình công khai cho client
└── package.json
```

### 5.1. Phân biệt page, layout và component

- **Page** đại diện một màn hình được router truy cập. Ghép component, gọi hook và điều phối hành động trên màn hình.
- **Layout** chứa khung chung: header, sidebar, vùng nội dung. DashboardLayout dùng menu theo role; việc ẩn menu không thay thế phân quyền server.
- **Component UI** là phần dùng chung như Button/Modal, không biết Booking hay VNPay là gì.
- **Component nghiệp vụ** như CourtSchedule/BookingSummary hiểu dữ liệu chức năng đó và tái sử dụng giữa màn hình customer, owner hoặc admin.

React khuyến khích chia UI thành cây component theo trách nhiệm và truyền dữ liệu từ trên xuống; các thư mục ở đây là cách áp dụng nguyên tắc đó cho dự án đặt sân. [Thinking in React](https://react.dev/learn/thinking-in-react)

### 5.2. Ví dụ tách màn hình chọn sân

```text
FacilityDetailPage
├── Facility information / images
├── CourtSelector
├── Date input
├── CourtSchedule
│   ├── ScheduleLegend
│   └── TimeSlotCell × N
└── SelectedRanges

BookingCheckoutPage
├── Contact form
├── BookingSummary
└── Confirm and pay button

PaymentPendingPage
├── BookingSummary
├── PaymentCountdown
└── Continue payment button
```

`TimeSlotCell` nhận giờ, trạng thái, selected và `onSelect`; không gọi API mỗi ô. `useCourtSchedule` lấy lịch của cả sân/ngày. `useBookingSelection` giữ lựa chọn ở màn hình và tính bản xem trước; server luôn kiểm tra/gộp lại trước khi giữ chỗ.

`usePaymentStatus` đọc trạng thái từ server khi chờ kết quả; polling có khoảng chờ hợp lý, dừng khi trạng thái cuối hoặc rời trang. Không đánh dấu đã trả tiền chỉ dựa vào query string của URL return.

### 5.3. API, hooks và state

- `api/` chứa hàm gọi HTTP, không render và không chứa quy tắc quyết định đã thanh toán.
- `hooks/` điều phối dữ liệu, loading/error và hành động lặp lại trên UI. Hook được gọi từ page hoặc component có trách nhiệm điều phối; component UI đơn giản chỉ nhận props.
- `AuthContext` giữ user và trạng thái `loading/authenticated/anonymous`; access token do lớp API giữ trong RAM. Không lưu access/refresh token vào localStorage, sessionStorage hoặc state được persist. Cơ chế bootstrap/refresh được chốt ở mục 10.
- Chọn ngày/sân/ô giờ dùng state cục bộ; bộ lọc có thể nằm trong URL để tải lại trang vẫn giữ lựa chọn. Chưa cần Redux cho phạm vi hiện tại.
- Tiền hiển thị ở frontend là bản xem trước; server chốt giá, bước giờ và hạn giữ chỗ. Đếm ngược hiển thị dựa trên expiresAt từ server, không tự quyết định nhả lịch.
- Frontend validator phục vụ trải nghiệm; backend validator và service vẫn phải kiểm tra lại toàn bộ dữ liệu.

## 6. Ánh xạ các nghiệp vụ quan trọng

### 6.1. Đặt sân và gộp các khoảng

```text
BookingCheckoutPage
  → booking.api.createRequest()
  → booking.routes
  → booking.controller
  → booking.service
      → slot-merger + pricing + booking-policy
      → transaction helper
          → schedule.service / schedule.repository
          → booking-request.repository
          → booking.repository
          → payment.repository
  → payment.service phát hành URL cho PaymentOrder đã lưu
  → phản hồi mã yêu cầu, Booking chờ, hạn giữ và payment URL
```

Ví dụ hai ô `06:00–06:30` và `06:30–07:00` tạo một Booking `06:00–07:00`. Nếu thêm dải `08:00–09:00`, cùng BookingRequest có thêm một Booking riêng. PaymentOrder thu tổng tiền các Booking của yêu cầu; không tạo collection slot nhỏ.

Tạo URL sau khi commit không được tạo lại đơn nếu lỗi hoặc mất phản hồi: client dùng cùng mã yêu cầu để lấy lại BookingRequest/PaymentOrder đã có. Giá và thời hạn giữ chỗ không thay đổi khi thử lại.

### 6.2. Callback VNPay

```text
VNPay IPN / return
  → payment.routes
  → payment.controller
  → payment.service
      → vnpay.client: kiểm tra chữ ký, chuẩn hóa callback
      → kiểm tra tham chiếu, số tiền, trạng thái và hạn giữ
      → transaction: phối hợp ghi lịch + cập nhật Payment/Booking + outbox
  → phản hồi theo giao thức của endpoint

send-emails.job
  → email.service
  → mail.client
```

IPN được phản hồi theo giao thức VNPay, không ép vào JSON response thông thường của frontend. Return điều hướng/hiển thị trang kết quả và cùng dùng logic xác minh chống lặp. Không đặt hai bản xử lý thanh toán riêng ở hai controller.

### 6.3. Đơn hết hạn

`expire-bookings.job` gọi nghiệp vụ hết hạn của booking service; nghiệp vụ này sử dụng cùng phối hợp ghi PaymentOrder/lịch như callback và hủy đơn. Nó không được hủy một đơn mà thanh toán đã xác nhận trước đó. Booking hết hạn giữ lại để tra cứu, không dùng TTL xóa Booking hoặc Payment.

## 7. Các lưu ý MongoDB ảnh hưởng trực tiếp cấu trúc này

- Phần tạo nhiều Booking và PaymentOrder cần transaction nhiều document. Môi trường MongoDB standalone không hỗ trợ transaction; cấu hình replica set phù hợp hoặc dùng một deployment hỗ trợ transaction. [MongoDB — Production Considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
- Service mở transaction bằng helper, truyền cùng session cho mọi truy vấn liên quan. `Connection#transaction()`/`withTransaction()` hỗ trợ commit, abort và retry lỗi phù hợp. Không chạy `Promise.all` hoặc mở transaction lồng trên cùng session. [Mongoose Transactions](https://mongoosejs.com/docs/transactions.html)
- Transaction không tự chứng minh không trùng khoảng. `schedule.repository` phải phối hợp ghi thật trên document CourtDaySchedule cùng sân/ngày trước khi kiểm tra giao khoảng; unique giờ bắt đầu không đủ. Cần xử lý khởi tạo document phối hợp đồng thời và retry đọc lại khi xung đột ghi. Giá/cấu hình/trạng thái cơ sở thay đổi cũng phải được phối hợp, theo đặc tả tính năng.
- Callback transaction có thể chạy lại; không gửi email, gọi dịch vụ hoàn tiền hoặc tạo tác dụng bên ngoài không thể lặp trong callback. Chỉ ghi outbox, rồi gửi sau commit.
- Unique index cần có cho email chuẩn hóa, FacilitySport theo cơ sở/môn, mã yêu cầu theo actor/thao tác, mã tham chiếu thanh toán, mã giao dịch hợp lệ và khóa sự kiện email. Index được triển khai rõ ràng bằng script, không chỉ khai báo rồi giả định đã tồn tại.
- Giữ FacilityImage dạng mảng trong Facility vì giới hạn tối đa 10 ảnh. Booking, PaymentTransaction, EmailOutbox và lịch sử dài hạn là collection riêng; không nhúng danh sách đơn tăng vô hạn vào User hoặc Facility.
- Thời gian nghiệp vụ lưu nhất quán, ví dụ bookingDate dạng ngày địa phương và start/end dạng phút trong ngày hoặc timestamp đã quy đổi rõ. Chọn một cách rồi dùng xuyên suốt; không trộn chuỗi giờ không chuẩn hóa với timestamp khi kiểm tra giao nhau.

Các quy tắc phối hợp lịch là thiết kế riêng cho nghiệp vụ đặt sân, không phải tính năng tự có chỉ nhờ dùng Mongoose.

## 8. Quy ước để nhóm dễ làm việc

- Component/page/layout dùng PascalCase: `BookingSummary.jsx`.
- File backend dùng tên nghiệp vụ và hậu tố trách nhiệm: `booking.controller.js`, `booking.service.js`, `booking.repository.js`, `booking.model.js`.
- Hàm/biến dùng camelCase; mã trạng thái nghiệp vụ như `PENDING_PAYMENT`, `CONFIRMED`, `PAID` dùng hằng số có định nghĩa chung trong backend.
- Client chỉ biết hợp đồng API; không import model, repository, cấu hình VNPay hoặc module Node từ server. Nhãn trạng thái UI có thể ánh xạ riêng, nhưng phải khớp enum trong tài liệu API.
- Một bộ nghiệp vụ đặt sân dùng cho customer và owner tạo hộ; actor, quyền sở hữu và nguồn đơn là dữ liệu đầu vào, không viết hai thuật toán đặt sân.
- Mỗi thành viên phụ trách một nhóm chức năng xuyên các layer, ví dụ booking gồm route/controller/service/repository/UI. Không chia một người viết tất cả controller, một người viết tất cả service vì dễ phải chờ nhau.
- Giữ domain service tách khỏi HTTP. Chưa cần thêm `usecases`, `entities` thuần, dependency-injection container hoặc tầng DTO riêng cho mọi model nếu chúng chỉ lặp lại dữ liệu.
- Không đưa bí mật vào biến môi trường frontend; mọi biến được đưa vào bundle phải coi là công khai. `.env.example` chỉ chứa tên biến và giá trị mẫu.

## 9. Kiểm thử phù hợp với từng phần

- **Unit:** gộp dải 30/60/90 phút, giữ khoảng trống, tính tiền/làm tròn, điều kiện chuyển trạng thái.
- **Integration:** phân quyền sở hữu, hai yêu cầu giao giờ đồng thời, nhiều Booking cùng transaction, callback lặp, callback tranh chấp với hủy/hết hạn, email outbox chỉ xuất hiện sau commit.
- **Component:** chọn/bỏ chọn giờ, hiển thị dải gộp và trạng thái thanh toán đang xác minh; không viết test chỉ để chứng minh mỗi file render được.
- **E2E:** đăng nhập → tìm sân → chọn giờ → tạo yêu cầu → mô phỏng callback đã ký trong môi trường test → xem đơn đã xác nhận. Giữ một kịch bản VNPay môi trường thử nghiệm riêng để kiểm tra tích hợp; không dùng tiền thật cho test tự động.

Ưu tiên hoàn thành toàn bộ backend, kiểm thử và đạt mốc BE-READY trong `docs/planning/development-plan.md` trước khi viết giao diện React. Có thể chuẩn bị hợp đồng API, mô tả màn hình và trang HTML kiểm thử cookie tối thiểu trong giai đoạn backend; chúng không phải frontend sản phẩm.

## 10. Thiết kế JWT, cookie và quản lý phiên

### 10.1. Phương án áp dụng

- **Access token:** JWT có chữ ký, hạn 10 phút. API login/refresh trả trong JSON; React giữ trong RAM và gửi bằng `Authorization: Bearer <accessToken>` cho API cần đăng nhập.
- **Refresh token:** chuỗi ngẫu nhiên mật mã tối thiểu 32 byte, không cần là JWT. Server lưu hash, gửi giá trị thật chỉ qua cookie HttpOnly. Có khả năng thu hồi/rotate theo phiên; không trả refresh token trong JSON.
- **Phiên đăng nhập:** tối đa 7 ngày kể từ login, không kéo dài vô hạn khi refresh. Hạn refresh mới không vượt hạn tuyệt đối của phiên; access token cuối phiên cũng không vượt hạn phiên.
- **Token email:** tiếp tục dùng AuthToken ngẫu nhiên một lần cho verify/activate/reset; không dùng access hoặc refresh token thay thế.
- **Bí mật VNPay/link trả tiền cho khách không tài khoản:** có mục đích riêng, không phải JWT đăng nhập và không cấp quyền truy cập hồ sơ khách.

Thời hạn 10 phút/7 ngày là lựa chọn cho dự án, đặt trong cấu hình. Đây là JWT kết hợp quản lý phiên tại server để đáp ứng yêu cầu thu hồi ngay, không phải xác thực hoàn toàn không lưu trạng thái.

JWT có chữ ký không mặc nhiên mã hóa nội dung. Giữ claims tối thiểu và không nhét mật khẩu, thông tin thanh toán hoặc dữ liệu cá nhân không cần thiết vào token. [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html)

### 10.2. Cookie refresh

Đề xuất cookie tên `refresh_token` với:

- `HttpOnly=true`: JavaScript frontend không đọc được refresh token.
- `Secure=true` trên môi trường HTTPS triển khai.
- `SameSite=Lax`: mặc định khi frontend/API chạy cùng site; ưu tiên cùng origin qua reverse proxy `/api`.
- `Path=/api/v1/auth`: gửi cookie chỉ tới nhóm endpoint auth cần nó; Path giúp giảm phạm vi gửi, không thay thế kiểm tra quyền.
- Không đặt `Domain` để cookie là host-only; `Max-Age` bằng số giây còn lại của phiên, tối đa 7 ngày.
- Xóa cookie khi logout bằng đúng tên/path/domain đã dùng khi đặt; không chỉ xóa state trong React.

`HttpOnly` hạn chế đọc cookie từ JavaScript, còn `Secure` giới hạn gửi qua HTTPS. Các thuộc tính này không tự ngăn mọi XSS/CSRF. [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)

Môi trường local dùng Vite proxy `/api` và cùng hostname `localhost`; nếu chạy HTTP local thì cấu hình `Secure=false` chỉ cho development. Production kiểm tra cấu hình lúc khởi động để không vô tình dùng cấu hình local.

Nếu frontend/API khác origin nhưng cùng site thì bật credentials và CORS cho đúng origin cụ thể. Nếu thực sự khác site, cookie có thể cần `SameSite=None; Secure` và chịu chính sách cookie bên thứ ba; tránh thiết kế này cho bản đầu, không tự đổi `None` để chữa lỗi CORS.

### 10.3. JWT và trạng thái phiên phía server

- Claims: `sub` (userId), `sid` (sessionId), `ver` (tokenVersion của User), `iat`, `exp`, `iss`, `aud`, `type=access`. Role nếu có chỉ phục vụ gợi ý, quyền cuối cùng dựa trên User hiện tại trong DB.
- Một backend có thể dùng HS256 với bí mật ngẫu nhiên tối thiểu 256 bit chỉ ở server. Khóa algorithm được phép, kiểm tra chữ ký, exp, issuer, audience và type; không chọn thuật toán theo dữ liệu client hoặc dùng thao tác decode làm xác minh.
- `authenticate` kiểm tra JWT rồi đọc AuthSession và User: phiên còn hiệu lực, sid thuộc sub, ver khớp, user không khóa và đã xác thực/kích hoạt. Mọi yêu cầu được xác thực sau khi thao tác thu hồi đã commit phải bị từ chối nếu dùng phiên cũ.
- Kiểm tra phiên mỗi request là đánh đổi có chủ đích để thu hồi ngay. Bản đầu không cache trạng thái khóa/thu hồi; các request đã được xác thực và đang chạy cần kiểm tra điều kiện nghiệp vụ trong transaction theo đặc tả.
- AuthSession lưu userId, createdAt, absoluteExpiresAt, revokedAt, lý do thu hồi; RefreshToken lưu sessionId, tokenHash duy nhất, createdAt, expiresAt, usedAt, revokedAt, replacedBy. Giữ token đã dùng đến khi phiên hết hạn để nhận diện phát lại.
- Dùng `expiresAt` để kiểm tra ở ứng dụng; TTL chỉ dọn dữ liệu sau hạn, không quyết định token còn dùng được hay không. Index/TTL không xóa Booking, Payment hoặc lịch sử tiền.
- Không log header Authorization, giá trị cookie hoặc token email; log sessionId, userId và mã lỗi khi cần tra cứu.

### 10.4. Refresh, logout và vô hiệu phiên

1. **Login:** xác thực thông tin + trạng thái tài khoản → tạo AuthSession và refresh token → đặt cookie → trả access JWT và user đã lọc. Đăng nhập đúng mật khẩu nhưng email chưa xác thực vẫn không cấp phiên dùng nghiệp vụ.
2. **Bootstrap sau tải lại trang:** client chưa có access token → gửi POST refresh với cookie/guard → nhận JWT mới → lấy `/users/me` → cập nhật AuthContext. Nếu không có phiên hợp lệ, chuyển anonymous; không refresh liên tục.
3. **Refresh rotation:** kiểm tra hash token và phiên, trong transaction đánh dấu token cũ đã dùng và tạo token mới. Sau commit đặt cookie mới và trả JWT mới. Một token refresh chỉ dùng thành công một lần.
4. **Phát lại token đã dùng:** thu hồi toàn bộ phiên tương ứng và bắt đăng nhập lại; không ảnh hưởng phiên khác nếu chỉ phát hiện reuse trên một sid. Token không nhận diện được bị từ chối, không tùy tiện thu hồi phiên khác.
5. **Logout:** thu hồi AuthSession hiện tại và tất cả refresh token của phiên, xóa cookie; client xóa access token trong RAM. Endpoint dùng refresh cookie và guard, nên vẫn logout được khi access token đã hết hạn. Không có cookie/phiên thì trả kết quả idempotent và vẫn xóa cookie.
6. **Logout tất cả, đổi/reset mật khẩu, admin khóa:** tăng tokenVersion, thu hồi tất cả phiên trong cùng giao dịch phù hợp. Đổi/reset mật khẩu buộc đăng nhập lại; mở khóa không khôi phục token/phiên cũ. Khóa User vẫn cho IPN VNPay xác minh tiền như đặc tả vì IPN không dùng phiên user.

Refresh có thể mất phản hồi sau khi server đã rotate. Bản đầu xử lý theo hướng yêu cầu đăng nhập lại nếu token cũ được gửi lại, không trả token mới cho token đã dùng. Đây là đánh đổi về trải nghiệm được ghi rõ, không tự retry refresh vô hạn.

Frontend chỉ có một refresh đang chạy; các API 401 do `ACCESS_TOKEN_EXPIRED` chờ cùng kết quả rồi thử lại tối đa một lần. Không refresh khi 403 hoặc phiên đã bị thu hồi. Nhiều tab cần cơ chế khóa liên tab và thông báo kết quả qua bộ nhớ thông điệp (ví dụ Web Locks + BroadcastChannel khi hỗ trợ), không ghi token vào localStorage. Nếu không phối hợp được hoặc gặp reuse thì yêu cầu login lại. Các request ghi dữ liệu thử lại vẫn giữ nguyên idempotency key và nội dung.

### 10.5. CSRF, CORS và ngoại lệ VNPay

- API nghiệp vụ nhận JWT qua Authorization, không tự dùng refresh cookie như access token. Chỉ `/auth/refresh`, `/auth/logout` dùng cookie refresh; login cũng cần chống ép đăng nhập từ site khác.
- Với các POST auth do browser gọi (login/refresh/logout và các auth mutation khác), yêu cầu JSON, header tùy chỉnh `X-CSRF-Guard: 1` và `Origin` nằm trong allowlist chính xác; từ chối Origin thiếu, `null`, không hợp lệ hoặc header thiếu. Header này không phải bí mật, cơ chế dựa vào browser không cho form thường thêm header và preflight/CORS không cho origin lạ.
- CORS không dùng `*` với credentials, không phản chiếu Origin tùy ý. Chỉ cho origin client đã cấu hình và các header cần thiết; SameSite là lớp hỗ trợ, không thay các kiểm tra trên.
- API tests/Postman có thể đặt Origin/guard theo hợp đồng; đây không phải phương thức xác thực client không phải browser. Chỉ kiểm thử trong browser mới chứng minh được cookie/CORS/CSRF hoạt động đúng.
- VNPay IPN/return là ngoại lệ rõ ràng: không gắn guard yêu cầu Origin của SPA, JWT hoặc refresh cookie. Thay vào đó xác minh chữ ký, merchant, tham chiếu, số tiền và chống xử lý lặp; không nới lỏng middleware của toàn bộ API để cho callback đi qua.
- Xác thực email/reset dùng token một lần, không đổi trạng thái qua GET tự động do công cụ quét link; trang mở link rồi gửi POST xác nhận có guard. Không dùng refresh token cho luồng này.

Custom request header kết hợp CORS chặt là một cách bảo vệ API AJAX trước CSRF; SameSite chỉ nên là lớp bổ sung. [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

### 10.6. Hợp đồng endpoint auth tối thiểu

- `POST /api/v1/auth/register`, `/verify-email`, `/resend-verification`.
- `POST /api/v1/auth/activate-owner`, `/forgot-password`, `/reset-password`.
- `POST /api/v1/auth/login`: JSON gồm accessToken, expiresIn và user; cookie chứa refresh token.
- `POST /api/v1/auth/refresh`: đọc cookie, rotate và trả access token mới; không cần JWT còn hạn.
- `POST /api/v1/auth/logout`: thu hồi phiên từ refresh cookie, xóa cookie, trả 204.
- `POST /api/v1/auth/logout-all`: access JWT hợp lệ, thu hồi mọi phiên; thiếu access thì refresh trước.
- `POST /api/v1/auth/change-password`: access JWT + mật khẩu hiện tại, thu hồi mọi phiên sau khi đổi.
- `GET /api/v1/users/me`: access JWT; trả hồ sơ/role đã lọc từ server.

Không bao giờ nhận role hoặc userId trong body để quyết định người đang đăng nhập. Tài liệu OpenAPI phải chỉ rõ Bearer auth, cookie, guard, Set-Cookie và mã lỗi như `ACCESS_TOKEN_EXPIRED`, `SESSION_REVOKED`, `ACCOUNT_LOCKED` để client xử lý đúng.
