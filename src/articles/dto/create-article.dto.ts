import {
  IsString,
  MinLength,
  MaxLength,
  IsArray,
  IsOptional,
  IsBoolean,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateArticleDto {
  @ApiProperty({ example: 'Understanding TypeScript Generics' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    example: [
      { type: 'paragraph', content: 'This is the article body...' },
    ],
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
}
