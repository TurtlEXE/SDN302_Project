import { Court } from '../models/court.model.js';
import { Booking } from '../models/booking.model.js';
import { CourtBlock } from '../models/court-block.model.js';
import { getCurrentDateVN, getCurrentTimeVN } from '../utils/date-time.js';

export class CourtRepository {
  /**
   * Finds courts matching a query filter
   * @param {Object} [filter={}]
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async find(filter = {}, session = null) {
    return Court.find(filter)
      .populate('facilityId', 'name ownerId openTime closeTime status isLockedByAdmin')
      .populate('sportId', 'name isActive')
      .sort({ name: 1 })
      .session(session);
  }

  /**
   * Finds a Court document by its ID
   * @param {string} id
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findById(id, session = null) {
    return Court.findById(id)
      .populate('facilityId', 'name ownerId openTime closeTime status isLockedByAdmin')
      .populate('sportId', 'name isActive')
      .session(session);
  }

  /**
   * Finds courts belonging to a facility
   * @param {string} facilityId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByFacility(facilityId, session = null) {
    return Court.find({ facilityId })
      .populate('sportId', 'name isActive')
      .sort({ name: 1 })
      .session(session);
  }

  /**
   * Finds courts belonging to a facilitySport
   * @param {string} facilitySportId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByFacilitySport(facilitySportId, session = null) {
    return Court.find({ facilitySportId })
      .populate('sportId', 'name isActive')
      .sort({ name: 1 })
      .session(session);
  }

  /**
   * Finds active courts belonging to a facility
   * @param {string} facilityId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findActiveByFacility(facilityId, session = null) {
    return Court.find({ facilityId, isActive: true })
      .populate('sportId', 'name isActive')
      .sort({ pricePerHourVnd: 1, name: 1 })
      .session(session);
  }

  /**
   * Checks if facility has at least one court accepting bookings (isActive = true)
   * @param {string} facilityId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async hasActiveCourt(facilityId, session = null) {
    const count = await Court.countDocuments({ facilityId, isActive: true }).session(session);
    return count > 0;
  }

  /**
   * Checks if court name already exists within the facility
   * @param {string} facilityId
   * @param {string} name
   * @param {string} [excludeCourtId=null]
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async hasCourtWithName(facilityId, name, excludeCourtId = null, session = null) {
    const query = {
      facilityId,
      name: new RegExp(`^${name.trim()}$`, 'i'),
    };
    if (excludeCourtId) {
      query._id = { $ne: excludeCourtId };
    }
    const count = await Court.countDocuments(query).session(session);
    return count > 0;
  }

  /**
   * Creates a new Court
   * @param {Object} data
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async create(data, session = null) {
    const [created] = await Court.create([data], { session });
    return created;
  }

  /**
   * Updates court details. If pricePerHourVnd is changed, priceVersion increments.
   * @param {string} id
   * @param {Object} updateData
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async updateById(id, updateData, session = null) {
    const updateOps = { $set: {} };

    if (updateData.name !== undefined) updateOps.$set.name = updateData.name.trim();
    if (updateData.description !== undefined) updateOps.$set.description = updateData.description.trim();
    if (updateData.isActive !== undefined) updateOps.$set.isActive = Boolean(updateData.isActive);

    if (updateData.pricingRules !== undefined) {
      updateOps.$set.pricingRules = updateData.pricingRules;
      updateOps.$inc = { ...(updateOps.$inc || {}), priceVersion: 1 };
    }

    if (updateData.pricePerHourVnd !== undefined) {
      updateOps.$set.pricePerHourVnd = Number(updateData.pricePerHourVnd);
      updateOps.$inc = { ...(updateOps.$inc || {}), priceVersion: 1 };
    }

    return Court.findByIdAndUpdate(id, updateOps, { new: true, session })
      .populate('sportId', 'name isActive');
  }

  /**
   * Checks if there are active unexpired bookings or active blocks on any of the given courts.
   * Required for Criterion 15 (guards when updating operating hours or slot steps).
   * @param {Array<string>} courtIds
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async checkActiveSchedulesForCourts(courtIds, session = null) {
    if (!courtIds || courtIds.length === 0) {
      return { hasActiveSchedules: false, activeBookings: [], activeBlocks: [] };
    }

    const todayStr = getCurrentDateVN();
    const nowTimeStr = getCurrentTimeVN();
    const now = new Date();

    const activeBookings = await Booking.find({
      courtId: { $in: courtIds },
      $or: [
        {
          status: 'PENDING_PAYMENT',
          holdExpiresAt: { $gt: now },
        },
        {
          status: 'CONFIRMED',
          $or: [
            { bookingDate: { $gt: todayStr } },
            { bookingDate: todayStr, endTime: { $gt: nowTimeStr } },
          ],
        },
      ],
    })
      .select('bookingCode courtId bookingDate startTime endTime status holdExpiresAt')
      .session(session)
      .lean();

    const activeBlocks = await CourtBlock.find({
      courtId: { $in: courtIds },
      isActive: true,
      $or: [
        { bookingDate: { $gt: todayStr } },
        { bookingDate: todayStr, endTime: { $gt: nowTimeStr } },
      ],
    })
      .select('courtId bookingDate startTime endTime reason')
      .session(session)
      .lean();

    const hasActiveSchedules = activeBookings.length > 0 || activeBlocks.length > 0;

    return {
      hasActiveSchedules,
      activeBookings,
      activeBlocks,
    };
  }

  /**
   * Acquires a write lock on Court document to coordinate with facility/sport configuration updates (Issue 2).
   * Prevents write skew between booking creation / court blocks and operating hours / slot step changes.
   *
   * @param {string|import('mongoose').Types.ObjectId} courtId
   * @param {import('mongoose').ClientSession} session - Active transaction session (required)
   * @returns {Promise<import('../models/court.model.js').Court>}
   */
  async touchCoordination(courtId, session) {
    if (!session) {
      throw new Error('touchCoordination requires an active MongoDB ClientSession.');
    }
    return Court.findOneAndUpdate(
      { _id: courtId },
      { $inc: { bookingCoordinationVersion: 1 } },
      { session, new: true }
    );
  }

