import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import type { RequestWithContext } from '../middleware/request-context.middleware';

export interface SuccessEnvelope {
  payload: unknown;
  requestId: string;
  timestamp: string;
  meta?: {
    apiVersion?: string;
    processingTimeMs?: number;
  };
  warnings?: Array<{ code: string; message: string }>;
}

@Injectable()
export class SuccessEnvelopeInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessEnvelope | StreamableFile> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const accept = request.headers?.accept;

    // SSE streams must keep native event payload shape.
    if (typeof accept === 'string' && accept.includes('text/event-stream')) {
      return next.handle() as Observable<SuccessEnvelope>;
    }

    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof StreamableFile) {
          return data;
        }

        const now = Date.now();
        const requestId = request.requestId ?? randomUUID();
        const timestamp = new Date(now).toISOString();
        const processingTimeMs =
          request._startTime != null ? now - request._startTime : undefined;

        const envelope: SuccessEnvelope = {
          payload: data,
          requestId,
          timestamp,
          meta: {
            ...(processingTimeMs !== undefined && { processingTimeMs }),
          },
        };

        return envelope;
      }),
    );
  }
}
