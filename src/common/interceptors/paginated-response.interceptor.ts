import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PAGINATED_RESPONSE_KEY } from '../decorators/paginated-response.decorator';
import { createPaginatedResponse } from '../dto/paginated-response.dto';

function isPaginatedPayload(
  data: unknown,
): data is { items: unknown[]; total: number; page: number; limit: number } {
  return (
    data !== null &&
    typeof data === 'object' &&
    'items' in data &&
    Array.isArray((data as { items: unknown[] }).items) &&
    'total' in data &&
    typeof (data as { total: number }).total === 'number' &&
    'page' in data &&
    typeof (data as { page: number }).page === 'number' &&
    'limit' in data &&
    typeof (data as { limit: number }).limit === 'number' &&
    !('meta' in data)
  );
}

@Injectable()
export class PaginatedResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isPaginated = this.reflector.getAllAndOverride<boolean>(
      PAGINATED_RESPONSE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isPaginated) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => {
        if (isPaginatedPayload(data)) {
          return createPaginatedResponse(
            data.items,
            data.total,
            data.page,
            data.limit,
          );
        }
        return data;
      }),
    );
  }
}
