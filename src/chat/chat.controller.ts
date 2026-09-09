import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
} from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import {
  ChatMessageResponseDto,
  ChatUnreadCountResponseDto,
  ConversationDeletedResponseDto,
  ConversationReadResponseDto,
  ConversationResponseDto,
  CreateChatMessageDto,
  CreateConversationDto,
} from './dto';
import { PaginationQueryDto } from '../common/dto';
import { CurrentUser, Paginated } from '../common/decorators';
import {
  ApiEnvelopeCreatedResponse,
  ApiEnvelopeOkResponse,
  ApiEnvelopePaginatedOkResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @Paginated()
  @ApiEnvelopePaginatedOkResponse(ConversationResponseDto)
  @ApiStandardErrorResponses()
  listConversations(
    @Query() query: PaginationQueryDto,
    @CurrentUser() userId: string,
  ) {
    return this.chatService.listConversations(userId, query);
  }

  @Get('conversations/unread-count')
  @ApiEnvelopeOkResponse(ChatUnreadCountResponseDto)
  @ApiStandardErrorResponses()
  getUnreadCount(@CurrentUser() userId: string) {
    return this.chatService.getUnreadCount(userId);
  }

  @Post('conversations')
  @HttpCode(200)
  @ApiEnvelopeOkResponse(ConversationResponseDto)
  @ApiStandardErrorResponses()
  createOrGet(
    @CurrentUser() userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.chatService.createOrGetConversation(userId, dto);
  }

  @Get('conversations/:id')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(ConversationResponseDto)
  @ApiStandardErrorResponses()
  getConversation(
    @Param('id') conversationId: string,
    @CurrentUser() userId: string,
  ) {
    return this.chatService.getConversation(conversationId, userId);
  }

  @Get('conversations/:id/messages')
  @Paginated()
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopePaginatedOkResponse(ChatMessageResponseDto)
  @ApiStandardErrorResponses()
  listMessages(
    @Param('id') conversationId: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() userId: string,
  ) {
    return this.chatService.listMessages(conversationId, userId, query);
  }

  @Post('conversations/:id/messages')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeCreatedResponse(ChatMessageResponseDto)
  @ApiStandardErrorResponses()
  sendMessage(
    @Param('id') conversationId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateChatMessageDto,
  ) {
    return this.chatService.sendMessage(conversationId, userId, dto);
  }

  @Patch('conversations/:id/read')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(ConversationReadResponseDto)
  @ApiStandardErrorResponses()
  markRead(
    @Param('id') conversationId: string,
    @CurrentUser() userId: string,
  ) {
    return this.chatService.markRead(conversationId, userId);
  }

  @Delete('conversations/:id')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(ConversationDeletedResponseDto)
  @ApiStandardErrorResponses()
  deleteConversation(
    @Param('id') conversationId: string,
    @CurrentUser() userId: string,
  ) {
    return this.chatService.deleteConversation(conversationId, userId);
  }
}
