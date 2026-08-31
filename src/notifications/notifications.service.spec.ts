import { NotificationPayload } from './dto';
import {
  NotificationTargetType,
  NotificationType,
} from './entities/notification.entity';
import { NotificationsService } from './notifications.service';

function likedPayload(
  overrides: Partial<
    Extract<NotificationPayload, { type: NotificationType.POST_LIKED }>
  > = {},
): Extract<NotificationPayload, { type: NotificationType.POST_LIKED }> {
  return {
    type: NotificationType.POST_LIKED,
    actorId: 'alice',
    actorName: 'Alice',
    actorAvatarUrl: null,
    targetType: NotificationTargetType.POST,
    postId: 'post-1',
    postExcerpt: 'hello',
    createdAt: '2026-08-31T00:00:00.000Z',
    ...overrides,
  };
}

function createService(preferenceRepository?: {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}) {
  const notificationsRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((value: object) => ({ ...value })),
    save: jest.fn(async (value: unknown) => ({
      ...(value as object),
      id: 'notif-1',
      createdAt: new Date('2026-08-31T00:00:00.000Z'),
      updatedAt: new Date('2026-08-31T00:00:00.000Z'),
    })),
    count: jest.fn().mockResolvedValue(1),
  };
  const notificationStreamTokenRepository = {
    delete: jest.fn().mockResolvedValue({ affected: 5 }),
  };
  const notificationPreferenceRepository = preferenceRepository ?? {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((value: object) => ({ ...value })),
    save: jest.fn(async (value: unknown) => value),
  };
  const service = new NotificationsService(
    notificationsRepository as never,
    notificationStreamTokenRepository as never,
    notificationPreferenceRepository as never,
  );

  return {
    service,
    notificationsRepository,
    notificationStreamTokenRepository,
    notificationPreferenceRepository,
  };
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

  it('inserts a collapsible notification when none is unread', async () => {
    const { service, notificationsRepository } = createService();
    const created = await service.createNotification(
      'author-1',
      NotificationType.POST_LIKED,
      NotificationTargetType.POST,
      likedPayload(),
      'post-1',
    );

    expect(notificationsRepository.save).toHaveBeenCalledTimes(1);
    expect(created.payload).toEqual(
      expect.objectContaining({
        actorIds: ['alice'],
        actorCount: 1,
      }),
    );
  });

  it('updates the unread row instead of inserting a second like', async () => {
    const { service, notificationsRepository } = createService();
    notificationsRepository.findOne.mockResolvedValue({
      id: 'notif-1',
      userId: 'author-1',
      type: NotificationType.POST_LIKED,
      targetType: NotificationTargetType.POST,
      targetId: 'post-1',
      isRead: false,
      readAt: null,
      payload: {
        type: NotificationType.POST_LIKED,
        actorId: 'alice',
        actorName: 'Alice',
        actorIds: ['alice'],
        actorNames: ['Alice'],
        actorCount: 1,
      },
      createdAt: new Date('2026-08-31T00:00:00.000Z'),
      updatedAt: new Date('2026-08-31T00:00:00.000Z'),
    });

    const updated = await service.createNotification(
      'author-1',
      NotificationType.POST_LIKED,
      NotificationTargetType.POST,
      likedPayload({
        actorId: 'bob',
        actorName: 'Bob',
        createdAt: '2026-08-31T00:01:00.000Z',
      }),
      'post-1',
    );

    expect(notificationsRepository.create).not.toHaveBeenCalled();
    expect(updated.payload).toEqual(
      expect.objectContaining({
        actorId: 'bob',
        actorCount: 2,
        actorIds: ['bob', 'alice'],
      }),
    );
  });
});
