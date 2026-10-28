# Giao từng phase cho AI và kiểm soát việc chuyển phase

> Dùng cùng `docs/planning/development-plan.md`; không thay thế đặc tả hoặc tạo thêm tính năng sản phẩm.
> Hiện đã chuẩn bị thư mục và quy trình: chưa triển khai P00, chưa có ứng dụng hoặc CI.
> Mở `sport-booking/` làm gốc dự án. Đường dẫn trong prompt và đoạn code của hướng dẫn này tính từ gốc đó.

## 1. Cách sử dụng ngắn gọn

1. Mở agent trong đúng thư mục dự án. Giao **một phase cụ thể**, ví dụ P00, bằng mẫu ở mục 6.
2. Agent đọc tài liệu, kiểm tra phụ thuộc và lập hợp đồng thực hiện ngay trong báo cáo phase; sau đó làm đến hết phạm vi được giao.
3. Agent kiểm chứng đầu ra, lưu bằng chứng và bàn giao ở `READY_FOR_REVIEW`. Trạng thái này chưa cho phép chuyển phase.
4. Bạn tự nghiệm thu hoặc mở một lượt review riêng và giao quyền nghiệm thu cho reviewer bằng mẫu ở mục 7.
5. Chỉ khi phase là `ACCEPTED`, giao phase tiếp theo. P15 còn phải có gate `BE_READY` được nghiệm thu.

Mỗi phase có thể dùng một chat mới để giảm việc lẫn yêu cầu. Tiếp tục trong chat cũ cũng được, nhưng vẫn phải đọc lại trạng thái/file thực tế. Không giao chung chung “làm tiếp cho hoàn thiện dự án” nếu bạn chỉ muốn một phase.

**Không có prompt nào bảo đảm agent luôn đúng 100%.** Cách kiểm soát là kết hợp phạm vi rõ, tài liệu trong repository, kiểm thử, bằng chứng và người/lượt review riêng. Các file ở đây là quy trình; cơ chế chặn merge bằng CI và quyền repository cần triển khai riêng ở P01.

## 2. Các file có vai trò gì

- `AGENTS.md`: quy tắc ngắn áp dụng toàn repository, để agent biết cách làm việc trước khi sửa.
- `.cursor/rules/phase-workflow.mdc`: cầu nối tới cùng quy tắc cho công cụ có hỗ trợ định dạng rule này; không phải một bản đặc tả khác. Không giả định mọi agent đều tự đọc `.mdc`.
- `docs/features.md`: nguồn nghiệp vụ và 64 tiêu chí nghiệm thu.
- `docs/architecture.md`: nguồn kiến trúc, layer/component và JWT/cookie.
- `docs/planning/development-plan.md`: mục tiêu, công việc, đầu ra và điều kiện của P00–P20.
- `docs/planning/phase-status.json`: nguồn trạng thái tiến độ hiện tại, không phải bằng chứng tự thân rằng code đã đúng.
- `docs/phase-reports/TEMPLATE.md`: mẫu hợp đồng, kết quả kiểm chứng và bàn giao; tạo `Pxx.md` khi thực sự bắt đầu phase.
- `docs/phase-reports/Pxx-review.md`: kết quả review riêng; chưa tạo trước khi review thật.

