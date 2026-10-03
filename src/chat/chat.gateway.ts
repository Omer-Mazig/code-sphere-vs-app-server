import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthService } from '../auth/auth.service';
import { ChatService } from './chat.service';
import {
  ChatDomainEventName,
  ChatMessageCreatedEvent,
} from './events/chat-domain-events';

type ChatSocket = Socket & { data: { currentUserId?: string } };

@SkipThrottle()
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly chatService: ChatService,
  ) {}

  handleConnection(client: ChatSocket) {
    const token = this.extractToken(client);
    const payload = token ? this.authService.verifyAccessToken(token) : null;
    if (!payload) {
      this.logger.log('Rejected unauthenticated chat socket');
      client.disconnect(true);
      return;
    }

    client.data.currentUserId = payload.sub;
    void client.join(this.userRoom(payload.sub));
  }

  handleDisconnect(client: ChatSocket) {
    const currentUserId = client.data.currentUserId;
    if (currentUserId) {
      this.logger.debug(`Chat socket disconnected for user ${currentUserId}`);
    }
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const currentUserId = client.data.currentUserId;
    const conversationId = body?.conversationId;
    if (!currentUserId || !conversationId) {
      return { ok: false };
    }

    try {
      await this.chatService.assertCanJoinRoom(conversationId, currentUserId);
    } catch {
      return { ok: false };
    }

    await client.join(conversationId);
    return { ok: true };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const currentUserId = client.data.currentUserId;
    const conversationId = body?.conversationId;
    if (!currentUserId || !conversationId) {
      return;
    }

    client.to(conversationId).emit('typing', {
      conversationId,
      userId: currentUserId,
    });
  }

  @OnEvent(ChatDomainEventName.MESSAGE_CREATED)
  handleMessageCreated(event: ChatMessageCreatedEvent) {
    this.server.to(event.conversationId).emit('message', event.message);
    this.server
      .to(this.userRoom(event.recipientId))
      .emit('message', event.message);
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private extractToken(client: ChatSocket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }

    return null;
  }
}
