import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationTargetType,
  NotificationType,
} from '../notifications.entity';

export class PostLikedNotificationPayloadDto {
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

export class PostCommentedNotificationPayloadDto {
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

export class NewFollowerNotificationPayloadDto {
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

export type NotificationPayload =
  | PostLikedNotificationPayloadDto
  | PostCommentedNotificationPayloadDto
  | CommentRepliedNotificationPayloadDto
  | NewFollowerNotificationPayloadDto;
