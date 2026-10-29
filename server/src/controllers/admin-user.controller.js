import { userRepository } from '../repositories/user.repository.js';
import { authTokenService, TOKEN_TYPES } from '../services/auth-token.service.js';
import { emailService } from '../services/email/email.service.js';
import { withTransaction } from '../database/transaction.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';
import { env } from '../config/env.js';

export class AdminUserController {
  /**
   * Admin provisions a new OWNER account and queues an activation email (valid for 24h)
   */
  async provisionOwner(req, res, next) {
    try {
      const { fullName, email, phoneNumber } = req.body || {};

      if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
        throw AppError.badRequest('Họ và tên chủ sân không được để trống.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'fullName', message: 'Họ và tên là bắt buộc.' },
        ]);
      }

      if (!email || !email.includes('@')) {
        throw AppError.badRequest('Email không hợp lệ.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'email', message: 'Email phải đúng định dạng.' },
        ]);
      }

      if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
        throw AppError.badRequest('Số điện thoại không được để trống.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'phoneNumber', message: 'Số điện thoại là bắt buộc.' },
        ]);
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await userRepository.findByEmail(normalizedEmail);
      if (existingUser) {
        throw new AppError('Email đã tồn tại trong hệ thống.', 409, ERROR_CODES.USER_ALREADY_EXISTS);
      }

      await withTransaction(async (session) => {
        const newOwner = await userRepository.create(
          {
            email: normalizedEmail,
            fullName: fullName.trim(),
            phoneNumber: phoneNumber.trim(),
            role: 'OWNER',
            passwordHash: null,
            isLocked: false,
            tokenVersion: 0,
            emailVerifiedAt: null,
            activatedAt: null,
          },
          session
        );

        const { token, expiresAt } = await authTokenService.generateToken(
          { userId: newOwner._id, type: TOKEN_TYPES.ACTIVATE_OWNER },
          { session }
        );

        const activationUrl = `${env.CLIENT_ORIGIN}/activate-owner?token=${token}`;

        await emailService.queueEmail(
          {
            eventKey: `ACTIVATE_OWNER:${newOwner._id}:${Date.now()}`,
            eventType: TOKEN_TYPES.ACTIVATE_OWNER,
            recipientEmail: newOwner.email,
            recipientName: newOwner.fullName,
            subject: '[SportBooking] Kích hoạt tài khoản Chủ sân và thiết lập mật khẩu',
            templateName: 'ACTIVATE_OWNER',
            templateData: {
              name: newOwner.fullName,
              activationUrl,
              expiresInHours: 24,
              expiresAt,
            },
          },
          { session }
        );
      });

      return res.status(201).json({
        success: true,
        message: 'Cấp tài khoản chủ sân thành công, email kích hoạt đã được gửi.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin resends activation invitation email for an unactivated owner
   */
  async resendOwnerInvitation(req, res, next) {
    try {
      const { id } = req.params;

      const user = await userRepository.findById(id);
      if (!user) {
        throw new AppError('Không tìm thấy người dùng.', 404, ERROR_CODES.USER_NOT_FOUND);
      }

      if (user.role !== 'OWNER') {
        throw AppError.badRequest('Tài khoản không phải vai trò chủ sân (OWNER).', ERROR_CODES.VALIDATION_ERROR);
      }

      if (user.activatedAt) {
        throw AppError.badRequest('Tài khoản chủ sân đã được kích hoạt trước đó.', ERROR_CODES.VALIDATION_ERROR);
      }

      await withTransaction(async (session) => {
        const { token, expiresAt } = await authTokenService.generateToken(
          { userId: user._id, type: TOKEN_TYPES.ACTIVATE_OWNER },
          { session }
        );

        const activationUrl = `${env.CLIENT_ORIGIN}/activate-owner?token=${token}`;

        await emailService.queueEmail(
          {
            eventKey: `ACTIVATE_OWNER:${user._id}:${Date.now()}`,
            eventType: TOKEN_TYPES.ACTIVATE_OWNER,
            recipientEmail: user.email,
            recipientName: user.fullName,
            subject: '[SportBooking] Kích hoạt tài khoản Chủ sân và thiết lập mật khẩu',
            templateName: 'ACTIVATE_OWNER',
            templateData: {
              name: user.fullName,
              activationUrl,
              expiresInHours: 24,
              expiresAt,
            },
          },
          { session }
        );
      });

      return res.status(200).json({
        success: true,
        message: 'Đã gửi lại email mời kích hoạt cho chủ sân.',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const adminUserController = new AdminUserController();
export default adminUserController;
