import { Injectable, Logger } from '@nestjs/common';
import type {
  EmailProvider,
  PasswordResetEmailPayload,
  VerificationEmailPayload,
} from '../email.types';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  sendVerificationEmail(payload: VerificationEmailPayload): Promise<void> {
    this.logger.log(
      `Verification email for ${payload.to} (console provider — not sent)`,
    );
    this.logger.log(`Open this link to verify: ${payload.verificationUrl}`);
    return Promise.resolve();
  }

  sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void> {
    this.logger.log(
      `Password reset email for ${payload.to} (console provider — not sent)`,
    );
    this.logger.log(`Open this link to reset: ${payload.resetUrl}`);
    return Promise.resolve();
  }
}
