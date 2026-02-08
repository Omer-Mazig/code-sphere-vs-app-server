import { RoleType } from '../common/types';

export type AuthPayload = {
  sub: string;
  email: string;
  roles: RoleType[];
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  roles: RoleType[];
};
