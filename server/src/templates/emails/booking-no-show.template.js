/**
 * Booking No-Show Email Template
 * Sent to customer when owner or admin marks booking as no-show after endTime (Criterion 18).
 *
 * @param {Object} data
 * @param {string} data.name - Recipient name
 * @param {string} data.bookingCode - Booking code
 * @param {string} [data.facilityName] - Facility name
 * @param {string} [data.courtName] - Court name
 * @param {string} [data.bookingDate] - Booking date
 * @param {string} [data.startTime] - Start time
 * @param {string} [data.endTime] - End time
 * @param {string} [data.note] - No-show note
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderBookingNoShowTemplate(data) {
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

  const subject = `[SportBooking] Xác nhận không đến sân (No-show) - ${bookingCode}`;

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
    .header h1 { color: #6b7280; margin: 0; font-size: 24px; }
    .badge { display: inline-block; background-color: #f3f4f6; color: #374151; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 13px; margin-top: 8px; }
    .footer { font-size: 13px; color: #6b7280; border-top: 1px solid #eef0f2; padding-top: 20px; margin-top: 28px; }
    .summary-box { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SportBooking</h1>
      <span class="badge">XÁC NHẬN VẮNG MẶT (NO-SHOW)</span>
    </div>
    <p>Xin chào <strong>${name}</strong>,</p>
    <p>Chủ sân đã ghi nhận bạn không đến sử dụng sân theo đúng khung giờ đã đặt cho đơn <strong>${bookingCode}</strong>.</p>
    
    <div class="summary-box">
      <h3 style="margin-top: 0; color: #374151;">Chi tiết đơn đặt:</h3>
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

    <p>Theo chính sách đặt sân đã thỏa thuận, khoản tiền thuê sân không được hoàn lại trong trường hợp khách vắng mặt (No-show).</p>
    <p>Nếu bạn có thắc mắc hoặc cần khiếu nại, vui lòng liên hệ quản trị viên để được hỗ trợ.</p>
    <div class="footer">
      <p>Đây là email tự động từ hệ thống SportBooking. Vui lòng không trả lời trực tiếp email này.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Xin chào ${name},

Đơn đặt sân ${bookingCode} của bạn đã được chủ sân ghi nhận vắng mặt (No-show).
- Cơ sở: ${facilityName}
- Sân: ${courtName}
- Khung giờ: ${bookingDate} ${startTime} – ${endTime}
${note ? `- Ghi chú: ${note}\n` : ''}
Theo chính sách đặt sân, khoản tiền đã trả không được hoàn lại khi khách hàng không đến sân.
  `.trim();

  return { subject, html, text };
}

export default renderBookingNoShowTemplate;

