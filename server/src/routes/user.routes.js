import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

// Get current authenticated user profile
router.get('/me', authenticate, (req, res, next) => {
  userController.getProfile(req, res, next);
});

// Update profile (fullName, phoneNumber only)
router.patch('/me', authenticate, (req, res, next) => {
  userController.updateProfile(req, res, next);
});

export default router;
