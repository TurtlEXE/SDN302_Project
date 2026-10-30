import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { bookingController } from '../controllers/booking.controller.js';

const router = Router();

// All customer booking routes require authentication
router.use(authenticate);

// GET /api/v1/bookings - Customer lists their own bookings
router.get('/', bookingController.listMyBookings.bind(bookingController));

// GET /api/v1/bookings/:id - Customer / Owner / Admin gets booking detail
router.get('/:id', bookingController.getBookingById.bind(bookingController));

export default router;

