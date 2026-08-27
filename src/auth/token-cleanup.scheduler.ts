import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from './auth.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TokenCleanupScheduler {
  private readonly logger = new Logger(TokenCleanupScheduler.name);

  constructor(
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeExpiredTokens() {
    if (!this.configService.get<boolean>('app.enableCron', true)) {
      return;
    }

    const [refreshDeleted, streamDeleted] = await Promise.all([
      this.authService.purgeExpiredRefreshTokens(),
      this.notificationsService.purgeExpiredStreamTokens(),
    ]);

    this.logger.log(
      `Expired token cleanup removed ${refreshDeleted} refresh tokens and ${streamDeleted} stream tokens`,
    );
  }
}
