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
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PROFILE_IMAGE_REF_PATTERN } from '../../media/media-object-url';
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

  @ApiPropertyOptional({
    example: '/api/media/550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
    type: String,
    description:
      'Uploaded media path from POST /media, an https URL, or null to clear.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2048)
  @Matches(PROFILE_IMAGE_REF_PATTERN, {
    message: 'Must be an uploaded image or a valid URL',
  })
  coverImageUrl?: string | null;

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
