import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { actionLogRepository } from '../../src/repositories/action-log.repository.js';

describe('ActionLog Repository (Unit)', () => {
  it('should transform ActionLog document to standard DTO', () => {
    const actorId = new mongoose.Types.ObjectId();
    const targetId = new mongoose.Types.ObjectId();
    const logId = new mongoose.Types.ObjectId();
    const now = new Date();

    const mockDoc = {
      _id: logId,
      actorId,
      actorRole: 'ADMIN',
      targetType: 'USER',
      targetId,
      action: 'LOCK_USER',
      reason: 'Spam activity detected',
      previousState: { isLocked: false },
      newState: { isLocked: true },
      ipAddress: '127.0.0.1',
      createdAt: now,
    };

    const dto = actionLogRepository.toDTO(mockDoc);

    assert.equal(dto.id, logId.toString());
    assert.equal(dto.actorId, actorId.toString());
    assert.equal(dto.actorRole, 'ADMIN');
    assert.equal(dto.targetType, 'USER');
    assert.equal(dto.targetId, targetId.toString());
    assert.equal(dto.action, 'LOCK_USER');
    assert.equal(dto.reason, 'Spam activity detected');
    assert.deepEqual(dto.previousState, { isLocked: false });
    assert.deepEqual(dto.newState, { isLocked: true });
    assert.equal(dto.ipAddress, '127.0.0.1');
    assert.equal(dto.createdAt, now.toISOString());
  });

  it('should return null when converting null or undefined document', () => {
    assert.equal(actionLogRepository.toDTO(null), null);
    assert.equal(actionLogRepository.toDTO(undefined), null);
  });
});

