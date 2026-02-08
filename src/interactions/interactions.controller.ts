import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InteractionsService } from './interactions.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { LikeDto } from './dto/like.dto';
import { InteractionQueryDto } from './dto/interaction-query.dto';
import { Permissions, CurrentUser } from '../common/decorators';
import { RoleType } from '../common/types';

@ApiTags('Interactions')
@Controller('interactions')
export class InteractionsController {
  constructor(
    private readonly interactionsService: InteractionsService,
  ) {}

  // --- Likes ---

  @Post('likes')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  like(
    @CurrentUser() userId: string,
    @Body() dto: LikeDto,
  ) {
    return this.interactionsService.like(userId, dto.targetId, dto.targetType);
  }

  @Delete('likes')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  unlike(
    @CurrentUser() userId: string,
    @Body() dto: LikeDto,
  ) {
    return this.interactionsService.unlike(
      userId,
      dto.targetId,
      dto.targetType,
    );
  }

  @Get('likes/count')
  @Permissions(RoleType.PUBLIC)
  getLikesCount(@Query() query: LikeDto) {
    return this.interactionsService.getLikesCount(
      query.targetId,
      query.targetType,
    );
  }

  @Get('likes/status')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  isLiked(
    @CurrentUser() userId: string,
    @Query() query: LikeDto,
  ) {
    return this.interactionsService.isLiked(
      userId,
      query.targetId,
      query.targetType,
    );
  }

  // --- Comments ---

  @Get('comments')
  @Permissions(RoleType.PUBLIC)
  getComments(@Query() query: InteractionQueryDto) {
    return this.interactionsService.getComments(query);
  }

  @Post('comments')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  addComment(
    @CurrentUser() userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.interactionsService.addComment(userId, dto);
  }

  @Patch('comments/:id')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  updateComment(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.interactionsService.updateComment(id, userId, dto);
  }

  @Delete('comments/:id')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  deleteComment(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    return this.interactionsService.deleteComment(id, userId);
  }

  // --- Shares ---

  @Post('shares')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  share(
    @CurrentUser() userId: string,
    @Body() dto: LikeDto,
  ) {
    return this.interactionsService.share(
      userId,
      dto.targetId,
      dto.targetType,
    );
  }

  @Get('shares/count')
  @Permissions(RoleType.PUBLIC)
  getSharesCount(@Query() query: LikeDto) {
    return this.interactionsService.getSharesCount(
      query.targetId,
      query.targetType,
    );
  }
}
