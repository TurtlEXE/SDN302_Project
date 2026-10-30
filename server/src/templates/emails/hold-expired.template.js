/**
 * Hold Expired Email Template
 * Sent when a pending booking request hold expires after 10 minutes without successful payment.
 *
 * @param {Object} data
 * @param {string} data.name - Recipient name
 * @param {string} data.requestNumber - Booking request reference number
 * @param {string} [data.facilityName] - Facility name
 * @param {string} [data.bookingDate] - Booking date
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderHoldExpiredTemplate(data) {
  const {
    name = 'Quý khách',
    requestNumber,
    facilityName = '',
    bookingDate = '',
  } = data;

  const subject = `[SportBooking] Hết hạn giữ chỗ đặt sân - ${requestNumber}`;

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
    .header h1 { color: #d97706; margin: 0; font-size: 24px; }
    .badge { display: inline-block; background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 13px; margin-top: 8px; }
    .footer { font-size: 13px; color: #6b7280; border-top: 1px solid #eef0f2; padding-top: 20px; margin-top: 28px; }
    .summary-box { background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 16px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SportBooking</h1>
      <span class="badge">GIỮ CHỖ HẾT HẠN</span>
    </div>
    <p>Xin chào <strong>${name}</strong>,</p>
    <p>Yêu cầu giữ chỗ đặt sân của bạn đã hết hạn do chưa hoàn tất thanh toán trong thời hạn 10 phút quy định.</p>
    
    <div class="summary-box">
      <h3 style="margin-top: 0; color: #92400e;">Thông tin yêu cầu:</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #4b5563;">Mã yêu cầu:</td>
          <td style="padding: 6px 0; font-weight: bold; text-align: right;">${requestNumber}</td>
        </tr>
        ${facilityName ? `
        <tr>
          <td style="padding: 6px 0; color: #4b5563;">Cơ sở:</td>
          <td style="padding: 6px 0; font-weight: 500; text-align: right;">${facilityName}</td>
        </tr>` : ''}
        ${bookingDate ? `
        <tr>
          <td style="padding: 6px 0; color: #4b5563;">Ngày chơi:</td>
          <td style="padding: 6px 0; font-weight: 500; text-align: right;">${bookingDate}</td>
        </tr>` : ''}
      </table>
    </div>

    <p>Khung giờ đã được giải phóng để các khách hàng khác có thể đặt. Nếu vẫn có nhu cầu đặt sân, bạn vui lòng tạo một yêu cầu mới trên hệ thống.</p>
    <div class="footer">
      <p>Đây là email tự động từ hệ thống SportBooking. Vui lòng không trả lời trực tiếp email này.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Xin chào ${name},

Yêu cầu giữ chỗ đặt sân ${requestNumber} của bạn đã hết hạn do chưa hoàn tất thanh toán trong 10 phút.
- Mã yêu cầu: ${requestNumber}
${facilityName ? `- Cơ sở: ${facilityName}\n` : ''}${bookingDate ? `- Ngày chơi: ${bookingDate}\n` : ''}
Khung giờ đã được giải phóng trên hệ thống. Bạn có thể tạo yêu cầu mới nếu vẫn có nhu cầu sử dụng sân.
  `.trim();

  return { subject, html, text };
}

export default renderHoldExpiredTemplate;

