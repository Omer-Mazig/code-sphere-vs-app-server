import { TargetType } from '../../interactions/entities/like.entity';

export enum NotificationDomainEventName {
  POST_LIKED = 'notification.post_liked',
  POST_COMMENTED = 'notification.post_commented',
  COMMENT_REPLIED = 'notification.comment_replied',
  USER_FOLLOWED = 'notification.user_followed',
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
