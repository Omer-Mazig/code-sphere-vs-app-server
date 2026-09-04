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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_TOPICS_PER_ITEM } from '../../topics/topics.constants';
import { MAX_POST_IMAGES, PostImageLayout } from '../posts.constants';

export class UpdatePostDto {
  @ApiProperty({ example: 'Updated post content' })
  @IsString()
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({
    type: [String],
    description: `Replace images when sent (max ${MAX_POST_IMAGES}). Empty array clears.`,
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
  })
  @IsOptional()
  @IsEnum(PostImageLayout)
  imageLayout?: PostImageLayout;

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
