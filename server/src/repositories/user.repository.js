import { User } from '../models/user.model.js';
import { parsePagination, formatPaginatedResponse, escapeRegex } from '../utils/pagination.js';

export const userRepository = {
  /**
   * Find user by normalized email address
   * @param {string} email
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/user.model.js').User|null>}
   */
  async findByEmail(email, session = null) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const query = User.findOne({ email: normalizedEmail });
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Find user by ID
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/user.model.js').User|null>}
   */
  async findById(id, session = null) {
    const query = User.findById(id);
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Create a new user
   * @param {object} userData
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/user.model.js').User>}
   */
  async create(userData, session = null) {
    const docs = await User.create([userData], session ? { session } : {});
    return docs[0];
  },

  /**
   * Update user by ID
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {object} updateData
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/user.model.js').User|null>}
   */
  async updateById(id, updateData, session = null) {
    const query = User.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Increment tokenVersion to invalidate existing JWTs
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/user.model.js').User|null>}
   */
  async incrementTokenVersion(id, session = null) {
    const query = User.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } }, { new: true });
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Update password and increment tokenVersion atomically
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {string} passwordHash
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/user.model.js').User|null>}
   */
  async updatePassword(id, passwordHash, session = null) {
    const query = User.findByIdAndUpdate(
      id,
      {
        $set: { passwordHash },
        $inc: { tokenVersion: 1 },
      },
      { new: true }
    );
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Activate owner account with initial password and verification timestamps
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {string} passwordHash
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/user.model.js').User|null>}
   */
  async activateOwner(id, passwordHash, session = null) {
    const now = new Date();
    const query = User.findByIdAndUpdate(
      id,
      {
        $set: {
          passwordHash,
          emailVerifiedAt: now,
          activatedAt: now,
        },
        $inc: { tokenVersion: 1 },
      },
      { new: true }
    );
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Find paginated users with optional role, isLocked and search keyword filters
   * @param {object} params
   * @param {string} [params.role]
   * @param {boolean} [params.isLocked]
   * @param {string} [params.search]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async findUsers(params = {}) {
    const { page, limit, skip } = parsePagination(params);
    const query = {};

    if (params.role) {
      query.role = params.role.toUpperCase();
    }

    if (params.isLocked !== undefined && params.isLocked !== null && params.isLocked !== '') {
      query.isLocked = String(params.isLocked) === 'true';
    }

    if (params.search && typeof params.search === 'string' && params.search.trim()) {
      const escaped = escapeRegex(params.search.trim());
      const regex = new RegExp(escaped, 'i');
      query.$or = [{ fullName: regex }, { email: regex }, { phoneNumber: regex }];
    }

    const [items, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      User.countDocuments(query).exec(),
    ]);

    const formattedItems = items.map((u) => this.toUserDTO(u));
    return formatPaginatedResponse(formattedItems, total, page, limit);
  },

  /**
   * Lock user account, set lockReason and increment tokenVersion atomically
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {string} reason
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/user.model.js').User|null>}
   */
  async lockUser(id, reason, session = null) {
    const query = User.findByIdAndUpdate(
      id,
      {
        $set: {
          isLocked: true,
          lockReason: reason,
        },
        $inc: { tokenVersion: 1 },
      },
      { new: true }
    );
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Unlock user account and clear lockReason
   * NOTE: Does NOT restore prior sessions or decrease tokenVersion (AUTH-06, rule 60)
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/user.model.js').User|null>}
   */
  async unlockUser(id, session = null) {
    const query = User.findByIdAndUpdate(
      id,
      {
        $set: {
          isLocked: false,
          lockReason: null,
        },
      },
      { new: true }
    );
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Convert user document to standard UserDTO
   * @param {object} user
   * @returns {object}
   */
  toUserDTO(user) {
    if (!user) return null;
    return {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isLocked: Boolean(user.isLocked),
      lockReason: user.lockReason || null,
      emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
      activatedAt: user.activatedAt ? user.activatedAt.toISOString() : null,
      createdAt: user.createdAt ? user.createdAt.toISOString() : null,
      updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
    };
  },
};

export default userRepository;
