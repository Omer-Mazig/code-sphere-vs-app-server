import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class DevelopmentWaitMiddleware implements NestMiddleware {
  async use(req: Request, _res: Response, next: NextFunction) {
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.NODE_ENV === 'test'
    ) {
      return next();
    }

    const waitHeader = req.headers['wait'];
    const waitQuery = req.query['wait'];
    const waitMs = Number(waitHeader ?? waitQuery);

    if (!isNaN(waitMs) && waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    } else {
      const delay =
        Math.random() < 0.5
          ? 50 + Math.random() * 100 // 50–150ms → padded to 300
          : 450 + Math.random() * 350; // 450–800ms → no pad
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    next();
  }
}
