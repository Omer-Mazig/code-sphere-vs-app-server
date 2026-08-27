import { HttpStatus, Injectable, MessageEvent } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subject } from 'rxjs';
import { randomBytes, createHash } from 'crypto';
import { LessThanOrEqual, Repository } from 'typeorm';
import { PaginatedPayload } from '../common/dto/paginated-response.dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { NotificationPayload } from './dto';
import {
  Notification,
  NotificationTargetType,
  NotificationType,
} from './entities/notification.entity';
import { NotificationStreamToken } from './entities/notification-stream-token.entity';

type NotificationStreamEvent =
  | {
      type: 'notification.created';
      data: ReturnType<NotificationsService['formatNotification']>;
    }
  | { type: 'notification.unread_count'; data: { count: number } }
  | { type: 'ping'; data: { timestamp: string } };

@Injectable()
export class NotificationsService {
  private readonly userStreams = new Map<string, Set<Subject<MessageEvent>>>();

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(NotificationStreamToken)
    private readonly notificationStreamTokenRepository: Repository<NotificationStreamToken>,
  ) {}

  async createStreamToken(userId: string) {
    const streamToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(streamToken);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.notificationStreamTokenRepository.delete({ tokenHash });

    await this.notificationStreamTokenRepository.save({
      userId,
      tokenHash,
      expiresAt,
    });

    return { streamToken };
  }

  async purgeExpiredStreamTokens(): Promise<number> {
    const result = await this.notificationStreamTokenRepository.delete({
      expiresAt: LessThanOrEqual(new Date()),
    });
    return result.affected ?? 0;
  }

  async validateStreamToken(streamToken: string): Promise<string> {
    const tokenHash = this.hashToken(streamToken);

    const token = await this.notificationStreamTokenRepository.findOne({
      where: { tokenHash },
    });

    if (!token) {
      throw new BusinessException(
        ErrorCode.NOTIFICATION_STREAM_TOKEN_INVALID,
        `Stream token is invalid`,
        'Stream token is invalid',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (token.expiresAt <= new Date()) {
      await this.notificationStreamTokenRepository.delete({ tokenHash });
      throw new BusinessException(
        ErrorCode.NOTIFICATION_STREAM_TOKEN_EXPIRED,
        `Stream token expired`,
        'Stream token expired',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return token.userId;
  }

  detachStream(userId: string, stream: Subject<MessageEvent>) {
    const streamSet = this.userStreams.get(userId);
    if (!streamSet) return;

    streamSet.delete(stream);
    stream.complete();

    if (streamSet.size === 0) {
      this.userStreams.delete(userId);
    }
  }

  async createNotification(
    userId: string,
    type: NotificationType,
    targetType: NotificationTargetType,
    payload: NotificationPayload,
  ) {
    const notification = this.notificationsRepository.create({
      userId,
      type,
      targetType,
      payload: payload as unknown as Record<string, unknown>,
      isRead: false,
      readAt: null,
    });

    const saved = await this.notificationsRepository.save(notification);
    const formatted = this.formatNotification(saved);

    this.publish(userId, {
      type: 'notification.created',
      data: formatted,
    });

    const unreadCount = await this.getUnreadCount(userId);
    this.publish(userId, {
      type: 'notification.unread_count',
      data: { count: unreadCount.count },
    });

    return formatted;
  }

  async listForUser(
    userId: string,
    page: number,
    limit: number,
    filters?: {
      targetType?: NotificationTargetType;
      isRead?: boolean;
    },
  ): Promise<
    PaginatedPayload<ReturnType<NotificationsService['formatNotification']>>
  > {
    const skip = (page - 1) * limit;

    const query = this.notificationsRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (filters?.targetType) {
      query.andWhere('notification.targetType = :targetType', {
        targetType: filters.targetType,
      });
    }

    if (filters?.isRead !== undefined) {
      query.andWhere('notification.isRead = :isRead', {
        isRead: filters.isRead,
      });
    }

    const [items, total] = await query.getManyAndCount();

    return {
      items: items.map((item) => this.formatNotification(item)),
      total,
      page,
      limit,
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.notificationsRepository.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { count };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationsRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new BusinessException(
        ErrorCode.NOTIFICATION_NOT_FOUND,
        `Notification "${notificationId}" not found`,
        'Notification not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (notification.userId !== userId) {
      throw new BusinessException(
        ErrorCode.NOTIFICATION_UPDATE_FORBIDDEN,
        `User "${userId}" cannot update notification "${notificationId}"`,
        'You can only update your own notifications',
        HttpStatus.FORBIDDEN,
      );
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await this.notificationsRepository.save(notification);
    }

    const unreadCount = await this.getUnreadCount(userId);
    this.publish(userId, {
      type: 'notification.unread_count',
      data: { count: unreadCount.count },
    });

    return this.formatNotification(notification);
  }

  async markAllAsRead(userId: string) {
    await this.notificationsRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('isRead = :isRead', { isRead: false })
      .execute();

    this.publish(userId, {
      type: 'notification.unread_count',
      data: { count: 0 },
    });

    return { message: 'All notifications marked as read' };
  }

  createStream(userId: string) {
    const stream = new Subject<MessageEvent>();
    const streamSet =
      this.userStreams.get(userId) ?? new Set<Subject<MessageEvent>>();
    streamSet.add(stream);
    this.userStreams.set(userId, streamSet);
    return stream;
  }

  publish(userId: string, event: NotificationStreamEvent) {
    const streamSet = this.userStreams.get(userId);
    if (!streamSet || streamSet.size === 0) return;

    for (const stream of streamSet) {
      stream.next({
        type: event.type,
        data: event.data,
      });
    }
  }

  private formatNotification(notification: Notification) {
    return {
      id: notification.id,
      type: notification.type,
      targetType: notification.targetType,
      payload: notification.payload,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
