# Quy tắc thực hiện dự án theo phase

Áp dụng toàn dự án. Tuân thủ chỉ dẫn hệ thống/công cụ và yêu cầu trực tiếp của người dùng; không dùng file này để bỏ qua chúng.
Gốc dự án là thư mục `sport-booking/` chứa file này; mọi đường dẫn bên dưới tính từ gốc đó.

## Đọc trước khi làm

- Đọc `docs/features.md`, `docs/architecture.md`, phase liên quan trong `docs/planning/development-plan.md`, `docs/planning/phase-status.json` và `docs/guides/ai-workflow.md`.
- Đọc báo cáo triển khai/review của phase phụ thuộc hoặc phase đang tiếp tục; kiểm tra file thực tế, không coi lời báo hoàn thành là bằng chứng.
- Đặc tả quyết định nghiệp vụ; tài liệu cấu trúc quyết định kiến trúc; kế hoạch quyết định phạm vi/tiêu chí; status ghi tiến độ, không sửa nghĩa của ba tài liệu trên.
- Nếu tài liệu mâu thuẫn, nêu vị trí và cách xử lý; không âm thầm đổi nghiệp vụ. Tiếp tục phần độc lập, chỉ hỏi khi chưa có căn cứ quyết định.

## Phạm vi một lần giao việc

- Chỉ triển khai phase người dùng giao. Yêu cầu đọc/review/sửa tài liệu không mặc nhiên giao triển khai ứng dụng.
- Mặc định lần lượt P00 → P20; các phase trước phải `ACCEPTED`. P00 không có phase tiền nhiệm.
- Trước khi sửa, ghi hợp đồng phase trong `docs/phase-reports/Pxx.md`: mục tiêu, đầu việc, phạm vi file, ngoài phạm vi, kiểm chứng và phụ thuộc. Không cần xin duyệt từng lựa chọn kỹ thuật đã nằm trong phạm vi.
- Ghi `active_phase` và trạng thái thực tế; chỉ một phase đang được triển khai. Không bắt đầu phase kế tiếp chỉ vì còn thời gian.
- Có thể sửa helper/layer liên quan để hoàn tất phase; ghi lý do. Không nhân tiện refactor toàn dự án, đổi stack hoặc thêm tính năng.
- Không xây/cài React hay giao diện sản phẩm trước khi P14 `ACCEPTED` và gate `BE_READY` là `ACCEPTED`; fixture HTML test backend theo kế hoạch được phép.
- Nếu bị thiếu môi trường/credentials/phụ thuộc, hoàn tất phần độc lập trong phase rồi báo phần bị chặn; không tạo đường giả để báo đạt.

## Các ràng buộc không được làm lệch

- Node.js/Express + React + MongoDB; client–server 3 tier; backend theo layer đã mô tả, mặc định JavaScript ES Modules.
- Không hoa hồng/voucher; admin cấp OWNER; email đăng ký và thông báo; không mở rộng ngoài đặc tả.
- Bước 30/60/90 phút ở FacilitySport; gộp khoảng liền trước khi lưu Booking; không chia database thành từng ô cố định.
- Chống giao lịch bằng khoảng và transaction/phối hợp ghi sân-ngày; không chỉ dựa vào query trước insert.
- VNPay thu 100%, xác minh ở server, xử lý idempotent; callback không phụ thuộc JWT/cookie người dùng; không có API tự đánh dấu đã trả.
- JWT access trong RAM; refresh cookie HttpOnly; rotation/thu hồi/CSRF theo mục 10 tài liệu cấu trúc. Không lưu token vào localStorage/sessionStorage.

## Kiểm chứng và bàn giao

- Mỗi đầu việc phải có đầu ra và cách kiểm chứng. Chỉ tick khi có bằng chứng; không hạ tiêu chí, xóa/skip test hoặc sửa quy tắc để vượt gate.
- Chạy kiểm tra phù hợp phase và hồi quy phần bị ảnh hưởng; ghi lệnh thật, môi trường, kết quả, file log đã che dữ liệu nhạy cảm và phần chưa chạy.
- Không ghi PASS cho test chưa chạy. Mock không thay thế tích hợp VNPay/email/browser bắt buộc ở các phase tương ứng.
- Cập nhật API/tài liệu cùng thay đổi; giữ công việc có sẵn của người dùng, không ghi secret hoặc dữ liệu riêng vào báo cáo.
- Agent triển khai chỉ được kết luận tối đa `READY_FOR_REVIEW`; `ACCEPTED` cần người dùng nghiệm thu hoặc reviewer đã được người dùng giao quyền nghiệm thu riêng.
- Reviewer dùng `docs/phase-reports/Pxx-review.md`, đối chiếu code/tài liệu/test và phiên bản thực tế; không chỉ chép lại báo cáo triển khai.
- Chỉ người có quyền nghiệm thu mới ghi nhận gate `BE_READY`/`RELEASE_READY` theo các tiêu chí P14/P20. Không tự giả danh người duyệt.
- Nếu sửa hành vi backend đã được nghiệm thu về lịch/tiền/quyền/dữ liệu/hợp đồng API, đánh dấu gate liên quan `STALE` và kiểm chứng lại trước công việc phụ thuộc gate.
- Kết thúc bằng: kết quả, file chính, kiểm chứng, phần còn thiếu, trạng thái và bước tiếp theo; cập nhật báo cáo cùng `docs/planning/phase-status.json`.
- Không tự tạo agent/chat hoặc cho nhiều agent sửa cùng phần; chỉ phân công khi người dùng đã yêu cầu, theo hướng dẫn điều phối.

## Code Review Rules

- Báo lỗi khi triển khai vượt phase, thiếu bằng chứng, sai layer, trùng lịch, sai tiền, vượt quyền hoặc mở frontend trước gate; kèm vị trí, ảnh hưởng và hướng sửa.
- File status và báo cáo là dữ liệu theo dõi, không phải cơ chế bảo vệ kỹ thuật. Không tuyên bố CI/branch protection đã có nếu chưa cấu hình và chạy thật.
