import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { emailService } from '../../src/services/email/email.service.js';
import { EmailOutbox } from '../../src/models/email-outbox.model.js';
import { mailClient } from '../../src/integrations/mail.client.js';
import { startSendEmailsJob, stopSendEmailsJob, runSendEmailsJob } from '../../src/jobs/send-emails.job.js';

describe('Email Outbox Worker & Concurrency Lease (Integration)', () => {
  const TEST_RECIPIENT_BASE = 'worker-test';

  before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  after(async () => {
    stopSendEmailsJob();
    await disconnectDB();
  });

  beforeEach(async () => {
    stopSendEmailsJob();
    mailClient.clearSentEmails();
    mailClient.setFailureMock(null);
    await EmailOutbox.deleteMany({
      recipientEmail: { $regex: new RegExp(`^${TEST_RECIPIENT_BASE}`) },
    });
  });

  it('should process pending emails and prevent duplicate processing across concurrent workers using atomic lease locks', async () => {
    const totalMessages = 8;
    const testBatchId = Date.now();

    // Seed 8 pending messages
    for (let i = 0; i < totalMessages; i++) {
      await emailService.queueEmail({
        eventKey: `CONCURRENT_JOB:${testBatchId}:${i}`,
        eventType: 'VERIFY_EMAIL',
        recipientEmail: `${TEST_RECIPIENT_BASE}-${i}@sportbooking.local`,
        recipientName: `User ${i}`,
        subject: `Xác thực tài khoản ${i}`,
        templateName: 'VERIFY_EMAIL',
        templateData: {
          name: `User ${i}`,
          verificationUrl: `http://localhost:3000/verify-email?token=token_${i}`,
          expiresInMinutes: 15,
        },
      });
    }

    // Verify all 8 are pending
    const pendingCount = await EmailOutbox.countDocuments({
      eventKey: { $regex: new RegExp(`^CONCURRENT_JOB:${testBatchId}:`) },
      status: 'PENDING',
    });
    assert.equal(pendingCount, totalMessages);

    const scopeFilter = {
      eventKey: { $regex: new RegExp(`^CONCURRENT_JOB:${testBatchId}:`) },
    };

    // Launch two worker instances simultaneously claiming from the scoped outbox
    const worker1Promise = emailService.processPendingBatch({ filter: scopeFilter, limit: totalMessages, leaseDurationMs: 60000 });
    const worker2Promise = emailService.processPendingBatch({ filter: scopeFilter, limit: totalMessages, leaseDurationMs: 60000 });

    const [w1Result, w2Result] = await Promise.all([worker1Promise, worker2Promise]);

    const totalProcessed = w1Result.processed + w2Result.processed;
    const totalSent = w1Result.sent + w2Result.sent;

    // Both workers combined must process exactly totalMessages
    assert.equal(totalProcessed, totalMessages, 'Total processed by both workers must equal total messages');
    assert.equal(totalSent, totalMessages, 'Total sent must equal total messages');

    // Mail client must have received exactly totalMessages (no duplicate sends)
    const sentList = mailClient.getSentEmails();
    assert.equal(sentList.length, totalMessages, 'Mail client must send each email exactly once');

    // Every single database record must be in SENT status
    const dbSentCount = await EmailOutbox.countDocuments({
      eventKey: { $regex: new RegExp(`^CONCURRENT_JOB:${testBatchId}:`) },
      status: 'SENT',
    });
    assert.equal(dbSentCount, totalMessages, 'All outbox records must be marked SENT');
  });

  it('should handle SMTP failure with exponential backoff retries and mark FAILED after 3 attempts', async () => {
    const testBatchId = Date.now();
    const eventKey = `RETRY_TEST:${testBatchId}`;

    const message = await emailService.queueEmail({
      eventKey,
      eventType: 'VERIFY_EMAIL',
      recipientEmail: `${TEST_RECIPIENT_BASE}-retry@sportbooking.local`,
      recipientName: 'Retry User',
      subject: 'Retry Test Subject',
      templateName: 'VERIFY_EMAIL',
      templateData: {
        name: 'Retry User',
        verificationUrl: 'http://localhost:3000/verify',
      },
    });

    // 1. Simulate failure on Attempt 1
    mailClient.setFailureMock(new Error('Connection timeout to SMTP'));
    const doc1 = await EmailOutbox.findById(message._id);
    const result1 = await emailService.processMessage(doc1);
    assert.equal(result1.success, false);

    const docAfter1 = await EmailOutbox.findById(message._id);
    assert.equal(docAfter1.status, 'PENDING');
    assert.equal(docAfter1.retryCount, 1);
    assert.ok(docAfter1.lastError.includes('Connection timeout to SMTP'));
    assert.ok(docAfter1.nextRetryAt > new Date());

    // 2. Attempt 2 failure
    mailClient.setFailureMock(new Error('535 Authentication credentials invalid'));
    const doc2 = await EmailOutbox.findById(message._id);
    const result2 = await emailService.processMessage(doc2);
    assert.equal(result2.success, false);

    const docAfter2 = await EmailOutbox.findById(message._id);
    assert.equal(docAfter2.status, 'PENDING');
    assert.equal(docAfter2.retryCount, 2);
    assert.ok(docAfter2.lastError.includes('535 Authentication'));

    // 3. Attempt 3 failure -> Reaches MAX_EMAIL_RETRIES (3) -> Terminal FAILED
    mailClient.setFailureMock(new Error('Permanent transport rejection'));
    const doc3 = await EmailOutbox.findById(message._id);
    const result3 = await emailService.processMessage(doc3);
    assert.equal(result3.success, false);

    const docAfter3 = await EmailOutbox.findById(message._id);
    assert.equal(docAfter3.status, 'FAILED', 'Status must transition to FAILED after 3 attempts');
    assert.equal(docAfter3.retryCount, 3);
    assert.ok(docAfter3.lastError.includes('Permanent transport rejection'));
    assert.equal(docAfter3.lockedUntil, null, 'Lock must be released');
  });

  it('should successfully start and stop the recurring background email job without errors', async () => {
    // Start job with short interval
    startSendEmailsJob({ intervalMs: 200, limit: 5 });

    // Let it run for 300ms
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Stop job
    stopSendEmailsJob();

    // Calling runSendEmailsJob directly works
    const result = await runSendEmailsJob({ limit: 5 });
    assert.ok(typeof result.processed === 'number');
  });
});
