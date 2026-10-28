import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import app from '../../src/app.js';
import { errorHandler } from '../../src/middlewares/error-handler.js';
import { AppError } from '../../src/errors/app-error.js';
import { ERROR_CODES } from '../../src/errors/error-codes.js';

describe('App Import & Middlewares (Unit)', () => {
  it('should export app as a function without opening a port', () => {
    assert.equal(typeof app, 'function');
    // Express apps that are listening have a server property or listening state
    // An un-listened app function does not have a server listening
    assert.equal(app.listening, undefined);
  });

  it('should return 404 with standardized ErrorResponse for non-existent routes', async () => {
    const res = await request(app).get('/api/v1/non-existent-route-xyz');

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, ERROR_CODES.NOT_FOUND);
    assert.match(res.body.error.message, /không tồn tại/);
  });

  it('should correctly format AppError via centralized error handler', async () => {
    const testApp = express();
    testApp.get('/test-error-endpoint', (req, res, next) => {
      next(AppError.validationError('Dữ liệu không hợp lệ', [{ field: 'email', message: 'Email sai' }]));
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/test-error-endpoint');

    assert.equal(res.status, 422);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, ERROR_CODES.VALIDATION_ERROR);
    assert.equal(res.body.error.details.length, 1);
    assert.equal(res.body.error.details[0].field, 'email');
  });

  it('should catch malformed JSON syntax error in body parsing', async () => {
    const res = await request(app)
      .post('/api/v1')
      .set('Content-Type', 'application/json')
      .send('{"bad_json: missing_brace');

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, ERROR_CODES.VALIDATION_ERROR);
  });
});
