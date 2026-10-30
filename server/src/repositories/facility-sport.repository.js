import { FacilitySport } from '../models/facility-sport.model.js';

export class FacilitySportRepository {
  /**
   * Finds a FacilitySport document by its ID
   * @param {string} id
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findById(id, session = null) {
    return FacilitySport.findById(id).populate('sportId', 'name isActive').session(session);
  }

  /**
   * Finds a FacilitySport by facilityId and sportId
   * @param {string} facilityId
   * @param {string} sportId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByFacilityAndSport(facilityId, sportId, session = null) {
    return FacilitySport.findOne({ facilityId, sportId }).session(session);
  }

  /**
   * Lists all sports configured for a facility
   * @param {string} facilityId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByFacility(facilityId, session = null) {
    return FacilitySport.find({ facilityId })
      .populate('sportId', 'name isActive')
      .sort({ createdAt: 1 })
      .session(session);
  }

  /**
   * Creates a new FacilitySport mapping
   * @param {Object} data
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async create(data, session = null) {
    const [created] = await FacilitySport.create([data], { session });
    return created;
  }

  /**
   * Updates slotStepMinutes and increments configVersion
   * @param {string} id
   * @param {number} slotStepMinutes
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async updateStep(id, slotStepMinutes, session = null) {
    return FacilitySport.findByIdAndUpdate(
      id,
      {
        $set: { slotStepMinutes },
        $inc: { configVersion: 1 },
      },
      { new: true, session }
    ).populate('sportId', 'name isActive');
  }

  /**
   * Transforms document to FacilitySportDTO
   * @param {Object} facilitySport
   * @param {string} [sportName]
   */
  toDTO(facilitySport, sportName = null) {
    if (!facilitySport) return null;
    const sportObj = facilitySport.sportId;
    const resolvedSportName =
      sportName || (typeof sportObj === 'object' && sportObj !== null ? sportObj.name : '');

    const resolvedSportId =
      typeof sportObj === 'object' && sportObj !== null && sportObj._id
        ? sportObj._id.toString()
        : sportObj
        ? sportObj.toString()
        : '';

    return {
      id: facilitySport._id.toString(),
      facilityId: facilitySport.facilityId.toString(),
      sportId: resolvedSportId,
      sportName: resolvedSportName,
      slotStepMinutes: facilitySport.slotStepMinutes,
      configVersion: facilitySport.configVersion,
      createdAt: facilitySport.createdAt,
      updatedAt: facilitySport.updatedAt,
    };
  }
}

export const facilitySportRepository = new FacilitySportRepository();
export default facilitySportRepository;

