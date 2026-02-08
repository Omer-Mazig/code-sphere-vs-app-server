import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TargetType } from '../entities/like.entity';
import { PaginationQueryDto } from '../../common/dto';

export class InteractionQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: 'uuid-of-post-or-article' })
  @IsString()
  targetId: string;

  @ApiProperty({ enum: TargetType })
  @IsEnum(TargetType)
  targetType: TargetType;
}
