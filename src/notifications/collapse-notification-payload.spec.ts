import {
  NotificationTargetType,
  NotificationType,
} from './entities/notification.entity';
import {
  MAX_COLLAPSE_ACTOR_PREVIEWS,
  isCollapsibleNotificationType,
  mergeCollapsedNotificationPayload,
  seedCollapsedNotificationPayload,
} from './collapse-notification-payload';
import type { NotificationPayload } from './dto';

function likedPayload(
  overrides: Partial<Extract<NotificationPayload, { type: NotificationType.POST_LIKED }>> = {},
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

describe('isCollapsibleNotificationType', () => {
  it('collapses likes, comments, and new followers only', () => {
    expect(isCollapsibleNotificationType(NotificationType.POST_LIKED)).toBe(true);
    expect(isCollapsibleNotificationType(NotificationType.POST_COMMENTED)).toBe(
      true,
    );
    expect(isCollapsibleNotificationType(NotificationType.ARTICLE_LIKED)).toBe(
      true,
    );
    expect(
      isCollapsibleNotificationType(NotificationType.ARTICLE_COMMENTED),
    ).toBe(true);
    expect(isCollapsibleNotificationType(NotificationType.NEW_FOLLOWER)).toBe(
      true,
    );
    expect(isCollapsibleNotificationType(NotificationType.USER_MENTIONED)).toBe(
      false,
    );
    expect(isCollapsibleNotificationType(NotificationType.COMMENT_REPLIED)).toBe(
      false,
    );
  });
});

describe('seedCollapsedNotificationPayload', () => {
  it('starts a row with one actor', () => {
    expect(seedCollapsedNotificationPayload(likedPayload())).toEqual(
      expect.objectContaining({
        actorIds: ['alice'],
        actorNames: ['Alice'],
        actorCount: 1,
      }),
    );
  });
});

describe('mergeCollapsedNotificationPayload', () => {
  it('appends a new actor and keeps the latest first', () => {
    const merged = mergeCollapsedNotificationPayload(
      seedCollapsedNotificationPayload(likedPayload()) as unknown as Record<
        string,
        unknown
      >,
      likedPayload({
        actorId: 'bob',
        actorName: 'Bob',
        createdAt: '2026-08-31T00:01:00.000Z',
      }),
    );

    expect(merged).toEqual(
      expect.objectContaining({
        actorId: 'bob',
        actorName: 'Bob',
        actorIds: ['bob', 'alice'],
        actorNames: ['Bob', 'Alice'],
        actorCount: 2,
      }),
    );
  });

  it('does not increment when the same actor likes again', () => {
    const existing = mergeCollapsedNotificationPayload(
      seedCollapsedNotificationPayload(likedPayload()) as unknown as Record<
        string,
        unknown
      >,
      likedPayload({ actorId: 'bob', actorName: 'Bob' }),
    );

    const merged = mergeCollapsedNotificationPayload(
      existing as unknown as Record<string, unknown>,
      likedPayload(),
    );

    expect(merged).toEqual(
      expect.objectContaining({
        actorCount: 2,
        actorIds: ['alice', 'bob'],
        actorNames: ['Alice', 'Bob'],
      }),
    );
  });

  it('caps stored preview ids at the last three actors', () => {
    let payload: Record<string, unknown> = seedCollapsedNotificationPayload(
      likedPayload(),
    ) as unknown as Record<string, unknown>;

    for (let index = 2; index <= 5; index += 1) {
      payload = mergeCollapsedNotificationPayload(
        payload,
        likedPayload({
          actorId: `user-${index}`,
          actorName: `User ${index}`,
        }),
      ) as unknown as Record<string, unknown>;
    }

    expect(payload.actorCount).toBe(5);
    expect(payload.actorIds).toHaveLength(MAX_COLLAPSE_ACTOR_PREVIEWS);
    expect(payload.actorIds).toEqual(['user-5', 'user-4', 'user-3']);
  });

  it('reads legacy rows that only stored a single actorId', () => {
    const merged = mergeCollapsedNotificationPayload(
      {
        type: NotificationType.POST_LIKED,
        actorId: 'alice',
        actorName: 'Alice',
      },
      likedPayload({ actorId: 'bob', actorName: 'Bob' }),
    );

    expect(merged).toEqual(
      expect.objectContaining({
        actorCount: 2,
        actorIds: ['bob', 'alice'],
        actorNames: ['Bob', 'Alice'],
      }),
    );
  });
});
