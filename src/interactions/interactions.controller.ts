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
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { LikeDto } from './dto/like.dto';
import { InteractionQueryDto } from './dto/interaction-query.dto';
import { CommentMentionCandidatesQueryDto } from './dto/comment-mention-candidates-query.dto';
import { PaginationQueryDto } from '../common/dto';
import { Public, CurrentUser, Paginated } from '../common/decorators';
import { InteractionsService } from './interactions.service';

@ApiTags('Interactions')
@Controller('interactions')
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  // --- Likes ---

  @Post('likes')
  like(@CurrentUser() userId: string, @Body() dto: LikeDto) {
    return this.interactionsService.like(userId, dto.targetId, dto.targetType);
  }

  @Delete('likes')
  unlike(@CurrentUser() userId: string, @Body() dto: LikeDto) {
    return this.interactionsService.unlike(
      userId,
      dto.targetId,
      dto.targetType,
    );
  }

  @Get('likes/count')
  @Public()
  getLikesCount(@Query() query: LikeDto) {
    return this.interactionsService.getLikesCount(
      query.targetId,
      query.targetType,
    );
  }

  @Get('likes/status')
  isLiked(@CurrentUser() userId: string, @Query() query: LikeDto) {
    return this.interactionsService.isLiked(
      userId,
      query.targetId,
      query.targetType,
    );
  }

  // --- Comments ---

  @Get('comments')
  @Public()
  @Paginated()
  getComments(
    @Query() query: InteractionQueryDto,
    @CurrentUser() currentUserId: string,
  ) {
    return this.interactionsService.getComments(query, currentUserId);
  }

  @Get('comments/:id/replies')
  @Public()
  @Paginated()
  getCommentReplies(
    @Param('id') commentId: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUserId: string,
  ) {
    return this.interactionsService.getCommentReplies(
      commentId,
      query,
      currentUserId,
    );
  }

  @Post('comments')
  addComment(@CurrentUser() userId: string, @Body() dto: CreateCommentDto) {
    return this.interactionsService.addComment(userId, dto);
  }

  @Get('comments/mention-candidates')
  @Public()
  getCommentMentionCandidates(
    @Query() query: CommentMentionCandidatesQueryDto,
  ) {
    return this.interactionsService.getCommentMentionCandidatesForReply(
      query.targetId,
      query.parentId,
      query.query,
    );
  }

  @Patch('comments/:id')
  updateComment(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.interactionsService.updateComment(id, userId, dto);
  }

  @Delete('comments/:id')
  deleteComment(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.interactionsService.deleteComment(id, userId);
  }

  // --- Shares ---

  @Post('shares')
  share(@CurrentUser() userId: string, @Body() dto: LikeDto) {
    return this.interactionsService.share(userId, dto.targetId, dto.targetType);
  }

  @Get('shares/count')
  @Public()
  getSharesCount(@Query() query: LikeDto) {
    return this.interactionsService.getSharesCount(
      query.targetId,
      query.targetType,
    );
  }
}
