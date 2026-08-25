import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER, type EmailProvider } from './email.types';

@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
    private readonly configService: ConfigService,
  ) {}

  async sendVerificationEmail(to: string, verificationUrl: string) {
    await this.emailProvider.sendVerificationEmail({ to, verificationUrl });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string) {
    await this.emailProvider.sendPasswordResetEmail({ to, resetUrl });
  }

  buildVerificationUrl(token: string) {
    const frontendUrl = this.configService.get<string>(
      'email.frontendUrl',
      'http://localhost:5173',
    );
    const url = new URL('/auth/verify-email', frontendUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  buildPasswordResetUrl(token: string) {
    const frontendUrl = this.configService.get<string>(
      'email.frontendUrl',
      'http://localhost:5173',
    );
    const url = new URL('/auth/reset-password', frontendUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  shouldExposeVerificationUrl() {
    return this.configService.get<boolean>('email.exposeVerificationUrl', true);
  }
}
