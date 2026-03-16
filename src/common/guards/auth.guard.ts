import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../../auth/auth.service';
import { IS_PUBLIC_KEY } from '../decorators';
import { BusinessException } from '../errors/business.exception';
import { ErrorCode } from '../errors/error-codes.enum';
import { AuthenticatedUser, AuthPayload } from '../../auth/auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request: Request & { user?: AuthenticatedUser } = context
      .switchToHttp()
      .getRequest();

    const token = this.extractToken(request);
    const payload = token ? this.authService.verifyAccessToken(token) : null;

    // Public routes: allow access but still attach user if token is valid
    if (isPublic) {
      if (payload) {
        this.setUser(request, payload);
      }
      return true;
    }

    // Protected routes: require valid token
    if (!payload) {
      this.logger.log('User not authenticated.');
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'User not authenticated.',
        'User not authenticated.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.setUser(request, payload);

    return true;
  }

  private setUser(
    request: Request & { user?: AuthenticatedUser },
    payload: AuthPayload,
  ) {
    request.user = {
      id: payload.sub,
      email: payload.email,
    };
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length);
    }

    const queryToken = request.query?.accessToken;
    if (typeof queryToken === 'string' && queryToken.length > 0) {
      return queryToken;
    }

    const cookieToken = (
      request as Request & { cookies?: { accessToken?: string } }
    ).cookies?.accessToken;
    if (typeof cookieToken === 'string' && cookieToken.length > 0) {
      return cookieToken;
    }

    return null;
  }
}
