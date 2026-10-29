/**
 * Verification Email Template for Customer Registration
 * @param {object} data
 * @param {string} data.name - Recipient name
 * @param {string} data.verificationUrl - Full verification link
 * @param {number} [data.expiresInMinutes=15] - Expiration in minutes
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderVerifyEmailTemplate(data) {
  const { name = 'Khách hàng', verificationUrl, expiresInMinutes = 15 } = data;
  const subject = '[SportBooking] Xác thực địa chỉ email tài khoản của bạn';

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
    .btn { display: inline-block; background-color: #16a34a; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; margin: 24px 0; text-align: center; }
    .footer { font-size: 13px; color: #6b7280; border-top: 1px solid #eef0f2; padding-top: 20px; margin-top: 28px; }
    .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; font-size: 14px; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sport Booking Platform</h1>
    </div>
    <p>Xin chào <strong>${name}</strong>,</p>
    <p>Cảm ơn bạn đã đăng ký tài khoản tại hệ thống đặt sân <strong>SportBooking</strong>. Để hoàn tất việc kích hoạt tài khoản và bắt đầu đặt sân, vui lòng xác thực địa chỉ email của bạn bằng cách nhấn vào nút bên dưới:</p>
    <div style="text-align: center;">
      <a href="${verificationUrl}" class="btn" target="_blank" rel="noopener noreferrer">Xác thực tài khoản ngay</a>
    </div>
    <div class="alert">
      <strong>Lưu ý:</strong> Liên kết này chỉ có hiệu lực trong vòng <strong>${expiresInMinutes} phút</strong> và chỉ sử dụng được <strong>duy nhất 1 lần</strong>.
    </div>
    <p>Nếu nút trên không hoạt động, bạn có thể sao chép liên kết sau và dán vào trình duyệt:</p>
    <p style="word-break: break-all; color: #2563eb; font-size: 13px;">${verificationUrl}</p>
    <div class="footer">
      <p>Nếu bạn không thực hiện đăng ký này, xin vui lòng bỏ qua email. Tài khoản chưa xác thực sẽ không thể đặt sân trực tuyến.</p>
      <p>© 2026 Sport Booking Platform. Mọi quyền được bảo lưu.</p>
    </div>
  </div>
</body>
</html>
`.trim();

  const text = `
Xin chào ${name},

Cảm ơn bạn đã đăng ký tài khoản tại hệ thống đặt sân SportBooking.
Để hoàn tất việc kích hoạt tài khoản, vui lòng truy cập liên kết sau:
${verificationUrl}

Lưu ý: Liên kết này chỉ có hiệu lực trong vòng ${expiresInMinutes} phút và chỉ sử dụng được duy nhất 1 lần.
Nếu bạn không thực hiện đăng ký này, xin vui lòng bỏ qua email.
`.trim();

  return { subject, html, text };
}

export default renderVerifyEmailTemplate;
