import { Controller, Post, Delete, Body, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators';
import { LikeDto } from '../dto';
import { LikesService } from './likes.service';

@ApiTags('Interactions')
@Controller('interactions/likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post()
  like(@CurrentUser() userId: string, @Body() dto: LikeDto) {
    return this.likesService.like(userId, dto.targetId, dto.targetType);
  }

  @Delete()
  unlike(@CurrentUser() userId: string, @Body() dto: LikeDto) {
    return this.likesService.unlike(userId, dto.targetId, dto.targetType);
  }

  @Get('count')
  @Public()
  getLikesCount(@Query() query: LikeDto) {
    return this.likesService.getLikesCount(query.targetId, query.targetType);
  }

  @Get('status')
  isLiked(@CurrentUser() userId: string, @Query() query: LikeDto) {
    return this.likesService.isLiked(userId, query.targetId, query.targetType);
  }
}
