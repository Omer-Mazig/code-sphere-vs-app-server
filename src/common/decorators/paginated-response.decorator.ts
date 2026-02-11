import { SetMetadata } from '@nestjs/common';

export const PAGINATED_RESPONSE_KEY = 'paginatedResponse';

/**
 * Mark an endpoint as returning a raw pagination payload.
 * PaginatedResponseInterceptor will wrap { items, total, page, limit } into PaginatedResponse.
 */
export const Paginated = () => SetMetadata(PAGINATED_RESPONSE_KEY, true);
