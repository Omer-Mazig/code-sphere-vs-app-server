export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export type EmailProviderName = 'console' | 'smtp';

export interface VerificationEmailPayload {
  to: string;
  verificationUrl: string;
}

export interface PasswordResetEmailPayload {
  to: string;
  resetUrl: string;
}

export interface EmailProvider {
  sendVerificationEmail(payload: VerificationEmailPayload): Promise<void>;
  sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void>;
}
