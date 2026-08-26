import type { AuthRequestMetadata } from './auth.types';

export const AUTH_AUDIT_EVENT = {
  LOGIN: 'auth.login',
  REGISTER: 'auth.register',
  LOGOUT: 'auth.logout',
  REFRESH: 'auth.refresh',
  VERIFY_EMAIL: 'auth.verify_email',
  RESEND_VERIFICATION: 'auth.resend_verification',
  PASSWORD_RESET_REQUEST: 'auth.password_reset_request',
  PASSWORD_RESET: 'auth.password_reset',
} as const;

export type AuthAuditEvent =
  (typeof AUTH_AUDIT_EVENT)[keyof typeof AUTH_AUDIT_EVENT];

export type AuthAuditOutcome =
  | 'success'
  | 'failure'
  | 'issued'
  | 'rotated'
  | 'revoked'
  | 'reuse_detected'
  | 'sent'
  | 'noop';

export type AuthAuditLog = {
  msg: string;
  event: AuthAuditEvent;
  outcome: AuthAuditOutcome;
  userId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  reason?: string;
};

export function buildAuthAuditLog(
  event: AuthAuditEvent,
  outcome: AuthAuditOutcome,
  metadata: AuthRequestMetadata,
  extra: { userId?: string; reason?: string } = {},
): AuthAuditLog {
  return {
    msg: `${event} ${outcome}`,
    event,
    outcome,
    ...(extra.userId ? { userId: extra.userId } : {}),
    ...(metadata.ipAddress ? { ip: metadata.ipAddress } : {}),
    ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
    ...(metadata.requestId ? { requestId: metadata.requestId } : {}),
    ...(extra.reason ? { reason: extra.reason } : {}),
  };
}
