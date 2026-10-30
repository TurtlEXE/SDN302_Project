import { jwtService } from '../services/jwt.service.js';
import { authSessionRepository } from '../repositories/auth-session.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

/**
 * Authentication Middleware
 * Enforces JWT access token verification in RAM and validates active AuthSession & User state in DB.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'Chưa cung cấp token xác thực Authorization Bearer',
        401,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError(
        'Token xác thực không hợp lệ',
        401,
        ERROR_CODES.TOKEN_INVALID
      );
    }

    // 1. Verify JWT signature, algorithm, audience, issuer, type='access'
    const decoded = jwtService.verifyAccessToken(token);

    // 2. Verify AuthSession in DB
    const session = await authSessionRepository.findById(decoded.sid);
    if (!session) {
      throw new AppError(
        'Phiên đăng nhập không tồn tại hoặc đã hết hạn',
        401,
        ERROR_CODES.SESSION_REVOKED
      );
    }

    if (session.revokedAt || session.absoluteExpiresAt <= new Date()) {
      throw new AppError(
        'Phiên đăng nhập đã bị thu hồi hoặc đã hết hạn',
        401,
        ERROR_CODES.SESSION_REVOKED
      );
    }

    if (session.userId.toString() !== decoded.sub) {
      throw new AppError(
        'Phiên đăng nhập không khớp với người dùng',
        401,
        ERROR_CODES.SESSION_REVOKED
      );
    }

    // 3. Verify User state in DB
    const user = await userRepository.findById(decoded.sub);
    if (!user) {
      throw new AppError(
        'Người dùng không tồn tại trong hệ thống',
        401,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    if (user.isLocked) {
      throw new AppError(
        'Tài khoản đã bị khóa bởi quản trị viên',
        403,
        ERROR_CODES.ACCOUNT_LOCKED
      );
    }

    if (user.tokenVersion !== decoded.ver) {
      throw new AppError(
        'Phiên đăng nhập không còn hiệu lực do mật khẩu hoặc quyền đã thay đổi',
        401,
        ERROR_CODES.SESSION_REVOKED
      );
    }

    if (user.role === 'CUSTOMER' && !user.emailVerifiedAt) {
      throw new AppError(
        'Tài khoản chưa được xác thực email',
        403,
        ERROR_CODES.ACCOUNT_NOT_VERIFIED
      );
    }

    if (user.role === 'OWNER' && !user.activatedAt) {
      throw new AppError(
        'Tài khoản chủ sân chưa được kích hoạt',
        403,
        ERROR_CODES.ACCOUNT_NOT_ACTIVATED
      );
    }

    // Attach to request context
    req.user = user;
    req.authSession = session;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role-based Authorization Middleware
 * Verifies role directly from server-managed User record attached by authenticate.
 * @param  {...string} allowedRoles
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError('Chưa xác thực người dùng', 401, ERROR_CODES.UNAUTHORIZED)
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          'Bạn không có quyền thực hiện thao tác này',
          403,
          ERROR_CODES.FORBIDDEN
        )
      );
    }

    next();
  };
}

/**
 * Optional Authentication Middleware
 * If Authorization Bearer token is provided and valid, attaches req.user and req.authSession.
 * If no token or invalid token, quietly proceeds without error.
 */
export async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  return authenticate(req, res, (err) => {
    if (err) {
      req.user = null;
      req.authSession = null;
    }
    next();
  });
}

export default { authenticate, authorize, optionalAuthenticate };
