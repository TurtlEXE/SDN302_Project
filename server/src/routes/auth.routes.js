import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { emailCooldownMiddleware } from '../middlewares/rate-limit.js';

const router = Router();

// Resend verification email with 60s cooldown per email
router.post('/resend-verification', emailCooldownMiddleware, (req, res, next) => {
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

// POST /verify-email atomically consumes token and activates user
router.post('/verify-email', (req, res, next) => {
  authController.verifyEmail(req, res, next);
});

export default router;
