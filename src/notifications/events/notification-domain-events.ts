import { TargetType } from '../../interactions/entities/like.entity';
import { NotificationTargetType } from '../entities/notification.entity';

export enum NotificationDomainEventName {
  POST_LIKED = 'notification.post_liked',
  POST_COMMENTED = 'notification.post_commented',
  ARTICLE_LIKED = 'notification.article_liked',
  ARTICLE_COMMENTED = 'notification.article_commented',
  COMMENT_REPLIED = 'notification.comment_replied',
  USER_FOLLOWED = 'notification.user_followed',
  USER_MENTIONED = 'notification.user_mentioned',
}

export type PostLikedEvent = {
  postId: string;
  likerId: string;
};

export type PostCommentedEvent = {
  postId: string;
  commentId: string;
  commenterId: string;
};

export type ArticleLikedEvent = {
  articleId: string;
  likerId: string;
};

export type ArticleCommentedEvent = {
  articleId: string;
  commentId: string;
  commenterId: string;
};

export type CommentRepliedEvent = {
  targetId: string;
  targetType: TargetType.POST | TargetType.ARTICLE;
  parentCommentId: string;
  replyCommentId: string;
  replierId: string;
};

export type UserFollowedEvent = {
  followerId: string;
  followeeId: string;
};

export type UserMentionedEvent = {
  actorId: string;
  usernames: string[];
  targetType: NotificationTargetType.POST | NotificationTargetType.ARTICLE;
  postId?: string;
  articleSlug?: string;
  commentId?: string;
  excerpt: string;
};
