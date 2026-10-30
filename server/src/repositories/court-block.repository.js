import { CourtBlock } from '../models/court-block.model.js';

export class CourtBlockRepository {
  /**
   * Finds a CourtBlock by ID
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findById(id, session = null) {
    return CourtBlock.findById(id).session(session);
  }

  /**
   * Creates a single CourtBlock
   * @param {Object} blockData
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async create(blockData, session = null) {
    const [created] = await CourtBlock.create([blockData], { session });
    return created;
  }

  /**
   * Creates multiple CourtBlocks within an optional transaction session
   * @param {Array<Object>} blocksData
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async createMany(blocksData, session = null) {
    return CourtBlock.create(blocksData, { session, ordered: true });
  }

  /**
   * Finds active CourtBlocks for a specific court and booking date
   * @param {string|import('mongoose').Types.ObjectId} courtId
   * @param {string} bookingDate - 'YYYY-MM-DD'
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findActiveByCourtAndDate(courtId, bookingDate, session = null) {
    return CourtBlock.find({
      courtId,
      bookingDate,
      isActive: true,
    }).session(session);
  }

  /**
   * Updates a CourtBlock by ID
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {Object} updateData
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async updateById(id, updateData, session = null) {
    return CourtBlock.findByIdAndUpdate(id, updateData, { new: true, session });
  }

  /**
   * Finds CourtBlocks matching a query filter
   * @param {Object} filter
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async find(filter = {}, session = null) {
    return CourtBlock.find(filter).sort({ bookingDate: 1, startMinutes: 1 }).session(session);
  }
}

export const courtBlockRepository = new CourtBlockRepository();
export default courtBlockRepository;

