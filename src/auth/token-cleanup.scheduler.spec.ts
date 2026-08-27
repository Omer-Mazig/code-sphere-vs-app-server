import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { NotificationsService } from '../notifications/notifications.service';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_DAY_AT_MIDNIGHT: '0 0 * * *' },
}));

import { TokenCleanupScheduler } from './token-cleanup.scheduler';

describe('TokenCleanupScheduler', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('no-ops when cron is disabled', async () => {
    const authService = {
      purgeExpiredRefreshTokens: jest.fn(),
    };
    const notificationsService = {
      purgeExpiredStreamTokens: jest.fn(),
    };
    const configService = {
      get: jest.fn().mockReturnValue(false),
    };

    const scheduler = new TokenCleanupScheduler(
      authService as unknown as AuthService,
      notificationsService as unknown as NotificationsService,
      configService as unknown as ConfigService,
    );

    await scheduler.purgeExpiredTokens();

    expect(authService.purgeExpiredRefreshTokens).not.toHaveBeenCalled();
    expect(notificationsService.purgeExpiredStreamTokens).not.toHaveBeenCalled();
  });

  it('deletes expired refresh tokens and stream tokens when cron is enabled', async () => {
    const authService = {
      purgeExpiredRefreshTokens: jest.fn().mockResolvedValue(4),
    };
    const notificationsService = {
      purgeExpiredStreamTokens: jest.fn().mockResolvedValue(2),
    };
    const configService = {
      get: jest.fn().mockReturnValue(true),
    };

    const scheduler = new TokenCleanupScheduler(
      authService as unknown as AuthService,
      notificationsService as unknown as NotificationsService,
      configService as unknown as ConfigService,
    );

    await scheduler.purgeExpiredTokens();

    expect(authService.purgeExpiredRefreshTokens).toHaveBeenCalledTimes(1);
    expect(notificationsService.purgeExpiredStreamTokens).toHaveBeenCalledTimes(
      1,
    );
  });
});
