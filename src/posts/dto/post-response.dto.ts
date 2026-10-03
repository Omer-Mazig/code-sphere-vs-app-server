import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../common/swagger';
import { TopicPreviewResponseDto } from '../../topics/dto';
import { PostImageLayout } from '../posts.constants';

export class PostAuthorResponseDto {
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

export class PostImageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '/api/media/550e8400-e29b-41d4-a716-446655440000' })
  url!: string;
}

export class SharedPostPreviewResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ type: PostAuthorResponseDto, nullable: true })
  author!: PostAuthorResponseDto | null;

  @ApiProperty({ type: [PostImageResponseDto] })
  images!: PostImageResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class PostResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  isPublished!: boolean;

  @ApiProperty({ type: PostAuthorResponseDto, nullable: true })
  author!: PostAuthorResponseDto | null;

  @ApiProperty({ type: [TopicPreviewResponseDto] })
  topics!: TopicPreviewResponseDto[];

  @ApiProperty({ type: [PostImageResponseDto] })
  images!: PostImageResponseDto[];

  @ApiProperty({ enum: PostImageLayout, enumName: 'PostImageLayout' })
  imageLayout!: PostImageLayout;

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
