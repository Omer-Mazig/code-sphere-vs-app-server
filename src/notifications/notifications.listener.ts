import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '../articles/entities/article.entity';
import { Comment } from '../interactions/entities/comment.entity';
import { TargetType } from '../interactions/entities/like.entity';
import { Post } from '../posts/entities/post.entity';
import { User } from '../users/entities/user.entity';
import {
  CommentRepliedEvent,
  NotificationDomainEventName,
  PostCommentedEvent,
  PostLikedEvent,
  UserFollowedEvent,
  UserMentionedEvent,
} from './events/notification-domain-events';
import {
  NotificationTargetType,
  NotificationType,
} from './entities/notification.entity';
import { NotificationsService } from './notifications.service';

/*
  If these event handlers become hot paths, 
  we might want batching or background jobs.
*/

const MAX_EXCERPT_LENGTH = 80;

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent(NotificationDomainEventName.POST_LIKED)
  async handlePostLiked(event: PostLikedEvent) {
    const [post, actor] = await Promise.all([
      this.postsRepository.findOne({
        where: { id: event.postId },
        select: ['id', 'authorId', 'content'],
      }),
      this.usersRepository.findOne({
        where: { id: event.likerId },
        select: ['id', 'username', 'displayName', 'avatarUrl'],
      }),
    ]);

    if (!post || !actor) {
      this.logger.warn(
        `Skip POST_LIKED notification (post="${event.postId}", actor="${event.likerId}")`,
      );
      return;
    }

    if (post.authorId === actor.id) {
      return;
    }

    await this.notificationsService.createNotification(
      post.authorId,
      NotificationType.POST_LIKED,
      NotificationTargetType.POST,
      {
        type: NotificationType.POST_LIKED,
        actorId: actor.id,
        actorName: actor.displayName ?? actor.username,
        actorAvatarUrl: actor.avatarUrl,
        targetType: NotificationTargetType.POST,
        postId: post.id,
        postExcerpt: this.toExcerpt(post.content),
        createdAt: new Date().toISOString(),
      },
    );
  }

  @OnEvent(NotificationDomainEventName.POST_COMMENTED)
  async handlePostCommented(event: PostCommentedEvent) {
    const [post, comment, actor] = await Promise.all([
      this.postsRepository.findOne({
        where: { id: event.postId },
        select: ['id', 'authorId', 'content'],
      }),
      this.commentsRepository.findOne({
        where: { id: event.commentId },
        select: ['id', 'content'],
      }),
      this.usersRepository.findOne({
        where: { id: event.commenterId },
        select: ['id', 'username', 'displayName', 'avatarUrl'],
      }),
    ]);

    if (!post || !comment || !actor) {
      this.logger.warn(
        `Skip POST_COMMENTED notification (post="${event.postId}", comment="${event.commentId}", actor="${event.commenterId}")`,
      );
      return;
    }

    if (post.authorId === actor.id) {
      return;
    }

    await this.notificationsService.createNotification(
      post.authorId,
      NotificationType.POST_COMMENTED,
      NotificationTargetType.POST,
      {
        type: NotificationType.POST_COMMENTED,
        actorId: actor.id,
        actorName: actor.displayName ?? actor.username,
        actorAvatarUrl: actor.avatarUrl,
        targetType: NotificationTargetType.POST,
        postId: post.id,
        postExcerpt: this.toExcerpt(post.content),
        commentId: comment.id,
        commentExcerpt: this.toExcerpt(comment.content),
        createdAt: new Date().toISOString(),
      },
    );
  }

  @OnEvent(NotificationDomainEventName.COMMENT_REPLIED)
  async handleCommentReplied(event: CommentRepliedEvent) {
    const [parentComment, replyComment, actor] = await Promise.all([
      this.commentsRepository.findOne({
        where: { id: event.parentCommentId },
        select: ['id', 'authorId', 'targetId', 'targetType'],
      }),
      this.commentsRepository.findOne({
        where: { id: event.replyCommentId },
        select: ['id', 'content'],
      }),
      this.usersRepository.findOne({
        where: { id: event.replierId },
        select: ['id', 'username', 'displayName', 'avatarUrl'],
      }),
    ]);

    if (!parentComment || !replyComment || !actor) {
      this.logger.warn(
        `Skip COMMENT_REPLIED notification (parent="${event.parentCommentId}", reply="${event.replyCommentId}", actor="${event.replierId}")`,
      );
      return;
    }

    if (parentComment.authorId === actor.id) {
      return;
    }

    const article =
      parentComment.targetType === TargetType.ARTICLE
        ? await this.articlesRepository.findOne({
            where: { id: parentComment.targetId },
            select: ['id', 'slug'],
          })
        : null;

    await this.notificationsService.createNotification(
      parentComment.authorId,
      NotificationType.COMMENT_REPLIED,
      parentComment.targetType === TargetType.ARTICLE
        ? NotificationTargetType.ARTICLE
        : NotificationTargetType.POST,
      {
        type: NotificationType.COMMENT_REPLIED,
        actorId: actor.id,
        actorName: actor.displayName ?? actor.username,
        actorAvatarUrl: actor.avatarUrl,
        targetType:
          parentComment.targetType === TargetType.ARTICLE
            ? NotificationTargetType.ARTICLE
            : NotificationTargetType.POST,
        targetId: parentComment.targetId,
        articleSlug: article?.slug,
        parentCommentId: parentComment.id,
        replyCommentId: replyComment.id,
        replyExcerpt: this.toExcerpt(replyComment.content),
        createdAt: new Date().toISOString(),
      },
    );
  }

  @OnEvent(NotificationDomainEventName.USER_FOLLOWED)
  async handleUserFollowed(event: UserFollowedEvent) {
    const actor = await this.usersRepository.findOne({
      where: { id: event.followerId },
      select: ['id', 'username', 'displayName', 'avatarUrl'],
    });

    if (!actor) {
      this.logger.warn(
        `Skip USER_FOLLOWED notification (actor="${event.followerId}")`,
      );
      return;
    }

    if (event.followeeId === actor.id) {
      return;
    }

    await this.notificationsService.createNotification(
      event.followeeId,
      NotificationType.NEW_FOLLOWER,
      NotificationTargetType.USER,
      {
        type: NotificationType.NEW_FOLLOWER,
        actorId: actor.id,
        actorName: actor.displayName ?? actor.username,
        actorAvatarUrl: actor.avatarUrl,
        targetType: NotificationTargetType.USER,
        createdAt: new Date().toISOString(),
      },
    );
  }

  @OnEvent(NotificationDomainEventName.USER_MENTIONED)
  async handleUserMentioned(event: UserMentionedEvent) {
    const usernames = Array.from(
      new Set(event.usernames.map((username) => username.toLowerCase())),
    );
    if (usernames.length === 0) {
      return;
    }

    const [actor, mentionedUsers] = await Promise.all([
      this.usersRepository.findOne({
        where: { id: event.actorId },
        select: ['id', 'username', 'displayName', 'avatarUrl'],
      }),
      this.usersRepository
        .createQueryBuilder('user')
        .select(['user.id', 'user.username'])
        .where('LOWER(user.username) IN (:...usernames)', { usernames })
        .getMany(),
    ]);

    if (!actor) {
      this.logger.warn(
        `Skip USER_MENTIONED notification (actor="${event.actorId}")`,
      );
      return;
    }

    const excerpt = this.toExcerpt(event.excerpt);

    for (const mentionedUser of mentionedUsers) {
      if (mentionedUser.id === actor.id) {
        continue;
      }

      await this.notificationsService.createNotification(
        mentionedUser.id,
        NotificationType.USER_MENTIONED,
        event.targetType,
        {
          type: NotificationType.USER_MENTIONED,
          actorId: actor.id,
          actorName: actor.displayName ?? actor.username,
          actorAvatarUrl: actor.avatarUrl,
          targetType: event.targetType,
          postId: event.postId,
          articleSlug: event.articleSlug,
          commentId: event.commentId,
          excerpt,
          createdAt: new Date().toISOString(),
        },
      );
    }
  }

  private toExcerpt(value: string) {
    if (value.length <= MAX_EXCERPT_LENGTH) {
      return value;
    }

    return `${value.slice(0, MAX_EXCERPT_LENGTH - 1)}…`;
  }
}
