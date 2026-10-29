import bcrypt from 'bcryptjs';
import { authTokenService, TOKEN_TYPES } from '../services/auth-token.service.js';
import { emailService } from '../services/email/email.service.js';
import { jwtService } from '../services/jwt.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { authSessionRepository } from '../repositories/auth-session.repository.js';
import { refreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { withTransaction } from '../database/transaction.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';
import { env } from '../config/env.js';

export class AuthController {
  /**
   * Register a new CUSTOMER account
   * Creates unverified user, generates single-use verify token, queues email outbox atomically
   */
  async register(req, res, next) {
    try {
      const { email, password, fullName, phoneNumber } = req.body || {};

      if (!email || !email.includes('@')) {
        throw AppError.badRequest('Email không hợp lệ.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'email', message: 'Email phải đúng định dạng.' },
        ]);
      }

      if (!password || typeof password !== 'string' || password.length < 8) {
        throw AppError.badRequest('Mật khẩu phải có tối thiểu 8 ký tự.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'password', message: 'Mật khẩu phải có ít nhất 8 ký tự.' },
        ]);
      }

      if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
        throw AppError.badRequest('Họ và tên không được để trống.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'fullName', message: 'Họ và tên là bắt buộc.' },
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
        if (existingUser.emailVerifiedAt) {
          throw new AppError(
            'Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng chức năng quên mật khẩu.',
            409,
            ERROR_CODES.USER_ALREADY_EXISTS
          );
        } else {
          throw new AppError(
            'Email này đã được đăng ký nhưng chưa xác thực. Vui lòng kiểm tra email hoặc yêu cầu gửi lại email xác thực.',
            409,
            ERROR_CODES.USER_ALREADY_EXISTS
          );
        }
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await withTransaction(async (session) => {
        // Enforce role CUSTOMER regardless of client input
        const newUser = await userRepository.create(
          {
            email: normalizedEmail,
            passwordHash,
            fullName: fullName.trim(),
            phoneNumber: phoneNumber.trim(),
            role: 'CUSTOMER',
            isLocked: false,
            tokenVersion: 0,
            emailVerifiedAt: null,
            activatedAt: null,
          },
          session
        );

        const { token, expiresAt } = await authTokenService.generateToken(
          { userId: newUser._id, type: TOKEN_TYPES.VERIFY_EMAIL },
          { session }
        );

        const verificationUrl = `${env.CLIENT_ORIGIN}/verify-email?token=${token}`;

        await emailService.queueEmail(
          {
            eventKey: `VERIFY_EMAIL:${newUser._id}:${Date.now()}`,
            eventType: TOKEN_TYPES.VERIFY_EMAIL,
            recipientEmail: newUser.email,
            recipientName: newUser.fullName,
            subject: '[SportBooking] Xác thực địa chỉ email tài khoản của bạn',
            templateName: 'VERIFY_EMAIL',
            templateData: {
              name: newUser.fullName,
              verificationUrl,
              expiresInMinutes: 15,
              expiresAt,
            },
          },
          { session }
        );
      });

      return res.status(201).json({
        success: true,
        message: 'Đăng ký tài khoản thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Login user with email & password
   * Returns access JWT in JSON and sets HttpOnly refresh_token cookie
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        throw AppError.badRequest('Email và mật khẩu không được để trống.', ERROR_CODES.VALIDATION_ERROR);
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await userRepository.findByEmail(normalizedEmail);

      if (!user || !user.passwordHash) {
        throw new AppError('Email hoặc mật khẩu không chính xác.', 401, ERROR_CODES.INVALID_CREDENTIALS);
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new AppError('Email hoặc mật khẩu không chính xác.', 401, ERROR_CODES.INVALID_CREDENTIALS);
      }

      if (user.isLocked) {
        throw new AppError('Tài khoản đã bị khóa bởi quản trị viên.', 403, ERROR_CODES.ACCOUNT_LOCKED);
      }

      if (user.role === 'CUSTOMER' && !user.emailVerifiedAt) {
        throw new AppError(
          'Tài khoản chưa được xác thực email. Vui lòng kiểm tra hộp thư để xác thực trước khi đăng nhập.',
          403,
          ERROR_CODES.ACCOUNT_NOT_VERIFIED
        );
      }

      if (user.role === 'OWNER' && !user.activatedAt) {
        throw new AppError(
          'Tài khoản chủ sân chưa được kích hoạt. Vui lòng kích hoạt qua liên kết trong email mời.',
          403,
          ERROR_CODES.ACCOUNT_NOT_ACTIVATED
        );
      }

      // Create AuthSession
      const absoluteExpiresAt = new Date(Date.now() + env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
      const session = await authSessionRepository.create({
        userId: user._id,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        absoluteExpiresAt,
      });

      // Create RefreshToken
      const rawRefreshToken = refreshTokenRepository.generateRawToken();
      const tokenHash = refreshTokenRepository.hashToken(rawRefreshToken);
      await refreshTokenRepository.create({
        sessionId: session._id,
        userId: user._id,
        tokenHash,
        expiresAt: absoluteExpiresAt,
      });

      // Sign Access Token
      const { accessToken, expiresInSeconds } = jwtService.signAccessToken(user, session);

      // Set HttpOnly Cookie
      res.cookie(env.REFRESH_COOKIE_NAME, rawRefreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'Lax',
        path: env.REFRESH_COOKIE_PATH,
        maxAge: env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({
        success: true,
        data: {
          accessToken,
          expiresInSeconds,
          user: userRepository.toUserDTO(user),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Owner activates account and sets initial password
   */
  async activateOwner(req, res, next) {
    try {
      const { token, password } = req.body || {};

      if (!token) {
        throw AppError.badRequest('Token kích hoạt không được để trống.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'token', message: 'Token là bắt buộc.' },
        ]);
      }

      if (!password || typeof password !== 'string' || password.length < 8) {
        throw AppError.badRequest('Mật khẩu phải có tối thiểu 8 ký tự.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'password', message: 'Mật khẩu phải có ít nhất 8 ký tự.' },
        ]);
      }

      await withTransaction(async (session) => {
        const consumedToken = await authTokenService.consumeToken(
          { token, type: TOKEN_TYPES.ACTIVATE_OWNER },
          { session }
        );

        const user = await userRepository.findById(consumedToken.userId, session);
        if (!user || user.role !== 'OWNER') {
          throw AppError.badRequest('Tài khoản chủ sân không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
        }

        if (user.activatedAt) {
          throw AppError.badRequest('Tài khoản chủ sân đã được kích hoạt trước đó.', ERROR_CODES.VALIDATION_ERROR);
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await userRepository.activateOwner(user._id, passwordHash, session);
      });

      return res.status(200).json({
        success: true,
        message: 'Kích hoạt tài khoản chủ sân thành công. Bạn có thể đăng nhập ngay.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Initiates forgot password flow; sends reset link via transactional outbox
   */
  async forgotPassword(req, res, next) {
    try {
      const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
      if (!email || !email.includes('@')) {
        throw AppError.badRequest('Địa chỉ email không hợp lệ.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'email', message: 'Email phải đúng định dạng.' },
        ]);
      }

      const user = await userRepository.findByEmail(email);

      // Generic response for privacy if user not found, locked, or has no passwordHash
      if (!user || user.isLocked) {
        return res.status(200).json({
          success: true,
          message: 'Nếu địa chỉ email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi tới hộp thư của bạn.',
        });
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
            recipientName: user.fullName || 'Người dùng',
            subject: '[SportBooking] Yêu cầu đặt lại mật khẩu tài khoản',
            templateName: 'RESET_PASSWORD',
            templateData: {
              name: user.fullName || 'Người dùng',
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
        message: 'Nếu địa chỉ email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi tới hộp thư của bạn.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Resets password using single-use token and revokes all active user sessions
   */
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body || {};

      if (!token) {
        throw AppError.badRequest('Token đặt lại mật khẩu không được để trống.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'token', message: 'Token là bắt buộc.' },
        ]);
      }

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
        throw AppError.badRequest('Mật khẩu mới phải có tối thiểu 8 ký tự.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'newPassword', message: 'Mật khẩu phải có ít nhất 8 ký tự.' },
        ]);
      }

      await withTransaction(async (session) => {
        const consumedToken = await authTokenService.consumeToken(
          { token, type: TOKEN_TYPES.RESET_PASSWORD },
          { session }
        );

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await userRepository.updatePassword(consumedToken.userId, passwordHash, session);

        // Revoke all existing sessions and refresh tokens
        await authSessionRepository.revokeAllUserSessions(consumedToken.userId, 'PASSWORD_CHANGED', session);
        await refreshTokenRepository.revokeAllForUser(consumedToken.userId, session);
      });

      return res.status(200).json({
        success: true,
        message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại với mật khẩu mới.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Changes password for authenticated user and revokes all active sessions
   */
  async changePassword(req, res, next) {
    try {
      const { oldPassword, newPassword } = req.body || {};

      if (!oldPassword || !newPassword) {
        throw AppError.badRequest('Mật khẩu cũ và mật khẩu mới không được để trống.', ERROR_CODES.VALIDATION_ERROR);
      }

      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        throw AppError.badRequest('Mật khẩu mới phải có tối thiểu 8 ký tự.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'newPassword', message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' },
        ]);
      }

      if (!req.user.passwordHash) {
        throw new AppError('Tài khoản chưa thiết lập mật khẩu.', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      const isOldPasswordValid = await bcrypt.compare(oldPassword, req.user.passwordHash);
      if (!isOldPasswordValid) {
        throw new AppError('Mật khẩu hiện tại không chính xác.', 400, ERROR_CODES.INVALID_CREDENTIALS);
      }

      await withTransaction(async (session) => {
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await userRepository.updatePassword(req.user._id, passwordHash, session);

        // Revoke all existing sessions and refresh tokens
        await authSessionRepository.revokeAllUserSessions(req.user._id, 'PASSWORD_CHANGED', session);
        await refreshTokenRepository.revokeAllForUser(req.user._id, session);
      });

      return res.status(200).json({
        success: true,
        message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Resends verification email for unverified customer accounts
   */
  async resendVerification(req, res, next) {
    try {
      const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
      if (!email || !email.includes('@')) {
        throw AppError.badRequest('Địa chỉ email không hợp lệ.', ERROR_CODES.VALIDATION_ERROR, [
          { field: 'email', message: 'Email phải đúng định dạng.' },
        ]);
      }

      const user = await userRepository.findByEmail(email);

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
        const consumedToken = await authTokenService.consumeToken(
          { token, type: TOKEN_TYPES.VERIFY_EMAIL },
          { session }
        );

        await userRepository.updateById(
          consumedToken.userId,
          { emailVerifiedAt: new Date() },
          session
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
