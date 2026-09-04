import { HttpStatus, Injectable, MessageEvent } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subject } from 'rxjs';
import { randomBytes, createHash } from 'crypto';
import { LessThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import { PaginatedPayload } from '../common/dto/paginated-response.dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { UpdateNotificationPreferencesDto } from '../users/dto/notification-preferences.dto';
import {
  isCollapsibleNotificationType,
  mergeCollapsedNotificationPayload,
  seedCollapsedNotificationPayload,
} from './collapse-notification-payload';
import { NotificationPayload } from './dto';
import {
  Notification,
  NotificationTargetType,
  NotificationType,
} from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationStreamToken } from './entities/notification-stream-token.entity';

type FormattedNotification = ReturnType<
  NotificationsService['formatNotification']
>;

type NotificationStreamEvent =
  | {
      type: 'notification.created';
      data: FormattedNotification;
    }
  | {
      type: 'notification.updated';
      data: FormattedNotification;
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
    @InjectRepository(NotificationPreference)
    private readonly notificationPreferenceRepository: Repository<NotificationPreference>,
  ) {}

  async getMyPreferences(userId: string) {
    const row = await this.notificationPreferenceRepository.findOne({
      where: { userId },
    });
    return this.formatPreferences(row);
  }

  async updateMyPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ) {
    let row = await this.notificationPreferenceRepository.findOne({
      where: { userId },
    });

    if (!row) {
      row = this.notificationPreferenceRepository.create({
        userId,
        mentions: true,
        comments: true,
        likes: true,
        newFollowers: true,
      });
    }

    if (dto.mentions !== undefined) {
      row.mentions = dto.mentions;
    }
    if (dto.comments !== undefined) {
      row.comments = dto.comments;
    }
    if (dto.likes !== undefined) {
      row.likes = dto.likes;
    }
    if (dto.newFollowers !== undefined) {
      row.newFollowers = dto.newFollowers;
    }

    const saved = await this.notificationPreferenceRepository.save(row);
    return this.formatPreferences(saved);
  }

  async isTypeEnabled(userId: string, type: NotificationType) {
    const row = await this.notificationPreferenceRepository.findOne({
      where: { userId },
    });
    const prefs = this.formatPreferences(row);

    switch (type) {
      case NotificationType.USER_MENTIONED:
        return prefs.mentions;
      case NotificationType.POST_COMMENTED:
      case NotificationType.ARTICLE_COMMENTED:
      case NotificationType.COMMENT_REPLIED:
        return prefs.comments;
      case NotificationType.POST_LIKED:
      case NotificationType.ARTICLE_LIKED:
        return prefs.likes;
      case NotificationType.NEW_FOLLOWER:
        return prefs.newFollowers;
      default:
        return true;
    }
  }

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
    targetId: string | null = null,
  ) {
    if (isCollapsibleNotificationType(type) && targetId) {
      const existing = await this.findUnreadCollapseRow(
        userId,
        type,
        targetType,
        targetId,
      );
      if (existing) {
        return this.updateCollapsedNotification(existing, payload);
      }
    }

    const payloadToStore = isCollapsibleNotificationType(type)
      ? seedCollapsedNotificationPayload(payload)
      : payload;

    const notification = this.notificationsRepository.create({
      userId,
      type,
      targetType,
      targetId,
      payload: payloadToStore as unknown as Record<string, unknown>,
      isRead: false,
      readAt: null,
    });

    try {
      const saved = await this.notificationsRepository.save(notification);
      return this.publishCreated(userId, saved);
    } catch (error) {
      if (
        !this.isUniqueViolation(error) ||
        !isCollapsibleNotificationType(type) ||
        !targetId
      ) {
        throw error;
      }

      const existing = await this.findUnreadCollapseRow(
        userId,
        type,
        targetType,
        targetId,
      );
      if (!existing) {
        throw error;
      }
      return this.updateCollapsedNotification(existing, payload);
    }
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
      .orderBy('notification.updatedAt', 'DESC')
      .addOrderBy('notification.createdAt', 'DESC')
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

  private formatPreferences(row: NotificationPreference | null) {
    return {
      mentions: row?.mentions ?? true,
      comments: row?.comments ?? true,
      likes: row?.likes ?? true,
      newFollowers: row?.newFollowers ?? true,
    };
  }

  private async findUnreadCollapseRow(
    userId: string,
    type: NotificationType,
    targetType: NotificationTargetType,
    targetId: string,
  ) {
    return this.notificationsRepository.findOne({
      where: {
        userId,
        type,
        targetType,
        targetId,
        isRead: false,
      },
    });
  }

  private async updateCollapsedNotification(
    existing: Notification,
    incoming: NotificationPayload,
  ) {
    existing.payload = mergeCollapsedNotificationPayload(
      existing.payload,
      incoming,
    ) as unknown as Record<string, unknown>;
    const saved = await this.notificationsRepository.save(existing);
    const formatted = this.formatNotification(saved);

    this.publish(existing.userId, {
      type: 'notification.updated',
      data: formatted,
    });

    const unreadCount = await this.getUnreadCount(existing.userId);
    this.publish(existing.userId, {
      type: 'notification.unread_count',
      data: { count: unreadCount.count },
    });

    return formatted;
  }

  private async publishCreated(userId: string, saved: Notification) {
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

  private isUniqueViolation(error: unknown) {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    return (
      (error.driverError as { code?: string } | undefined)?.code === '23505'
    );
  }

  private formatNotification(notification: Notification) {
    return {
      id: notification.id,
      type: notification.type,
      targetType: notification.targetType,
      payload: notification.payload,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      readAt: notification.readAt,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
