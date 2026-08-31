import { IsString, MinLength, MaxLength, IsOptional, IsUUID, IsArray, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_TOPICS_PER_ITEM } from '../../topics/topics.constants';

export class UpdatePostDto {
  @ApiProperty({ example: 'Updated post content' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

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
