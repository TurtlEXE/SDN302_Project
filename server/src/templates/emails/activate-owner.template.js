/**
 * Activation Email Template for Owner Accounts Created by Admin
 * @param {object} data
 * @param {string} data.name - Recipient name
 * @param {string} data.activationUrl - Full activation link
 * @param {number} [data.expiresInHours=24] - Expiration in hours
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderActivateOwnerTemplate(data) {
  const { name = 'Chủ sân', activationUrl, expiresInHours = 24 } = data;
  const subject = '[SportBooking] Kích hoạt tài khoản Chủ sân và thiết lập mật khẩu';

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
    .header h1 { color: #1e40af; margin: 0; font-size: 24px; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; margin: 24px 0; text-align: center; }
    .footer { font-size: 13px; color: #6b7280; border-top: 1px solid #eef0f2; padding-top: 20px; margin-top: 28px; }
    .alert { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; font-size: 14px; color: #1e3a8a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sport Booking Platform</h1>
    </div>
    <p>Xin chào <strong>${name}</strong>,</p>
    <p>Tài khoản chủ sân (<strong>OWNER</strong>) của bạn đã được quản trị viên khởi tạo thành công trên hệ thống <strong>SportBooking</strong>.</p>
    <p>Để hoàn tất kích hoạt tài khoản và tự thiết lập mật khẩu đăng nhập lần đầu tiên, vui lòng bấm vào nút bên dưới:</p>
    <div style="text-align: center;">
      <a href="${activationUrl}" class="btn" target="_blank" rel="noopener noreferrer">Kích hoạt tài khoản chủ sân</a>
    </div>
    <div class="alert">
      <strong>Lưu ý:</strong> Liên kết kích hoạt này có hiệu lực trong vòng <strong>${expiresInHours} giờ</strong> và chỉ sử dụng được <strong>duy nhất 1 lần</strong>.
    </div>
    <p>Nếu nút trên không hoạt động, bạn có thể sao chép liên kết sau và dán vào trình duyệt:</p>
    <p style="word-break: break-all; color: #2563eb; font-size: 13px;">${activationUrl}</p>
    <div class="footer">
      <p>Sau khi kích hoạt, bạn sẽ có toàn quyền đăng cơ sở thể thao, quản lý sân con, cấu hình bước giờ và theo dõi lịch đặt sân.</p>
      <p>© 2026 Sport Booking Platform. Mọi quyền được bảo lưu.</p>
    </div>
  </div>
</body>
</html>
`.trim();

  const text = `
Xin chào ${name},

Tài khoản chủ sân (OWNER) của bạn đã được quản trị viên cấp trên hệ thống SportBooking.
Vui lòng truy cập liên kết sau để kích hoạt tài khoản và thiết lập mật khẩu:
${activationUrl}

Lưu ý: Liên kết có hiệu lực trong vòng ${expiresInHours} giờ và chỉ sử dụng được duy nhất 1 lần.
© 2026 Sport Booking Platform.
`.trim();

  return { subject, html, text };
}

export default renderActivateOwnerTemplate;
