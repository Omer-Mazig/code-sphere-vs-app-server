export type AuthPayload = {
  sub: string;
  email: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export type AuthRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};
