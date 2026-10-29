/**
 * Password Reset Email Template
 * @param {object} data
 * @param {string} data.name - Recipient name
 * @param {string} data.resetUrl - Full password reset link
 * @param {number} [data.expiresInMinutes=15] - Expiration in minutes
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderResetPasswordTemplate(data) {
  const { name = 'Người dùng', resetUrl, expiresInMinutes = 15 } = data;
  const subject = '[SportBooking] Yêu cầu đặt lại mật khẩu tài khoản';

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
    .btn { display: inline-block; background-color: #dc2626; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; margin: 24px 0; text-align: center; }
    .footer { font-size: 13px; color: #6b7280; border-top: 1px solid #eef0f2; padding-top: 20px; margin-top: 28px; }
    .alert { background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; font-size: 14px; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sport Booking Platform</h1>
    </div>
    <p>Xin chào <strong>${name}</strong>,</p>
    <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>SportBooking</strong> của bạn.</p>
    <p>Để đặt mật khẩu mới, vui lòng bấm vào nút bên dưới:</p>
    <div style="text-align: center;">
      <a href="${resetUrl}" class="btn" target="_blank" rel="noopener noreferrer">Đặt lại mật khẩu</a>
    </div>
    <div class="alert">
      <strong>Lưu ý bảo mật:</strong> Liên kết này chỉ có hiệu lực trong vòng <strong>${expiresInMinutes} phút</strong> và chỉ sử dụng được <strong>duy nhất 1 lần</strong>.
    </div>
    <p>Nếu nút trên không hoạt động, bạn có thể sao chép liên kết sau và dán vào trình duyệt:</p>
    <p style="word-break: break-all; color: #2563eb; font-size: 13px;">${resetUrl}</p>
    <div class="footer">
      <p>Nếu bạn KHÔNG yêu cầu đặt lại mật khẩu, xin vui lòng bỏ qua email này. Mật khẩu hiện tại của bạn vẫn an toàn và không bị thay đổi.</p>
      <p>© 2026 Sport Booking Platform. Mọi quyền được bảo lưu.</p>
    </div>
  </div>
</body>
</html>
`.trim();

  const text = `
Xin chào ${name},

Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản SportBooking của bạn.
Để đặt lại mật khẩu mới, vui lòng truy cập liên kết sau:
${resetUrl}

Lưu ý: Liên kết chỉ có hiệu lực trong vòng ${expiresInMinutes} phút và chỉ sử dụng được duy nhất 1 lần.
Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
© 2026 Sport Booking Platform.
`.trim();

  return { subject, html, text };
}

export default renderResetPasswordTemplate;
