import mongoose from 'mongoose';
import { env } from '../../src/config/env.js';
import { Facility } from '../../src/models/facility.model.js';
import { Court } from '../../src/models/court.model.js';

/**
 * Migration Script for Batch B03:
 * Migrates existing flat prices to equivalent WEEKDAY and WEEKEND pricing rules,
 * and initializes weeklySchedule for facilities.
 *
 * Safe to re-run (Idempotent), non-destructive, does not modify Booking or PaymentOrder.
 */
export async function migrateB03PricingAndWeeklySchedule({ mongoUri = env.MONGODB_URI, verbose = true } = {}) {
  let ownConnection = false;
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
    ownConnection = true;
  }

  const log = (...args) => {
    if (verbose) console.log(...args);
  };

  log('[MIGRATION B03] Starting migration: pricing rules & weekly schedule...');

  // 1. PRE-CHECK
  const totalFacilities = await Facility.countDocuments();
  const totalCourts = await Court.countDocuments();

  const facilitiesNeedingWeekly = await Facility.countDocuments({
    $or: [
      { weeklySchedule: { $exists: false } },
      { 'weeklySchedule.monday': { $exists: false } },
    ],
  });

  const courtsNeedingRules = await Court.countDocuments({
    $or: [
      { pricingRules: { $exists: false } },
      { pricingRules: { $size: 0 } },
    ],
  });

  log(`[MIGRATION B03] Pre-check: ${totalFacilities} facilities (${facilitiesNeedingWeekly} need weekly schedule), ${totalCourts} courts (${courtsNeedingRules} need pricing rules).`);

  // 2. MIGRATE FACILITIES
  const facilities = await Facility.find({
    $or: [
      { weeklySchedule: { $exists: false } },
      { 'weeklySchedule.monday': { $exists: false } },
    ],
  });

  let migratedFacilitiesCount = 0;
  for (const fac of facilities) {
    const openTime = fac.openTime || '06:00';
    const closeTime = fac.closeTime || '22:00';

    const defaultDay = { isOpen: true, openTime, closeTime };
    fac.weeklySchedule = {
      monday: defaultDay,
      tuesday: defaultDay,
      wednesday: defaultDay,
      thursday: defaultDay,
      friday: defaultDay,
      saturday: defaultDay,
      sunday: defaultDay,
    };

    await fac.save();
    migratedFacilitiesCount++;
  }
  log(`[MIGRATION B03] Migrated ${migratedFacilitiesCount} facilities to weeklySchedule.`);

  // 3. MIGRATE COURTS
  const courts = await Court.find({
    $or: [
      { pricingRules: { $exists: false } },
      { pricingRules: { $size: 0 } },
    ],
  }).populate('facilityId');

  let migratedCourtsCount = 0;
  for (const court of courts) {
    const fac = court.facilityId;
    const openTime = (fac && fac.openTime) || '06:00';
    const closeTime = (fac && fac.closeTime) || '22:00';
    const price = court.pricePerHourVnd || 100000;

    court.pricingRules = [
      {
        dayType: 'WEEKDAY',
        startTime: openTime,
        endTime: closeTime,
        pricePerHourVnd: price,
      },
      {
        dayType: 'WEEKEND',
        startTime: openTime,
        endTime: closeTime,
        pricePerHourVnd: price,
      },
    ];

    await court.save();
    migratedCourtsCount++;
  }
  log(`[MIGRATION B03] Migrated ${migratedCourtsCount} courts to pricingRules.`);

  // 4. POST-CHECK
  const postFacilitiesNeedingWeekly = await Facility.countDocuments({
    $or: [
      { weeklySchedule: { $exists: false } },
      { 'weeklySchedule.monday': { $exists: false } },
    ],
  });

  const postCourtsNeedingRules = await Court.countDocuments({
    $or: [
      { pricingRules: { $exists: false } },
      { pricingRules: { $size: 0 } },
    ],
  });

  log(`[MIGRATION B03] Post-check: remaining facilities needing weekly: ${postFacilitiesNeedingWeekly}, courts needing rules: ${postCourtsNeedingRules}.`);

  const isSuccess = postFacilitiesNeedingWeekly === 0 && postCourtsNeedingRules === 0;
  log(`[MIGRATION B03] Migration finished. Result: ${isSuccess ? 'SUCCESS' : 'FAILED'}.`);

  if (ownConnection) {
    await mongoose.disconnect();
  }

  return {
    success: isSuccess,
    migratedFacilitiesCount,
    migratedCourtsCount,
    totalFacilities,
    totalCourts,
  };
}

// Run directly from CLI if invoked as main module
if (process.argv[1] && process.argv[1].endsWith('migrate-b03-pricing-weekly.js')) {
  migrateB03PricingAndWeeklySchedule()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[MIGRATION B03] Error:', err);
      process.exit(1);
    });
}

