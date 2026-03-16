import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../interactions/entities/comment.entity';
import { Post } from '../posts/entities/post.entity';
import { User } from '../users/entities/user.entity';
import {
  CommentRepliedEvent,
  NotificationDomainEventName,
  PostCommentedEvent,
  PostLikedEvent,
  UserFollowedEvent,
} from './events/notification-domain-events';
import { NotificationType } from './notifications.entity';
import { NotificationsService } from './notifications.service';

const MAX_EXCERPT_LENGTH = 80;

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
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
      {
        type: NotificationType.POST_LIKED,
        actorId: actor.id,
        actorName: actor.displayName ?? actor.username,
        actorAvatarUrl: actor.avatarUrl,
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
      {
        type: NotificationType.POST_COMMENTED,
        actorId: actor.id,
        actorName: actor.displayName ?? actor.username,
        actorAvatarUrl: actor.avatarUrl,
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

    await this.notificationsService.createNotification(
      parentComment.authorId,
      NotificationType.COMMENT_REPLIED,
      {
        type: NotificationType.COMMENT_REPLIED,
        actorId: actor.id,
        actorName: actor.displayName ?? actor.username,
        actorAvatarUrl: actor.avatarUrl,
        targetType: parentComment.targetType,
        targetId: parentComment.targetId,
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
      {
        type: NotificationType.NEW_FOLLOWER,
        actorId: actor.id,
        actorName: actor.displayName ?? actor.username,
        actorAvatarUrl: actor.avatarUrl,
        createdAt: new Date().toISOString(),
      },
    );
  }

  private toExcerpt(value: string) {
    if (value.length <= MAX_EXCERPT_LENGTH) {
      return value;
    }

    return `${value.slice(0, MAX_EXCERPT_LENGTH - 1)}…`;
  }
}
