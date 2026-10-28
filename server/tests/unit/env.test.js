import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnv } from '../../src/config/env.js';

describe('Environment Configuration Validation (Unit)', () => {
  it('should parse valid development environment with defaults', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
      PORT: '5000',
    });

    assert.equal(config.NODE_ENV, 'development');
    assert.equal(config.PORT, 5000);
    assert.equal(config.API_PREFIX, '/api/v1');
    assert.ok(config.JWT_ACCESS_SECRET);
  });

  it('should throw an error if PORT is invalid', () => {
    assert.throws(
      () => {
        validateEnv({
          PORT: 'not_a_number',
        });
      },
      (err) => {
        assert.match(err.message, /PORT must be a valid port number/);
        return true;
      }
    );
  });

  it('should throw an error in production if JWT_ACCESS_SECRET is missing or too short', () => {
    assert.throws(
      () => {
        validateEnv({
          NODE_ENV: 'production',
          PORT: '5000',
          MONGODB_URI: 'mongodb://localhost:27017/prod',
          JWT_ACCESS_SECRET: 'short_key',
        });
      },
      (err) => {
        assert.match(err.message, /JWT_ACCESS_SECRET is required and must be at least 32 characters in production/);
        return true;
      }
    );
  });

  it('should throw an error in production if MONGODB_URI is missing', () => {
    assert.throws(
      () => {
        validateEnv({
          NODE_ENV: 'production',
          PORT: '5000',
          MONGODB_URI: '',
          JWT_ACCESS_SECRET: 'a_very_long_valid_jwt_secret_key_at_least_32_chars',
        });
      },
      (err) => {
        assert.match(err.message, /MONGODB_URI is required in production/);
        return true;
      }
    );
  });
});

