import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CommentMentionCandidatesQueryDto {
  @ApiProperty({ example: 'uuid-of-post' })
  @IsString()
  targetId: string;

  @ApiProperty({ example: 'uuid-of-parent-comment' })
  @IsString()
  parentId: string;

  @ApiPropertyOptional({ example: 'ali' })
  @IsOptional()
  @IsString()
  query?: string;
}
