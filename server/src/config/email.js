import { env } from './env.js';

const isPlaceholderUser = !env.SMTP_USER || env.SMTP_USER === 'your_mailtrap_user';

export const emailConfig = Object.freeze({
  host: env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
  port: env.SMTP_PORT || 2525,
  secure: (env.SMTP_PORT === 465),
  auth: {
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
  },
  from: env.SMTP_FROM || 'SportBooking Platform <no-reply@sportbooking.local>',
  isTestMode: env.NODE_ENV === 'test' || isPlaceholderUser,
});

export default emailConfig;
