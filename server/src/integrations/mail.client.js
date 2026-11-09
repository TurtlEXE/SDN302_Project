import nodemailer from 'nodemailer';
import { emailConfig } from '../config/email.js';
import { logger } from '../utils/logger.js';

class MailClient {
  constructor(config = emailConfig) {
    this.config = config;
    this.isTestMode = this.config.isTestMode;
    this.sentEmails = [];
    this.failureMock = null;
    this.transporter = this._initTransporter();
  }

  _initTransporter() {
    if (this.isTestMode) {
      // In test mode or without live SMTP credentials, use JSON transport to capture sent emails in-memory
      return nodemailer.createTransport({
        jsonTransport: true,
      });
    }

    // SMTP transport for live development and production
    return nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth.user ? {
        user: this.config.auth.user,
        pass: this.config.auth.pass,
      } : undefined,
    });
  }

  /**
   * Toggles in-memory test transport mode
   * @param {boolean} [isTest=true]
   */
  setTestMode(isTest = true) {
    this.isTestMode = isTest;
    this.transporter = this._initTransporter();
  }

  /**
   * Set simulated failure for testing retry and failure handling
   * @param {Error|null} error
   */
  setFailureMock(error) {
    this.failureMock = error;
  }

  /**
   * Clears the sent email log in test mode
   */
  clearSentEmails() {
    this.sentEmails = [];
  }

  /**
   * Returns copy of all sent emails in test mode
   * @returns {Array<object>}
   */
  getSentEmails() {
    return [...this.sentEmails];
  }

  /**
   * Sends an email message
   * @param {object} options
   * @param {string} options.to
   * @param {string} options.subject
   * @param {string} options.html
   * @param {string} [options.text]
   * @param {string} [options.from]
   * @returns {Promise<object>}
   */
  async sendMail({ to, subject, html, text, from }) {
    if (this.failureMock) {
      logger.warn(`[MailClient] Triggering mocked failure: ${this.failureMock.message}`);
      throw this.failureMock;
    }

    const mailOptions = {
      from: from || this.config.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      if ((this.isTestMode || this.config.isTestMode) && info.message) {
        const parsed = JSON.parse(info.message);
        this.sentEmails.push({
          to: mailOptions.to,
          subject: mailOptions.subject,
          html: mailOptions.html,
          text: mailOptions.text,
          from: mailOptions.from,
          raw: parsed,
          sentAt: new Date(),
        });
      }
      logger.info(`[MailClient] Email sent successfully to [${to}] - Subject: "${subject}"`);
      return info;
    } catch (err) {
      logger.error(`[MailClient] Failed to send email to [${to}]: ${err.message}`, {
        to,
        subject,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Verifies SMTP connection
   * @returns {Promise<boolean>}
   */
  async verifyConnection() {
    if (this.config.isTestMode) return true;
    try {
      await this.transporter.verify();
      logger.info('[MailClient] SMTP transporter verified successfully.');
      return true;
    } catch (err) {
      logger.error(`[MailClient] SMTP transporter verification failed: ${err.message}`);
      return false;
    }
  }
}

export const mailClient = new MailClient();
export default mailClient;
