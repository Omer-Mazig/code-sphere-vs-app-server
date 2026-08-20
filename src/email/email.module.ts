import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { EMAIL_PROVIDER, type EmailProviderName } from './email.types';

@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<EmailProviderName>(
          'email.provider',
          'console',
        );

        if (provider === 'smtp') {
          return new SmtpEmailProvider(configService);
        }

        return new ConsoleEmailProvider();
      },
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
