/**
 * Refund Processed Email Template
 * Sent to customer when Admin has recorded successful manual refund (Section 8.7, Criterion 54).
 *
 * @param {Object} data
 * @param {string} data.name - Recipient name
 * @param {string} data.refundCaseCode - Refund case code (e.g. RF20261030-ABC)
 * @param {string} [data.bookingCode] - Associated booking code (if applicable)
 * @param {number} data.refundAmountVnd - Amount refunded in VND
 * @param {string} data.reason - Reason for refund
 * @param {string} data.proofReference - Bank transfer / proof reference
 * @param {Date|string} data.processedAt - Timestamp when refund was recorded
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderRefundProcessedTemplate(data) {
  const {
    name = 'Quý khách',
    refundCaseCode,
    bookingCode,
    refundAmountVnd,
    reason,
    proofReference,
    processedAt,
  } = data;

  const formattedAmount = new Intl.NumberFormat('vi-VN').format(refundAmountVnd || 0);
  const subject = `[SportBooking] Xác nhận hoàn tiền thành công - ${refundCaseCode}`;
  const formattedDate = processedAt
    ? new Date(processedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    : 'N/A';

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f6f8; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .header { text-align: center; border-bottom: 1px solid #eef0f2; padding-bottom: 20px; margin-bottom: 24px; }
    .header h1 { color: #166534; margin: 0; font-size: 24px; }
    .badge { display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 13px; margin-top: 8px; }
    .footer { font-size: 13px; color: #6b7280; border-top: 1px solid #eef0f2; padding-top: 20px; margin-top: 28px; }
    .summary-box { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .highlight { font-weight: bold; color: #166534; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sport Booking Platform</h1>
      <div class="badge">ĐÃ HOÀN TIỀN THÀNH CÔNG</div>
    </div>
    <p>Xin chào <strong>${name}</strong>,</p>
    <p>Hệ thống xin thông báo yêu cầu hoàn tiền của bạn đã được Quản trị viên xử lý và chuyển tiền thành công. Thông tin chi tiết như sau:</p>

    <div class="summary-box">
      <p style="margin: 4px 0;"><strong>Mã hồ sơ hoàn tiền:</strong> ${refundCaseCode}</p>
      ${bookingCode ? `<p style="margin: 4px 0;"><strong>Mã đơn đặt sân:</strong> ${bookingCode}</p>` : ''}
      <p style="margin: 4px 0;"><strong>Số tiền hoàn:</strong> <span class="highlight">${formattedAmount} VND</span></p>
      <p style="margin: 4px 0;"><strong>Lý do hoàn tiền:</strong> ${reason || 'N/A'}</p>
      <p style="margin: 4px 0;"><strong>Mã tham chiếu chuyển khoản / Ủy nhiệm chi:</strong> ${proofReference}</p>
      <p style="margin: 4px 0;"><strong>Thời gian xử lý:</strong> ${formattedDate}</p>
    </div>

    <p style="font-size: 14px; color: #4b5563;">
      * Khoản tiền đã được chuyển về tài khoản ban đầu hoặc theo thông tin thỏa thuận hỗ trợ. Tùy thuộc vào ngân hàng tiếp nhận, giao dịch có thể mất từ 1 đến 3 ngày làm việc để hiển thị trên sao kê của bạn.
    </p>

    <div class="footer">
      <p>Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của SportBooking Platform.</p>
      <p>© 2026 Sport Booking Platform. Mọi quyền được bảo lưu.</p>
    </div>
  </div>
</body>
</html>
`.trim();

  const text = `
Xin chào ${name},

Hệ thống SportBooking xin thông báo yêu cầu hoàn tiền của bạn đã được xử lý thành công!

Thông tin chi tiết:
- Mã hồ sơ hoàn tiền: ${refundCaseCode}
${bookingCode ? `- Mã đơn đặt sân: ${bookingCode}\n` : ''}- Số tiền hoàn: ${formattedAmount} VND
- Lý do: ${reason || 'N/A'}
- Mã tham chiếu chuyển khoản: ${proofReference}
- Thời gian xử lý: ${formattedDate}

Cảm ơn bạn đã đồng hành cùng SportBooking Platform!
`.trim();

  return { subject, html, text };
}

export default renderRefundProcessedTemplate;

