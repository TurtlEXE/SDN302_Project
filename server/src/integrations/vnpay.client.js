import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Formats a Date object to VNPay date format: 'yyyyMMddHHmmss' in Asia/Ho_Chi_Minh (GMT+7).
 * @param {Date|string|number} date
 * @returns {string} 'yyyyMMddHHmmss'
 */
export function formatDateToVnpay(date) {
  const d = new Date(date);
  // Shift from UTC to GMT+7
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const vnTime = new Date(utcMs + 7 * 3600000);

  const YYYY = vnTime.getFullYear();
  const MM = String(vnTime.getMonth() + 1).padStart(2, '0');
  const DD = String(vnTime.getDate()).padStart(2, '0');
  const HH = String(vnTime.getHours()).padStart(2, '0');
  const mm = String(vnTime.getMinutes()).padStart(2, '0');
  const ss = String(vnTime.getSeconds()).padStart(2, '0');

  return `${YYYY}${MM}${DD}${HH}${mm}${ss}`;
}

/**
 * Parses a VNPay date string ('yyyyMMddHHmmss' in GMT+7) into a standard Date object in UTC.
 * @param {string} dateStr
 * @returns {Date|null}
 */
export function parseVnpayDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.length !== 14) {
    return null;
  }
  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(4, 6), 10) - 1;
  const day = parseInt(dateStr.slice(6, 8), 10);
  const hour = parseInt(dateStr.slice(8, 10), 10);
  const minute = parseInt(dateStr.slice(10, 12), 10);
  const second = parseInt(dateStr.slice(12, 14), 10);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute) || isNaN(second)) {
    return null;
  }

  // Input dateStr is GMT+7, so UTC hour = hour - 7
  return new Date(Date.UTC(year, month, day, hour - 7, minute, second));
}

/**
 * Constant-time safe string comparison for hash values
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function secureCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a.toLowerCase(), 'utf-8');
  const bufB = Buffer.from(b.toLowerCase(), 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * VNPay Gateway Client
 * Handles URL creation and HMAC-SHA512 verification in compliance with VNPay 2.1.0 specification
 * and Section 8.6 / Section 16.1 of docs/features.md.
 */
export class VNPayClient {
  constructor(config = {}) {
    this.tmnCode = config.tmnCode || env.VNPAY_TMN_CODE;
    this.hashSecret = config.hashSecret || env.VNPAY_HASH_SECRET;
    this.vnpUrl = config.vnpUrl || env.VNPAY_URL;
    this.returnUrl = config.returnUrl || env.VNPAY_RETURN_URL;
  }

  /**
   * Builds an authenticated VNPay payment URL.
   * - Amount is multiplied by 100 (expectedAmountVnd * 100, Section 8.6, Criterion 44)
   * - ExpireDate matches holdExpiresAt exactly (Criterion 46)
   * - Parameters are sorted alphabetically ascending
   * - Signed with HMAC-SHA512
   *
   * @param {Object} params
   * @param {string} params.txnRef - Unique PaymentOrder reference (e.g. 'PO12345678ABC')
   * @param {number} params.amountVnd - Total booking price in VND
   * @param {string} params.orderInfo - Description (e.g. 'Thanh toan don dat san BR20261029-ABC')
   * @param {string} [params.ipAddr='127.0.0.1'] - Client IP address
   * @param {Date} [params.createDate=new Date()] - Creation timestamp
   * @param {Date} params.expireDate - Expiration timestamp (matches holdExpiresAt)
   * @param {string} [params.returnUrl] - Optional custom return URL override
   * @returns {string} Full payment URL with vnp_SecureHash
   */
  createPaymentUrl({
    txnRef,
    amountVnd,
    orderInfo,
    ipAddr = '127.0.0.1',
    createDate = new Date(),
    expireDate,
    returnUrl,
  }) {
    if (!txnRef) throw new Error('VNPay createPaymentUrl: txnRef is required.');
    if (!amountVnd || amountVnd <= 0) throw new Error('VNPay createPaymentUrl: amountVnd must be greater than 0.');
    if (!expireDate) throw new Error('VNPay createPaymentUrl: expireDate is required (matches holdExpiresAt).');

    const amountInVnp = Math.round(amountVnd) * 100; // Criterion 44
    const vnpParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Amount: String(amountInVnp),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: String(txnRef),
      vnp_OrderInfo: String(orderInfo || `Thanh toan don dat san ${txnRef}`),
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: returnUrl || this.returnUrl,
      vnp_IpAddr: ipAddr || '127.0.0.1',
      vnp_CreateDate: formatDateToVnpay(createDate),
      vnp_ExpireDate: formatDateToVnpay(expireDate), // Criterion 46
    };

    // Sort keys alphabetically ascending
    const sortedKeys = Object.keys(vnpParams).sort();
    const hashData = [];
    const queryParts = [];

    for (const key of sortedKeys) {
      const val = vnpParams[key];
      if (val !== undefined && val !== null && val !== '') {
        const encodedKey = encodeURIComponent(key);
        const encodedVal = encodeURIComponent(val).replace(/%20/g, '+');
        hashData.push(`${encodedKey}=${encodedVal}`);
        queryParts.push(`${encodedKey}=${encodedVal}`);
      }
    }

    const signData = hashData.join('&');
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return `${this.vnpUrl}?${queryParts.join('&')}&vnp_SecureHash=${signedHash}`;
  }

  /**
   * Verifies the cryptographic HMAC-SHA512 signature of VNPay callback parameters.
   * Works identically for both Return and IPN callbacks (Section 8.6, Criterion 45).
   *
   * @param {Record<string, string>} queryParams - Key-value query parameters from VNPay
   * @returns {boolean} True if signature is authentic, false otherwise
   */
  verifySignature(queryParams) {
    if (!queryParams || typeof queryParams !== 'object') return false;

    const secureHash = queryParams.vnp_SecureHash;
    if (!secureHash || typeof secureHash !== 'string') return false;

    const fields = {};
    for (const [key, value] of Object.entries(queryParams)) {
      if (
        key.startsWith('vnp_') &&
        key !== 'vnp_SecureHash' &&
        key !== 'vnp_SecureHashType' &&
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        fields[key] = value;
      }
    }

    const sortedKeys = Object.keys(fields).sort();
    const hashParts = [];

    for (const key of sortedKeys) {
      const val = fields[key];
      const encodedKey = encodeURIComponent(key);
      const encodedVal = encodeURIComponent(val).replace(/%20/g, '+');
      hashParts.push(`${encodedKey}=${encodedVal}`);
    }

    const signData = hashParts.join('&');
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const calculatedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return secureCompare(calculatedHash, secureHash);
  }
}

export const vnpayClient = new VNPayClient();
export default vnpayClient;

