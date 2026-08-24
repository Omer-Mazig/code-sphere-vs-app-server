import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageResponseDto } from '../../common/swagger';

export class UserProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({
    description: 'Present only on GET /users/me. Omitted from public profiles.',
  })
  email?: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  bio!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ type: String, nullable: true })
  website!: string | null;

  @ApiProperty({ type: String, nullable: true })
  github!: string | null;

  @ApiProperty({ type: String, nullable: true })
  location!: string | null;

  @ApiProperty()
  followersCount!: number;

  @ApiProperty()
  followingCount!: number;

  @ApiProperty()
  postsCount!: number;

  @ApiProperty()
  articlesCount!: number;

  @ApiProperty()
  isFollowing!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class FollowUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ type: String, nullable: true })
  bio!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  followedAt!: string;
}

export class SuggestedUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ type: String, nullable: true })
  bio!: string | null;

  @ApiProperty()
  followersCount!: number;
}

export class FollowActionResponseDto extends MessageResponseDto {}
