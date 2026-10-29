import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import * as models from '../../src/models/index.js';

describe('Mongoose Models & Schema Definitions (Unit)', () => {
  it('should export all 17 required models', () => {
    const requiredModels = [
      'User',
      'AuthToken',
      'AuthSession',
      'RefreshToken',
      'Sport',
      'Facility',
      'FacilitySport',
      'Court',
      'CourtDaySchedule',
      'CourtBlock',
      'BookingRequest',
      'Booking',
      'PaymentOrder',
      'PaymentTransaction',
      'RefundCase',
      'EmailOutbox',
      'ActionLog',
    ];

    for (const name of requiredModels) {
      assert.ok(models[name], `Model [${name}] should be exported`);
      assert.ok(models[name].prototype instanceof mongoose.Model, `Model [${name}] must be a Mongoose Model`);
    }
  });

  it('should validate User schema requirements and enums', () => {
    const { User } = models;
    const user = new User({
      email: 'Test@example.com',
      fullName: ' Nguyễn Văn A ',
      phoneNumber: '0901234567',
      role: 'INVALID_ROLE',
    });

    const validationError = user.validateSync();
    assert.ok(validationError, 'Validation should fail for invalid role');
    assert.ok(validationError.errors.role, 'Role error should exist');

    user.role = 'CUSTOMER';
    assert.equal(user.validateSync(), undefined, 'Validation should pass with valid role');
    assert.equal(user.email, 'test@example.com', 'Email must be lowercased');
    assert.equal(user.fullName, 'Nguyễn Văn A', 'Full name must be trimmed');
    assert.equal(user.isLocked, false, 'Default isLocked must be false');
    assert.equal(user.tokenVersion, 0, 'Default tokenVersion must be 0');
  });

  it('should validate FacilitySport slotStepMinutes enum [30, 60, 90]', () => {
    const { FacilitySport } = models;
    const fsInvalid = new FacilitySport({
      facilityId: new mongoose.Types.ObjectId(),
      sportId: new mongoose.Types.ObjectId(),
      slotStepMinutes: 45, // Invalid step
    });

    const err = fsInvalid.validateSync();
    assert.ok(err, 'Validation should fail for step 45');
    assert.ok(err.errors.slotStepMinutes);

    for (const step of [30, 60, 90]) {
      const fsValid = new FacilitySport({
        facilityId: new mongoose.Types.ObjectId(),
        sportId: new mongoose.Types.ObjectId(),
        slotStepMinutes: step,
      });
      assert.equal(fsValid.validateSync(), undefined, `Step ${step} should be valid`);
    }
  });

  it('should validate Court pricePerHourVnd minimum constraint (> 0)', () => {
    const { Court } = models;
    const court = new Court({
      facilitySportId: new mongoose.Types.ObjectId(),
      facilityId: new mongoose.Types.ObjectId(),
      sportId: new mongoose.Types.ObjectId(),
      name: 'Court 1',
      pricePerHourVnd: 0, // Invalid min
    });

    const err = court.validateSync();
    assert.ok(err, 'Validation should fail for price 0');
    assert.ok(err.errors.pricePerHourVnd);
  });

  it('should validate Facility images limit (maximum 10 images)', () => {
    const { Facility } = models;
    const images11 = Array.from({ length: 11 }, (_, i) => ({
      id: `img-${i}`,
      url: `https://example.com/img-${i}.jpg`,
      isCover: i === 0,
      order: i,
    }));

    const facility = new Facility({
      ownerId: new mongoose.Types.ObjectId(),
      name: 'Facility A',
      address: '123 St',
      province: 'Hà Nội',
      phoneNumber: '0901234567',
      images: images11,
    });

    const err = facility.validateSync();
    assert.ok(err, 'Validation should fail for 11 images');
    assert.ok(err.errors.images);
  });

  it('should strictly verify TTL indexes: allowed ONLY on auth_tokens, auth_sessions, refresh_tokens', () => {
    const ttlModels = ['AuthToken', 'AuthSession', 'RefreshToken'];
    const noTtlModels = [
      'Booking',
      'BookingRequest',
      'PaymentOrder',
      'PaymentTransaction',
      'RefundCase',
      'ActionLog',
      'CourtDaySchedule',
      'CourtBlock',
      'Court',
      'Facility',
      'FacilitySport',
      'Sport',
      'User',
      'EmailOutbox',
    ];

    // Helper to inspect schema indexes for TTL (expireAfterSeconds)
    const getTtlIndexes = (model) => {
      const schemaIndexes = model.schema.indexes();
      return schemaIndexes.filter(([fields, options]) => options && typeof options.expireAfterSeconds === 'number');
    };

    // 1. Verify models that MUST have TTL
    for (const name of ttlModels) {
      const model = models[name];
      const ttlIdxs = getTtlIndexes(model);
      assert.ok(
        ttlIdxs.length > 0,
        `Model [${name}] MUST have a TTL index for automatic token/session expiry cleanup`
      );
    }

    // 2. Verify models that MUST NEVER have TTL
    for (const name of noTtlModels) {
      const model = models[name];
      const ttlIdxs = getTtlIndexes(model);
      assert.equal(
        ttlIdxs.length,
        0,
        `Model [${name}] MUST NEVER have a TTL index (audit/financial/booking records must be preserved)`
      );
    }
  });
});
