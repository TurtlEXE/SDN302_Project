import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';

describe('Health & Readiness Endpoints (Integration)', () => {
  it('GET /health should return 200 and status UP without requiring DB connection', async () => {
    const res = await request(app).get('/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'UP');
    assert.ok(res.body.timestamp);
    assert.ok(typeof res.body.uptime === 'number');
  });

  it('GET /api/v1/health should return 200 and status UP', async () => {
    const res = await request(app).get('/api/v1/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'UP');
  });

  it('GET /ready should return 503 NOT_READY when database is disconnected', async () => {
    await disconnectDB();

    const res = await request(app).get('/ready');

    assert.equal(res.status, 503);
    assert.equal(res.body.status, 'NOT_READY');
    assert.equal(res.body.database, 'disconnected');
  });

  it('GET /ready should return 200 READY when database is connected', async () => {
    try {
      // Connect to local MongoDB instance
      await connectDB(env.MONGODB_URI);

      const res = await request(app).get('/ready');

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'READY');
      assert.equal(res.body.database, 'connected');
    } finally {
      await disconnectDB();
    }
  });
});

