import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../common/swagger';
import { SavedTargetType } from '../entities/saved-item.entity';

export class SavedAuthorPreviewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;
}

export class SavedPostPreviewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ type: SavedAuthorPreviewDto, nullable: true })
  author!: SavedAuthorPreviewDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class SavedArticlePreviewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ type: SavedAuthorPreviewDto, nullable: true })
  author!: SavedAuthorPreviewDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class SavedItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: SavedTargetType, enumName: 'SavedTargetType' })
  targetType!: SavedTargetType;

  @ApiProperty({ format: 'uuid' })
  targetId!: string;

  @ApiProperty({ type: SavedPostPreviewDto, nullable: true })
  post!: SavedPostPreviewDto | null;

  @ApiProperty({ type: SavedArticlePreviewDto, nullable: true })
  article!: SavedArticlePreviewDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class SavedActionResponseDto extends MessageResponseDto {}
