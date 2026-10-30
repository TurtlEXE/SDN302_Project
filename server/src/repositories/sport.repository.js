import { Sport } from '../models/sport.model.js';
import { FacilitySport } from '../models/facility-sport.model.js';
import { Court } from '../models/court.model.js';
import { parsePagination, formatPaginatedResponse, escapeRegex } from '../utils/pagination.js';

export const sportRepository = {
  /**
   * Find sport by ID
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/sport.model.js').Sport|null>}
   */
  async findById(id, session = null) {
    const query = Sport.findById(id);
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Find sport by normalized name
   * @param {string} normalizedName
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/sport.model.js').Sport|null>}
   */
  async findByNormalizedName(normalizedName, session = null) {
    const query = Sport.findOne({ normalizedName });
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Find all active sports for public listing
   * @returns {Promise<Array<object>>}
   */
  async findActiveSports() {
    const sports = await Sport.find({ isActive: true })
      .sort({ name: 1 })
      .lean()
      .exec();
    return sports.map((s) => this.toDTO(s));
  },

  /**
   * Find sports with pagination and optional search/status filters for admin
   * @param {object} params
   * @param {string} [params.search]
   * @param {boolean} [params.isActive]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async findSports(params = {}) {
    const { page, limit, skip } = parsePagination(params);
    const query = {};

    if (params.isActive !== undefined && params.isActive !== null && params.isActive !== '') {
      query.isActive = String(params.isActive) === 'true';
    }

    if (params.search && typeof params.search === 'string' && params.search.trim()) {
      const escaped = escapeRegex(params.search.trim());
      const regex = new RegExp(escaped, 'i');
      query.$or = [{ name: regex }, { description: regex }];
    }

    const [items, total] = await Promise.all([
      Sport.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Sport.countDocuments(query).exec(),
    ]);

    const formattedItems = items.map((item) => this.toDTO(item));
    return formatPaginatedResponse(formattedItems, total, page, limit);
  },

  /**
   * Create a new sport
   * @param {object} sportData
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/sport.model.js').Sport>}
   */
  async create(sportData, session = null) {
    const docs = await Sport.create([sportData], session ? { session } : {});
    return docs[0];
  },

  /**
   * Update sport by ID
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {object} updateData
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/sport.model.js').Sport|null>}
   */
  async updateById(id, updateData, session = null) {
    const query = Sport.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Check if any court or facility sport is using this sport
   * @param {string|import('mongoose').Types.ObjectId} sportId
   * @returns {Promise<boolean>}
   */
  async isSportInUse(sportId) {
    const [facilitySportExists, courtExists] = await Promise.all([
      FacilitySport.exists({ sportId }),
      Court.exists({ sportId }),
    ]);
    return Boolean(facilitySportExists || courtExists);
  },

  /**
   * Check if any active court is currently accepting bookings for this sport
   * @param {string|import('mongoose').Types.ObjectId} sportId
   * @returns {Promise<boolean>}
   */
  async hasActiveCourts(sportId) {
    const courtExists = await Court.exists({ sportId, isActive: true });
    return Boolean(courtExists);
  },

  /**
   * Delete sport document (only allowed if not in use)
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<boolean>}
   */
  async deleteById(id, session = null) {
    const query = Sport.findByIdAndDelete(id);
    if (session) query.session(session);
    const result = await query.exec();
    return Boolean(result);
  },

  /**
   * Formats sport document to clean DTO
   * @param {object} sport
   * @returns {object}
   */
  toDTO(sport) {
    if (!sport) return null;
    return {
      id: sport._id.toString(),
      name: sport.name,
      normalizedName: sport.normalizedName,
      description: sport.description || '',
      isActive: Boolean(sport.isActive),
      createdAt: sport.createdAt ? sport.createdAt.toISOString() : null,
      updatedAt: sport.updatedAt ? sport.updatedAt.toISOString() : null,
    };
  },
};

export default sportRepository;

