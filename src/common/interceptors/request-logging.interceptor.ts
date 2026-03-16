import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import type { RequestWithContext } from '../middleware/request-context.middleware';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<
      RequestWithContext & { user?: { id: string } }
    >();
    const response = http.getResponse<Response>();

    response.on('finish', () => {
      const requestId = request.requestId ?? '-';
      const durationMs =
        request._startTime != null
          ? Date.now() - request._startTime
          : undefined;
      const userId = request.user?.id;

      this.logger.log({
        method: request.method,
        path: request.url ?? request.path,
        statusCode: response.statusCode,
        ...(durationMs !== undefined && { durationMs }),
        requestId,
        ...(userId && { userId }),
      });
    });

    return next.handle();
  }
}
