/**
 * Account Unlocked Email Template
 * @param {object} data
 * @param {string} data.name - Recipient name
 * @param {string} [data.email] - User email
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderAccountUnlockedTemplate(data) {
  const { name = 'Người dùng' } = data;
  const subject = '[SportBooking] Thông báo tài khoản của bạn đã được mở khóa';

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
    .alert-success { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 14px 16px; margin: 20px 0; font-size: 14px; color: #15803d; border-radius: 4px; }
    .footer { font-size: 13px; color: #6b7280; border-top: 1px solid #eef0f2; padding-top: 20px; margin-top: 28px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sport Booking Platform</h1>
    </div>
    <p>Xin chào <strong>${name}</strong>,</p>
    <p>Tài khoản của bạn trên hệ thống <strong>SportBooking</strong> đã được Quản trị viên mở khóa thành công.</p>
    <div class="alert-success">
      <strong>Trạng thái:</strong> Tài khoản đã hoạt động trở lại bình thường.
    </div>
    <p><strong>Lưu ý bảo mật:</strong> Để đảm bảo tính an toàn, việc mở khóa tài khoản <em>không tự động khôi phục các phiên đăng nhập cũ</em>. Vui lòng đăng nhập lại bằng email và mật khẩu của bạn để tiếp tục sử dụng hệ thống.</p>
    <div class="footer">
      <p>Email này được gửi tự động từ hệ thống Sport Booking Platform. Vui lòng không trả lời trực tiếp email này.</p>
      <p>© 2026 Sport Booking Platform. Mọi quyền được bảo lưu.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Xin chào ${name},

Tài khoản của bạn trên hệ thống SportBooking đã được Quản trị viên mở khóa thành công.
Trạng thái: Tài khoản đã hoạt động trở lại bình thường.

Lưu ý: Việc mở khóa không tự động khôi phục các phiên đăng nhập cũ. Vui lòng đăng nhập lại để tiếp tục sử dụng hệ thống.

Trân trọng,
Sport Booking Platform Team
  `.trim();

  return { subject, html, text };
}

export default renderAccountUnlockedTemplate;

