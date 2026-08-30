import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class NotificationPreferencesResponseDto {
  @ApiProperty({ example: true })
  mentions!: boolean;

  @ApiProperty({ example: true })
  comments!: boolean;

  @ApiProperty({ example: true })
  likes!: boolean;

  @ApiProperty({ example: true })
  newFollowers!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  mentions?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  comments?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  likes?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  newFollowers?: boolean;
}
