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
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto';
import { CurrentUser, Paginated, Public } from '../../common/decorators';
import {
  CommentDeletedResponseDto,
  CommentMentionCandidateResponseDto,
  CommentResponseDto,
  CommentMentionCandidatesQueryDto,
  CreateCommentDto,
  InteractionQueryDto,
  UpdateCommentDto,
} from '../dto';
import { CommentsService } from './comments.service';
import {
  ApiEnvelopeArrayOkResponse,
  ApiEnvelopeCreatedResponse,
  ApiEnvelopeOkResponse,
  ApiEnvelopePaginatedOkResponse,
  ApiStandardErrorResponses,
} from '../../common/swagger';

@ApiTags('Interactions')
@Controller('interactions/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @Public()
  @Paginated()
  @ApiEnvelopePaginatedOkResponse(CommentResponseDto)
  @ApiStandardErrorResponses()
  getComments(
    @Query() query: InteractionQueryDto,
    @CurrentUser() currentUserId: string | undefined,
  ) {
    return this.commentsService.getComments(query, currentUserId);
  }

  // Must be declared before ":id/replies" so "mention-candidates" is not captured
  @Get('mention-candidates')
  @ApiEnvelopeArrayOkResponse(CommentMentionCandidateResponseDto)
  @ApiStandardErrorResponses()
  getCommentMentionCandidates(
    @CurrentUser() currentUserId: string,
    @Query() query: CommentMentionCandidatesQueryDto,
  ) {
    return this.commentsService.getCommentMentionCandidatesForReply(
      currentUserId,
      query.targetId,
      query.targetType,
      query.parentId,
      query.query,
    );
  }

  @Get(':id/replies')
  @Public()
  @Paginated()
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopePaginatedOkResponse(CommentResponseDto)
  @ApiStandardErrorResponses()
  getCommentReplies(
    @Param('id') commentId: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUserId: string | undefined,
  ) {
    return this.commentsService.getCommentReplies(
      commentId,
      query,
      currentUserId,
    );
  }

  @Post()
  @ApiEnvelopeCreatedResponse(CommentResponseDto)
  @ApiStandardErrorResponses()
  addComment(
    @CurrentUser() currentUserId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.addComment(currentUserId, dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(CommentResponseDto)
  @ApiStandardErrorResponses()
  updateComment(
    @Param('id') id: string,
    @CurrentUser() currentUserId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.updateComment(id, currentUserId, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(CommentDeletedResponseDto)
  @ApiStandardErrorResponses()
  deleteComment(@Param('id') id: string, @CurrentUser() currentUserId: string) {
    return this.commentsService.deleteComment(id, currentUserId);
  }
}
