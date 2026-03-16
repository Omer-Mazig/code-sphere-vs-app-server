import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../common/swagger';
import {
  NotificationTargetType,
  NotificationType,
} from '../notifications.entity';

export class NotificationPayloadDto {
  [key: string]: unknown;
}

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
    type: 'object',
    additionalProperties: true,
  })
  payload!: NotificationPayloadDto;

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
