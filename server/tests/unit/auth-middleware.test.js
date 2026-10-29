import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../../src/middlewares/auth.js';
import { csrfGuard } from '../../src/middlewares/csrf-guard.js';
import { jwtService } from '../../src/services/jwt.service.js';
import { authSessionRepository } from '../../src/repositories/auth-session.repository.js';
import { userRepository } from '../../src/repositories/user.repository.js';

test('Auth and CSRF Middlewares (Unit)', async (t) => {
  await t.test('csrfGuard should pass when X-CSRF-Guard: 1 and valid Origin are provided', () => {
    let nextCalled = false;
    let nextError = null;

    const req = {
      headers: {
        'x-csrf-guard': '1',
        origin: 'http://localhost:3000',
      },
    };
    const res = {};
    const next = (err) => {
      nextCalled = true;
      nextError = err;
    };

    csrfGuard(req, res, next);
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(nextError, undefined);
  });

  await t.test('csrfGuard should reject when X-CSRF-Guard has an invalid value', () => {
    let nextError = null;

    const req = { headers: { 'x-csrf-guard': 'invalid_value' } };
    const res = {};
    const next = (err) => {
      nextError = err;
    };

    csrfGuard(req, res, next);
    assert.ok(nextError);
    assert.strictEqual(nextError.statusCode, 403);
    assert.strictEqual(nextError.errorCode, 'CSRF_GUARD_TRIGGERED');
  });

  await t.test('authenticate should reject when Authorization header is missing', async () => {
    let nextError = null;
    const req = { headers: {} };
    const res = {};
    const next = (err) => {
      nextError = err;
    };

    await authenticate(req, res, next);
    assert.ok(nextError);
    assert.strictEqual(nextError.statusCode, 401);
    assert.strictEqual(nextError.errorCode, 'UNAUTHORIZED');
  });

  await t.test('authenticate should reject when session is revoked', async () => {
    const userId = new mongoose.Types.ObjectId();
    const sessionId = new mongoose.Types.ObjectId();

    const { accessToken } = jwtService.signAccessToken(
      { _id: userId, role: 'CUSTOMER', tokenVersion: 1 },
      { _id: sessionId }
    );

    // Mock session as revoked
    const originalFindSession = authSessionRepository.findById;
    authSessionRepository.findById = async () => ({
      _id: sessionId,
      userId,
      revokedAt: new Date(),
      absoluteExpiresAt: new Date(Date.now() + 100000),
    });

    let nextError = null;
    const req = { headers: { authorization: `Bearer ${accessToken}` } };
    const res = {};
    const next = (err) => {
      nextError = err;
    };

    try {
      await authenticate(req, res, next);
      assert.ok(nextError);
      assert.strictEqual(nextError.statusCode, 401);
      assert.strictEqual(nextError.errorCode, 'SESSION_REVOKED');
    } finally {
      authSessionRepository.findById = originalFindSession;
    }
  });

  await t.test('authenticate should reject when user is locked', async () => {
    const userId = new mongoose.Types.ObjectId();
    const sessionId = new mongoose.Types.ObjectId();

    const { accessToken } = jwtService.signAccessToken(
      { _id: userId, role: 'CUSTOMER', tokenVersion: 1 },
      { _id: sessionId }
    );

    const originalFindSession = authSessionRepository.findById;
    const originalFindUser = userRepository.findById;

    authSessionRepository.findById = async () => ({
      _id: sessionId,
      userId,
      revokedAt: null,
      absoluteExpiresAt: new Date(Date.now() + 100000),
    });

    userRepository.findById = async () => ({
      _id: userId,
      isLocked: true,
      tokenVersion: 1,
      role: 'CUSTOMER',
      emailVerifiedAt: new Date(),
    });

    let nextError = null;
    const req = { headers: { authorization: `Bearer ${accessToken}` } };
    const res = {};
    const next = (err) => {
      nextError = err;
    };

    try {
      await authenticate(req, res, next);
      assert.ok(nextError);
      assert.strictEqual(nextError.statusCode, 403);
      assert.strictEqual(nextError.errorCode, 'ACCOUNT_LOCKED');
    } finally {
      authSessionRepository.findById = originalFindSession;
      userRepository.findById = originalFindUser;
    }
  });

  await t.test('authenticate should reject when customer email is not verified', async () => {
    const userId = new mongoose.Types.ObjectId();
    const sessionId = new mongoose.Types.ObjectId();

    const { accessToken } = jwtService.signAccessToken(
      { _id: userId, role: 'CUSTOMER', tokenVersion: 1 },
      { _id: sessionId }
    );

    const originalFindSession = authSessionRepository.findById;
    const originalFindUser = userRepository.findById;

    authSessionRepository.findById = async () => ({
      _id: sessionId,
      userId,
      revokedAt: null,
      absoluteExpiresAt: new Date(Date.now() + 100000),
    });

    userRepository.findById = async () => ({
      _id: userId,
      isLocked: false,
      tokenVersion: 1,
      role: 'CUSTOMER',
      emailVerifiedAt: null,
    });

    let nextError = null;
    const req = { headers: { authorization: `Bearer ${accessToken}` } };
    const res = {};
    const next = (err) => {
      nextError = err;
    };

    try {
      await authenticate(req, res, next);
      assert.ok(nextError);
      assert.strictEqual(nextError.statusCode, 403);
      assert.strictEqual(nextError.errorCode, 'ACCOUNT_NOT_VERIFIED');
    } finally {
      authSessionRepository.findById = originalFindSession;
      userRepository.findById = originalFindUser;
    }
  });

  await t.test('authenticate should reject when token version does not match user tokenVersion', async () => {
    const userId = new mongoose.Types.ObjectId();
    const sessionId = new mongoose.Types.ObjectId();

    // Token has ver = 1
    const { accessToken } = jwtService.signAccessToken(
      { _id: userId, role: 'CUSTOMER', tokenVersion: 1 },
      { _id: sessionId }
    );

    const originalFindSession = authSessionRepository.findById;
    const originalFindUser = userRepository.findById;

    authSessionRepository.findById = async () => ({
      _id: sessionId,
      userId,
      revokedAt: null,
      absoluteExpiresAt: new Date(Date.now() + 100000),
    });

    // User in DB has tokenVersion = 2 (e.g. password changed)
    userRepository.findById = async () => ({
      _id: userId,
      isLocked: false,
      tokenVersion: 2,
      role: 'CUSTOMER',
      emailVerifiedAt: new Date(),
    });

    let nextError = null;
    const req = { headers: { authorization: `Bearer ${accessToken}` } };
    const res = {};
    const next = (err) => {
      nextError = err;
    };

    try {
      await authenticate(req, res, next);
      assert.ok(nextError);
      assert.strictEqual(nextError.statusCode, 401);
      assert.strictEqual(nextError.errorCode, 'SESSION_REVOKED');
    } finally {
      authSessionRepository.findById = originalFindSession;
      userRepository.findById = originalFindUser;
    }
  });

  await t.test('authorize should allow allowed roles and block forbidden roles', () => {
    const adminUser = { role: 'ADMIN' };
    const customerUser = { role: 'CUSTOMER' };

    const adminOnlyMiddleware = authorize('ADMIN');

    let errorForCustomer = null;
    adminOnlyMiddleware({ user: customerUser }, {}, (err) => {
      errorForCustomer = err;
    });
    assert.ok(errorForCustomer);
    assert.strictEqual(errorForCustomer.statusCode, 403);
    assert.strictEqual(errorForCustomer.errorCode, 'FORBIDDEN');

    let passedForAdmin = false;
    adminOnlyMiddleware({ user: adminUser }, {}, (err) => {
      if (!err) passedForAdmin = true;
    });
    assert.strictEqual(passedForAdmin, true);
  });
});
