import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitize } from '../../src/utils/logger.js';

describe('Logger Sensitive Data Masking (Unit)', () => {
  it('should mask sensitive keys in objects', () => {
    const input = {
      username: 'testuser',
      password: 'MySecretPassword123!',
      passwordHash: '$2b$10$...',
      token: 'jwt.token.here',
      refreshToken: 'random_hex_string',
      address: '123 Test St',
    };

    const sanitized = sanitize(input);

    assert.equal(sanitized.username, 'testuser');
    assert.equal(sanitized.address, '123 Test St');
    assert.equal(sanitized.password, '[REDACTED]');
    assert.equal(sanitized.passwordHash, '[REDACTED]');
    assert.equal(sanitized.token, '[REDACTED]');
    assert.equal(sanitized.refreshToken, '[REDACTED]');
  });

  it('should mask Authorization Bearer header strings', () => {
    const input = 'Request headers: Authorization: Bearer eyJhbGciOiJIUzI1NiIsIn...';
    const sanitized = sanitize(input);

    assert.equal(sanitized, 'Request headers: Authorization: Bearer [REDACTED]');
  });

  it('should recursively mask nested objects and arrays', () => {
    const input = {
      user: {
        email: 'user@example.com',
        currentPassword: 'oldSecret',
      },
      tokens: [
        { type: 'access', token: 'secret-token-1' },
        { type: 'refresh', token: 'secret-token-2' },
      ],
    };

    const sanitized = sanitize(input);

    assert.equal(sanitized.user.email, 'user@example.com');
    assert.equal(sanitized.user.currentPassword, '[REDACTED]');
    assert.equal(sanitized.tokens[0].token, '[REDACTED]');
    assert.equal(sanitized.tokens[1].token, '[REDACTED]');
  });
});

