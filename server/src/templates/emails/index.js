import { renderVerifyEmailTemplate } from './verify-email.template.js';
import { renderActivateOwnerTemplate } from './activate-owner.template.js';
import { renderResetPasswordTemplate } from './reset-password.template.js';

export const emailTemplates = {
  VERIFY_EMAIL: renderVerifyEmailTemplate,
  ACTIVATE_OWNER: renderActivateOwnerTemplate,
  RESET_PASSWORD: renderResetPasswordTemplate,
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
};

export default renderEmail;
