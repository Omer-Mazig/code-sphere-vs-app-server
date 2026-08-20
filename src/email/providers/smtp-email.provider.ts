import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { BusinessException } from '../../common/errors/business.exception';
import { ErrorCode } from '../../common/errors/error-codes.enum';
import type { EmailProvider, VerificationEmailPayload } from '../email.types';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(configService: ConfigService) {
    const host = configService.get<string>('email.smtpHost');
    const port = configService.get<number>('email.smtpPort', 587);
    const user = configService.get<string>('email.smtpUser');
    const password = configService.get<string>('email.smtpPassword');
    const from = configService.get<string>('email.from');

    if (!host || !from) {
      throw new Error(
        'SMTP_HOST and SMTP_FROM are required when EMAIL_PROVIDER=smtp',
      );
    }

    this.from = from;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass: password } : undefined,
    });
  }

  async sendVerificationEmail(
    payload: VerificationEmailPayload,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: payload.to,
        subject: 'Verify your CodeSphere account',
        text: `Welcome to CodeSphere.\n\nVerify your email by opening this link:\n${payload.verificationUrl}\n\nThis link expires in 24 hours.`,
        html: `<p>Welcome to CodeSphere.</p><p><a href="${payload.verificationUrl}">Verify your email</a></p><p>This link expires in 24 hours.</p>`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send verification email: ${message}`);
      throw new BusinessException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        `Failed to send verification email to "${payload.to}": ${message}`,
        'Unable to send verification email. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
