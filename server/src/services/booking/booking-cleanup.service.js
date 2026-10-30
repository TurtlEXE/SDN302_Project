import { bookingRepository } from '../../repositories/booking.repository.js';
import { bookingRequestRepository } from '../../repositories/booking-request.repository.js';
import { paymentOrderRepository } from '../../repositories/payment-order.repository.js';
import { courtDayScheduleRepository } from '../../repositories/court-day-schedule.repository.js';
import { actionLogRepository } from '../../repositories/action-log.repository.js';
import { emailOutboxRepository } from '../../repositories/email-outbox.repository.js';
import { User } from '../../models/user.model.js';
import { withTransaction } from '../../database/transaction.js';

export class BookingCleanupService {
  /**
   * Scans and cleans up expired holds atomically (Section 8.3, Criterion 49, Criterion 51).
   * - Transitions unexpired PENDING_PAYMENT bookings to EXPIRED
   * - Closes PaymentOrder with closedReason = 'EXPIRED'
   * - Releases schedule without deleting history
   * - STRICTLY DOES NOT touch CONFIRMED or PAID bookings
   *
   * @param {Date} [now=new Date()]
   * @param {number} [limit=100]
   * @returns {Promise<{ processedRequestsCount: number, expiredBookingsCount: number }>}
   */
  async cleanupExpiredHolds(now = new Date(), limit = 100) {
    const expiredBookings = await bookingRepository.findExpiredHolds(now, limit);
    if (!expiredBookings || expiredBookings.length === 0) {
      return { processedRequestsCount: 0, expiredBookingsCount: 0 };
    }

    // Group by bookingRequestId
    const requestMap = new Map();
    for (const b of expiredBookings) {
      const reqId = b.bookingRequestId.toString();
      if (!requestMap.has(reqId)) {
        requestMap.set(reqId, []);
      }
      requestMap.get(reqId).push(b);
    }

    let processedRequestsCount = 0;
    let expiredBookingsCount = 0;

    for (const [bookingRequestId, bookings] of requestMap.entries()) {
      try {
        const sampleBooking = bookings[0];
        const { courtId, bookingDate } = sampleBooking;

        await withTransaction(async (session) => {
          // Acquire atomic coordination lock on court and date
          await courtDayScheduleRepository.acquireCoordinationLock(courtId, bookingDate, session);

          // Re-fetch bookings and payment order within session
          const currentBookings = await bookingRepository.findByRequestId(bookingRequestId, session);
          const currentPaymentOrder = await paymentOrderRepository.findByBookingRequestId(bookingRequestId, session);

          // STRICT CHECK: Do NOT touch if already CONFIRMED or PAID (Criterion 49)
          const anyPaidOrConfirmed = currentBookings.some(
            (b) => b.status === 'CONFIRMED' || b.paymentStatus === 'PAID'
          );
          if (anyPaidOrConfirmed || (currentPaymentOrder && currentPaymentOrder.status === 'PAID')) {
            return;
          }

          // Check if still PENDING_PAYMENT
          const pendingBookings = currentBookings.filter((b) => b.status === 'PENDING_PAYMENT');
          if (pendingBookings.length === 0) {
            return;
          }

          // Check expiration condition
          const isExpired = pendingBookings.some((b) => new Date(b.holdExpiresAt) <= now);
          if (!isExpired) {
            return;
          }

          // Atomically update all child bookings to EXPIRED
          await bookingRepository.updateManyByRequestId(
            bookingRequestId,
            {
              $set: {
                status: 'EXPIRED',
                updatedAt: new Date(),
              },
              $inc: { statusVersion: 1 },
            },
            session
          );

          // Close PaymentOrder
          if (currentPaymentOrder && currentPaymentOrder.status === 'PENDING') {
            await paymentOrderRepository.updateById(
              currentPaymentOrder._id,
              {
                $set: {
                  status: 'CLOSED',
                  closedReason: 'EXPIRED',
                  updatedAt: new Date(),
                },
                $inc: { processingVersion: 1 },
              },
              session
            );
          }

          // Record ActionLog audit entry
          for (const b of pendingBookings) {
            await actionLogRepository.create(
              {
                actorId: null,
                actorRole: 'SYSTEM',
                targetType: 'BOOKING',
                targetId: b._id,
                action: 'EXPIRE_BOOKING',
                reason: 'Giữ chỗ quá hạn 10 phút chưa thanh toán',
                previousState: { status: 'PENDING_PAYMENT' },
                newState: { status: 'EXPIRED' },
              },
              session
            );
          }

          // Enqueue HOLD_EXPIRED email event
          try {
            const bRequest = await bookingRequestRepository.findById(bookingRequestId, session);
            if (bRequest) {
              let recipientEmail = null;
              let recipientName = bRequest.contactName || '';

              if (bRequest.customerId) {
                const customer = await User.findById(bRequest.customerId).session(session);
                if (customer && customer.email) {
                  recipientEmail = customer.email;
                  recipientName = customer.fullName || bRequest.contactName || '';
                }
              } else if (bRequest.source === 'OWNER_ON_BEHALF' && bRequest.createdBy) {
                const owner = await User.findById(bRequest.createdBy).session(session);
                if (owner && owner.email) {
                  recipientEmail = owner.email;
                  recipientName = owner.fullName || 'Chủ sân';
                }
              }

              if (recipientEmail) {
                await emailOutboxRepository.createMessage(
                  {
                    eventKey: `HOLD_EXPIRED_${bookingRequestId}`,
                    eventType: 'HOLD_EXPIRED',
                    recipientEmail,
                    recipientName,
                    subject: `[SportBooking] Hết hạn giữ chỗ đặt sân - ${bRequest.requestNumber}`,
                    templateName: 'hold-expired',
                    templateData: {
                      name: recipientName,
                      requestNumber: bRequest.requestNumber,
                      facilityName: sampleBooking?.snapshot?.facilityName || '',
                      bookingDate: sampleBooking?.bookingDate || '',
                    },
                  },
                  { session }
                );
              }
            }
          } catch (mailErr) {
            // Mail enqueue error shouldn't abort transaction
          }

          processedRequestsCount++;
          expiredBookingsCount += pendingBookings.length;
        });
      } catch (err) {
        // Individual request error shouldn't abort the entire cleanup loop
        // Log error and continue
      }
    }

    return { processedRequestsCount, expiredBookingsCount };
  }

