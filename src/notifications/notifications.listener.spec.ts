import { Logger } from '@nestjs/common';
import {
  NotificationTargetType,
  NotificationType,
} from './notifications.entity';
import { NotificationsListener } from './notifications.listener';

function createListener() {
  const postsRepository = { findOne: jest.fn() };
  const commentsRepository = { findOne: jest.fn() };
  const articlesRepository = { findOne: jest.fn() };
  const usersRepository = { findOne: jest.fn() };
  const notificationsService = { createNotification: jest.fn() };

  const listener = new NotificationsListener(
    postsRepository as never,
    commentsRepository as never,
    articlesRepository as never,
    usersRepository as never,
    notificationsService as never,
  );

  return {
    listener,
    postsRepository,
    usersRepository,
    notificationsService,
  };
}

describe('NotificationsListener', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('does not notify when the liker is the post author', async () => {
    const { listener, postsRepository, usersRepository, notificationsService } =
      createListener();
    postsRepository.findOne.mockResolvedValue({
      id: 'post-1',
      authorId: 'user-1',
      content: 'hello',
    });
    usersRepository.findOne.mockResolvedValue({
      id: 'user-1',
      username: 'ada',
      displayName: 'Ada',
      avatarUrl: null,
    });

    await listener.handlePostLiked({
      postId: 'post-1',
      likerId: 'user-1',
    });

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it('skips missing posts instead of throwing', async () => {
    const { listener, postsRepository, usersRepository, notificationsService } =
      createListener();
    postsRepository.findOne.mockResolvedValue(null);
    usersRepository.findOne.mockResolvedValue({
      id: 'user-2',
      username: 'grace',
      displayName: null,
      avatarUrl: null,
    });

    await expect(
      listener.handlePostLiked({
        postId: 'missing',
        likerId: 'user-2',
      }),
    ).resolves.toBeUndefined();
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it('creates a POST_LIKED notification for another user', async () => {
    const { listener, postsRepository, usersRepository, notificationsService } =
      createListener();
    postsRepository.findOne.mockResolvedValue({
      id: 'post-1',
      authorId: 'author-1',
      content: 'x'.repeat(120),
    });
    usersRepository.findOne.mockResolvedValue({
      id: 'liker-1',
      username: 'grace',
      displayName: 'Grace',
      avatarUrl: null,
    });

    await listener.handlePostLiked({
      postId: 'post-1',
      likerId: 'liker-1',
    });

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'author-1',
      NotificationType.POST_LIKED,
      NotificationTargetType.POST,
      expect.objectContaining({
        type: NotificationType.POST_LIKED,
        actorId: 'liker-1',
        actorName: 'Grace',
        postId: 'post-1',
        postExcerpt: `${'x'.repeat(79)}…`,
      }),
    );
  });

  it('does not notify a user about their own follow', async () => {
    const { listener, usersRepository, notificationsService } =
      createListener();
    usersRepository.findOne.mockResolvedValue({
      id: 'user-1',
      username: 'ada',
      displayName: 'Ada',
      avatarUrl: null,
    });

    await listener.handleUserFollowed({
      followerId: 'user-1',
      followeeId: 'user-1',
    });

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });
});
