import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { randomUUID } from 'crypto';

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
  ): Observable<SuccessEnvelope> {
    const request = context.switchToHttp().getRequest<Request & { _startTime?: number }>();
    request._startTime = Date.now();

    return next.handle().pipe(
      map((data: unknown) => {
        const now = Date.now();
        const requestId = randomUUID();
        const timestamp = new Date(now).toISOString();
        const processingTimeMs = request._startTime != null ? now - request._startTime : undefined;

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
