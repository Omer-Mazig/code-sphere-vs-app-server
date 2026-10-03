import { Controller, Post, Delete, Body, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators';
import {
  CountResponseDto,
  IsLikedResponseDto,
  LikeActionResponseDto,
  LikeDto,
} from '../dto';
import { LikesService } from './likes.service';
import {
  ApiEnvelopeCreatedResponse,
  ApiEnvelopeOkResponse,
  ApiStandardErrorResponses,
} from '../../common/swagger';

@ApiTags('Interactions')
@Controller('interactions/likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post()
  @ApiEnvelopeCreatedResponse(LikeActionResponseDto)
  @ApiStandardErrorResponses()
  like(@CurrentUser() currentUserId: string, @Body() dto: LikeDto) {
    return this.likesService.like(currentUserId, dto.targetId, dto.targetType);
  }

  @Delete()
  @ApiEnvelopeOkResponse(LikeActionResponseDto)
  @ApiStandardErrorResponses()
  unlike(@CurrentUser() currentUserId: string, @Body() dto: LikeDto) {
    return this.likesService.unlike(
      currentUserId,
      dto.targetId,
      dto.targetType,
    );
  }

  @Get('count')
  @Public()
  @ApiEnvelopeOkResponse(CountResponseDto)
  @ApiStandardErrorResponses()
  getLikesCount(@Query() query: LikeDto) {
    return this.likesService.getLikesCount(query.targetId, query.targetType);
  }

  @Get('status')
  @ApiEnvelopeOkResponse(IsLikedResponseDto)
  @ApiStandardErrorResponses()
  isLiked(@CurrentUser() currentUserId: string, @Query() query: LikeDto) {
    return this.likesService.isLiked(
      currentUserId,
      query.targetId,
      query.targetType,
    );
  }
}
