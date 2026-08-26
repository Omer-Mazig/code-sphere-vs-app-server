import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../common/swagger';

export class ArticleAuthorResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty()
  isFollowing!: boolean;
}

export class ArticleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  content!: Record<string, unknown>[];

  @ApiProperty({ type: String, nullable: true })
  coverImageUrl!: string | null;

  @ApiProperty()
  isPublished!: boolean;

  @ApiProperty({ type: ArticleAuthorResponseDto, nullable: true })
  author!: ArticleAuthorResponseDto | null;

  @ApiProperty()
  likesCount!: number;

  @ApiProperty()
  commentsCount!: number;

  @ApiProperty()
  isLiked!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class ArticleDeletedResponseDto extends MessageResponseDto {}
