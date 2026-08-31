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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_TOPICS_PER_ITEM } from '../../topics/topics.constants';

export class CreateArticleDto {
  @ApiProperty({ example: 'Understanding TypeScript Generics' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    example: [{ type: 'paragraph', content: 'This is the article body...' }],
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  @IsArray()
  content: Record<string, unknown>[];

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

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
