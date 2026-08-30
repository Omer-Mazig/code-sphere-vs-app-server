import { NotificationType } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';

function createService(preferenceRepository?: {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}) {
  const notificationStreamTokenRepository = {
    delete: jest.fn().mockResolvedValue({ affected: 5 }),
  };
  const notificationPreferenceRepository = preferenceRepository ?? {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((value: object) => ({ ...value })),
    save: jest.fn(async (value: unknown) => value),
  };
  const service = new NotificationsService(
    {} as never,
    notificationStreamTokenRepository as never,
    notificationPreferenceRepository as never,
  );

  return { service, notificationStreamTokenRepository, notificationPreferenceRepository };
}

describe('NotificationsService', () => {
  it('deletes expired stream tokens', async () => {
    const { service, notificationStreamTokenRepository } = createService();

    await expect(service.purgeExpiredStreamTokens()).resolves.toBe(5);
    expect(notificationStreamTokenRepository.delete).toHaveBeenCalledWith({
      expiresAt: expect.anything(),
    });
  });

  it('returns all-enabled defaults when the user has no prefs row', async () => {
    const { service } = createService();

    await expect(service.getMyPreferences('user-1')).resolves.toEqual({
      mentions: true,
      comments: true,
      likes: true,
      newFollowers: true,
    });
    await expect(
      service.isTypeEnabled('user-1', NotificationType.POST_LIKED),
    ).resolves.toBe(true);
  });

  it('treats a muted type as disabled', async () => {
    const { service } = createService({
      findOne: jest.fn().mockResolvedValue({
        userId: 'user-1',
        mentions: true,
        comments: true,
        likes: false,
        newFollowers: true,
      }),
      create: jest.fn(),
      save: jest.fn(),
    });

    await expect(
      service.isTypeEnabled('user-1', NotificationType.POST_LIKED),
    ).resolves.toBe(false);
    await expect(
      service.isTypeEnabled('user-1', NotificationType.USER_MENTIONED),
    ).resolves.toBe(true);
    await expect(
      service.isTypeEnabled('user-1', NotificationType.POST_COMMENTED),
    ).resolves.toBe(true);
    await expect(
      service.isTypeEnabled('user-1', NotificationType.COMMENT_REPLIED),
    ).resolves.toBe(true);
  });

  it('upserts a prefs row on the first PATCH', async () => {
    const { service, notificationPreferenceRepository } = createService();

    await expect(
      service.updateMyPreferences('user-1', { likes: false }),
    ).resolves.toEqual({
      mentions: true,
      comments: true,
      likes: false,
      newFollowers: true,
    });
    expect(notificationPreferenceRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      mentions: true,
      comments: true,
      likes: true,
      newFollowers: true,
    });
    expect(notificationPreferenceRepository.save).toHaveBeenCalled();
  });
});
