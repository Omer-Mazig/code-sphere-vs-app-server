import {
  IsString,
  MinLength,
  MaxLength,
  IsArray,
  IsOptional,
  IsBoolean,
  IsUrl,
  IsUUID,
  ArrayMaxSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_TOPICS_PER_ITEM } from '../../topics/topics.constants';
import { ARTICLE_CONTENT_MAX_LENGTH } from './create-article.dto';

export class UpdateArticleDto {
  @ApiPropertyOptional({ example: 'Updated Title' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    example: '## Updated heading\n\nUpdated markdown body.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(ARTICLE_CONTENT_MAX_LENGTH)
  content?: string;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: `Replace topics when sent (max ${MAX_TOPICS_PER_ITEM}). Empty array clears.`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TOPICS_PER_ITEM)
  @IsUUID('4', { each: true })
  topicIds?: string[];
}
