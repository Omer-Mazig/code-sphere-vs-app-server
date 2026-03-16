import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto';
import { NotificationTargetType } from '../notifications.entity';

export class NotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: NotificationTargetType,
    enumName: 'NotificationTargetType',
  })
  @IsOptional()
  @IsEnum(NotificationTargetType)
  targetType?: NotificationTargetType;

  @ApiPropertyOptional({
    description: 'Filter by read state.',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isRead?: boolean;
}
