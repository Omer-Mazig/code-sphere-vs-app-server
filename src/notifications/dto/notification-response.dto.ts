import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { MessageResponseDto } from '../../common/swagger';
import {
  NotificationTargetType,
  NotificationType,
} from '../entities/notification.entity';
import {
  ArticleCommentedNotificationPayloadDto,
  ArticleLikedNotificationPayloadDto,
  CommentRepliedNotificationPayloadDto,
  NewFollowerNotificationPayloadDto,
  NotificationPayload,
  PostCommentedNotificationPayloadDto,
  PostLikedNotificationPayloadDto,
  UserMentionedNotificationPayloadDto,
} from './notification-payload.dto';

@ApiExtraModels(
  PostLikedNotificationPayloadDto,
  PostCommentedNotificationPayloadDto,
  ArticleLikedNotificationPayloadDto,
  ArticleCommentedNotificationPayloadDto,
  CommentRepliedNotificationPayloadDto,
  NewFollowerNotificationPayloadDto,
  UserMentionedNotificationPayloadDto,
)
export class NotificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type!: NotificationType;

  @ApiProperty({
    enum: NotificationTargetType,
    enumName: 'NotificationTargetType',
    nullable: true,
  })
  targetType!: NotificationTargetType | null;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(PostLikedNotificationPayloadDto) },
      { $ref: getSchemaPath(PostCommentedNotificationPayloadDto) },
      { $ref: getSchemaPath(ArticleLikedNotificationPayloadDto) },
      { $ref: getSchemaPath(ArticleCommentedNotificationPayloadDto) },
      { $ref: getSchemaPath(CommentRepliedNotificationPayloadDto) },
      { $ref: getSchemaPath(NewFollowerNotificationPayloadDto) },
      { $ref: getSchemaPath(UserMentionedNotificationPayloadDto) },
    ],
    discriminator: {
      propertyName: 'type',
      mapping: {
        POST_LIKED: getSchemaPath(PostLikedNotificationPayloadDto),
        POST_COMMENTED: getSchemaPath(PostCommentedNotificationPayloadDto),
        ARTICLE_LIKED: getSchemaPath(ArticleLikedNotificationPayloadDto),
        ARTICLE_COMMENTED: getSchemaPath(ArticleCommentedNotificationPayloadDto),
        COMMENT_REPLIED: getSchemaPath(CommentRepliedNotificationPayloadDto),
        NEW_FOLLOWER: getSchemaPath(NewFollowerNotificationPayloadDto),
        USER_MENTIONED: getSchemaPath(UserMentionedNotificationPayloadDto),
      },
    },
  })
  payload!: NotificationPayload;

  @ApiProperty()
  isRead!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: string | null;
}

export class UnreadCountResponseDto {
  @ApiProperty()
  count!: number;
}

export class MarkAllReadResponseDto extends MessageResponseDto {}
