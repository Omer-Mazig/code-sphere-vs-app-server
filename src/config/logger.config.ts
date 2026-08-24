import { registerAs } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Params } from 'nestjs-pino';

export const loggerConfig = registerAs('logger', () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  return {
    level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
    pretty: nodeEnv === 'development',
  };
});

type RequestWithLogContext = IncomingMessage & {
  id?: string;
  requestId?: string;
  originalUrl?: string;
  user?: { id?: string };
};

export function buildPinoHttpParams(options: {
  level: string;
  pretty: boolean;
}): Params {
  return {
    pinoHttp: {
      level: options.level,
      genReqId: (req: IncomingMessage) => {
        const headerId = req.headers['x-request-id'];
        if (typeof headerId === 'string' && headerId.length > 0) {
          return headerId;
        }
        return randomUUID();
      },
      customProps: (req: RequestWithLogContext) => ({
        requestId: req.requestId ?? req.id,
        ...(req.user?.id && { userId: req.user.id }),
      }),
      customAttributeKeys: {
        responseTime: 'durationMs',
      },
      customSuccessMessage: (req: IncomingMessage, res: ServerResponse) =>
        `${req.method} ${req.url} ${res.statusCode}`,
      customErrorMessage: (req: IncomingMessage, res: ServerResponse) =>
        `${req.method} ${req.url} ${res.statusCode}`,
      serializers: {
        req: (req: RequestWithLogContext) => ({
          id: req.id,
          method: req.method,
          path: req.originalUrl ?? req.url,
        }),
        res: (res: ServerResponse) => ({
          statusCode: res.statusCode,
        }),
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          '*.password',
          '*.currentPassword',
          '*.newPassword',
          '*.refreshToken',
          '*.accessToken',
        ],
        censor: '[Redacted]',
      },
      ...(options.pretty
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
                singleLine: false,
              },
            },
          }
        : {}),
    },
  };
}
