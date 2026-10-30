import { userRepository } from '../repositories/user.repository.js';
import { authSessionRepository } from '../repositories/auth-session.repository.js';
import { refreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { actionLogRepository } from '../repositories/action-log.repository.js';
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

  /**
   * List users with optional role, lock status, search and pagination
   */
  async listUsers(req, res, next) {
    try {
      const result = await userRepository.findUsers(req.query);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get user details by ID
   */
  async getUserById(req, res, next) {
    try {
      const user = await userRepository.findById(req.params.id);
      if (!user) {
        throw new AppError('Không tìm thấy người dùng.', 404, ERROR_CODES.USER_NOT_FOUND);
      }

      return res.status(200).json({
        success: true,
        data: userRepository.toUserDTO(user),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin updates contact information with strict whitelist protection
   * ADM-02: Only allows updating fullName and phoneNumber.
   * Disallows altering role, email, isLocked, passwordHash, tokenVersion via extra inputs.
   */
  async updateUser(req, res, next) {
    try {
      const user = await userRepository.findById(req.params.id);
      if (!user) {
        throw new AppError('Không tìm thấy người dùng.', 404, ERROR_CODES.USER_NOT_FOUND);
      }

      const updateData = {};
      const { fullName, phoneNumber } = req.body || {};

      if (fullName !== undefined) {
        if (typeof fullName !== 'string' || !fullName.trim()) {
          throw AppError.badRequest('Họ và tên không được để trống.', ERROR_CODES.VALIDATION_ERROR);
        }
        updateData.fullName = fullName.trim();
      }

      if (phoneNumber !== undefined) {
        if (typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
          throw AppError.badRequest('Số điện thoại không được để trống.', ERROR_CODES.VALIDATION_ERROR);
        }
        updateData.phoneNumber = phoneNumber.trim();
      }

      const updated = await userRepository.updateById(user._id, updateData);

      return res.status(200).json({
        success: true,
        data: userRepository.toUserDTO(updated),
        message: 'Cập nhật thông tin người dùng thành công.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Lock user account with mandatory reason
   * Revokes all active sessions and refresh tokens, increments tokenVersion, records ActionLog, queues email
   */
  async lockUser(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};

      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        throw AppError.badRequest('Lý do khóa tài khoản là bắt buộc.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'reason', message: 'Lý do khóa tài khoản là bắt buộc.' },
        ]);
      }

      const user = await userRepository.findById(id);
      if (!user) {
        throw new AppError('Không tìm thấy người dùng.', 404, ERROR_CODES.USER_NOT_FOUND);
      }

      // ADM-02: Giao diện không có đăng ký admin hoặc thao tác tự khóa admin
      if (user.role === 'ADMIN') {
        throw AppError.badRequest('Không thể khóa tài khoản Quản trị viên.', ERROR_CODES.VALIDATION_ERROR);
      }

      if (user.isLocked) {
        throw AppError.badRequest('Tài khoản đã bị khóa trước đó.', ERROR_CODES.VALIDATION_ERROR);
      }

      const trimmedReason = reason.trim();
      const actorId = req.user?.id || req.user?._id;

      await withTransaction(async (session) => {
        // Lock user and increment tokenVersion atomically
        await userRepository.lockUser(user._id, trimmedReason, session);

        // Revoke all active sessions and refresh tokens
        await authSessionRepository.revokeAllUserSessions(user._id, 'REVOKED_LOCK', session);
        await refreshTokenRepository.revokeAllForUser(user._id, session);

        // Record ActionLog
        await actionLogRepository.create(
          {
            actorId,
            actorRole: 'ADMIN',
            targetType: 'USER',
            targetId: user._id,
            action: 'LOCK_USER',
            reason: trimmedReason,
            previousState: { isLocked: false, lockReason: null },
            newState: { isLocked: true, lockReason: trimmedReason },
            ipAddress: req.ip || null,
          },
          session
        );

        // Queue notification email to user
        await emailService.queueEmail(
          {
            eventKey: `ACCOUNT_LOCKED:${user._id}:${Date.now()}`,
            eventType: 'ACCOUNT_LOCKED',
            recipientEmail: user.email,
            recipientName: user.fullName,
            subject: '[SportBooking] Thông báo tạm khóa tài khoản của bạn',
            templateName: 'ACCOUNT_LOCKED',
            templateData: {
              name: user.fullName,
              reason: trimmedReason,
              email: user.email,
            },
          },
          { session }
        );
      });

      return res.status(200).json({
        success: true,
        message: 'Đã khóa tài khoản thành công.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Unlock user account
   * NOTE: Does NOT restore prior sessions or decrease tokenVersion (AUTH-06, rule 60).
   * User must log in anew.
   */
  async unlockUser(req, res, next) {
    try {
      const { id } = req.params;

      const user = await userRepository.findById(id);
      if (!user) {
        throw new AppError('Không tìm thấy người dùng.', 404, ERROR_CODES.USER_NOT_FOUND);
      }

      if (!user.isLocked) {
        throw AppError.badRequest('Tài khoản đang không ở trạng thái bị khóa.', ERROR_CODES.VALIDATION_ERROR);
      }

      const actorId = req.user?.id || req.user?._id;
      const reason = req.body?.reason || 'Quản trị viên mở khóa tài khoản';

      await withTransaction(async (session) => {
        await userRepository.unlockUser(user._id, session);

        // Record ActionLog
        await actionLogRepository.create(
          {
            actorId,
            actorRole: 'ADMIN',
            targetType: 'USER',
            targetId: user._id,
            action: 'UNLOCK_USER',
            reason,
            previousState: { isLocked: true, lockReason: user.lockReason },
            newState: { isLocked: false, lockReason: null },
            ipAddress: req.ip || null,
          },
          session
        );

        // Queue notification email to user
        await emailService.queueEmail(
          {
            eventKey: `ACCOUNT_UNLOCKED:${user._id}:${Date.now()}`,
            eventType: 'ACCOUNT_UNLOCKED',
            recipientEmail: user.email,
            recipientName: user.fullName,
            subject: '[SportBooking] Thông báo tài khoản của bạn đã được mở khóa',
            templateName: 'ACCOUNT_UNLOCKED',
            templateData: {
              name: user.fullName,
              email: user.email,
            },
          },
          { session }
        );
      });

      return res.status(200).json({
        success: true,
        message: 'Đã mở khóa tài khoản thành công.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin initiates reset password email for an active user
   * AUTH-04: Admin supports by requesting system to send reset link (15m, single-use).
   * Unactivated owners must use resend-invitation instead.
   * Locked users cannot be reset.
   */
  async resetPassword(req, res, next) {
    try {
      const { id } = req.params;

      const user = await userRepository.findById(id);
      if (!user) {
        throw new AppError('Không tìm thấy người dùng.', 404, ERROR_CODES.USER_NOT_FOUND);
      }

      if (user.role === 'OWNER' && !user.activatedAt) {
        throw AppError.badRequest(
          'Tài khoản chủ sân chưa kích hoạt. Vui lòng sử dụng tính năng gửi lại lời mời kích hoạt.',
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      if (user.isLocked) {
        throw new AppError(
          'Tài khoản đang bị khóa, không thể gửi liên kết đặt lại mật khẩu.',
          403,
          ERROR_CODES.ACCOUNT_LOCKED
        );
      }

      await withTransaction(async (session) => {
        const { token, expiresAt } = await authTokenService.generateToken(
          { userId: user._id, type: TOKEN_TYPES.RESET_PASSWORD },
          { session }
        );

        const resetUrl = `${env.CLIENT_ORIGIN}/reset-password?token=${token}`;

        await emailService.queueEmail(
          {
            eventKey: `RESET_PASSWORD:${user._id}:${Date.now()}`,
            eventType: TOKEN_TYPES.RESET_PASSWORD,
            recipientEmail: user.email,
            recipientName: user.fullName,
            subject: '[SportBooking] Yêu cầu đặt lại mật khẩu từ Quản trị viên',
            templateName: 'RESET_PASSWORD',
            templateData: {
              name: user.fullName,
              resetUrl,
              expiresInMinutes: 15,
              expiresAt,
            },
          },
          { session }
        );
      });

      return res.status(200).json({
        success: true,
        message: 'Đã gửi liên kết đặt lại mật khẩu tới email người dùng.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin lists paginated audit action logs
   */
  async listActionLogs(req, res, next) {
    try {
      const result = await actionLogRepository.findLogs(req.query);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const adminUserController = new AdminUserController();
export default adminUserController;
