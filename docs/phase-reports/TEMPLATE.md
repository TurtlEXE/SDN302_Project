# Pxx — Tên phase

> Mẫu, không phải bằng chứng đã thực hiện. Khi bắt đầu phase, tạo `Pxx.md` từ mẫu này.
> Trạng thái: NOT_STARTED. Người/agent thực hiện: chưa giao. Ngày: chưa có.

## 1. Hợp đồng thực hiện

- Yêu cầu giao việc: trích ngắn chỉ dẫn của người dùng, không tự tạo sự cho phép.
- Mục tiêu và phase trong kế hoạch:
- Các tài liệu đã đọc:
- Phụ thuộc và bằng chứng đã ACCEPTED:
- Mục sẽ làm: liệt kê đủ đầu việc/đầu ra/tiêu chí của phase; không rút bớt yêu cầu.
- Phạm vi file/thư mục dự kiến sửa:
- Ngoài phạm vi:
- Cách kiểm chứng từng đầu việc:
- Giả định/quyết định kỹ thuật còn mở:

## 2. Đầu việc và kết quả

- [ ] Đầu việc 1 — đầu ra: …; kiểm chứng: …; bằng chứng: …
- [ ] Đầu việc 2 — đầu ra: …; kiểm chứng: …; bằng chứng: …

Giữ nguyên mã tiêu chí 1–64 trong đặc tả; tham chiếu bản ánh xạ tạo ở P00. Ghi phần backend/UI riêng nếu cùng một tiêu chí cần hai giai đoạn.

## 3. Thay đổi thực tế

- File và mục đích:
- Thay đổi API/schema/index/config, nếu có:
- Phần ngoài danh sách file dự kiến và lý do vẫn thuộc phase:
- Quyết định cần duy trì cho phase sau:

## 4. Kiểm chứng

Với mỗi kiểm tra, ghi đủ:

- Tên kiểm tra/tiêu chí:
- Thư mục chạy và lệnh thực tế, hoặc các bước thủ công tái hiện:
- Môi trường và dữ liệu test, không chứa secret:
- Kết quả kỳ vọng:
- Kết quả thực tế: PASS / FAIL / NOT_RUN / NOT_APPLICABLE.
- Đường dẫn log/bằng chứng đã che dữ liệu nhạy cảm:
- Nguyên nhân và ảnh hưởng nếu chưa đạt/chưa chạy:

P00 là phase tài liệu: kiểm tra hợp đồng, ánh xạ tiêu chí, tham chiếu và mâu thuẫn; không bịa kết quả chạy API khi chưa có code. Phase code phải dùng lệnh của dự án thực tế, không ghi lệnh ví dụ thành lệnh đã chạy.

## 5. Phiên bản được bàn giao

- Commit đã kiểm tra, nếu có:
- Có thay đổi chưa commit hay không:
- Nếu chưa có Git hoặc còn thay đổi chưa commit: đường dẫn manifest file + SHA-256 của đầu ra thực tế được kiểm tra; loại báo cáo/status/manifest khỏi việc tự hash vòng tròn.
- Mốc thời gian kiểm tra và file log:

Không dùng một commit cũ làm bằng chứng cho các sửa đổi chưa nằm trong commit đó.

## 6. Việc còn thiếu và điểm tiếp tục

- Lỗi/chặn còn lại và việc cần để gỡ:
- Việc nào hoàn tất, việc nào chưa:
- Bước nhỏ tiếp theo nếu bị gián đoạn:
- Rủi ro hoặc quyết định cần người dùng xử lý:

## 7. Kết luận của agent triển khai

- Trạng thái đề nghị: IN_PROGRESS / VERIFYING / READY_FOR_REVIEW / BLOCKED.
- Các tiêu chí bắt buộc đã đủ bằng chứng hay chưa:
- `docs/planning/phase-status.json` đã khớp báo cáo hay chưa:
- Dừng ở phase này; không tự nghiệm thu hoặc triển khai phase tiếp.

## 8. Nghiệm thu riêng

- Báo cáo reviewer: `Pxx-review.md` (chưa tạo khi chưa review).
- Người dùng/reviewer được ủy quyền nghiệm thu:
- Căn cứ giao quyền nghiệm thu:
- Phiên bản được nghiệm thu:
- Kết luận và ngày: chưa nghiệm thu.

Agent triển khai để phần nghiệm thu trống cho đến khi có kết luận thật từ người có quyền nghiệm thu. Nếu người dùng nghiệm thu trực tiếp, ghi đúng chỉ dẫn đó; không gán một cuộc review kỹ thuật chưa xảy ra.
