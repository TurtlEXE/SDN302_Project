import { Router } from 'express';
import { adminUserController } from '../controllers/admin-user.controller.js';
import { sportController } from '../controllers/sport.controller.js';
import { facilityController } from '../controllers/facility.controller.js';
import { bookingController } from '../controllers/booking.controller.js';
import { adminRefundController } from '../controllers/admin-refund.controller.js';
import { adminEmailController } from '../controllers/admin-email.controller.js';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// All admin routes require valid access token and ADMIN role
router.use(authenticate, authorize('ADMIN'));

// --- Operational Dashboard (ADM-06) ---
router.get('/dashboard', (req, res, next) => {
  dashboardController.getAdminDashboard(req, res, next);
});

// --- User Management ---
router.get('/users', (req, res, next) => {
  adminUserController.listUsers(req, res, next);
});

router.post('/users/owners', (req, res, next) => {
  adminUserController.provisionOwner(req, res, next);
});

router.get('/users/:id', (req, res, next) => {
  adminUserController.getUserById(req, res, next);
});

router.patch('/users/:id', (req, res, next) => {
  adminUserController.updateUser(req, res, next);
});

router.post('/users/:id/resend-invitation', (req, res, next) => {
  adminUserController.resendOwnerInvitation(req, res, next);
});

router.patch('/users/:id/lock', (req, res, next) => {
  adminUserController.lockUser(req, res, next);
});

router.patch('/users/:id/unlock', (req, res, next) => {
  adminUserController.unlockUser(req, res, next);
});

router.post('/users/:id/reset-password', (req, res, next) => {
  adminUserController.resetPassword(req, res, next);
});

// --- Sport Catalog Management ---
router.get('/sports', (req, res, next) => {
  sportController.listAdminSports(req, res, next);
});

router.post('/sports', (req, res, next) => {
  sportController.createSport(req, res, next);
});

router.get('/sports/:id', (req, res, next) => {
  sportController.getSportById(req, res, next);
});

router.patch('/sports/:id', (req, res, next) => {
  sportController.updateSport(req, res, next);
});

router.delete('/sports/:id', (req, res, next) => {
  sportController.deleteSport(req, res, next);
});

// --- Audit Action Logs ---
router.get('/action-logs', (req, res, next) => {
  adminUserController.listActionLogs(req, res, next);
});

// --- Facility Management ---
router.get('/facilities', (req, res, next) => {
  facilityController.listAdminFacilities(req, res, next);
});

router.patch('/facilities/:id/lock', (req, res, next) => {
  facilityController.lockFacility(req, res, next);
});

router.patch('/facilities/:id/unlock', (req, res, next) => {
  facilityController.unlockFacility(req, res, next);
});

// --- Booking Management ---
router.get('/bookings', (req, res, next) => {
  bookingController.listAdminBookings(req, res, next);
});

router.get('/bookings/:id', (req, res, next) => {
  bookingController.getAdminBookingById(req, res, next);
});

router.post('/bookings/:id/cancel-and-refund', (req, res, next) => {
  adminRefundController.cancelAndRefundBooking(req, res, next);
});

// --- Refund Case Management ---
router.get('/refunds', (req, res, next) => {
  adminRefundController.listRefundCases(req, res, next);
});

router.get('/refunds/:id', (req, res, next) => {
  adminRefundController.getRefundCaseById(req, res, next);
});

router.post('/refunds/:id/record-manual-refund', (req, res, next) => {
  adminRefundController.recordManualRefund(req, res, next);
});

router.post('/refunds/exception-refund', (req, res, next) => {
  adminRefundController.createExceptionRefund(req, res, next);
});

// --- Payment Transactions & Exceptions Inspection ---
router.get('/payment-transactions', (req, res, next) => {
  adminRefundController.listPaymentTransactions(req, res, next);
});

// --- Email Outbox Monitoring & Retries (ADM-07) ---
router.get('/email-outbox', (req, res, next) => {
  adminEmailController.listEmailOutbox(req, res, next);
});

router.post('/email-outbox/:id/retry', (req, res, next) => {
  adminEmailController.retryEmail(req, res, next);
});

export default router;
