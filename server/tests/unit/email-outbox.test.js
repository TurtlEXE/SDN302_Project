import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { renderEmail } from '../../src/templates/emails/index.js';
import { emailService, MAX_EMAIL_RETRIES, RETRY_BACKOFF_MS } from '../../src/services/email/email.service.js';
import { emailOutboxRepository } from '../../src/repositories/email-outbox.repository.js';
import { EmailOutbox } from '../../src/models/email-outbox.model.js';
import { mailClient } from '../../src/integrations/mail.client.js';

describe('Email Outbox & Templates (Unit)', () => {
  const TEST_RECIPIENT = 'test-outbox@sportbooking.local';

  before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  after(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    mailClient.clearSentEmails();
    mailClient.setFailureMock(null);
    await EmailOutbox.deleteMany({ recipientEmail: TEST_RECIPIENT });
  });

  it('should render VERIFY_EMAIL template with proper subject, link and expiration', () => {
    const rendered = renderEmail('VERIFY_EMAIL', {
      name: 'Nguyễn Văn A',
      verificationUrl: 'http://localhost:3000/verify-email?token=abcdef123456',
      expiresInMinutes: 15,
    });

    assert.ok(rendered.subject.includes('Xác thực địa chỉ email'));
    assert.ok(rendered.html.includes('Nguyễn Văn A'));
    assert.ok(rendered.html.includes('http://localhost:3000/verify-email?token=abcdef123456'));
    assert.ok(rendered.html.includes('15 phút'));
    assert.ok(rendered.text.includes('15 phút'));
  });

  it('should render ACTIVATE_OWNER template with 24 hours validity', () => {
    const rendered = renderEmail('ACTIVATE_OWNER', {
      name: 'Trần Chủ Sân',
      activationUrl: 'http://localhost:3000/activate-owner?token=owner123456',
      expiresInHours: 24,
    });

    assert.ok(rendered.subject.includes('Kích hoạt tài khoản Chủ sân'));
    assert.ok(rendered.html.includes('Trần Chủ Sân'));
    assert.ok(rendered.html.includes('24 giờ'));
    assert.ok(rendered.text.includes('24 giờ'));
  });

  it('should render RESET_PASSWORD template with security warning', () => {
    const rendered = renderEmail('RESET_PASSWORD', {
      name: 'Lê Khách',
      resetUrl: 'http://localhost:3000/reset-password?token=reset123456',
      expiresInMinutes: 15,
    });

    assert.ok(rendered.subject.toLowerCase().includes('đặt lại mật khẩu'));
    assert.ok(rendered.html.includes('Lê Khách'));
    assert.ok(rendered.html.includes('15 phút'));
    assert.ok(rendered.html.includes('bỏ qua email'));
  });

  it('should throw error when rendering an unknown template name', () => {
    assert.throws(() => {
      renderEmail('NON_EXISTENT_TEMPLATE', {});
    }, /Email template \[NON_EXISTENT_TEMPLATE\] does not exist/);
  });

  it('should enqueue email to outbox and handle duplicate eventKey idempotently', async () => {
    const eventKey = `TEST_EVENT:${Date.now()}`;

    const first = await emailService.queueEmail({
      eventKey,
      eventType: 'VERIFY_EMAIL',
      recipientEmail: TEST_RECIPIENT,
      recipientName: 'Test Recipient',
      subject: 'Xác thực tài khoản',
      templateName: 'VERIFY_EMAIL',
      templateData: {
        name: 'Test Recipient',
        verificationUrl: 'http://localhost:3000/verify',
      },
    });

    assert.ok(first._id);
    assert.equal(first.status, 'PENDING');
    assert.equal(first.retryCount, 0);

    // Queueing with same eventKey should return the existing doc without throwing
    const duplicate = await emailService.queueEmail({
      eventKey,
      eventType: 'VERIFY_EMAIL',
      recipientEmail: TEST_RECIPIENT,
      recipientName: 'Test Recipient',
      subject: 'Xác thực tài khoản',
      templateName: 'VERIFY_EMAIL',
      templateData: {
        name: 'Test Recipient',
        verificationUrl: 'http://localhost:3000/verify',
      },
    });

    assert.equal(String(duplicate._id), String(first._id), 'Duplicate eventKey should return existing record');
  });

  it('should calculate exponential backoff retry timestamps correctly', () => {
    const now = Date.now();
    const retry0 = emailService.calculateNextRetryAt(0);
    const retry1 = emailService.calculateNextRetryAt(1);
    const retry2 = emailService.calculateNextRetryAt(2);

    // retry 0 delay ~1m
    assert.ok(retry0.getTime() >= now + RETRY_BACKOFF_MS[0] - 100);
    // retry 1 delay ~5m
    assert.ok(retry1.getTime() >= now + RETRY_BACKOFF_MS[1] - 100);
    // retry 2 delay ~15m
    assert.ok(retry2.getTime() >= now + RETRY_BACKOFF_MS[2] - 100);
  });

  it('should refuse to deliver email if the embedded token has already expired', async () => {
    const eventKey = `EXPIRED_TOKEN_TEST:${Date.now()}`;
    const pastDate = new Date(Date.now() - 1000 * 60); // 1 minute in the past

    const message = await emailService.queueEmail({
      eventKey,
      eventType: 'VERIFY_EMAIL',
      recipientEmail: TEST_RECIPIENT,
      subject: 'Expired link email',
      templateName: 'VERIFY_EMAIL',
      templateData: {
        verificationUrl: 'http://localhost:3000/verify?token=exp',
        expiresAt: pastDate.toISOString(),
      },
    });

    const result = await emailService.processMessage(message);

    assert.equal(result.success, false);
    assert.equal(result.skipped, true);

    const updated = await EmailOutbox.findById(message._id);
    assert.equal(updated.status, 'FAILED', 'Must be marked FAILED');
    assert.ok(updated.lastError.includes('Token expired before email delivery'));
    assert.equal(mailClient.getSentEmails().length, 0, 'No email must be sent over the wire');
  });
});
