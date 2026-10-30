import { CourtDaySchedule } from '../models/court-day-schedule.model.js';

/**
 * Repository for CourtDaySchedule
 * Acts as the atomic synchronization and coordination point for schedule writes on the same court/day.
 * Adheres strictly to Section 8.3.3 of docs/features.md.
 */
export class CourtDayScheduleRepository {
  /**
   * Atomically acquires a write coordination lock on a court and booking date within a transaction session.
   * Increments scheduleVersion and updates updatedAt.
   * Handles cases where the coordination document does not exist yet (upsert).
   *
   * @param {string|import('mongoose').Types.ObjectId} courtId
   * @param {string} bookingDate - 'YYYY-MM-DD'
   * @param {import('mongoose').ClientSession} session - Active transaction session (required)
   * @returns {Promise<import('../models/court-day-schedule.model.js').CourtDaySchedule>}
   */
  async acquireCoordinationLock(courtId, bookingDate, session) {
    if (!session) {
      throw new Error('acquireCoordinationLock requires an active MongoDB ClientSession.');
    }

    try {
      const coordDoc = await CourtDaySchedule.findOneAndUpdate(
        { courtId, bookingDate },
        {
          $inc: { scheduleVersion: 1 },
          $set: { updatedAt: new Date() },
        },
        {
          upsert: true,
          new: true,
          session,
        }
      );
      return coordDoc;
    } catch (err) {
      // In concurrent transaction upserts on replica set, handle duplicate key (code 11000)
      if (err.code === 11000) {
        return CourtDaySchedule.findOneAndUpdate(
          { courtId, bookingDate },
          {
            $inc: { scheduleVersion: 1 },
            $set: { updatedAt: new Date() },
          },
          {
            new: true,
            session,
          }
        );
      }
      throw err;
    }
  }

  /**
   * Finds the coordination document for a court and booking date
   * @param {string|import('mongoose').Types.ObjectId} courtId
   * @param {string} bookingDate - 'YYYY-MM-DD'
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByCourtAndDate(courtId, bookingDate, session = null) {
    return CourtDaySchedule.findOne({ courtId, bookingDate }).session(session);
  }
}

export const courtDayScheduleRepository = new CourtDayScheduleRepository();
export default courtDayScheduleRepository;

