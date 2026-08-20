export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export type EmailProviderName = 'console' | 'smtp';

export interface VerificationEmailPayload {
  to: string;
  verificationUrl: string;
}

export interface EmailProvider {
  sendVerificationEmail(payload: VerificationEmailPayload): Promise<void>;
}
