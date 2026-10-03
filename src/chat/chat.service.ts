import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationParticipant } from './entities/conversation-participant.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { PaginationQueryDto } from '../common/dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { UsersService } from '../users/users.service';
import { BlocksService } from '../users/blocks.service';
import {
  ChatDomainEventName,
  ChatMessageCreatedEvent,
} from './events/chat-domain-events';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantsRepository: Repository<ConversationParticipant>,
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    private readonly usersService: UsersService,
    private readonly blocksService: BlocksService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createOrGetConversation(
    currentUserId: string,
    dto: CreateConversationDto,
  ) {
    if (currentUserId === dto.userId) {
      throw new BusinessException(
        ErrorCode.CANNOT_MESSAGE_SELF,
        `User "${currentUserId}" tried to message themselves`,
        'You cannot message yourself',
        HttpStatus.BAD_REQUEST,
      );
    }

    const other = await this.usersService.findUserOrFail(dto.userId);
    await this.assertCanMessage(currentUserId, other.id);

    const [userLowId, userHighId] = this.sortedPair(currentUserId, other.id);
    const existing = await this.conversationsRepository.findOne({
      where: { userLowId, userHighId },
    });

    if (existing) {
      return this.getConversation(existing.id, currentUserId);
    }

    const conversation = this.conversationsRepository.create({
      userLowId,
      userHighId,
    });
    await this.conversationsRepository.save(conversation);

    await this.participantsRepository.save([
      this.participantsRepository.create({
        conversationId: conversation.id,
        userId: currentUserId,
        lastReadAt: null,
      }),
      this.participantsRepository.create({
        conversationId: conversation.id,
        userId: other.id,
        lastReadAt: null,
      }),
    ]);

    return this.getConversation(conversation.id, currentUserId);
  }

  async listConversations(currentUserId: string, query: PaginationQueryDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [conversations, total] = await this.conversationsRepository
      .createQueryBuilder('conversation')
      .innerJoin('conversation.participants', 'me', 'me.userId = :userId', {
        userId: currentUserId,
      })
      .orderBy('conversation.updatedAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const items = await this.formatConversations(
      conversations.map((row) => row.id),
      currentUserId,
    );

    return { items, total, page, limit };
  }

  async getConversation(conversationId: string, currentUserId: string) {
    await this.requireParticipant(conversationId, currentUserId);
    const [formatted] = await this.formatConversations(
      [conversationId],
      currentUserId,
    );
    if (!formatted) {
      throw new BusinessException(
        ErrorCode.CONVERSATION_NOT_FOUND,
        `Conversation "${conversationId}" not found`,
        'Conversation not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return formatted;
  }

  async listMessages(
    conversationId: string,
    currentUserId: string,
    query: PaginationQueryDto,
  ) {
    await this.requireParticipant(conversationId, currentUserId);
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [messages, total] = await this.messagesRepository.findAndCount({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items: messages.map((message) => this.formatMessage(message)),
      total,
      page,
      limit,
    };
  }

  async sendMessage(
    conversationId: string,
    currentUserId: string,
    dto: CreateChatMessageDto,
  ) {
    const conversation = await this.requireParticipant(
      conversationId,
      currentUserId,
    );
    const recipientId = this.otherUserId(conversation, currentUserId);
    await this.assertCanMessage(currentUserId, recipientId);

    const message = this.messagesRepository.create({
      conversationId,
      senderId: currentUserId,
      body: dto.body,
    });
    await this.messagesRepository.save(message);

    conversation.updatedAt = new Date();
    await this.conversationsRepository.save(conversation);

    await this.participantsRepository.update(
      { conversationId, userId: currentUserId },
      { lastReadAt: message.createdAt },
    );

    const formatted = this.formatMessage(message);
    const event: ChatMessageCreatedEvent = {
      conversationId,
      recipientId,
      message: formatted,
    };
    this.eventEmitter.emit(ChatDomainEventName.MESSAGE_CREATED, event);

    return formatted;
  }

  async markRead(conversationId: string, currentUserId: string) {
    await this.requireParticipant(conversationId, currentUserId);
    await this.participantsRepository.update(
      { conversationId, userId: currentUserId },
      { lastReadAt: new Date() },
    );
    return { message: 'Conversation marked as read' };
  }

  async deleteConversation(conversationId: string, currentUserId: string) {
    await this.requireParticipant(conversationId, currentUserId);
    await this.conversationsRepository.delete({ id: conversationId });
    return { message: 'Conversation deleted' };
  }

  async getUnreadCount(currentUserId: string) {
    const count = await this.unreadConversationCount(currentUserId);
    return { count };
  }

  async assertCanJoinRoom(conversationId: string, currentUserId: string) {
    await this.requireParticipant(conversationId, currentUserId);
  }

  private async assertCanMessage(senderId: string, recipientId: string) {
    const blocked = await this.blocksService.isMessagingBlocked(
      senderId,
      recipientId,
    );
    if (blocked) {
      throw new BusinessException(
        ErrorCode.CHAT_BLOCKED,
        `User "${senderId}" cannot message "${recipientId}" because they are blocked`,
        'You cannot message this user',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async requireParticipant(
    conversationId: string,
    currentUserId: string,
  ) {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new BusinessException(
        ErrorCode.CONVERSATION_NOT_FOUND,
        `Conversation "${conversationId}" not found`,
        'Conversation not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const isParticipant =
      conversation.userLowId === currentUserId ||
      conversation.userHighId === currentUserId;
    if (!isParticipant) {
      throw new BusinessException(
        ErrorCode.CONVERSATION_FORBIDDEN,
        `User "${currentUserId}" is not in conversation "${conversationId}"`,
        'Conversation not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return conversation;
  }

  private otherUserId(conversation: Conversation, currentUserId: string) {
    return conversation.userLowId === currentUserId
      ? conversation.userHighId
      : conversation.userLowId;
  }

  private sortedPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  private formatMessage(message: ChatMessage) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private async formatConversations(ids: string[], currentUserId: string) {
    if (ids.length === 0) {
      return [];
    }

    const conversations = await this.conversationsRepository.find({
      where: { id: In(ids) },
    });
    const byId = new Map(conversations.map((row) => [row.id, row]));

    const participants = await this.participantsRepository.find({
      where: { conversationId: In(ids) },
      relations: ['user'],
    });

    const lastMessages = await this.messagesRepository
      .createQueryBuilder('message')
      .distinctOn(['message.conversationId'])
      .where('message.conversationId IN (:...ids)', { ids })
      .orderBy('message.conversationId')
      .addOrderBy('message.createdAt', 'DESC')
      .getMany();
    const lastByConversation = new Map(
      lastMessages.map((message) => [message.conversationId, message]),
    );

    const unreadRows: Array<{ conversationId: string; count: string }> =
      await this.messagesRepository.query(
        `
        SELECT m."conversationId" AS "conversationId", COUNT(*)::int AS count
        FROM chat_messages m
        INNER JOIN conversation_participants p
          ON p."conversationId" = m."conversationId" AND p."userId" = $1
        WHERE m."conversationId" = ANY($2)
          AND m."senderId" <> $1
          AND (p."lastReadAt" IS NULL OR m."createdAt" > p."lastReadAt")
        GROUP BY m."conversationId"
        `,
        [currentUserId, ids],
      );
    const unreadByConversation = new Map(
      unreadRows.map((row) => [row.conversationId, Number(row.count)]),
    );

    return ids
      .map((id) => byId.get(id))
      .filter((row): row is Conversation => Boolean(row))
      .map((conversation) => {
        const mine = participants.find(
          (row) =>
            row.conversationId === conversation.id &&
            row.userId === currentUserId,
        );
        const other = participants.find(
          (row) =>
            row.conversationId === conversation.id &&
            row.userId !== currentUserId,
        );
        const last = lastByConversation.get(conversation.id) ?? null;
        const otherUser = other?.user;

        return {
          id: conversation.id,
          otherUser: {
            id: otherUser?.id ?? this.otherUserId(conversation, currentUserId),
            username: otherUser?.username ?? 'unknown',
            displayName: otherUser?.displayName ?? null,
            avatarUrl: otherUser?.avatarUrl ?? null,
          },
          lastMessage: last ? this.formatMessage(last) : null,
          unreadCount: unreadByConversation.get(conversation.id) ?? 0,
          lastReadAt: mine?.lastReadAt ? mine.lastReadAt.toISOString() : null,
          otherLastReadAt: other?.lastReadAt
            ? other.lastReadAt.toISOString()
            : null,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
        };
      });
  }

  private async unreadConversationCount(currentUserId: string) {
    const rows: Array<{ count: string }> = await this.messagesRepository.query(
      `
      SELECT COUNT(DISTINCT m."conversationId")::int AS count
      FROM chat_messages m
      INNER JOIN conversation_participants p
        ON p."conversationId" = m."conversationId" AND p."userId" = $1
      WHERE m."senderId" <> $1
        AND (p."lastReadAt" IS NULL OR m."createdAt" > p."lastReadAt")
      `,
      [currentUserId],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
