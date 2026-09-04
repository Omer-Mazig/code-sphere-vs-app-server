import { Logger } from '@nestjs/common';
import {
  NotificationTargetType,
  NotificationType,
} from './entities/notification.entity';
import { NotificationsListener } from './notifications.listener';

function createListener() {
  const postsRepository = { findOne: jest.fn() };
  const commentsRepository = { findOne: jest.fn() };
  const articlesRepository = { findOne: jest.fn() };
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  const usersRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const notificationsService = {
    createNotification: jest.fn(),
    isTypeEnabled: jest.fn().mockResolvedValue(true),
  };

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
    commentsRepository,
    articlesRepository,
    usersRepository,
    queryBuilder,
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

    expect(notificationsService.isTypeEnabled).toHaveBeenCalledWith(
      'author-1',
      NotificationType.POST_LIKED,
    );
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
      'post-1',
    );
  });

  it('does not create a notification when the recipient muted that type', async () => {
    const { listener, postsRepository, usersRepository, notificationsService } =
      createListener();
    notificationsService.isTypeEnabled.mockResolvedValue(false);
    postsRepository.findOne.mockResolvedValue({
      id: 'post-1',
      authorId: 'author-1',
      content: 'hello',
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

    expect(notificationsService.isTypeEnabled).toHaveBeenCalledWith(
      'author-1',
      NotificationType.POST_LIKED,
    );
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
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

  it('notifies each mentioned user once and skips the actor', async () => {
    const { listener, usersRepository, queryBuilder, notificationsService } =
      createListener();
    usersRepository.findOne.mockResolvedValue({
      id: 'author-1',
      username: 'ada',
      displayName: 'Ada',
      avatarUrl: null,
    });
    queryBuilder.getMany.mockResolvedValue([
      { id: 'author-1', username: 'ada' },
      { id: 'grace-1', username: 'grace' },
    ]);

    await listener.handleUserMentioned({
      actorId: 'author-1',
      usernames: ['grace', 'grace', 'ada'],
      targetType: NotificationTargetType.POST,
      postId: 'post-1',
      excerpt: 'hello @grace @ada',
    });

    expect(notificationsService.createNotification).toHaveBeenCalledTimes(1);
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'grace-1',
      NotificationType.USER_MENTIONED,
      NotificationTargetType.POST,
      expect.objectContaining({
        type: NotificationType.USER_MENTIONED,
        actorId: 'author-1',
        postId: 'post-1',
        excerpt: 'hello @grace @ada',
      }),
      'post-1',
    );
  });

  it('skips unknown usernames', async () => {
    const { listener, usersRepository, queryBuilder, notificationsService } =
      createListener();
    usersRepository.findOne.mockResolvedValue({
      id: 'author-1',
      username: 'ada',
      displayName: 'Ada',
      avatarUrl: null,
    });
    queryBuilder.getMany.mockResolvedValue([]);

    await listener.handleUserMentioned({
      actorId: 'author-1',
      usernames: ['nobody'],
      targetType: NotificationTargetType.POST,
      postId: 'post-1',
      excerpt: 'hello @nobody',
    });

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it('creates an ARTICLE_LIKED notification for an article author', async () => {
    const {
      listener,
      articlesRepository,
      usersRepository,
      notificationsService,
    } = createListener();
    articlesRepository.findOne.mockResolvedValue({
      id: 'article-1',
      authorId: 'author-1',
      title: 'Deep dive',
      slug: 'deep-dive',
      isPublished: true,
    });
    usersRepository.findOne.mockResolvedValue({
      id: 'liker-1',
      username: 'grace',
      displayName: 'Grace',
      avatarUrl: null,
    });

    await listener.handleArticleLiked({
      articleId: 'article-1',
      likerId: 'liker-1',
    });

    expect(notificationsService.isTypeEnabled).toHaveBeenCalledWith(
      'author-1',
      NotificationType.ARTICLE_LIKED,
    );
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'author-1',
      NotificationType.ARTICLE_LIKED,
      NotificationTargetType.ARTICLE,
      expect.objectContaining({
        type: NotificationType.ARTICLE_LIKED,
        targetType: NotificationTargetType.ARTICLE,
        articleSlug: 'deep-dive',
        articleExcerpt: 'Deep dive',
      }),
      'article-1',
    );
  });

  it('does not notify for likes on unpublished articles', async () => {
    const {
      listener,
      articlesRepository,
      usersRepository,
      notificationsService,
    } = createListener();
    articlesRepository.findOne.mockResolvedValue({
      id: 'article-1',
      authorId: 'author-1',
      title: 'Draft',
      slug: 'draft',
      isPublished: false,
    });
    usersRepository.findOne.mockResolvedValue({
      id: 'liker-1',
      username: 'grace',
      displayName: 'Grace',
      avatarUrl: null,
    });

    await listener.handleArticleLiked({
      articleId: 'article-1',
      likerId: 'liker-1',
    });

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it('does not notify when the liker is the article author', async () => {
    const {
      listener,
      articlesRepository,
      usersRepository,
      notificationsService,
    } = createListener();
    articlesRepository.findOne.mockResolvedValue({
      id: 'article-1',
      authorId: 'author-1',
      title: 'Deep dive',
      slug: 'deep-dive',
      isPublished: true,
    });
    usersRepository.findOne.mockResolvedValue({
      id: 'author-1',
      username: 'ada',
      displayName: 'Ada',
      avatarUrl: null,
    });

    await listener.handleArticleLiked({
      articleId: 'article-1',
      likerId: 'author-1',
    });

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it('creates an ARTICLE_COMMENTED notification for an article author', async () => {
    const {
      listener,
      commentsRepository,
      articlesRepository,
      usersRepository,
      notificationsService,
    } = createListener();
    commentsRepository.findOne.mockResolvedValue({
      id: 'comment-1',
      content: 'great writeup',
    });
    articlesRepository.findOne.mockResolvedValue({
      id: 'article-1',
      authorId: 'author-1',
      title: 'Deep dive',
      slug: 'deep-dive',
      isPublished: true,
    });
    usersRepository.findOne.mockResolvedValue({
      id: 'commenter-1',
      username: 'grace',
      displayName: 'Grace',
      avatarUrl: null,
    });

    await listener.handleArticleCommented({
      articleId: 'article-1',
      commentId: 'comment-1',
      commenterId: 'commenter-1',
    });

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'author-1',
      NotificationType.ARTICLE_COMMENTED,
      NotificationTargetType.ARTICLE,
      expect.objectContaining({
        type: NotificationType.ARTICLE_COMMENTED,
        targetType: NotificationTargetType.ARTICLE,
        articleSlug: 'deep-dive',
        articleExcerpt: 'Deep dive',
        commentId: 'comment-1',
        commentExcerpt: 'great writeup',
      }),
      'article-1',
    );
  });
});
