import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../common/swagger';
import { TargetType } from '../entities/like.entity';

export class CommentAuthorResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;
}

export class CommentMentionCandidateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;
}

export class CommentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  targetId!: string;

  @ApiProperty({ enum: TargetType, enumName: 'TargetType' })
  targetType!: TargetType;

  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;

  @ApiProperty({ type: CommentAuthorResponseDto, nullable: true })
  author!: CommentAuthorResponseDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty()
  likesCount!: number;

  @ApiProperty()
  isLiked!: boolean;

  @ApiProperty()
  repliesCount!: number;

  @ApiProperty({ type: [CommentMentionCandidateResponseDto] })
  mentionedUsers!: CommentMentionCandidateResponseDto[];
}

export class CountResponseDto {
  @ApiProperty()
  count!: number;
}

export class IsLikedResponseDto {
  @ApiProperty()
  isLiked!: boolean;
}

export class LikeActionResponseDto extends MessageResponseDto {}

export class ShareActionResponseDto extends MessageResponseDto {}

export class CommentDeletedResponseDto extends MessageResponseDto {}
