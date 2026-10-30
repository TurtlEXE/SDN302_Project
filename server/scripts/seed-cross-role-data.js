import { fileURLToPath } from 'url';
import path from 'path';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';
import { User } from '../src/models/user.model.js';

/**
 * Seeds cross-role test data (1 Admin, 2 Owners, 2 Customers)
 * Used to verify access control, isolation and cross-role authorization.
 *
 * @param {string} [uri]
 * @returns {Promise<{ admin: object, owners: object[], customers: object[] }>}
 */
export async function seedCrossRoleData(uri = env.MONGODB_URI) {
  await connectDB(uri);

  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  const now = new Date();

  // 1. Admin
  let admin = await User.findOne({ email: 'admin@sportbooking.local' });
  if (!admin) {
    admin = await User.create({
      email: 'admin@sportbooking.local',
      passwordHash,
      fullName: 'Platform Admin',
      phoneNumber: '0901000001',
      role: 'ADMIN',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    logger.info(`Seeded Admin: ${admin.email}`);
  }

  // 2. Owners (at least 2)
  const owners = [];
  const ownerConfigs = [
    { email: 'owner1@sportbooking.local', fullName: 'Chủ Sân Số Một', phoneNumber: '0902000001' },
    { email: 'owner2@sportbooking.local', fullName: 'Chủ Sân Số Hai', phoneNumber: '0902000002' },
  ];

  for (const cfg of ownerConfigs) {
    let owner = await User.findOne({ email: cfg.email });
    if (!owner) {
      owner = await User.create({
        ...cfg,
        passwordHash,
        role: 'OWNER',
        isLocked: false,
        tokenVersion: 0,
        emailVerifiedAt: now,
        activatedAt: now,
      });
      logger.info(`Seeded Owner: ${owner.email}`);
    }
    owners.push(owner.toObject ? owner.toObject() : owner);
  }

  // 3. Customers (at least 2)
  const customers = [];
  const customerConfigs = [
    { email: 'customer1@sportbooking.local', fullName: 'Khách Hàng Nguyễn Văn A', phoneNumber: '0903000001' },
    { email: 'customer2@sportbooking.local', fullName: 'Khách Hàng Trần Thị B', phoneNumber: '0903000002' },
  ];

  for (const cfg of customerConfigs) {
    let customer = await User.findOne({ email: cfg.email });
    if (!customer) {
      customer = await User.create({
        ...cfg,
        passwordHash,
        role: 'CUSTOMER',
        isLocked: false,
        tokenVersion: 0,
        emailVerifiedAt: now,
      });
      logger.info(`Seeded Customer: ${customer.email}`);
    }
    customers.push(customer.toObject ? customer.toObject() : customer);
  }

  logger.info('Cross-role test dataset verified (1 Admin, 2 Owners, 2 Customers).');
  return {
    admin: admin.toObject ? admin.toObject() : admin,
    owners,
    customers,
  };
}

// Execute if run directly from CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seedCrossRoleData()
    .then((result) => {
      console.log('Seeding completed successfully:');
      console.log(`- Admin: ${result.admin.email}`);
      console.log(`- Owners (${result.owners.length}): ${result.owners.map((o) => o.email).join(', ')}`);
      console.log(`- Customers (${result.customers.length}): ${result.customers.map((c) => c.email).join(', ')}`);
      return disconnectDB().then(() => process.exit(0));
    })
    .catch(async (err) => {
      console.error('Cross-role seeding failed:', err.message);
      await disconnectDB();
      process.exit(1);
    });
}

