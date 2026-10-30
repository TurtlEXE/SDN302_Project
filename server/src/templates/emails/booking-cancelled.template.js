/**
 * Booking Cancelled & Refund Initiated Email Template
 * Sent to customer when Admin cancels a booking and creates a refund case (Section 8.7, Criterion 53).
 *
 * @param {Object} data
 * @param {string} data.name - Recipient name
 * @param {string} data.bookingCode - Booking code
 * @param {string} [data.refundCaseCode] - Refund case reference
 * @param {number} [data.refundAmountVnd] - Refund amount in VND
 * @param {string} [data.reason] - Cancellation reason
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderBookingCancelledTemplate(data) {
  const {
    name = 'Quý khách',
    bookingCode,
    requestNumber,
    refundCaseCode,
    refundAmountVnd,
    reason,
  } = data;

  const displayCode = bookingCode || requestNumber || 'N/A';
  const formattedAmount = refundAmountVnd != null
    ? new Intl.NumberFormat('vi-VN').format(refundAmountVnd)
    : null;
  const subject = refundCaseCode
    ? `[SportBooking] Thông báo hủy sân và lập hồ sơ hoàn tiền - ${displayCode}`
    : `[SportBooking] Thông báo hủy yêu cầu đặt sân - ${displayCode}`;

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
    .header h1 { color: #dc2626; margin: 0; font-size: 24px; }
    .badge { display: inline-block; background-color: #fee2e2; color: #b91c1c; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 13px; margin-top: 8px; }
    .footer { font-size: 13px; color: #6b7280; border-top: 1px solid #eef0f2; padding-top: 20px; margin-top: 28px; }
    .summary-box { background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .highlight { font-weight: bold; color: #dc2626; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SportBooking</h1>
      <span class="badge">${refundCaseCode ? 'ĐƠN ĐÃ ĐƯỢC HỦY &amp; CHỜ HOÀN TIỀN' : 'YÊU CẦU ĐÃ ĐƯỢC HỦY'}</span>
    </div>
    <p>Xin chào <strong>${name}</strong>,</p>
    <p>${refundCaseCode ? `Chúng tôi rất tiếc phải thông báo rằng đơn đặt sân <strong>${displayCode}</strong> của bạn đã bị hủy do cơ sở không thể phục vụ hoặc phát sinh sự cố vận hành.` : `Yêu cầu đặt sân <strong>${displayCode}</strong> của bạn đã được hủy thành công.`}</p>
    
    <div class="summary-box">
      <h3 style="margin-top: 0; color: #991b1b;">Thông tin chi tiết:</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #4b5563;">Mã đơn / Yêu cầu:</td>
          <td style="padding: 6px 0; font-weight: bold; text-align: right;">${displayCode}</td>
        </tr>
        ${refundCaseCode ? `
        <tr>
          <td style="padding: 6px 0; color: #4b5563;">Mã hồ sơ hoàn tiền:</td>
          <td style="padding: 6px 0; font-weight: bold; color: #0284c7; text-align: right;">${refundCaseCode}</td>
        </tr>` : ''}
        ${formattedAmount ? `
        <tr>
          <td style="padding: 6px 0; color: #4b5563;">Số tiền sẽ hoàn:</td>
          <td style="padding: 6px 0; font-weight: bold; color: #dc2626; text-align: right;">${formattedAmount} đ</td>
        </tr>` : ''}
        ${reason ? `
        <tr>
          <td style="padding: 6px 0; color: #4b5563;">Lý do hủy:</td>
          <td style="padding: 6px 0; font-weight: 500; text-align: right;">${reason}</td>
        </tr>` : ''}
      </table>
    </div>

    ${refundCaseCode ? `<p>Hồ sơ hoàn tiền đã được chuyển sang bộ phận vận hành để thực hiện hoàn tiền vào tài khoản thanh toán của bạn trong thời gian sớm nhất.</p>
    <p>Chúng tôi chân thành xin lỗi vì sự bất tiện này.</p>` : `<p>Lịch giữ chỗ đã được giải phóng để phục vụ cho các khách hàng khác.</p>`}
    <div class="footer">
      <p>Đây là email tự động từ hệ thống SportBooking. Vui lòng không trả lời trực tiếp email này.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Xin chào ${name},

Đơn đặt sân ${bookingCode} của bạn đã bị hủy do cơ sở không thể phục vụ.
- Mã đơn đặt sân: ${bookingCode}
- Mã hồ sơ hoàn tiền: ${refundCaseCode || 'N/A'}
- Số tiền hoàn lại: ${formattedAmount} đ
- Lý do: ${reason || 'Không có lý do cụ thể'}

Hồ sơ hoàn tiền đã được chuyển sang bộ phận vận hành để thực hiện hoàn tất thủ công trong thời gian sớm nhất.
Chúng tôi chân thành xin lỗi vì sự bất tiện này.
  `.trim();

  return { subject, html, text };
}

export default renderBookingCancelledTemplate;