  /**
   * Acquires write locks on multiple Court documents to coordinate configuration updates (Issue 2).
   *
   * @param {Array<string|import('mongoose').Types.ObjectId>} courtIds
   * @param {import('mongoose').ClientSession} session - Active transaction session (required)
   */
  async touchCoordinationForCourts(courtIds, session) {
    if (!session) {
      throw new Error('touchCoordinationForCourts requires an active MongoDB ClientSession.');
    }
    if (!courtIds || courtIds.length === 0) return;
    return Court.updateMany(
      { _id: { $in: courtIds } },
      { $inc: { bookingCoordinationVersion: 1 } },
      { session }
    );
  }

  /**
   * Transforms document to CourtDTO
   * @param {Object} court
   * @param {string} [sportName]
   */
  toDTO(court, sportName = null) {
    if (!court) return null;
    const sportObj = court.sportId;
    const resolvedSportName =
      sportName || (typeof sportObj === 'object' && sportObj !== null ? sportObj.name : '');

    const resolvedSportId =
      typeof sportObj === 'object' && sportObj !== null && sportObj._id
        ? sportObj._id.toString()
        : sportObj
        ? sportObj.toString()
        : '';

    const resolvedFacilityId =
      typeof court.facilityId === 'object' && court.facilityId !== null && court.facilityId._id
        ? court.facilityId._id.toString()
        : court.facilityId
        ? court.facilityId.toString()
        : '';

    return {
      id: court._id.toString(),
      facilityId: resolvedFacilityId,
      facilitySportId: court.facilitySportId.toString(),
      sportId: resolvedSportId,
      sportName: resolvedSportName,
      name: court.name,
      description: court.description || '',
      pricePerHourVnd: court.pricePerHourVnd,
      priceVersion: court.priceVersion,
      pricingRules: court.pricingRules || [],
      isActive: court.isActive,
      createdAt: court.createdAt,
      updatedAt: court.updatedAt,
    };
  }
}

export const courtRepository = new CourtRepository();
export default courtRepository;

