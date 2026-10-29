import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { seedAdmin } from '../../scripts/seed-admin.js';
import { User } from '../../src/models/user.model.js';
import app from '../../src/app.js';

describe('Seed Admin & App Isolation (Integration)', () => {
  before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  after(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({ email: { $regex: /admin@sportbooking\.local/ } });
  });

  it('should seed admin user successfully when database is empty', async () => {
    const result = await seedAdmin(env.MONGODB_TEST_URI, {
      email: 'testadmin@sportbooking.local',
      fullName: 'Test Admin',
    });

    assert.equal(result.created, true);
    assert.equal(result.user.email, 'testadmin@sportbooking.local');
    assert.equal(result.user.role, 'ADMIN');
    assert.equal(result.user.isLocked, false);
    assert.ok(result.user.emailVerifiedAt);

    const count = await User.countDocuments({ email: 'testadmin@sportbooking.local' });
    assert.equal(count, 1);
  });

  it('should be idempotent and skip seeding if admin already exists', async () => {
    // First run creates admin
    const firstRun = await seedAdmin(env.MONGODB_TEST_URI, {
      email: 'idempotent.admin@sportbooking.local',
    });
    assert.equal(firstRun.created, true);

    // Second run should skip and return existing admin
    const secondRun = await seedAdmin(env.MONGODB_TEST_URI, {
      email: 'idempotent.admin@sportbooking.local',
    });
    assert.equal(secondRun.created, false);
    assert.equal(secondRun.user._id.toString(), firstRun.user._id.toString());

    const count = await User.countDocuments({ email: 'idempotent.admin@sportbooking.local' });
    assert.equal(count, 1, 'Only exactly 1 admin must exist in the database');
  });

  it('should verify that importing app does NOT automatically trigger seed', async () => {
    // Verify that app is an Express instance
    assert.equal(typeof app, 'function');

    // Verify no admin user was auto-created by app import
    const autoSeededAdmin = await User.findOne({ email: 'admin@sportbooking.local' });
    assert.equal(autoSeededAdmin, null, 'No users should be auto-seeded when app is imported');
  });
});
