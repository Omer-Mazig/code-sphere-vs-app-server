import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TargetType } from '../entities/like.entity';

export class CommentMentionCandidatesQueryDto {
  @ApiProperty({ example: 'uuid-of-post' })
  @IsString()
  targetId: string;

  @ApiProperty({ enum: TargetType, example: TargetType.POST })
  @IsEnum(TargetType)
  targetType: TargetType;

  @ApiPropertyOptional({ example: 'uuid-of-parent-comment' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: 'ali' })
  @IsOptional()
  @IsString()
  query?: string;
}
