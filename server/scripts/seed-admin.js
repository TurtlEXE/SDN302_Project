import { fileURLToPath } from 'url';
import path from 'path';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';
import { User } from '../src/models/user.model.js';

/**
 * Seeds the initial ADMIN user if not already present.
 * Does NOT run automatically on server boot; only executed explicitly via CLI.
 *
 * @param {string} [uri]
 * @param {object} [adminData]
 * @returns {Promise<{ created: boolean, user: object }>}
 */
export async function seedAdmin(uri = env.MONGODB_URI, adminData = {}) {
  await connectDB(uri);

  const email = (adminData.email || process.env.ADMIN_EMAIL || 'admin@sportbooking.local').trim().toLowerCase();
  const fullName = adminData.fullName || process.env.ADMIN_NAME || 'Platform Administrator';
  const phoneNumber = adminData.phoneNumber || process.env.ADMIN_PHONE || '0901234567';
  const passwordHash = adminData.passwordHash || process.env.ADMIN_PASSWORD_HASH || '$2b$10$EpRnTzVlqHNP0.fViXWCe.uG21d5JjD9u41Y6p1iV5N.iXjZ2eSgK'; // Default mock hash

  const existingAdmin = await User.findOne({
    $or: [{ email }, { role: 'ADMIN' }],
  });

  if (existingAdmin) {
    logger.info(`Admin user already exists: ${existingAdmin.email} (ID: ${existingAdmin._id}). Skipping creation.`);
    return { created: false, user: existingAdmin.toObject() };
  }

  const admin = await User.create({
    email,
    passwordHash,
    fullName,
    phoneNumber,
    role: 'ADMIN',
    isLocked: false,
    tokenVersion: 0,
    emailVerifiedAt: new Date(),
  });

  logger.info(`Admin user created successfully: ${admin.email} (ID: ${admin._id})`);
  return { created: true, user: admin.toObject() };
}

// Execute if run directly from CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seedAdmin()
    .then(({ created, user }) => {
      console.log(created ? `Admin seeded: ${user.email}` : `Admin already exists: ${user.email}`);
      return disconnectDB().then(() => process.exit(0));
    })
    .catch(async (err) => {
      console.error('Admin seeding failed:', err.message);
      await disconnectDB();
      process.exit(1);
    });
}
