import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark an endpoint as public — no authentication required.
 * Unauthenticated users can still access it, but if a valid token is present
 * the AuthGuard will attach the user to the request anyway.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
