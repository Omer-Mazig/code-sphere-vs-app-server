import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { QueryFailedError } from 'typeorm';
import { BusinessException } from '../errors/business.exception';
import { ErrorCode } from '../errors/error-codes.enum';
import { GlobalExceptionFilter } from './http-exception.filter';

function createHost(overrides?: {
  body?: unknown;
  headers?: Record<string, unknown>;
}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const getHeader = jest.fn();
  const response = { status, json, setHeader, getHeader };
  const request = {
    url: '/api/auth/login',
    method: 'POST',
    body: overrides?.body ?? { email: 'ada@example.com', password: 'secret' },
    query: {},
    params: {},
    requestId: 'req-1',
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, json, status, setHeader, request };
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the client message for BusinessException and keeps the internal message in logs', () => {
    const { host, json, status } = createHost();

    filter.catch(
      new BusinessException(
        ErrorCode.POST_NOT_FOUND,
        'Post with id "abc" not found',
        'Post not found',
        HttpStatus.NOT_FOUND,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        errorCode: ErrorCode.POST_NOT_FOUND,
        message: 'Post not found',
        method: 'POST',
      }),
    );
    expect(json.mock.calls[0][0].message).not.toContain('abc');
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.objectContaining({
        internalMessage: 'Post with id "abc" not found',
      }),
    );
  });

  it('maps throttler errors to 429 and sets Retry-After', () => {
    const { host, json, status, setHeader } = createHost();

    filter.catch(new ThrottlerException(), host);

    expect(status).toHaveBeenCalledWith(429);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: ErrorCode.RATE_LIMIT_EXCEEDED,
      }),
    );
  });

  it('does not leak HttpException details to the client', () => {
    const { host, json } = createHost();

    filter.catch(
      new HttpException('raw driver dump', HttpStatus.UNAUTHORIZED),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: ErrorCode.AUTHENTICATION_ERROR,
        message: 'Authentication required',
      }),
    );
  });

  it('maps unique database errors through mapDatabaseError', () => {
    const { host, json, status } = createHost();
    const exception = new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('duplicate'), {
        code: '23505',
        table: 'users',
        detail: 'Key (email)=(ada@example.com) already exists.',
      }),
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: ErrorCode.USER_EMAIL_EXISTS,
        message: 'An account with this email already exists',
      }),
    );
  });

  it('redacts passwords before logging the request body', () => {
    const { host } = createHost();

    filter.catch(new Error('unexpected'), host);

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          email: 'ada@example.com',
          password: '[Redacted]',
        },
      }),
    );
  });
});
