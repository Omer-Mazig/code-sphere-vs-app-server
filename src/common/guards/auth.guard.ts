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
import { RoleType } from '../types';
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
    const requiredPermissions = this.reflector.get<RoleType[]>(
      'permissions',
      context.getHandler(),
    );

    const request: Request & { user?: AuthenticatedUser } = context
      .switchToHttp()
      .getRequest();

    const token = this.extractToken(request);

    const payload = token ? this.authService.verifyAccessToken(token) : null;

    if (requiredPermissions?.includes(RoleType.PUBLIC)) {
      if (payload) {
        this.setUser(request, payload);
      }
      return true;
    }

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
      roles: payload.roles,
    };
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    return authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;
  }
}