  /**
   * Inline cleanup for a specific court and bookingDate within an existing transaction session (Criterion 51).
   * Eagerly expires pending holds that have passed holdExpiresAt so new requests do not wait for background tasks.
   *
   * @param {string|import('mongoose').Types.ObjectId} courtId
   * @param {string} bookingDate - 'YYYY-MM-DD'
   * @param {Date} [now=new Date()]
   * @param {import('mongoose').ClientSession} session - Active session
   */
  async eagerCleanupCourtExpiredHolds(courtId, bookingDate, now = new Date(), session) {
    const activeBookings = await bookingRepository.findActiveByCourtAndDate(courtId, bookingDate, session);
    const expiredPendingBookings = activeBookings.filter(
      (b) => b.status === 'PENDING_PAYMENT' && b.holdExpiresAt && new Date(b.holdExpiresAt) <= now
    );

    if (expiredPendingBookings.length === 0) return;

    const requestIds = [...new Set(expiredPendingBookings.map((b) => b.bookingRequestId.toString()))];

    for (const reqId of requestIds) {
      await bookingRepository.updateManyByRequestId(
        reqId,
        {
          $set: { status: 'EXPIRED', updatedAt: new Date() },
          $inc: { statusVersion: 1 },
        },
        session
      );

      const pOrder = await paymentOrderRepository.findByBookingRequestId(reqId, session);
      if (pOrder && pOrder.status === 'PENDING') {
        await paymentOrderRepository.updateById(
          pOrder._id,
          {
            $set: { status: 'CLOSED', closedReason: 'EXPIRED', updatedAt: new Date() },
            $inc: { processingVersion: 1 },
          },
          session
        );
      }
    }
  }
}

export const bookingCleanupService = new BookingCleanupService();
export default bookingCleanupService;

