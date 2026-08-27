import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('deletes expired stream tokens', async () => {
    const notificationStreamTokenRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 5 }),
    };
    const service = new NotificationsService(
      {} as never,
      notificationStreamTokenRepository as never,
    );

    await expect(service.purgeExpiredStreamTokens()).resolves.toBe(5);
    expect(notificationStreamTokenRepository.delete).toHaveBeenCalledWith({
      expiresAt: expect.anything(),
    });
  });
});
