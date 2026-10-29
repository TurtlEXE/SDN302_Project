import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { jwtService } from '../../src/services/jwt.service.js';
import { env } from '../../src/config/env.js';

test('JWT Access Token Service (Unit)', async (t) => {
  const dummyUser = {
    _id: new mongoose.Types.ObjectId(),
    role: 'CUSTOMER',
    tokenVersion: 2,
  };

  const dummySession = {
    _id: new mongoose.Types.ObjectId(),
  };

  await t.test('should sign a valid access token with standard claims and 600s expiresIn', () => {
    const { accessToken, expiresInSeconds } = jwtService.signAccessToken(dummyUser, dummySession);

    assert.ok(accessToken, 'Access token string must be generated');
    assert.strictEqual(expiresInSeconds, 600, 'Expiration must be 600 seconds (10 minutes)');

    // Decode and inspect claims
    const decoded = jwt.decode(accessToken);
    assert.strictEqual(decoded.sub, dummyUser._id.toString());
    assert.strictEqual(decoded.sid, dummySession._id.toString());
    assert.strictEqual(decoded.ver, dummyUser.tokenVersion);
    assert.strictEqual(decoded.role, 'CUSTOMER');
    assert.strictEqual(decoded.type, 'access');
    assert.strictEqual(decoded.iss, env.JWT_ISSUER);
    assert.strictEqual(decoded.aud, env.JWT_AUDIENCE);
  });

  await t.test('should successfully verify a valid access token and return claims', () => {
    const { accessToken } = jwtService.signAccessToken(dummyUser, dummySession);
    const verified = jwtService.verifyAccessToken(accessToken);

    assert.strictEqual(verified.sub, dummyUser._id.toString());
    assert.strictEqual(verified.sid, dummySession._id.toString());
    assert.strictEqual(verified.ver, dummyUser.tokenVersion);
    assert.strictEqual(verified.type, 'access');
  });

  await t.test('should reject a token signed with an invalid secret signature', () => {
    const forgedToken = jwt.sign(
      {
        sub: dummyUser._id.toString(),
        sid: dummySession._id.toString(),
        ver: dummyUser.tokenVersion,
        type: 'access',
      },
      'forged_secret_key_that_does_not_match',
      {
        algorithm: 'HS256',
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      }
    );

    assert.throws(
      () => jwtService.verifyAccessToken(forgedToken),
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.errorCode, 'TOKEN_INVALID');
        return true;
      }
    );
  });

  await t.test('should reject an expired access token with ACCESS_TOKEN_EXPIRED code', () => {
    const expiredToken = jwt.sign(
      {
        sub: dummyUser._id.toString(),
        sid: dummySession._id.toString(),
        ver: dummyUser.tokenVersion,
        type: 'access',
      },
      env.JWT_ACCESS_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '-1s',
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      }
    );

    assert.throws(
      () => jwtService.verifyAccessToken(expiredToken),
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.errorCode, 'ACCESS_TOKEN_EXPIRED');
        return true;
      }
    );
  });

  await t.test('should reject a token with wrong type claim (e.g. type="refresh")', () => {
    const nonAccessToken = jwt.sign(
      {
        sub: dummyUser._id.toString(),
        sid: dummySession._id.toString(),
        ver: dummyUser.tokenVersion,
        type: 'refresh',
      },
      env.JWT_ACCESS_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '10m',
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      }
    );

    assert.throws(
      () => jwtService.verifyAccessToken(nonAccessToken),
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.errorCode, 'TOKEN_INVALID');
        return true;
      }
    );
  });
});
