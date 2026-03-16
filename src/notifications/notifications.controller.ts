import {
  Controller,
  Get,
  MessageEvent,
  Patch,
  Param,
  Query,
  Sse,
} from '@nestjs/common';
import { ApiOkResponse, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Observable, interval, map, merge } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { CurrentUser, Paginated } from '../common/decorators';
import {
  ApiEnvelopeOkResponse,
  ApiEnvelopePaginatedOkResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';
import {
  MarkAllReadResponseDto,
  NotificationResponseDto,
  NotificationsQueryDto,
  UnreadCountResponseDto,
} from './dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
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

  @Sse('stream')
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: 'Server-Sent Events stream for real-time user notifications.',
    schema: {
      type: 'string',
      example:
        'event: notification.created\ndata: {"id":"...","type":"POST_LIKED"}\n\n',
    },
  })
  @ApiStandardErrorResponses()
  stream(@CurrentUser() userId: string): Observable<MessageEvent> {
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
  }
}
