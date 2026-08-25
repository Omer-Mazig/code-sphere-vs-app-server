import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../common/swagger';

export class PostAuthorResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;
}

export class PostCommentPreviewResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: PostAuthorResponseDto, nullable: true })
  author!: PostAuthorResponseDto | null;
}

export class SharedPostPreviewResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ type: PostAuthorResponseDto, nullable: true })
  author!: PostAuthorResponseDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class PostResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ type: PostAuthorResponseDto, nullable: true })
  author!: PostAuthorResponseDto | null;

  @ApiProperty()
  likesCount!: number;

  @ApiProperty()
  isLiked!: boolean;

  @ApiProperty()
  commentsCount!: number;

  @ApiProperty()
  sharesCount!: number;

  @ApiProperty()
  isShared!: boolean;

  @ApiProperty({ type: PostCommentPreviewResponseDto, nullable: true })
  latestComment!: PostCommentPreviewResponseDto | null;

  @ApiProperty({ type: SharedPostPreviewResponseDto, nullable: true })
  sharedPost!: SharedPostPreviewResponseDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PostDeletedResponseDto extends MessageResponseDto {}
