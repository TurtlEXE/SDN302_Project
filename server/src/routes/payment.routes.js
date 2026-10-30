import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

/**
 * Public VNPay Webhook & Callback routes (Section 10.5 exemption: NO JWT / Cookie / CSRF required)
 */
router.get('/vnpay-return', paymentController.handleVNPayReturn);
router.get('/vnpay-ipn', paymentController.handleVNPayIpn);
router.get('/guest-order/:paymentOrderId', paymentController.getGuestPaymentOrder);

/**
 * Authenticated Payment routes (Requires Bearer access token)
 */
router.post('/create-url', authenticate, paymentController.createPaymentUrl);
router.get('/order/:bookingRequestId', authenticate, paymentController.getPaymentOrderByBookingRequestId);

export default router;

