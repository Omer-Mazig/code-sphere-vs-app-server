import { registerAs } from '@nestjs/config';
import type { EmailProviderName } from '../email/email.types';

const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

export const emailConfig = registerAs('email', () => {
  const provider = (process.env.EMAIL_PROVIDER ??
    (isProduction ? 'smtp' : 'console')) as EmailProviderName;

  return {
    provider,
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    exposeVerificationUrl: !isProduction,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT ?? '587', 10),
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM ?? 'CodeSphere <noreply@localhost>',
  };
});
