import { authTokenService, TOKEN_TYPES } from '../services/auth-token.service.js';
import { emailService } from '../services/email/email.service.js';
import { withTransaction } from '../database/transaction.js';
import { User } from '../models/user.model.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';
import { env } from '../config/env.js';

export class AuthController {
  /**
   * Resends verification email for unverified customer accounts
   * Rate limited: 60s cooldown per email
   * Transactional Outbox: token generation and email outbox are committed atomically
   */
  async resendVerification(req, res, next) {
    try {
      const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
      if (!email || !email.includes('@')) {
        throw AppError.badRequest('Địa chỉ email không hợp lệ.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'email', message: 'Email phải đúng định dạng.' },
        ]);
      }

      const user = await User.findOne({ email });

      // Privacy protection: Return generic message if user not found
      if (!user) {
        return res.status(200).json({
          success: true,
          message: 'Nếu địa chỉ email hợp lệ và chưa xác thực, liên kết xác thực đã được gửi tới hộp thư của bạn.',
        });
      }

      // If user is already verified
      if (user.emailVerifiedAt) {
        return res.status(200).json({
          success: true,
          message: 'Địa chỉ email này đã được xác thực trước đó. Bạn có thể đăng nhập ngay.',
        });
      }

      // Transactional Outbox pattern: create token and outbox record atomically
      await withTransaction(async (session) => {
        const { token, expiresAt } = await authTokenService.generateToken(
          { userId: user._id, type: TOKEN_TYPES.VERIFY_EMAIL },
          { session }
        );

        const verificationUrl = `${env.CLIENT_ORIGIN}/verify-email?token=${token}`;

        await emailService.queueEmail(
          {
            eventKey: `VERIFY_EMAIL:${user._id}:${Date.now()}`,
            eventType: TOKEN_TYPES.VERIFY_EMAIL,
            recipientEmail: user.email,
            recipientName: user.fullName || 'Khách hàng',
            subject: '[SportBooking] Xác thực địa chỉ email tài khoản của bạn',
            templateName: 'VERIFY_EMAIL',
            templateData: {
              name: user.fullName || 'Khách hàng',
              verificationUrl,
              expiresInMinutes: 15,
              expiresAt,
            },
          },
          { session }
        );
      });

      return res.status(200).json({
        success: true,
        message: 'Yêu cầu gửi lại email xác thực đã được tiếp nhận thành công. Vui lòng kiểm tra hộp thư.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Inspects token status via GET without consuming it
   * Protects token from web crawlers / link prefetchers
   */
  async inspectToken(req, res, next) {
    try {
      const token = req.query.token;
      const type = req.query.type || TOKEN_TYPES.VERIFY_EMAIL;

      if (!token) {
        throw AppError.badRequest('Mã token không được để trống.', ERROR_CODES.VALIDATION_ERROR);
      }

      const info = await authTokenService.inspectToken({ token, type });

      return res.status(200).json({
        success: true,
        data: {
          valid: true,
          type: info.type,
          expiresAt: info.expiresAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Consumes single-use token and verifies customer email (via POST)
   */
  async verifyEmail(req, res, next) {
    try {
      const token = req.body?.token;
      if (!token) {
        throw AppError.badRequest('Mã token xác thực không được để trống.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'token', message: 'Token là bắt buộc.' },
        ]);
      }

      await withTransaction(async (session) => {
        // Atomically consume token
        const consumedToken = await authTokenService.consumeToken(
          { token, type: TOKEN_TYPES.VERIFY_EMAIL },
          { session }
        );

        // Update User verification timestamp
        await User.findByIdAndUpdate(
          consumedToken.userId,
          { $set: { emailVerifiedAt: new Date() } },
          { session }
        );
      });

      return res.status(200).json({
        success: true,
        message: 'Xác thực địa chỉ email thành công. Tài khoản của bạn đã sẵn sàng sử dụng.',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
export default authController;
