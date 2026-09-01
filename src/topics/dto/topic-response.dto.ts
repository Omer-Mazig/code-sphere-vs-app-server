import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../common/swagger';

export class TopicPreviewResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;
}

export class TopicResponseDto extends TopicPreviewResponseDto {
  @ApiProperty()
  description!: string;

  @ApiProperty()
  isFollowed!: boolean;
}

export class TopicDetailResponseDto extends TopicResponseDto {
  @ApiProperty()
  postCount!: number;

  @ApiProperty()
  articleCount!: number;

  @ApiProperty()
  followerCount!: number;
}

export class TopicFollowActionResponseDto extends MessageResponseDto {}
