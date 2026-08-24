import { HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ErrorCode } from './error-codes.enum';
import { mapDatabaseError } from './map-database-error';

function queryFailed(driverError: Record<string, unknown>) {
  return new QueryFailedError(
    'SELECT 1',
    [],
    Object.assign(new Error('query failed'), driverError),
  );
}

describe('mapDatabaseError', () => {
  it('returns null for non-database errors', () => {
    expect(mapDatabaseError(new Error('boom'))).toBeNull();
    expect(mapDatabaseError({ code: '23505' })).toBeNull();
  });

  it('maps unique email and username violations', () => {
    const email = mapDatabaseError(
      queryFailed({
        code: '23505',
        table: 'users',
        detail: 'Key (email)=(ada@example.com) already exists.',
      }),
    );
    expect(email?.status).toBe(HttpStatus.CONFLICT);
    expect(email?.errorCode).toBe(ErrorCode.USER_EMAIL_EXISTS);

    const username = mapDatabaseError(
      queryFailed({
        code: '23505',
        constraint: 'users_username_key',
      }),
    );
    expect(username?.errorCode).toBe(ErrorCode.USER_USERNAME_EXISTS);
  });

  it('maps unique likes, follows, and article slug violations', () => {
    expect(
      mapDatabaseError(queryFailed({ code: '23505', table: 'likes' }))
        ?.errorCode,
    ).toBe(ErrorCode.ALREADY_LIKED);

    expect(
      mapDatabaseError(queryFailed({ code: '23505', table: 'follows' }))
        ?.errorCode,
    ).toBe(ErrorCode.USER_ALREADY_FOLLOWED);

    expect(
      mapDatabaseError(
        queryFailed({
          code: '23505',
          table: 'articles',
          detail: 'Key (slug)=(hello-world) already exists.',
        }),
      )?.errorCode,
    ).toBe(ErrorCode.ARTICLE_SLUG_EXISTS);
  });

  it('falls back to DUPLICATE_RESOURCE for other unique violations', () => {
    expect(
      mapDatabaseError(queryFailed({ code: '23505', table: 'refresh_tokens' }))
        ?.errorCode,
    ).toBe(ErrorCode.DUPLICATE_RESOURCE);
  });

  it('maps foreign-key and not-null violations to validation errors', () => {
    const fk = mapDatabaseError(queryFailed({ code: '23503', table: 'likes' }));
    expect(fk?.status).toBe(HttpStatus.BAD_REQUEST);
    expect(fk?.errorCode).toBe(ErrorCode.VALIDATION_ERROR);

    const notNull = mapDatabaseError(
      queryFailed({ code: '23502', column: 'email' }),
    );
    expect(notNull?.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('maps unknown postgres codes to an internal error', () => {
    const mapped = mapDatabaseError(queryFailed({ code: '40P01' }));
    expect(mapped?.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mapped?.errorCode).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(mapped?.clientMessage).toBe('An unexpected error occurred');
  });
});
