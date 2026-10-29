import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { authTokenService, TOKEN_TYPES } from '../../src/services/auth-token.service.js';
import { authTokenRepository } from '../../src/repositories/auth-token.repository.js';
import { AuthToken } from '../../src/models/auth-token.model.js';
import { ERROR_CODES } from '../../src/errors/error-codes.js';

describe('AuthToken Service & Single-Use Tokens (Unit/Integration)', () => {
  const TEST_USER_ID_1 = new mongoose.Types.ObjectId('650000000000000000000001');
  const TEST_USER_ID_2 = new mongoose.Types.ObjectId('650000000000000000000002');

  before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  after(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await AuthToken.deleteMany({
      userId: { $in: [TEST_USER_ID_1, TEST_USER_ID_2] },
    });
  });

  it('should generate a 64-hex cryptographically secure token and store only SHA-256 hash', async () => {
    const { token, tokenHash, expiresAt, doc } = await authTokenService.generateToken({
      userId: TEST_USER_ID_1,
      type: TOKEN_TYPES.VERIFY_EMAIL,
    });

    assert.ok(token, 'Raw token must be generated');
    assert.equal(typeof token, 'string');
    assert.equal(token.length, 64, 'Raw token should be 32 bytes = 64 hex characters');

    assert.ok(tokenHash, 'Token hash must be computed');
    assert.equal(tokenHash.length, 64, 'SHA-256 hex hash length is 64');
    assert.equal(tokenHash, authTokenService.hashToken(token));

    // Verify database record
    const saved = await AuthToken.findById(doc._id);
    assert.ok(saved, 'AuthToken must exist in database');
    assert.equal(saved.tokenHash, tokenHash);
    assert.equal(saved.type, TOKEN_TYPES.VERIFY_EMAIL);
    assert.equal(saved.usedAt, null, 'usedAt must initially be null');
    assert.ok(saved.expiresAt > new Date(), 'expiresAt must be in the future');
  });

  it('should invalidate existing unused tokens of the same type when a new token is re-issued', async () => {
    // Generate first token
    const first = await authTokenService.generateToken({
      userId: TEST_USER_ID_1,
      type: TOKEN_TYPES.VERIFY_EMAIL,
    });

    // Generate second token for the same user and type
    const second = await authTokenService.generateToken({
      userId: TEST_USER_ID_1,
      type: TOKEN_TYPES.VERIFY_EMAIL,
    });

    assert.notEqual(first.token, second.token, 'Tokens must be distinct');

    // First token must be invalidated (usedAt populated)
    const firstDoc = await AuthToken.findById(first.doc._id);
    assert.ok(firstDoc.usedAt !== null, 'First token must be invalidated');

    // Second token must be active
    const secondDoc = await AuthToken.findById(second.doc._id);
    assert.equal(secondDoc.usedAt, null, 'Second token must remain active');

    // Attempting to inspect or consume the first token must fail with TOKEN_ALREADY_USED
    await assert.rejects(
      authTokenService.inspectToken({
        token: first.token,
        type: TOKEN_TYPES.VERIFY_EMAIL,
      }),
      (err) => {
        assert.equal(err.errorCode, ERROR_CODES.TOKEN_ALREADY_USED);
        return true;
      }
    );

    // Second token must be valid
    const inspected = await authTokenService.inspectToken({
      token: second.token,
      type: TOKEN_TYPES.VERIFY_EMAIL,
    });
    assert.equal(inspected.valid, true);
  });

  it('should reject token inspection or consumption when purpose does not match', async () => {
    const { token } = await authTokenService.generateToken({
      userId: TEST_USER_ID_1,
      type: TOKEN_TYPES.RESET_PASSWORD,
    });

    // Try inspecting as VERIFY_EMAIL
    await assert.rejects(
      authTokenService.inspectToken({
        token,
        type: TOKEN_TYPES.VERIFY_EMAIL,
      }),
      (err) => {
        assert.equal(err.errorCode, ERROR_CODES.TOKEN_INVALID);
        return true;
      }
    );

    // Try consuming as VERIFY_EMAIL
    await assert.rejects(
      authTokenService.consumeToken({
        token,
        type: TOKEN_TYPES.VERIFY_EMAIL,
      }),
      (err) => {
        assert.equal(err.errorCode, ERROR_CODES.TOKEN_INVALID);
        return true;
      }
    );
  });

  it('should reject expired tokens with TOKEN_EXPIRED', async () => {
    // Generate token with negative duration so it is immediately expired
    const { token, doc } = await authTokenService.generateToken({
      userId: TEST_USER_ID_1,
      type: TOKEN_TYPES.VERIFY_EMAIL,
      customExpiresInMinutes: -5,
    });

    // Inspecting expired token
    await assert.rejects(
      authTokenService.inspectToken({
        token,
        type: TOKEN_TYPES.VERIFY_EMAIL,
      }),
      (err) => {
        assert.equal(err.errorCode, ERROR_CODES.TOKEN_EXPIRED);
        return true;
      }
    );

    // Consuming expired token
    await assert.rejects(
      authTokenService.consumeToken({
        token,
        type: TOKEN_TYPES.VERIFY_EMAIL,
      }),
      (err) => {
        assert.equal(err.errorCode, ERROR_CODES.TOKEN_EXPIRED);
        return true;
      }
    );
  });

  it('should allow consuming token exactly once, rejecting any subsequent consumption', async () => {
    const { token } = await authTokenService.generateToken({
      userId: TEST_USER_ID_1,
      type: TOKEN_TYPES.VERIFY_EMAIL,
    });

    // First consumption: Success
    const consumed = await authTokenService.consumeToken({
      token,
      type: TOKEN_TYPES.VERIFY_EMAIL,
    });
    assert.ok(consumed.usedAt !== null, 'usedAt must be recorded');

    // Second consumption: Fails with TOKEN_ALREADY_USED
    await assert.rejects(
      authTokenService.consumeToken({
        token,
        type: TOKEN_TYPES.VERIFY_EMAIL,
      }),
      (err) => {
        assert.equal(err.errorCode, ERROR_CODES.TOKEN_ALREADY_USED);
        return true;
      }
    );
  });
});