Codex có cơ chế đọc `AGENTS.md` theo phạm vi thư mục; mở đúng gốc dự án và yêu cầu agent nêu các tài liệu đã đọc trước khi làm. Với chat đang mở từ trước khi tạo file, yêu cầu đọc lại file hiện tại; với agent khác, chỉ rõ file trong prompt nếu công cụ không tự nạp. Tham khảo [tài liệu chính thức về AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Không sao chép toàn bộ đặc tả vào từng prompt. Prompt chỉ định phase; agent phải đọc nguồn trong repository để tránh làm theo một bản yêu cầu cũ.

### 2.1. Antigravity

Đã đối chiếu tài liệu chính thức ngày 28/10/2026: Antigravity hỗ trợ `AGENTS.md` trong thư mục dự án, không cần YAML frontmatter cho file này. Rule tách riêng dùng `.agents/rules/*.md` và cần `trigger` hợp lệ, ví dụ `always_on`. Xem [Google Antigravity — Rules](https://antigravity.google/docs/rules/).

Trong dự án này, dùng `AGENTS.md` làm nguồn quy tắc chính. File hiện tại đúng định dạng và dưới giới hạn dung lượng rule. `.cursor/rules/phase-workflow.mdc` là cầu nối cho công cụ hỗ trợ định dạng đó; không dựa vào file này để xác nhận Antigravity đã nạp quy tắc. Không cần tạo thêm một bản nghiệp vụ trùng trong `GEMINI.md` hoặc `.agents/rules/`.

Cách kiểm tra trước khi giao việc:

1. Mở đúng thư mục `F:\FPT\Ky7\SDN302\Project\sport-booking` trong Antigravity.
2. Tạo một cuộc hội thoại mới và gửi đoạn kiểm tra bên dưới. Đây chỉ là kiểm tra cấu hình, chưa giao triển khai P00.
3. Đối chiếu kết quả: phase tiếp theo là P00, các phase chưa bắt đầu, hai gate đang đóng; frontend chỉ được triển khai từ P15 sau nghiệm thu BE-READY.
4. Khi thông tin đúng, dùng prompt triển khai hoặc review ở mục 6/7. Khi thông tin sai, kiểm tra lại thư mục đang mở và các rule khác có xung đột trước khi giao code.

```text
Chỉ kiểm tra quy tắc của dự án, không sửa file hoặc triển khai phase.
Nêu thư mục gốc hiện tại và các nguồn rule tự động được nạp nếu công cụ
cung cấp thông tin đó; nếu không biết thì nói rõ, không suy đoán.
Đọc AGENTS.md, docs/guides/ai-workflow.md, docs/planning/phase-status.json,
docs/planning/development-plan.md, docs/features.md và docs/architecture.md.
Tóm tắt phase tiếp theo, điều kiện bắt đầu frontend, quyền nghiệm thu phase,
cách lưu khoảng đặt liền/rời, cách xác nhận thanh toán và cách lưu token.
Phân biệt rule tự động được nạp với tài liệu vừa đọc theo yêu cầu này.
```

Kết quả mong đợi còn gồm: agent triển khai bàn giao tối đa READY_FOR_REVIEW; Booking gộp khoảng liền nhau; VNPay thu đủ 100% và server xác minh; access JWT trong RAM, refresh trong cookie HttpOnly. Đối chiếu các câu trả lời này với file thực tế, không chỉ hỏi agent “đã hiểu chưa”.

Việc kiểm tra file và đối chiếu tài liệu chính thức chưa xác nhận khả năng tự nạp trên phiên bản Antigravity đang cài ở máy người dùng. Bài kiểm tra trên kiểm chứng agent đọc đúng nội dung; phần tự nạp chỉ được xác nhận khi công cụ có thông tin nguồn rule tương ứng. Dù rule đã được nạp, vẫn áp dụng kiểm thử và nghiệm thu từng phase.

## 3. Trạng thái và quyền chuyển trạng thái

Trạng thái của phase:

- `NOT_STARTED`: chưa bắt đầu.
- `IN_PROGRESS`: đang thực hiện phase đã được giao.
- `VERIFYING`: đang kiểm chứng đầu ra của phase.
- `READY_FOR_REVIEW`: công việc và các kiểm chứng bắt buộc đã hoàn tất, chờ nghiệm thu riêng.
- `NEEDS_CHANGES`: reviewer phát hiện điều kiện chưa đạt; kèm lỗi cụ thể cần sửa.
- `BLOCKED`: không thể hoàn tất phase do phụ thuộc/môi trường/thông tin còn thiếu; báo rõ phần đã làm và phần cần gỡ.
- `ACCEPTED`: người dùng hoặc reviewer được ủy quyền đã nghiệm thu phiên bản cụ thể.

Luồng thông thường:

```text
NOT_STARTED → IN_PROGRESS → VERIFYING → READY_FOR_REVIEW → ACCEPTED
                                ↑              │
                                └─ sửa ← NEEDS_CHANGES
IN_PROGRESS / VERIFYING → BLOCKED → IN_PROGRESS khi được gỡ chặn
```

- Agent triển khai quản lý tiến độ đến `READY_FOR_REVIEW`, không tự chuyển thành `ACCEPTED`.
- Reviewer có thể kết luận `NEEDS_CHANGES`; chỉ ghi `ACCEPTED` nếu người dùng đã giao quyền nghiệm thu. Nếu chỉ được yêu cầu “review”, báo khuyến nghị và để quyết định nghiệm thu cho người dùng.
- Người dùng có thể nghiệm thu trực tiếp; ghi đúng căn cứ và kết quả kiểm chứng, không bịa ra reviewer hoặc test.
- `active_phase` là phase đang thực hiện/chờ review/bị chặn; chỉ một giá trị. Khi nghiệm thu xong đặt `null`. Việc mở review không tạo thêm một phase đang chạy.
- `next_candidate` là phase chưa nghiệm thu sớm nhất, chỉ là gợi ý; sau P20 được nghiệm thu thì đặt `null`. Nó không cấp quyền tự bắt đầu.
- `report` và `review` là đường dẫn tương đối từ gốc `sport-booking/` tới file đã tồn tại, không tính từ thư mục chứa JSON; không gán đường dẫn bằng chứng chưa tạo.
- Khi nghiệm thu, điền `accepted_by`, `accepted_on`, `accepted_revision` theo bằng chứng thật. `accepted_revision` dùng commit cụ thể hoặc đường dẫn manifest SHA-256 nếu chưa có Git/còn thay đổi chưa commit. Không tự commit để lấp trường này.
- Cập nhật `updated_on` và `note` khi trạng thái thay đổi. Không có danh sách tiến độ thứ hai mâu thuẫn với JSON; checklist kế hoạch chỉ tick khi đã kiểm chứng, còn nghiệm thu xem JSON.

Gate `BE_READY` và `RELEASE_READY` dùng `CLOSED / ACCEPTED / STALE`. Tên hiển thị trong kế hoạch tương ứng BE-READY/RELEASE-READY.

- `CLOSED`: chưa được nghiệm thu.
- `ACCEPTED`: đủ điều kiện P14/P20, có báo cáo và người nghiệm thu thật.
- `STALE`: bằng chứng cũ không còn đủ bao phủ thay đổi hiện tại, cần kiểm chứng/nghiệm thu lại phần bị ảnh hưởng.

Gate BE_READY chỉ được nghiệm thu khi P00–P14 đều `ACCEPTED` và đầy đủ bảy điều kiện của P14. Gate RELEASE_READY yêu cầu P00–P20 `ACCEPTED`, BE_READY còn hiệu lực và điều kiện P20 đạt. Không mở gate bằng cách chỉ đổi JSON.

Nếu sửa backend sau BE-READY mà ảnh hưởng lịch/tiền/quyền/dữ liệu/hợp đồng API, ghi `STALE` cho BE_READY; RELEASE_READY nếu đã mở cũng chuyển `STALE`. Hoàn tất sửa và test liên quan trong phạm vi được giao, cập nhật báo cáo tái kiểm chứng P14, rồi nghiệm thu lại gate trước khi tiếp tục phần phụ thuộc. Sửa lỗi chính tả không ảnh hưởng hành vi thì không cần chạy lại toàn bộ hệ thống.

Nếu phải mở lại một phase đã nghiệm thu vì đầu ra không còn đạt, lưu lịch sử nghiệm thu cũ trong báo cáo, xóa các trường nghiệm thu hiện tại của phase và chuyển về `IN_PROGRESS`/`NEEDS_CHANGES` phù hợp. Không xóa lịch sử để che lỗi. Một bản sửa tương thích nhỏ không mặc nhiên buộc làm lại tất cả phase trước.

## 4. Hợp đồng và bằng chứng cho từng phase

Trước khi sửa, agent tạo hoặc cập nhật `docs/phase-reports/Pxx.md` từ mẫu. Phần “hợp đồng thực hiện” phải có:

1. Đúng ID phase, yêu cầu giao việc và các phase phụ thuộc đã nghiệm thu.
2. Toàn bộ đầu việc và tiêu chí trong kế hoạch, gắn với mã tiêu chí trong đặc tả nếu có.
3. Đầu ra cụ thể, phạm vi file/thư mục được sửa và phần ngoài phạm vi.
4. Lệnh hoặc cách kiểm chứng, điều kiện PASS, môi trường cần có.
5. Điểm cần giữ tương thích với phase trước và những phần được để lại cho phase sau theo kế hoạch.

Ví dụ P08 có phạm vi hàm lịch/gộp/giá, API lịch, test và tài liệu liên quan; không thực hiện checkout React hoặc callback VNPay của P11. P09 mới triển khai giữ chỗ nguyên tử. Không dùng “cần cho phase sau” để làm trước toàn bộ phase đó.

Phạm vi file dự kiến không cấm sửa helper cần thiết trong cùng phase. Agent phải ghi lý do mở rộng danh sách file, giữ nguyên phạm vi nghiệp vụ và kiểm tra hồi quy. Thay đổi yêu cầu nghiệp vụ chưa được chốt thì nêu riêng; không sửa đặc tả/gate để hợp thức hóa code đang sai.

Điều kiện chuyển `READY_FOR_REVIEW`:

- Mọi đầu việc bắt buộc trong phase có đầu ra thực, hoặc phần chưa đến hạn được kế hoạch ghi rõ từ đầu.
- Kiểm chứng bắt buộc của phase đạt; có lệnh/bước chạy, kết quả, môi trường và bằng chứng. `NOT_RUN` không phải PASS; bỏ test bắt buộc khiến phase chưa đủ điều kiện.
- API/schema/tài liệu khớp triển khai; không thêm nhánh bỏ qua auth/thanh toán để demo.
- Không còn lỗi ảnh hưởng tiêu chí hoàn thành của phase. Vấn đề ngoài phạm vi ghi rõ chủ sở hữu/phase xử lý, không che bằng câu “sẽ sửa sau”.
- Có phiên bản xác định của đầu ra đã kiểm tra: commit, hoặc manifest file + SHA-256 khi chưa có Git/còn thay đổi chưa commit. Manifest không đưa vào secret và không hash vòng tròn báo cáo/status/chính manifest.

Không bắt P00 chạy test API chưa tồn tại; nghiệm thu P00 bằng kiểm tra hợp đồng và tính nhất quán tài liệu. Ngược lại, đọc code không đủ thay cho kiểm thử cạnh tranh đặt sân, browser cookie hoặc luồng VNPay thực ở các phase yêu cầu chúng.

## 5. Làm việc tuần tự và bàn giao giữa các agent

- Mặc định chạy lần lượt P00 → P20. Hoàn tất backend P00–P14 trước, rồi P15–P19 và P20.
- P00 chia các đầu việc nhỏ ngay trong báo cáo của nó. Các phase sau làm tương tự; không cần tạo 21 bản sao đặc tả từ đầu.
- Khi đổi chat/agent, giao cùng phase và yêu cầu đọc báo cáo, status, file hiện tại; không bắt đầu lại hoặc xóa phần đã làm.
- Nếu bị gián đoạn, cập nhật checklist, kiểm chứng đã chạy và bước nhỏ tiếp theo. Agent tiếp theo xác minh lại trước khi tiếp tục.
- Khi thiếu VNPay/email/DB, ghi phần bị chặn, hoàn tất việc độc lập trong phase; không nhảy qua phase bắt buộc để làm React. Có thể review/chuẩn bị tài liệu độc lập nếu người dùng giao, nhưng không đánh dấu phase phụ thuộc đã bắt đầu hoặc đã đạt.
- Chỉ dùng nhiều agent khi người dùng yêu cầu. Chia đầu việc trong cùng phase, chỉ định file do từng agent phụ trách; tránh hai agent cùng sửa một file, status, hợp đồng API hay schema.
- Một agent tích hợp cập nhật status/báo cáo và chạy kiểm chứng chung. Kết quả các agent con chưa tự làm phase đạt nghiệm thu; reviewer cần xem phiên bản sau khi tích hợp.
- Không tự tạo chat, agent, lịch chạy hoặc gửi việc sang chat khác từ việc đọc tài liệu này.

## 6. Prompt giao triển khai — mẫu bắt đầu P00

Sao chép đoạn dưới vào agent mở tại gốc dự án. Với phase khác, thay `P00` bằng ID tương ứng; giữ nguyên giới hạn và yêu cầu kiểm chứng.

```text
Hãy thực hiện duy nhất phase P00 của dự án này.
Đọc AGENTS.md, docs/guides/ai-workflow.md, docs/planning/phase-status.json,
docs/features.md, docs/architecture.md và phase P00
trong docs/planning/development-plan.md. Đọc báo cáo phụ thuộc nếu có.

Trước khi sửa, nêu ngắn các tài liệu đã đọc, kiểm tra phụ thuộc,
rồi lập hợp đồng thực hiện trong docs/phase-reports/P00.md từ TEMPLATE.md:
mục tiêu, toàn bộ đầu việc, phạm vi file, ngoài phạm vi và cách kiểm chứng.
Sau đó thực hiện đến hết P00, tự xử lý lựa chọn kỹ thuật trong phạm vi,
kiểm chứng đầu ra và cập nhật báo cáo cùng docs/planning/phase-status.json.

Không triển khai P01 hoặc React. Không thay đổi nghiệp vụ đã chốt,
không hạ tiêu chí, không ghi PASS cho việc chưa kiểm chứng.
Nếu đủ điều kiện thì bàn giao READY_FOR_REVIEW; nếu chưa đủ, ghi chính xác
phần còn thiếu và trạng thái thực tế. Không tự nghiệm thu hoặc mở gate.
Kết thúc với file đã tạo/sửa, bằng chứng, việc còn thiếu và điểm tiếp tục.
```

Không cần chờ xác nhận lần hai để thực hiện P00 sau khi người dùng đã gửi prompt này. Bước nghiệm thu nằm sau đầu ra có thể kiểm tra, không phải sau mỗi file hoặc mỗi lệnh.

## 7. Prompt review và nghiệm thu riêng

Khuyến nghị dùng chat riêng để reviewer đọc lại đầu ra với ngữ cảnh mới. Người dùng gửi mẫu dưới đây là giao quyền nghiệm thu **đúng phase được chỉ định**, không cấp quyền chuyển sang phase kế tiếp.

```text
Hãy review độc lập phase P00 của dự án. Đọc AGENTS.md, các tài liệu nguồn,
docs/planning/phase-status.json và docs/phase-reports/P00.md. Kiểm tra đầu ra/file thực tế
so với từng tiêu chí P00; xác minh bằng chứng hoặc chạy lại kiểm chứng cần thiết.
Không chỉ tin báo cáo của agent triển khai. Không sửa code/tài liệu sản phẩm
trong lượt review này; chỉ ghi báo cáo review và trạng thái.

Tạo docs/phase-reports/P00-review.md: phạm vi/phiên bản đã review,
từng tiêu chí đạt/chưa đạt, kiểm chứng đã chạy, lỗi kèm vị trí và ảnh hưởng.
Tôi giao bạn quyền nghiệm thu P00: nếu đủ toàn bộ tiêu chí, ghi ACCEPTED
và căn cứ nghiệm thu thật vào docs/planning/phase-status.json; nếu chưa đủ, ghi NEEDS_CHANGES
với việc cần sửa. Thiếu môi trường bắt buộc thì ghi phần chưa xác minh,
không kết luận đạt. Không bắt đầu P01 hoặc sửa quy tắc để vượt nghiệm thu.
```

Ở P14/P20, người dùng thêm: “Tôi cũng giao quyền nghiệm thu gate BE_READY/RELEASE_READY tương ứng khi đủ tất cả điều kiện trong kế hoạch; cập nhật bằng chứng và phiên bản, không bắt đầu phase kế tiếp.” Nếu không giao quyền này, reviewer chỉ đề nghị mở gate.

Reviewer báo rõ lỗi chặn nghiệm thu, lỗi không chặn nhưng cần theo dõi và đề xuất tùy chọn. Không bắt làm thêm tính năng ngoài phạm vi như một điều kiện nghiệm thu. Việc nhận xét “có thể cải thiện” không tự khiến phase thất bại.

## 8. Prompt sửa sau review hoặc tiếp tục sau gián đoạn

```text
Tiếp tục duy nhất P00. Đọc lại AGENTS.md, docs/planning/phase-status.json, báo cáo P00,
báo cáo review nếu có, các tài liệu nguồn và file thực tế.
Hoàn tất các mục còn thiếu/sửa lỗi chặn nghiệm thu trong phạm vi P00.
Giữ phần đã làm đúng, không làm lại toàn bộ và không chuyển P01.
Chạy lại kiểm chứng bị ảnh hưởng, cập nhật báo cáo cùng trạng thái;
khi đủ điều kiện thì bàn giao READY_FOR_REVIEW để được nghiệm thu lại.
```

Sau khi P00 được nghiệm thu, gửi mẫu mục 6 với P01. Lặp lại đến P14; chỉ khi BE_READY được nghiệm thu mới giao P15.

## 9. Cơ chế kiểm soát kỹ thuật cần bổ sung ở P01

Hiện các mục dưới đây là đầu việc trong kế hoạch, **chưa có script hoặc CI được cài đặt**:

- Script kiểm tra cấu trúc status: ID P00–P20 duy nhất, trạng thái hợp lệ, thứ tự/phụ thuộc, tối đa một active phase, báo cáo tồn tại và dữ liệu nghiệm thu/gate đầy đủ.
- Kiểm tra phạm vi thay đổi của một phase so với hợp đồng/file dự kiến. Chặn thay đổi frontend sản phẩm trước BE_READY; fixture HTML kiểm thử backend phải được tách rõ. Kiểm tra đường dẫn chỉ hỗ trợ, reviewer vẫn phải kiểm tra việc giấu UI dưới thư mục khác hoặc đưa React vào dependencies.
- CI chạy lint, kiểm tra hợp đồng và test bắt buộc đã được xây tới phase đó. Không có test thì không in thông báo giả “tất cả test đạt”; P01 chỉ chịu kiểm tra P01, đến P14 mới chạy bộ backend đầy đủ.
- CI so với nhánh nền/commit được nghiệm thu, không chỉ tin `docs/planning/phase-status.json` do chính thay đổi đang chờ duyệt sửa. Sửa quy tắc/gate/workflow phải được review riêng theo yêu cầu người dùng, không gộp để làm test xanh.
- Khi dùng nền tảng Git hỗ trợ, cấu hình required checks và quyền review/merge để một agent triển khai không tự bỏ kiểm tra hoặc tự duyệt chính thay đổi của nó. Việc cấu hình phải được xác nhận bằng trạng thái thật; không coi một file workflow là bằng chứng branch protection đã bật.

Các kiểm tra này bắt được lỗi phạm vi và thiếu bằng chứng, không chứng minh mọi nghiệp vụ đúng. Những quy tắc như chống trùng lịch/thu đủ tiền/thu hồi JWT vẫn cần test có ý nghĩa và review.

## 10. Kiểm tra nhanh trước khi giao phase kế tiếp

- Phase hiện tại là `ACCEPTED`, có người nghiệm thu, phiên bản và báo cáo tương ứng.
- Đầu ra thực tế vẫn khớp phiên bản được nghiệm thu hoặc đã kiểm chứng lại các sửa đổi.
- Không có lỗi chặn hoặc test bắt buộc đang bị bỏ qua; không còn placeholder ở đầu ra bắt buộc.
- Hợp đồng API/schema và các quyết định bàn giao đủ để agent kế tiếp không phải đoán.
- Nếu bắt đầu P15: BE_READY là `ACCEPTED`, VNPay/email/browser test có bằng chứng thật.

Trạng thái lúc tạo hướng dẫn: tất cả P00–P20 là `NOT_STARTED`, hai gate là `CLOSED`. Việc tạo hướng dẫn và mẫu báo cáo này không đồng nghĩa P00 đã hoàn tất.
