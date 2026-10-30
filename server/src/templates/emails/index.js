import { renderVerifyEmailTemplate } from './verify-email.template.js';
import { renderActivateOwnerTemplate } from './activate-owner.template.js';
import { renderResetPasswordTemplate } from './reset-password.template.js';
import { renderAccountLockedTemplate } from './account-locked.template.js';
import { renderAccountUnlockedTemplate } from './account-unlocked.template.js';
import { renderBookingConfirmedTemplate } from './booking-confirmed.template.js';
import { renderBookingCancelledTemplate } from './booking-cancelled.template.js';
import { renderRefundProcessedTemplate } from './refund-processed.template.js';
import { renderHoldExpiredTemplate } from './hold-expired.template.js';
import { renderBookingCompletedTemplate } from './booking-completed.template.js';
import { renderBookingNoShowTemplate } from './booking-no-show.template.js';

export const emailTemplates = {
  VERIFY_EMAIL: renderVerifyEmailTemplate,
  ACTIVATE_OWNER: renderActivateOwnerTemplate,
  RESET_PASSWORD: renderResetPasswordTemplate,
  ACCOUNT_LOCKED: renderAccountLockedTemplate,
  ACCOUNT_UNLOCKED: renderAccountUnlockedTemplate,
  BOOKING_CONFIRMED: renderBookingConfirmedTemplate,
  'booking-confirmed': renderBookingConfirmedTemplate,
  BOOKING_CANCELLED: renderBookingCancelledTemplate,
  'booking-cancelled': renderBookingCancelledTemplate,
  REFUND_PROCESSED: renderRefundProcessedTemplate,
  'refund-processed': renderRefundProcessedTemplate,
  HOLD_EXPIRED: renderHoldExpiredTemplate,
  'hold-expired': renderHoldExpiredTemplate,
  BOOKING_COMPLETED: renderBookingCompletedTemplate,
  'booking-completed': renderBookingCompletedTemplate,
  BOOKING_NO_SHOW: renderBookingNoShowTemplate,
  'booking-no-show': renderBookingNoShowTemplate,
};

/**
 * Renders an email template by name
 * @param {string} templateName
 * @param {object} templateData
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderEmail(templateName, templateData) {
  const renderer = emailTemplates[templateName];
  if (!renderer) {
    throw new Error(`Email template [${templateName}] does not exist.`);
  }
  return renderer(templateData);
}

export {
  renderVerifyEmailTemplate,
  renderActivateOwnerTemplate,
  renderResetPasswordTemplate,
  renderAccountLockedTemplate,
  renderAccountUnlockedTemplate,
  renderBookingConfirmedTemplate,
  renderBookingCancelledTemplate,
  renderRefundProcessedTemplate,
  renderHoldExpiredTemplate,
  renderBookingCompletedTemplate,
  renderBookingNoShowTemplate,
};

export default renderEmail;
