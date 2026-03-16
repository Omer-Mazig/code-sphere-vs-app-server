import { HttpStatus, Injectable, MessageEvent } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subject } from 'rxjs';
import { Repository } from 'typeorm';
import { PaginatedPayload } from '../common/dto/paginated-response.dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { Notification, NotificationType } from './notifications.entity';

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
  ) {}

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
    payload: Record<string, unknown>,
  ) {
    const notification = this.notificationsRepository.create({
      userId,
      type,
      payload,
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
  ): Promise<
    PaginatedPayload<ReturnType<NotificationsService['formatNotification']>>
  > {
    const skip = (page - 1) * limit;

    const [items, total] = await this.notificationsRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

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
      payload: notification.payload,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    };
  }
}
