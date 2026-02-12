import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CommentMentionCandidatesQueryDto {
  @ApiProperty({ example: 'uuid-of-post' })
  @IsString()
  targetId: string;

  @ApiPropertyOptional({ example: 'uuid-of-parent-comment' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: 'ali' })
  @IsOptional()
  @IsString()
  query?: string;
}
