import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationTargetType,
  NotificationType,
} from '../entities/notification.entity';

class CollapsedActorsDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Up to the last 3 unique actor ids, most recent first',
  })
  actorIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Display names aligned with actorIds',
  })
  actorNames?: string[];

  @ApiPropertyOptional({
    example: 10,
    description: 'Unique actor count for this unread collapsed row',
  })
  actorCount?: number;
}

export class PostLikedNotificationPayloadDto extends CollapsedActorsDto {
  @ApiProperty({ enum: [NotificationType.POST_LIKED] })
  type!: NotificationType.POST_LIKED;

  @ApiProperty()
  actorId!: string;

  @ApiProperty()
  actorName!: string;

  @ApiProperty({ type: String, nullable: true })
  actorAvatarUrl!: string | null;

  @ApiProperty({ enum: [NotificationTargetType.POST] })
  targetType!: NotificationTargetType.POST;

  @ApiProperty()
  postId!: string;

  @ApiProperty()
  postExcerpt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class PostCommentedNotificationPayloadDto extends CollapsedActorsDto {
  @ApiProperty({ enum: [NotificationType.POST_COMMENTED] })
  type!: NotificationType.POST_COMMENTED;

  @ApiProperty()
  actorId!: string;

  @ApiProperty()
  actorName!: string;

  @ApiProperty({ type: String, nullable: true })
  actorAvatarUrl!: string | null;

  @ApiProperty({ enum: [NotificationTargetType.POST] })
  targetType!: NotificationTargetType.POST;

  @ApiProperty()
  postId!: string;

  @ApiProperty()
  postExcerpt!: string;

  @ApiProperty()
  commentId!: string;

  @ApiProperty()
  commentExcerpt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class ArticleLikedNotificationPayloadDto extends CollapsedActorsDto {
  @ApiProperty({ enum: [NotificationType.ARTICLE_LIKED] })
  type!: NotificationType.ARTICLE_LIKED;

  @ApiProperty()
  actorId!: string;

  @ApiProperty()
  actorName!: string;

  @ApiProperty({ type: String, nullable: true })
  actorAvatarUrl!: string | null;

  @ApiProperty({ enum: [NotificationTargetType.ARTICLE] })
  targetType!: NotificationTargetType.ARTICLE;

  @ApiProperty()
  articleSlug!: string;

  @ApiProperty()
  articleExcerpt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class ArticleCommentedNotificationPayloadDto extends CollapsedActorsDto {
  @ApiProperty({ enum: [NotificationType.ARTICLE_COMMENTED] })
  type!: NotificationType.ARTICLE_COMMENTED;

  @ApiProperty()
  actorId!: string;

  @ApiProperty()
  actorName!: string;

  @ApiProperty({ type: String, nullable: true })
  actorAvatarUrl!: string | null;

  @ApiProperty({ enum: [NotificationTargetType.ARTICLE] })
  targetType!: NotificationTargetType.ARTICLE;

  @ApiProperty()
  articleSlug!: string;

  @ApiProperty()
  articleExcerpt!: string;

  @ApiProperty()
  commentId!: string;

  @ApiProperty()
  commentExcerpt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class CommentRepliedNotificationPayloadDto {
  @ApiProperty({ enum: [NotificationType.COMMENT_REPLIED] })
  type!: NotificationType.COMMENT_REPLIED;

  @ApiProperty()
  actorId!: string;

  @ApiProperty()
  actorName!: string;

  @ApiProperty({ type: String, nullable: true })
  actorAvatarUrl!: string | null;

  @ApiProperty({
    enum: [NotificationTargetType.POST, NotificationTargetType.ARTICLE],
  })
  targetType!: NotificationTargetType.POST | NotificationTargetType.ARTICLE;

  @ApiProperty()
  targetId!: string;

  @ApiPropertyOptional()
  articleSlug?: string;

  @ApiProperty()
  parentCommentId!: string;

  @ApiProperty()
  replyCommentId!: string;

  @ApiProperty()
  replyExcerpt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class NewFollowerNotificationPayloadDto extends CollapsedActorsDto {
  @ApiProperty({ enum: [NotificationType.NEW_FOLLOWER] })
  type!: NotificationType.NEW_FOLLOWER;

  @ApiProperty()
  actorId!: string;

  @ApiProperty()
  actorName!: string;

  @ApiProperty({ type: String, nullable: true })
  actorAvatarUrl!: string | null;

  @ApiProperty({ enum: [NotificationTargetType.USER] })
  targetType!: NotificationTargetType.USER;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class UserMentionedNotificationPayloadDto {
  @ApiProperty({ enum: [NotificationType.USER_MENTIONED] })
  type!: NotificationType.USER_MENTIONED;

  @ApiProperty()
  actorId!: string;

  @ApiProperty()
  actorName!: string;

  @ApiProperty({ type: String, nullable: true })
  actorAvatarUrl!: string | null;

  @ApiProperty({
    enum: [NotificationTargetType.POST, NotificationTargetType.ARTICLE],
  })
  targetType!: NotificationTargetType.POST | NotificationTargetType.ARTICLE;

  @ApiPropertyOptional()
  postId?: string;

  @ApiPropertyOptional()
  articleSlug?: string;

  @ApiPropertyOptional()
  commentId?: string;

  @ApiProperty()
  excerpt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export type NotificationPayload =
  | PostLikedNotificationPayloadDto
  | PostCommentedNotificationPayloadDto
  | ArticleLikedNotificationPayloadDto
  | ArticleCommentedNotificationPayloadDto
  | CommentRepliedNotificationPayloadDto
  | NewFollowerNotificationPayloadDto
  | UserMentionedNotificationPayloadDto;
