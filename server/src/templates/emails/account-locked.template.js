/**
 * Account Locked Email Template
 * @param {object} data
 * @param {string} data.name - Recipient name
 * @param {string} data.reason - Reason for locking the account
 * @param {string} [data.email] - User email
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderAccountLockedTemplate(data) {
  const { name = 'Người dùng', reason = 'Vi phạm quy định hệ thống' } = data;
  const subject = '[SportBooking] Thông báo tạm khóa tài khoản của bạn';

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
    .alert-danger { background: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; margin: 20px 0; font-size: 14px; color: #991b1b; border-radius: 4px; }
    .footer { font-size: 13px; color: #6b7280; border-top: 1px solid #eef0f2; padding-top: 20px; margin-top: 28px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sport Booking Platform</h1>
    </div>
    <p>Xin chào <strong>${name}</strong>,</p>
    <p>Tài khoản của bạn trên hệ thống <strong>SportBooking</strong> đã bị tạm khóa bởi Quản trị viên.</p>
    <div class="alert-danger">
      <strong>Lý do khóa:</strong> ${reason}
    </div>
    <p>Trong thời gian tài khoản bị khóa:</p>
    <ul>
      <li>Bạn sẽ không thể đăng nhập hoặc thực hiện các giao dịch trên hệ thống.</li>
      <li>Toàn bộ phiên đăng nhập hiện tại trên các thiết bị đã bị thu hồi để đảm bảo an toàn.</li>
      <li>Nếu bạn là Chủ sân (OWNER), các cơ sở sân bãi thuộc tài khoản của bạn sẽ tạm ngừng nhận đơn đặt mới.</li>
    </ul>
    <p>Nếu bạn cho rằng đây là sự nhầm lẫn hoặc cần hỗ trợ mở lại tài khoản, vui lòng liên hệ với bộ phận hỗ trợ quản trị hệ thống.</p>
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

Tài khoản của bạn trên hệ thống SportBooking đã bị tạm khóa bởi Quản trị viên.
Lý do khóa: ${reason}

Trong thời gian tài khoản bị khóa, bạn không thể đăng nhập hoặc thực hiện giao dịch. Toàn bộ phiên đăng nhập cũ đã bị thu hồi.
Vui lòng liên hệ với bộ phận hỗ trợ quản trị hệ thống nếu cần giải đáp thắc mắc.

Trân trọng,
Sport Booking Platform Team
  `.trim();

  return { subject, html, text };
}

export default renderAccountLockedTemplate;

