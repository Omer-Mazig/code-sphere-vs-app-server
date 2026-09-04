import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_TOPICS_PER_ITEM } from '../../topics/topics.constants';
import { MAX_POST_IMAGES, PostImageLayout } from '../posts.constants';

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
    description: `Ordered MEDIA-001 object ids (max ${MAX_POST_IMAGES})`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POST_IMAGES)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  imageMediaIds?: string[];

  @ApiPropertyOptional({
    enum: PostImageLayout,
    enumName: 'PostImageLayout',
    description: 'How attached images are shown. Defaults to GALLERY.',
  })
  @IsOptional()
  @IsEnum(PostImageLayout)
  imageLayout?: PostImageLayout;

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
