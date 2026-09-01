import { IsOptional, IsString, IsBoolean, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto';

export class ArticleQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'When set, only articles by this author',
  })
  @IsOptional()
  @IsUUID()
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive match on title or markdown body',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    description: 'When set, only articles tagged with this curated topic',
  })
  @IsOptional()
  @IsUUID()
  topicId?: string;
}
