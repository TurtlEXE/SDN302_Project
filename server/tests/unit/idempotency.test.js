import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePayloadFingerprint,
  generateRequestNumber,
  generateBookingCode,
  generateVnpayTxnRef,
} from '../../src/services/booking/booking-request.service.js';

describe('Idempotency & Code Generators Unit Tests (P09)', () => {
  describe('computePayloadFingerprint', () => {
    const basePayload = {
      courtId: '6ae31d6816c831f13af47db7',
      bookingDate: '2026-11-05',
      configVersion: 1,
      selectedSlots: [
        { startTime: '06:00', endTime: '06:30' },
        { startTime: '06:30', endTime: '07:00' },
      ],
      contactName: 'Nguyễn Văn A',
      contactPhone: '0901234567',
    };

    it('generates identical fingerprint regardless of selectedSlots ordering (Criterion 10)', () => {
      const payloadShuffled = {
        ...basePayload,
        selectedSlots: [
          { startTime: '06:30', endTime: '07:00' },
          { startTime: '06:00', endTime: '06:30' },
        ],
      };

      const fp1 = computePayloadFingerprint(basePayload);
      const fp2 = computePayloadFingerprint(payloadShuffled);

      assert.equal(fp1, fp2);
      assert.equal(typeof fp1, 'string');
      assert.equal(fp1.length, 64); // SHA-256 hex
    });

    it('produces case-insensitive fingerprint for contactName', () => {
      const payloadUpper = {
        ...basePayload,
        contactName: 'NGUYỄN VĂN A',
      };
      const fp1 = computePayloadFingerprint(basePayload);
      const fp2 = computePayloadFingerprint(payloadUpper);
      assert.equal(fp1, fp2);
    });

    it('produces different fingerprints when courtId changes', () => {
      const payloadDiff = {
        ...basePayload,
        courtId: '6ae31d6816c831f13af47db8',
      };
      assert.notEqual(computePayloadFingerprint(basePayload), computePayloadFingerprint(payloadDiff));
    });

    it('produces different fingerprints when bookingDate changes', () => {
      const payloadDiff = {
        ...basePayload,
        bookingDate: '2026-11-06',
      };
      assert.notEqual(computePayloadFingerprint(basePayload), computePayloadFingerprint(payloadDiff));
    });

    it('produces different fingerprints when configVersion changes', () => {
      const payloadDiff = {
        ...basePayload,
        configVersion: 2,
      };
      assert.notEqual(computePayloadFingerprint(basePayload), computePayloadFingerprint(payloadDiff));
    });

    it('produces different fingerprints when slots change', () => {
      const payloadDiff = {
        ...basePayload,
        selectedSlots: [{ startTime: '07:00', endTime: '07:30' }],
      };
      assert.notEqual(computePayloadFingerprint(basePayload), computePayloadFingerprint(payloadDiff));
    });
  });

  describe('Code Generators', () => {
    it('generates well-formatted requestNumber', () => {
      const reqNum = generateRequestNumber('2026-11-05');
      assert.match(reqNum, /^BR20261105-[0-9A-F]{6}$/);
    });

    it('generates well-formatted bookingCode with index', () => {
      const code1 = generateBookingCode('2026-11-05', 1);
      const code2 = generateBookingCode('2026-11-05', 2);
      assert.match(code1, /^BK20261105-[0-9A-F]{6}1$/);
      assert.match(code2, /^BK20261105-[0-9A-F]{6}2$/);
      assert.notEqual(code1, code2);
    });

    it('generates well-formatted vnpayTxnRef', () => {
      const ref = generateVnpayTxnRef();
      assert.match(ref, /^PO[0-9]{8}[0-9A-F]{6}$/);
    });
  });
});

