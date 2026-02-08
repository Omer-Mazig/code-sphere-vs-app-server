import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TargetType } from '../entities/like.entity';

export class LikeDto {
  @ApiProperty({ example: 'uuid-of-post-or-article' })
  @IsString()
  targetId: string;

  @ApiProperty({ enum: TargetType })
  @IsEnum(TargetType)
  targetType: TargetType;
}
