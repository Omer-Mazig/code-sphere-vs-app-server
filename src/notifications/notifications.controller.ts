import {
  Controller,
  Post,
  Get,
  MessageEvent,
  Patch,
  Param,
  Query,
  Sse,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiParam,
  ApiProduces,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Observable, from, interval, map, merge } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { CurrentUser, Paginated, Public } from '../common/decorators';
import {
  ApiEnvelopeOkResponse,
  ApiEnvelopePaginatedOkResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';
import {
  CommentRepliedNotificationPayloadDto,
  MarkAllReadResponseDto,
  NewFollowerNotificationPayloadDto,
  NotificationResponseDto,
  NotificationStreamPingEventDto,
  NotificationsQueryDto,
  PostCommentedNotificationPayloadDto,
  PostLikedNotificationPayloadDto,
  UserMentionedNotificationPayloadDto,
  StreamTokenResponseDto,
  StreamTokenQueryDto,
  UnreadCountResponseDto,
} from './dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiExtraModels(
  PostLikedNotificationPayloadDto,
  PostCommentedNotificationPayloadDto,
  CommentRepliedNotificationPayloadDto,
  NewFollowerNotificationPayloadDto,
  UserMentionedNotificationPayloadDto,
  NotificationStreamPingEventDto,
)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Paginated()
  @ApiEnvelopePaginatedOkResponse(NotificationResponseDto)
  @ApiStandardErrorResponses()
  getNotifications(
    @CurrentUser() userId: string,
    @Query() query: NotificationsQueryDto,
  ) {
    return this.notificationsService.listForUser(
      userId,
      query.page,
      query.limit,
      {
        targetType: query.targetType,
        isRead: query.isRead,
      },
    );
  }

  @Get('unread-count')
  @ApiEnvelopeOkResponse(UnreadCountResponseDto)
  @ApiStandardErrorResponses()
  getUnreadCount(@CurrentUser() userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch('mark-all-read')
  @ApiEnvelopeOkResponse(MarkAllReadResponseDto)
  @ApiStandardErrorResponses()
  markAllAsRead(@CurrentUser() userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(NotificationResponseDto)
  @ApiStandardErrorResponses()
  markAsRead(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Post('stream-token')
  @ApiEnvelopeOkResponse(StreamTokenResponseDto)
  @ApiStandardErrorResponses()
  createStreamToken(@CurrentUser() userId: string) {
    return this.notificationsService.createStreamToken(userId);
  }

  @Sse('stream')
  @Public()
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description:
      'Server-Sent Events stream. Event names: notification.created (NotificationResponseDto), notification.unread_count (UnreadCountResponseDto), ping (NotificationStreamPingEventDto).',
    content: {
      'text/event-stream': {
        schema: {
          oneOf: [
            { $ref: getSchemaPath(NotificationResponseDto) },
            { $ref: getSchemaPath(UnreadCountResponseDto) },
            { $ref: getSchemaPath(NotificationStreamPingEventDto) },
          ],
        },
      },
    },
  })
  @ApiStandardErrorResponses()
  stream(@Query() query: StreamTokenQueryDto): Observable<MessageEvent> {
    return from(this.notificationsService.validateStreamToken(query.streamToken)).pipe(
      switchMap((userId) => {
        const stream = this.notificationsService.createStream(userId);
        const heartbeat$ = interval(25000).pipe(
          map(
            (): MessageEvent => ({
              type: 'ping',
              data: { timestamp: new Date().toISOString() },
            }),
          ),
        );

        return merge(stream.asObservable(), heartbeat$).pipe(
          finalize(() => this.notificationsService.detachStream(userId, stream)),
        );
      }),
    );
  }
}
