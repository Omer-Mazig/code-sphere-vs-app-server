import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleType } from '../types';
import { BusinessException } from '../errors/business.exception';
import { ErrorCode } from '../errors/error-codes.enum';
import { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<RoleType[]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions) {
      this.logger.warn(
        `No permissions decorator found on ${context.getClass().name}.${context.getHandler().name}`,
      );
      throw new BusinessException(
        ErrorCode.AUTHORIZATION_ERROR,
        `No permissions decorator found on ${context.getClass().name}.${context.getHandler().name}`,
        'Access denied',
        HttpStatus.FORBIDDEN,
      );
    }

    if (requiredPermissions.includes(RoleType.PUBLIC)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'User not authenticated for permission check.',
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const hasPermission = requiredPermissions.some((role) =>
      user.roles.includes(role),
    );

    if (!hasPermission) {
      throw new BusinessException(
        ErrorCode.AUTHORIZATION_ERROR,
        `User ${user.id} lacks required permissions: ${requiredPermissions.join(', ')}`,
        'Access denied',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
