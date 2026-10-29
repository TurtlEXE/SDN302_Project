import { Router } from 'express';
import { adminUserController } from '../controllers/admin-user.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Provision owner account (Admin only)
router.post('/users/owners', authenticate, authorize('ADMIN'), (req, res, next) => {
  adminUserController.provisionOwner(req, res, next);
});

// Resend invitation to unactivated owner (Admin only)
router.post('/users/:id/resend-invitation', authenticate, authorize('ADMIN'), (req, res, next) => {
  adminUserController.resendOwnerInvitation(req, res, next);
});

export default router;
