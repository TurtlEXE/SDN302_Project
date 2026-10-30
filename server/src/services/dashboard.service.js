import mongoose from 'mongoose';
import { Booking } from '../models/booking.model.js';
import { RefundCase } from '../models/refund-case.model.js';
import { PaymentTransaction } from '../models/payment-transaction.model.js';
import { User } from '../models/user.model.js';
import { Facility } from '../models/facility.model.js';
import { Court } from '../models/court.model.js';
import { EmailOutbox } from '../models/email-outbox.model.js';
import { facilityRepository } from '../repositories/facility.repository.js';
import { getCurrentDateVN, getCurrentTimeVN, isValidDateString } from '../utils/date-time.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

export class DashboardService {
  constructor(facilityRepo = facilityRepository) {
    this.facilityRepo = facilityRepo;
  }

  /**
   * Retrieves operational and revenue metrics for an owner (OWN-10, Criterion 35)
   * Strictly separates collected revenue, refunds, pending refunds, and net revenue.
   * Does NOT double-count PaymentOrder totals and child booking allocations.
   *
   * @param {Object} ownerUser - Authenticated owner
   * @param {Object} [query={}] - Query params: startDate, endDate, facilityId
   * @returns {Promise<Object>} OwnerDashboardDTO
   */
  async getOwnerDashboard(ownerUser, query = {}) {
    const { startDate, endDate, facilityId } = query;

    // Validate date format if supplied
    if (startDate && !isValidDateString(startDate)) {
      throw AppError.badRequest('Định dạng startDate không hợp lệ (YYYY-MM-DD).', ERROR_CODES.VALIDATION_ERROR);
    }
    if (endDate && !isValidDateString(endDate)) {
      throw AppError.badRequest('Định dạng endDate không hợp lệ (YYYY-MM-DD).', ERROR_CODES.VALIDATION_ERROR);
    }
    if (startDate && endDate && startDate > endDate) {
      throw AppError.badRequest('startDate không thể lớn hơn endDate.', ERROR_CODES.VALIDATION_ERROR);
    }

    // Retrieve all facilities owned by this user
    const ownerFacilities = await this.facilityRepo.findByOwnerId(ownerUser._id);
    const allFacilityIds = ownerFacilities.map((f) => f._id);

    // If specific facilityId requested, ensure ownership
    let targetFacilityIds = allFacilityIds;
    if (facilityId) {
      if (!mongoose.Types.ObjectId.isValid(facilityId)) {
        throw AppError.badRequest('ID cơ sở không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
      }
      const isOwner = allFacilityIds.some((id) => id.toString() === facilityId.toString());
      if (!isOwner) {
        throw AppError.forbidden('Bạn không có quyền truy cập cơ sở này.', ERROR_CODES.FORBIDDEN);
      }
      targetFacilityIds = [new mongoose.Types.ObjectId(facilityId)];
    }

    if (targetFacilityIds.length === 0) {
      return {
        bookingsToday: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        totalRevenueVnd: 0,
        totalRefundedVnd: 0,
        pendingRefundVnd: 0,
        netRevenueVnd: 0,
        upcomingBookings: [],
        unprocessedPastBookings: [],
      };
    }

    const todayStr = getCurrentDateVN();
    const nowTimeStr = getCurrentTimeVN();
    const rangeStart = startDate || '2000-01-01';
    const rangeEnd = endDate || '2099-12-31';

    // 1. Number of bookings today that are not cancelled or expired
    const bookingsToday = await Booking.countDocuments({
      facilityId: { $in: targetFacilityIds },
      bookingDate: todayStr,
      status: { $nin: ['CANCELLED', 'EXPIRED'] },
    });

    // 2. Completed bookings in selected date range
    const completedBookings = await Booking.countDocuments({
      facilityId: { $in: targetFacilityIds },
      status: 'COMPLETED',
      bookingDate: { $gte: rangeStart, $lte: rangeEnd },
    });

    // 3. Cancelled bookings in selected date range
    const cancelledBookings = await Booking.countDocuments({
      facilityId: { $in: targetFacilityIds },
      status: 'CANCELLED',
      bookingDate: { $gte: rangeStart, $lte: rangeEnd },
    });

    // 4. Financial Calculations:
    // Criterion 35: Revenue calculated by summing allocated Booking totalPriceVnd for PAID bookings.
    // Does NOT sum both PaymentOrder and child bookings.
    const revenueAgg = await Booking.aggregate([
      {
        $match: {
          facilityId: { $in: targetFacilityIds },
          paymentStatus: { $in: ['PAID', 'REFUND_PENDING', 'REFUNDED'] },
          bookingDate: { $gte: rangeStart, $lte: rangeEnd },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenueVnd: { $sum: '$totalPriceVnd' },
        },
      },
    ]);
    const totalRevenueVnd = revenueAgg[0]?.totalRevenueVnd || 0;

    // Refund calculations: Find all bookings in target facilities and date range
    const rangeBookingIds = await Booking.find({
      facilityId: { $in: targetFacilityIds },
      bookingDate: { $gte: rangeStart, $lte: rangeEnd },
    }).distinct('_id');

    let totalRefundedVnd = 0;
    let pendingRefundVnd = 0;

    if (rangeBookingIds.length > 0) {
      const refundAgg = await RefundCase.aggregate([
        {
          $match: {
            bookingId: { $in: rangeBookingIds },
          },
        },
        {
          $group: {
            _id: '$status',
            totalAmount: { $sum: '$refundAmountVnd' },
          },
        },
      ]);

      for (const row of refundAgg) {
        if (row._id === 'REFUNDED') {
          totalRefundedVnd = row.totalAmount;
        } else if (row._id === 'PENDING') {
          pendingRefundVnd = row.totalAmount;
        }
      }
    }

    const netRevenueVnd = Math.max(0, totalRevenueVnd - totalRefundedVnd);

    // 5. Upcoming bookings (today or future, sorted earliest first)
    const upcomingRaw = await Booking.find({
      facilityId: { $in: targetFacilityIds },
      status: 'CONFIRMED',
      $or: [
        { bookingDate: { $gt: todayStr } },
        { bookingDate: todayStr, startTime: { $gte: nowTimeStr } },
      ],
    })
      .sort({ bookingDate: 1, startTime: 1 })
      .limit(5)
      .lean();

    const upcomingBookings = upcomingRaw.map((b) => ({
      id: b._id.toString(),
      bookingCode: b.bookingCode,
      bookingDate: b.bookingDate,
      startTime: b.startTime,
      endTime: b.endTime,
      durationMinutes: b.durationMinutes,
      totalPriceVnd: b.totalPriceVnd,
      facilityName: b.snapshot?.facilityName || '',
      courtName: b.snapshot?.courtName || '',
      sportName: b.snapshot?.sportName || '',
      contactName: b.contactName || '',
    }));

    // 6. Unprocessed past bookings (past endTime still at CONFIRMED/PAID needing complete or no-show action)
    const unprocessedRaw = await Booking.find({
      facilityId: { $in: targetFacilityIds },
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      $or: [
        { bookingDate: { $lt: todayStr } },
        { bookingDate: todayStr, endTime: { $lte: nowTimeStr } },
      ],
    })
      .sort({ bookingDate: -1, endTime: -1 })
      .limit(5)
      .lean();

    const unprocessedPastBookings = unprocessedRaw.map((b) => ({
      id: b._id.toString(),
      bookingCode: b.bookingCode,
      bookingDate: b.bookingDate,
      startTime: b.startTime,
      endTime: b.endTime,
      durationMinutes: b.durationMinutes,
      totalPriceVnd: b.totalPriceVnd,
      facilityName: b.snapshot?.facilityName || '',
      courtName: b.snapshot?.courtName || '',
      sportName: b.snapshot?.sportName || '',
      contactName: b.contactName || '',
    }));

    return {
      bookingsToday,
      completedBookings,
      cancelledBookings,
      totalRevenueVnd,
      totalRefundedVnd,
      pendingRefundVnd,
      netRevenueVnd,
      upcomingBookings,
      unprocessedPastBookings,
    };
  }

  /**
   * Retrieves operational and audit overview for Administrator (ADM-06)
   *
   * @param {Object} [query={}] - Query params: startDate, endDate
   * @returns {Promise<Object>} AdminDashboardDTO
   */
  async getAdminDashboard(query = {}) {
    const { startDate, endDate } = query;

    if (startDate && !isValidDateString(startDate)) {
      throw AppError.badRequest('Định dạng startDate không hợp lệ (YYYY-MM-DD).', ERROR_CODES.VALIDATION_ERROR);
    }
    if (endDate && !isValidDateString(endDate)) {
      throw AppError.badRequest('Định dạng endDate không hợp lệ (YYYY-MM-DD).', ERROR_CODES.VALIDATION_ERROR);
    }
    if (startDate && endDate && startDate > endDate) {
      throw AppError.badRequest('startDate không thể lớn hơn endDate.', ERROR_CODES.VALIDATION_ERROR);
    }

    const todayStr = getCurrentDateVN();
    const currentMonthPrefix = todayStr.substring(0, 7); // e.g. '2026-10'
    const rangeStart = startDate || `${currentMonthPrefix}-01`;
    const rangeEnd = endDate || '2099-12-31';

    // 1. Entity totals
    const [
      totalCustomers,
      totalOwners,
      totalPublishedFacilities,
      totalActiveCourts,
      totalBookingsMonth,
    ] = await Promise.all([
      User.countDocuments({ role: 'CUSTOMER' }),
      User.countDocuments({ role: 'OWNER' }),
      Facility.countDocuments({ status: 'PUBLISHED' }),
      Court.countDocuments({ isActive: true }),
      Booking.countDocuments({ bookingDate: { $gte: rangeStart, $lte: rangeEnd } }),
    ]);

    // 2. Status distribution in date range
    const statusAgg = await Booking.aggregate([
      { $match: { bookingDate: { $gte: rangeStart, $lte: rangeEnd } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const bookingsByStatus = {
      PENDING_PAYMENT: 0,
      CONFIRMED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      EXPIRED: 0,
      NO_SHOW: 0,
    };
    for (const item of statusAgg) {
      if (item._id && bookingsByStatus[item._id] !== undefined) {
        bookingsByStatus[item._id] = item.count;
      }
    }

    // 3. Financial audit figures across the platform
    const [paymentTxnAgg, refundAgg, exceptionTxns, failedEmailsCount] = await Promise.all([
      PaymentTransaction.aggregate([
        { $match: { isAccepted: true } },
        { $group: { _id: null, totalCollected: { $sum: '$amountVnd' } } },
      ]),
      RefundCase.aggregate([
        { $group: { _id: '$status', totalAmount: { $sum: '$refundAmountVnd' } } },
      ]),
      PaymentTransaction.find({ exceptionType: { $ne: null } }).select('_id').lean(),
      EmailOutbox.countDocuments({ status: 'FAILED' }),
    ]);

    let unresolvedExceptionTransactions = 0;
    if (exceptionTxns.length > 0) {
      const exceptionIds = exceptionTxns.map((t) => t._id);
      const refundedCases = await RefundCase.find({
        paymentTransactionId: { $in: exceptionIds },
        status: 'REFUNDED',
      }).select('paymentTransactionId').lean();
      const resolvedSet = new Set(refundedCases.map((r) => r.paymentTransactionId?.toString()));
      unresolvedExceptionTransactions = exceptionTxns.filter((t) => !resolvedSet.has(t._id.toString())).length;
    }

    const totalCollectedVnd = paymentTxnAgg[0]?.totalCollected || 0;
    let totalRefundedVnd = 0;
    let totalPendingRefundVnd = 0;

    for (const item of refundAgg) {
      if (item._id === 'REFUNDED') {
        totalRefundedVnd = item.totalAmount;
      } else if (item._id === 'PENDING') {
        totalPendingRefundVnd = item.totalAmount;
      }
    }

    const netCollectedVnd = Math.max(0, totalCollectedVnd - totalRefundedVnd);

    return {
      totalCustomers,
      totalOwners,
      totalPublishedFacilities,
      totalActiveCourts,
      totalBookingsMonth,
      bookingsByStatus,
      totalCollectedVnd,
      totalRefundedVnd,
      totalPendingRefundVnd,
      netCollectedVnd,
      unresolvedExceptionTransactions,
      failedEmailsCount,
    };
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
