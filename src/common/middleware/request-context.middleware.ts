import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestContext {
  requestId: string;
  _startTime: number;
}

export type RequestWithContext = Request & RequestContext;

type RequestWithPinoId = Request & { id?: string };

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req as RequestWithPinoId;
    const headerId = req.headers['x-request-id'];
    const requestId =
      incoming.id ??
      (typeof headerId === 'string' && headerId.length > 0
        ? headerId
        : randomUUID());

    (req as RequestWithContext).requestId = requestId;
    incoming.id = requestId;
    (req as RequestWithContext)._startTime = Date.now();
    res.setHeader('x-request-id', requestId);
    next();
  }
}
