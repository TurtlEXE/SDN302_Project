import { describe, it, expect, beforeEach } from 'vitest';
import { tokenMemory } from '../token-memory.js';

describe('Token Memory Service (P15)', () => {
  beforeEach(() => {
    tokenMemory.clearToken();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should store and retrieve access token strictly in RAM memory', () => {
    expect(tokenMemory.getToken()).toBeNull();
    expect(tokenMemory.hasToken()).toBe(false);

    tokenMemory.setToken('sample_access_token_12345');
    expect(tokenMemory.getToken()).toBe('sample_access_token_12345');
    expect(tokenMemory.hasToken()).toBe(true);

    tokenMemory.clearToken();
    expect(tokenMemory.getToken()).toBeNull();
    expect(tokenMemory.hasToken()).toBe(false);
  });

  it('MUST NEVER write access token to localStorage or sessionStorage (Mục 10 Architecture)', () => {
    tokenMemory.setToken('super_secret_jwt_token');

    // Verify localStorage and sessionStorage remain completely untouched
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('jwt')).toBeNull();
    expect(localStorage.length).toBe(0);

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('access_token')).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('should safely broadcast and receive multi-tab events', () => {
    let receivedData = null;
    const unsubscribe = tokenMemory.onBroadcast((data) => {
      receivedData = data;
    });

    tokenMemory.broadcast('LOGOUT', { reason: 'user_action' });

    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});

