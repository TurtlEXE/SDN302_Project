import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { emailCooldownMiddleware } from '../middlewares/rate-limit.js';
import { csrfGuard } from '../middlewares/csrf-guard.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

// Customer registration (CSRF guarded)
router.post('/register', csrfGuard, (req, res, next) => {
  authController.register(req, res, next);
});

// Login (CSRF guarded)
router.post('/login', csrfGuard, (req, res, next) => {
  authController.login(req, res, next);
});

// Refresh Access Token via HttpOnly cookie (Token Rotation & Reuse Detection, CSRF guarded)
router.post('/refresh', csrfGuard, (req, res, next) => {
  authController.refresh(req, res, next);
});

// Logout current session via HttpOnly cookie (CSRF guarded)
router.post('/logout', csrfGuard, (req, res, next) => {
  authController.logout(req, res, next);
});

// Logout all active sessions (Bearer token required)
router.post('/logout-all', authenticate, (req, res, next) => {
  authController.logoutAll(req, res, next);
});

// Resend verification email with 60s cooldown per email (CSRF guarded)
router.post('/resend-verification', csrfGuard, emailCooldownMiddleware, (req, res, next) => {
  authController.resendVerification(req, res, next);
});

// Inspect token validity via GET without consuming it
router.get('/verify-token', (req, res, next) => {
  authController.inspectToken(req, res, next);
});

// GET /verify-email checks link validity without consuming token
router.get('/verify-email', (req, res, next) => {
  authController.inspectToken(req, res, next);
});

// POST /verify-email atomically consumes token and marks email verified (CSRF guarded)
router.post('/verify-email', csrfGuard, (req, res, next) => {
  authController.verifyEmail(req, res, next);
});

// Owner activates account and sets initial password (CSRF guarded)
router.post('/activate-owner', csrfGuard, (req, res, next) => {
  authController.activateOwner(req, res, next);
});

// Forgot password (CSRF guarded)
router.post('/forgot-password', csrfGuard, (req, res, next) => {
  authController.forgotPassword(req, res, next);
});

// Reset password with single-use token (CSRF guarded)
router.post('/reset-password', csrfGuard, (req, res, next) => {
  authController.resetPassword(req, res, next);
});

// Change password for authenticated user (Bearer token required)
router.post('/change-password', authenticate, (req, res, next) => {
  authController.changePassword(req, res, next);
});

export default router;
