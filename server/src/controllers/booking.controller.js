import { bookingLifecycleService } from '../services/booking/booking-lifecycle.service.js';

export class BookingController {
  /**
   * GET /api/v1/bookings
   * Customer lists their own bookings
   */
  async listMyBookings(req, res, next) {
    try {
      const result = await bookingLifecycleService.listCustomerBookings(req.user, req.query);
      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/bookings/:id
   * Customer / Owner / Admin gets booking detail
   */
  async getBookingById(req, res, next) {
    try {
      let result;
      if (req.user.role === 'ADMIN') {
        result = await bookingLifecycleService.getAdminBookingById(req.params.id);
      } else if (req.user.role === 'OWNER') {
        result = await bookingLifecycleService.getOwnerBookingById(req.user, req.params.id);
      } else {
        result = await bookingLifecycleService.getCustomerBookingById(req.user, req.params.id);
      }

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/owner/bookings
   * Owner lists bookings at their facilities
   */
  async listOwnerBookings(req, res, next) {
    try {
      const result = await bookingLifecycleService.listOwnerBookings(req.user, req.query);
      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/owner/bookings/:id
   * Owner gets booking detail with customer contact
   */
  async getOwnerBookingById(req, res, next) {
    try {
      const result = await bookingLifecycleService.getOwnerBookingById(req.user, req.params.id);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/owner/bookings/:id/complete
   * Owner completes booking after endTime (OWN-09, Criteria 17, 18)
   */
  async completeBooking(req, res, next) {
    try {
      const result = await bookingLifecycleService.completeBooking(
        req.user,
        req.params.id,
        req.body?.note
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/owner/bookings/:id/no-show
   * Owner marks booking no-show after endTime (OWN-09, Criteria 17, 18)
   */
  async markNoShowBooking(req, res, next) {
    try {
      const result = await bookingLifecycleService.markNoShowBooking(
        req.user,
        req.params.id,
        req.body?.note
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/bookings
   * Admin lists all bookings across the platform
   */
  async listAdminBookings(req, res, next) {
    try {
      const result = await bookingLifecycleService.listAdminBookings(req.query);
      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/bookings/:id
   * Admin gets booking detail
   */
  async getAdminBookingById(req, res, next) {
    try {
      const result = await bookingLifecycleService.getAdminBookingById(req.params.id);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const bookingController = new BookingController();
export default bookingController;

