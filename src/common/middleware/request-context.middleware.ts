import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestContext {
  requestId: string;
  _startTime: number;
}

export type RequestWithContext = Request & RequestContext;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    (req as RequestWithContext).requestId = randomUUID();
    (req as RequestWithContext)._startTime = Date.now();
    next();
  }
}
