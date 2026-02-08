import { SetMetadata } from '@nestjs/common';
import { RoleType } from '../types';

export const Permissions = (...roles: RoleType[]) =>
  SetMetadata('permissions', roles);
