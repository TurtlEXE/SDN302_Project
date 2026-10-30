/**
 * Booking Confirmed Email Template
 * Sent to customer (or owner for on-behalf) upon 100% successful payment verification (Section 8.6, Criteria 39, 42).
 *
 * @param {Object} data
 * @param {string} data.name - Recipient name
 * @param {string} data.requestNumber - Booking request identifier (e.g. BR20261029-ABC)
 * @param {string} data.vnpayTxnRef - Payment order reference (e.g. PO12345678)
 * @param {string} data.vnpayTransactionNo - VNPay transaction number
 * @param {number} data.totalAmountVnd - Total amount paid in VND
 * @param {string} data.bookingDate - Booking date (YYYY-MM-DD)
 * @param {string} data.facilityName - Facility name
 * @param {string} data.courtName - Court name
 * @param {Array<{ bookingCode: string, startTime: string, endTime: string, durationMinutes: number, totalPriceVnd: number }>} data.bookings
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderBookingConfirmedTemplate(data) {
  const {
    name = 'Quý khách',
    requestNumber,
    vnpayTxnRef,
    vnpayTransactionNo,
    totalAmountVnd,
    bookingDate,
    facilityName,
    courtName,
    bookings = [],
  } = data;

  const formattedTotal = new Intl.NumberFormat('vi-VN').format(totalAmountVnd || 0);
  const subject = `[SportBooking] Xác nhận đặt sân thành công - ${requestNumber}`;

  const bookingRowsHtml = bookings
    .map(
      (b) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${b.bookingCode}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${b.startTime} – ${b.endTime}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${b.durationMinutes} phút</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #166534; font-weight: 600;">
        ${new Intl.NumberFormat('vi-VN').format(b.totalPriceVnd || 0)} đ
      </td>
    </tr>`
    )
    .join('');

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
    .badge { display: inline-block; background-color: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 13px; margin-top: 8px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
    .info-table th { background-color: #f9fafb; padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #4b5563; }
    .footer { font-size: 13px; color: #6b7280; border-top: 1px solid #eef0f2; padding-top: 20px; margin-top: 28px; }
    .summary-box { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .highlight { font-weight: bold; color: #166534; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sport Booking Platform</h1>
      <div class="badge">ĐÃ THANH TOÁN 100% QUA VNPAY</div>
    </div>
    <p>Xin chào <strong>${name}</strong>,</p>
    <p>Đơn đặt sân của bạn đã được xác nhận thanh toán thành công qua cổng thanh toán VNPay. Chi tiết thông tin đặt sân như sau:</p>

    <div class="summary-box">
      <p style="margin: 4px 0;"><strong>Mã yêu cầu:</strong> ${requestNumber}</p>
      <p style="margin: 4px 0;"><strong>Cơ sở:</strong> ${facilityName || 'N/A'}</p>
      <p style="margin: 4px 0;"><strong>Sân:</strong> ${courtName || 'N/A'}</p>
      <p style="margin: 4px 0;"><strong>Ngày chơi:</strong> ${bookingDate || 'N/A'}</p>
      <p style="margin: 4px 0;"><strong>Mã tham chiếu thanh toán:</strong> ${vnpayTxnRef || 'N/A'}</p>
      ${vnpayTransactionNo ? `<p style="margin: 4px 0;"><strong>Mã giao dịch VNPay:</strong> ${vnpayTransactionNo}</p>` : ''}
      <p style="margin: 4px 0;"><strong>Tổng tiền đã thanh toán:</strong> <span class="highlight">${formattedTotal} VND</span></p>
    </div>

    <h3>Danh sách các khung giờ đặt sân:</h3>
    <table class="info-table">
      <thead>
        <tr>
          <th>Mã đơn</th>
          <th style="text-align: center;">Khoảng giờ</th>
          <th style="text-align: center;">Thời lượng</th>
          <th style="text-align: right;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${bookingRowsHtml}
      </tbody>
    </table>

    <p style="font-size: 14px; color: #4b5563;">
      * Lưu ý: Hệ thống đã thu đủ 100% tiền thuê sân qua VNPay. Quý khách không phải trả thêm tiền sân tại địa điểm. Vui lòng đến đúng giờ để có trải nghiệm chơi thể thao tốt nhất.
    </p>

    <div class="footer">
      <p>Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của SportBooking Platform.</p>
      <p>© 2026 Sport Booking Platform. Mọi quyền được bảo lưu.</p>
    </div>
  </div>
</body>
</html>
`.trim();

  const textBookings = bookings
    .map((b) => `- ${b.bookingCode}: ${b.startTime} - ${b.endTime} (${b.durationMinutes} phút) -> ${b.totalPriceVnd} đ`)
    .join('\n');

  const text = `
Xin chào ${name},

Đơn đặt sân của bạn đã được xác nhận thanh toán thành công qua VNPay!

Thông tin chi tiết:
- Mã yêu cầu: ${requestNumber}
- Cơ sở: ${facilityName || 'N/A'}
- Sân: ${courtName || 'N/A'}
- Ngày chơi: ${bookingDate || 'N/A'}
- Mã tham chiếu: ${vnpayTxnRef || 'N/A'}
- Mã giao dịch VNPay: ${vnpayTransactionNo || 'N/A'}
- Tổng tiền đã trả: ${formattedTotal} VND

Các khoảng giờ đặt:
${textBookings}

Lưu ý: Bạn đã thanh toán đủ 100% qua VNPay, không phải trả lại tiền sân tại địa điểm.
Cảm ơn bạn đã sử dụng dịch vụ của SportBooking!
`.trim();

  return { subject, html, text };
}

export default renderBookingConfirmedTemplate;

