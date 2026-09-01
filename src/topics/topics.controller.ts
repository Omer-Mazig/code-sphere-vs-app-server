import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../common/decorators';
import {
  ApiEnvelopeArrayOkResponse,
  ApiEnvelopeOkResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';
import {
  TopicDetailResponseDto,
  TopicFollowActionResponseDto,
  TopicResponseDto,
} from './dto';
import { TopicsService } from './topics.service';

@ApiTags('Topics')
@Controller('topics')
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get()
  @Public()
  @ApiEnvelopeArrayOkResponse(TopicResponseDto)
  @ApiStandardErrorResponses()
  list(@CurrentUser() currentUserId: string | undefined) {
    return this.topicsService.list(currentUserId);
  }

  @Get(':slug')
  @Public()
  @ApiParam({ name: 'slug', type: String })
  @ApiEnvelopeOkResponse(TopicDetailResponseDto)
  @ApiStandardErrorResponses()
  getBySlug(
    @Param('slug') slug: string,
    @CurrentUser() currentUserId: string | undefined,
  ) {
    return this.topicsService.getBySlug(slug, currentUserId);
  }

  @Post(':id/follow')
  @HttpCode(200)
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiEnvelopeOkResponse(TopicFollowActionResponseDto)
  @ApiStandardErrorResponses()
  follow(
    @CurrentUser() userId: string,
    @Param('id') topicId: string,
  ) {
    return this.topicsService.follow(userId, topicId);
  }

  @Delete(':id/follow')
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiEnvelopeOkResponse(TopicFollowActionResponseDto)
  @ApiStandardErrorResponses()
  unfollow(
    @CurrentUser() userId: string,
    @Param('id') topicId: string,
  ) {
    return this.topicsService.unfollow(userId, topicId);
  }
}
