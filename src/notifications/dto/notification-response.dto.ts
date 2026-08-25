import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { MessageResponseDto } from '../../common/swagger';
import {
  NotificationTargetType,
  NotificationType,
} from '../notifications.entity';
import {
  CommentRepliedNotificationPayloadDto,
  NewFollowerNotificationPayloadDto,
  NotificationPayload,
  PostCommentedNotificationPayloadDto,
  PostLikedNotificationPayloadDto,
} from './notification-payload.dto';

@ApiExtraModels(
  PostLikedNotificationPayloadDto,
  PostCommentedNotificationPayloadDto,
  CommentRepliedNotificationPayloadDto,
  NewFollowerNotificationPayloadDto,
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
      { $ref: getSchemaPath(CommentRepliedNotificationPayloadDto) },
      { $ref: getSchemaPath(NewFollowerNotificationPayloadDto) },
    ],
    discriminator: {
      propertyName: 'type',
      mapping: {
        POST_LIKED: getSchemaPath(PostLikedNotificationPayloadDto),
        POST_COMMENTED: getSchemaPath(PostCommentedNotificationPayloadDto),
        COMMENT_REPLIED: getSchemaPath(CommentRepliedNotificationPayloadDto),
        NEW_FOLLOWER: getSchemaPath(NewFollowerNotificationPayloadDto),
      },
    },
  })
  payload!: NotificationPayload;

  @ApiProperty()
  isRead!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: string | null;
}

export class UnreadCountResponseDto {
  @ApiProperty()
  count!: number;
}

export class MarkAllReadResponseDto extends MessageResponseDto {}
