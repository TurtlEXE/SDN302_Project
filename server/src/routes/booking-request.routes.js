import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { bookingRequestController } from '../controllers/booking-request.controller.js';

const router = Router();

// All booking request routes require authentication
router.use(authenticate);

// POST /api/v1/booking-requests (Customer creates booking request)
router.post('/', bookingRequestController.createBookingRequest.bind(bookingRequestController));

// POST /api/v1/booking-requests/quote (Official price quote for slots)
router.post('/quote', bookingRequestController.getBookingQuote.bind(bookingRequestController));

// GET /api/v1/booking-requests/:id (View booking request details and child bookings)
router.get('/:id', bookingRequestController.getBookingRequestById.bind(bookingRequestController));

// POST /api/v1/booking-requests/:id/cancel (Cancel pending booking request)
router.post('/:id/cancel', bookingRequestController.cancelBookingRequest.bind(bookingRequestController));

export default router;

