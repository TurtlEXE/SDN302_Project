import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { DashboardService } from '../../src/services/dashboard.service.js';

test('Dashboard Service Unit Tests (P13)', async (t) => {
  await t.test('Owner Dashboard: rejects invalid date formats', async () => {
    const service = new DashboardService();
    const fakeOwner = { _id: new mongoose.Types.ObjectId(), role: 'OWNER' };

    await assert.rejects(
      async () => service.getOwnerDashboard(fakeOwner, { startDate: 'invalid-date' }),
      /Định dạng startDate không hợp lệ/
    );

    await assert.rejects(
      async () => service.getOwnerDashboard(fakeOwner, { endDate: '2026/10/30' }),
      /Định dạng endDate không hợp lệ/
    );

    await assert.rejects(
      async () => service.getOwnerDashboard(fakeOwner, { startDate: '2026-11-01', endDate: '2026-10-01' }),
      /startDate không thể lớn hơn endDate/
    );
  });

  await t.test('Admin Dashboard: rejects invalid date formats', async () => {
    const service = new DashboardService();

    await assert.rejects(
      async () => service.getAdminDashboard({ startDate: '30-10-2026' }),
      /Định dạng startDate không hợp lệ/
    );

    await assert.rejects(
      async () => service.getAdminDashboard({ endDate: 'abc' }),
      /Định dạng endDate không hợp lệ/
    );

    await assert.rejects(
      async () => service.getAdminDashboard({ startDate: '2026-12-01', endDate: '2026-11-01' }),
      /startDate không thể lớn hơn endDate/
    );
  });

  await t.test('Owner Dashboard: returns zeroed metrics when owner has no facilities', async () => {
    const mockFacilityRepo = {
      findByOwnerId: async () => [],
    };
    const service = new DashboardService(mockFacilityRepo);
    const fakeOwner = { _id: new mongoose.Types.ObjectId(), role: 'OWNER' };

    const result = await service.getOwnerDashboard(fakeOwner);
    assert.deepEqual(result, {
      bookingsToday: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalRevenueVnd: 0,
      totalRefundedVnd: 0,
      pendingRefundVnd: 0,
      netRevenueVnd: 0,
      upcomingBookings: [],
      unprocessedPastBookings: [],
    });
  });

  await t.test('Owner Dashboard: rejects access to facility not owned by this owner', async () => {
    const ownedFacilityId = new mongoose.Types.ObjectId();
    const otherFacilityId = new mongoose.Types.ObjectId();
    const mockFacilityRepo = {
      findByOwnerId: async () => [{ _id: ownedFacilityId }],
    };
    const service = new DashboardService(mockFacilityRepo);
    const fakeOwner = { _id: new mongoose.Types.ObjectId(), role: 'OWNER' };

    await assert.rejects(
      async () => service.getOwnerDashboard(fakeOwner, { facilityId: otherFacilityId.toString() }),
      /Bạn không có quyền truy cập cơ sở này/
    );
  });
});

