import test from 'node:test';
import assert from 'node:assert/strict';
import { csrfGuard, getAllowedOrigins } from '../../src/middlewares/csrf-guard.js';
import { env } from '../../src/config/env.js';

test('Auth Request Guard Middleware (Unit)', async (t) => {
  await t.test('getAllowedOrigins should return client origin and localhost variants in dev/test', () => {
    const origins = getAllowedOrigins();
    assert.ok(origins.includes(env.CLIENT_ORIGIN));
    assert.ok(origins.includes('http://localhost:3000'));
    assert.ok(origins.includes('http://127.0.0.1:3000'));
  });

  await t.test('should pass when X-CSRF-Guard: 1 and valid allowed Origin are provided (no body)', () => {
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

  await t.test('should pass when valid Origin, X-CSRF-Guard: 1 and application/json Content-Type are provided', () => {
    let nextCalled = false;
    let nextError = null;

    const req = {
      headers: {
        'x-csrf-guard': '1',
        origin: 'http://localhost:3000',
        'content-type': 'application/json; charset=utf-8',
      },
      body: { email: 'test@example.com' },
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

  await t.test('should reject when X-CSRF-Guard header is missing', () => {
    let nextError = null;
    const req = {
      headers: {
        origin: 'http://localhost:3000',
      },
    };
    const res = {};
    const next = (err) => {
      nextError = err;
    };

    csrfGuard(req, res, next);
    assert.ok(nextError);
    assert.strictEqual(nextError.statusCode, 403);
    assert.strictEqual(nextError.errorCode, 'CSRF_GUARD_TRIGGERED');
    assert.ok(nextError.message.includes('X-CSRF-Guard'));
  });

  await t.test('should reject when X-CSRF-Guard header has invalid value', () => {
    let nextError = null;
    const req = {
      headers: {
        'x-csrf-guard': '0',
        origin: 'http://localhost:3000',
      },
    };
    const res = {};
    const next = (err) => {
      nextError = err;
    };

    csrfGuard(req, res, next);
    assert.ok(nextError);
    assert.strictEqual(nextError.statusCode, 403);
    assert.strictEqual(nextError.errorCode, 'CSRF_GUARD_TRIGGERED');
  });

  await t.test('should reject when Origin header is missing', () => {
    let nextError = null;
    const req = {
      headers: {
        'x-csrf-guard': '1',
      },
    };
    const res = {};
    const next = (err) => {
      nextError = err;
    };

    csrfGuard(req, res, next);
    assert.ok(nextError);
    assert.strictEqual(nextError.statusCode, 403);
    assert.strictEqual(nextError.errorCode, 'CSRF_GUARD_TRIGGERED');
    assert.ok(nextError.message.includes('Origin'));
  });

  await t.test('should reject when Origin header is "null"', () => {
    let nextError = null;
    const req = {
      headers: {
        'x-csrf-guard': '1',
        origin: 'null',
      },
    };
    const res = {};
    const next = (err) => {
      nextError = err;
    };

    csrfGuard(req, res, next);
    assert.ok(nextError);
    assert.strictEqual(nextError.statusCode, 403);
    assert.strictEqual(nextError.errorCode, 'CSRF_GUARD_TRIGGERED');
  });

  await t.test('should reject when Origin header is from an untrusted origin', () => {
    let nextError = null;
    const req = {
      headers: {
        'x-csrf-guard': '1',
        origin: 'http://malicious-attacker.com',
      },
    };
    const res = {};
    const next = (err) => {
      nextError = err;
    };

    csrfGuard(req, res, next);
    assert.ok(nextError);
    assert.strictEqual(nextError.statusCode, 403);
    assert.strictEqual(nextError.errorCode, 'CSRF_GUARD_TRIGGERED');
    assert.ok(nextError.message.includes('malicious-attacker.com'));
  });

  await t.test('should reject when request has body but Content-Type is not application/json', () => {
    let nextError = null;
    const req = {
      headers: {
        'x-csrf-guard': '1',
        origin: 'http://localhost:3000',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: { email: 'attack@test.com' },
    };
    const res = {};
    const next = (err) => {
      nextError = err;
    };

    csrfGuard(req, res, next);
    assert.ok(nextError);
    assert.strictEqual(nextError.statusCode, 403);
    assert.strictEqual(nextError.errorCode, 'CSRF_GUARD_TRIGGERED');
    assert.ok(nextError.message.includes('application/json'));
  });
});
