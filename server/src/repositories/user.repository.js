import { User } from '../models/user.model.js';

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
      emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
      activatedAt: user.activatedAt ? user.activatedAt.toISOString() : null,
      createdAt: user.createdAt ? user.createdAt.toISOString() : null,
    };
  },
};

export default userRepository;
