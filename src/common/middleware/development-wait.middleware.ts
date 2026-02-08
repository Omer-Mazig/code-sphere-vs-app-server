import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class DevelopmentWaitMiddleware implements NestMiddleware {
  async use(req: Request, _res: Response, next: NextFunction) {
    if (process.env.NODE_ENV === 'production') {
      return next();
    }

    const waitHeader = req.headers['wait'];
    const waitQuery = req.query['wait'];
    const waitMs = Number(waitHeader ?? waitQuery);

    if (!isNaN(waitMs) && waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    } else {
      const delay = Math.random() * 1000 + 500; // 0.5-1.5s
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    next();
  }
}
