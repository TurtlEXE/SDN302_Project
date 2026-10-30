import { bookingRequestService } from '../services/booking/booking-request.service.js';
import { bookingLifecycleService } from '../services/booking/booking-lifecycle.service.js';

export class BookingRequestController {
  /**
   * POST /api/v1/booking-requests
   * Customer creates booking request with 10-minute hold
   */
  async createBookingRequest(req, res, next) {
    try {
      const result = await bookingRequestService.createBookingRequest(
        req.user,
        req.body,
        'CUSTOMER_ONLINE'
      );
      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/booking-requests/:id
   * Customer / Owner / Admin views booking request details and child bookings
   */
  async getBookingRequestById(req, res, next) {
    try {
      const result = await bookingRequestService.getBookingRequestById(
        req.user,
        req.params.id
      );
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/owner/bookings/on-behalf
   * Owner creates on-behalf booking request for walk-in / phone customer (OWN-08)
   */
  async createOnBehalfBooking(req, res, next) {
    try {
      const inputData = {
        ...req.body,
        contactName: req.body.customerName || req.body.contactName,
        contactPhone: req.body.customerPhone || req.body.contactPhone,
      };

      const result = await bookingRequestService.createBookingRequest(
        req.user,
        inputData,
        'OWNER_ON_BEHALF'
      );

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/booking-requests/:id/cancel
   * Customer / Owner / Admin cancels a pending booking request and releases slots (CUS-03, OWN-07)
   */
  async cancelBookingRequest(req, res, next) {
    try {
      const result = await bookingLifecycleService.cancelBookingRequest(
        req.user,
        req.params.id,
        req.body?.reason
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const bookingRequestController = new BookingRequestController();
export default bookingRequestController;
