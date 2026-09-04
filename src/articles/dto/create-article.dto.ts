import {
  IsString,
  MinLength,
  MaxLength,
  IsArray,
  IsOptional,
  IsBoolean,
  IsUUID,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PROFILE_IMAGE_REF_PATTERN } from '../../media/media-object-url';
import { MAX_TOPICS_PER_ITEM } from '../../topics/topics.constants';

export const ARTICLE_CONTENT_MAX_LENGTH = 100_000;

export class CreateArticleDto {
  @ApiProperty({ example: 'Understanding TypeScript Generics' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    example:
      '## Why Generics?\n\nThey let you write reusable, type-safe code.\n\n```ts\nfunction identity<T>(value: T): T {\n  return value;\n}\n```',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(ARTICLE_CONTENT_MAX_LENGTH)
  content: string;

  @ApiPropertyOptional({
    example: '/api/media/550e8400-e29b-41d4-a716-446655440000',
    description:
      'Uploaded media path from POST /media, or an https URL (seed/legacy).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(PROFILE_IMAGE_REF_PATTERN, {
    message: 'Must be an uploaded image or a valid URL',
  })
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
