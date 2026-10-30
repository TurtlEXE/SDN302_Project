/**
 * Booking Completed Email Template
 * Sent to customer when owner or admin confirms successful completion of the booking session.
 *
 * @param {Object} data
 * @param {string} data.name - Recipient name
 * @param {string} data.bookingCode - Booking code
 * @param {string} [data.facilityName] - Facility name
 * @param {string} [data.courtName] - Court name
 * @param {string} [data.bookingDate] - Booking date
 * @param {string} [data.startTime] - Start time
 * @param {string} [data.endTime] - End time
 * @param {string} [data.note] - Completion note
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderBookingCompletedTemplate(data) {
  const {
    name = 'Quý khách',
    bookingCode,
    facilityName = '',
    courtName = '',
    bookingDate = '',
    startTime = '',
    endTime = '',
    note,
  } = data;

  const subject = `[SportBooking] Buổi chơi đã hoàn tất - ${bookingCode}`;

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
    .header h1 { color: #059669; margin: 0; font-size: 24px; }
    .badge { display: inline-block; background-color: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 13px; margin-top: 8px; }
    .footer { font-size: 13px; color: #6b7280; border-top: 1px solid #eef0f2; padding-top: 20px; margin-top: 28px; }
    .summary-box { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SportBooking</h1>
      <span class="badge">BUỔI CHƠI HOÀN TẤT</span>
    </div>
    <p>Xin chào <strong>${name}</strong>,</p>
    <p>Chủ sân đã xác nhận hoàn tất buổi chơi của bạn. Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ qua hệ thống SportBooking!</p>
    
    <div class="summary-box">
      <h3 style="margin-top: 0; color: #065f46;">Thông tin buổi chơi:</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #4b5563;">Mã đơn:</td>
          <td style="padding: 6px 0; font-weight: bold; text-align: right;">${bookingCode}</td>
        </tr>
        ${facilityName ? `
        <tr>
          <td style="padding: 6px 0; color: #4b5563;">Cơ sở:</td>
          <td style="padding: 6px 0; font-weight: 500; text-align: right;">${facilityName}</td>
        </tr>` : ''}
        ${courtName ? `
        <tr>
          <td style="padding: 6px 0; color: #4b5563;">Sân:</td>
          <td style="padding: 6px 0; font-weight: 500; text-align: right;">${courtName}</td>
        </tr>` : ''}
        ${bookingDate ? `
        <tr>
          <td style="padding: 6px 0; color: #4b5563;">Ngày chơi:</td>
          <td style="padding: 6px 0; font-weight: 500; text-align: right;">${bookingDate}</td>
        </tr>` : ''}
        ${startTime && endTime ? `
        <tr>
          <td style="padding: 6px 0; color: #4b5563;">Khung giờ:</td>
          <td style="padding: 6px 0; font-weight: 500; text-align: right;">${startTime} – ${endTime}</td>
        </tr>` : ''}
        ${note ? `
        <tr>
          <td style="padding: 6px 0; color: #4b5563;">Ghi chú:</td>
          <td style="padding: 6px 0; font-weight: 500; text-align: right;">${note}</td>
        </tr>` : ''}
      </table>
    </div>

    <p>Hẹn gặp lại bạn trong những buổi tập luyện và thi đấu tiếp theo!</p>
    <div class="footer">
      <p>Đây là email tự động từ hệ thống SportBooking. Vui lòng không trả lời trực tiếp email này.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Xin chào ${name},

Buổi chơi của bạn (Mã đơn: ${bookingCode}) đã được chủ sân xác nhận hoàn tất thành công.
- Cơ sở: ${facilityName}
- Sân: ${courtName}
- Khung giờ: ${bookingDate} ${startTime} – ${endTime}
${note ? `- Ghi chú: ${note}\n` : ''}
Cảm ơn bạn đã đồng hành cùng SportBooking!
  `.trim();

  return { subject, html, text };
}

export default renderBookingCompletedTemplate;

