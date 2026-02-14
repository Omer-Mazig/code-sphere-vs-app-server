import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto';
import { CurrentUser, Paginated, Public } from '../../common/decorators';
import {
  CommentMentionCandidatesQueryDto,
  CreateCommentDto,
  InteractionQueryDto,
  UpdateCommentDto,
} from '../dto';
import { CommentsService } from './comments.service';

@ApiTags('Interactions')
@Controller('interactions/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @Public()
  @Paginated()
  getComments(
    @Query() query: InteractionQueryDto,
    @CurrentUser() currentUserId: string,
  ) {
    return this.commentsService.getComments(query, currentUserId);
  }

  @Get(':id/replies')
  @Public()
  @Paginated()
  getCommentReplies(
    @Param('id') commentId: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUserId: string,
  ) {
    return this.commentsService.getCommentReplies(commentId, query, currentUserId);
  }

  @Post()
  addComment(@CurrentUser() userId: string, @Body() dto: CreateCommentDto) {
    return this.commentsService.addComment(userId, dto);
  }

  @Get('mention-candidates')
  @Public()
  getCommentMentionCandidates(
    @CurrentUser() currentUserId: string,
    @Query() query: CommentMentionCandidatesQueryDto,
  ) {
    return this.commentsService.getCommentMentionCandidatesForReply(
      currentUserId,
      query.targetId,
      query.parentId,
      query.query,
    );
  }

  @Patch(':id')
  updateComment(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.updateComment(id, userId, dto);
  }

  @Delete(':id')
  deleteComment(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.commentsService.deleteComment(id, userId);
  }
}
