import { IsString, MaxLength, IsOptional, IsUUID, IsArray, ArrayMaxSize } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_TOPICS_PER_ITEM } from '../../topics/topics.constants';

export class CreatePostDto {
  @ApiPropertyOptional({ example: 'Just shipped a new feature!' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({
    description: 'Original post to reshare. Commentary may be empty.',
  })
  @IsOptional()
  @IsUUID()
  sharedPostId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: `Curated topic ids (max ${MAX_TOPICS_PER_ITEM})`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TOPICS_PER_ITEM)
  @IsUUID('4', { each: true })
  topicIds?: string[];
}
