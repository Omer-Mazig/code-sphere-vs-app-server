import {
  AUTH_AUDIT_EVENT,
  buildAuthAuditLog,
} from './auth-audit';

describe('buildAuthAuditLog', () => {
  it('includes userId, ip, userAgent, requestId, and outcome', () => {
    expect(
      buildAuthAuditLog(
        AUTH_AUDIT_EVENT.LOGIN,
        'success',
        {
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
          requestId: 'req-1',
        },
        { userId: 'user-1' },
      ),
    ).toEqual({
      msg: 'auth.login success',
      event: AUTH_AUDIT_EVENT.LOGIN,
      outcome: 'success',
      userId: 'user-1',
      ip: '127.0.0.1',
      userAgent: 'jest',
      requestId: 'req-1',
    });
  });

  it('omits unknown fields and does not copy secrets', () => {
    const log = buildAuthAuditLog(
      AUTH_AUDIT_EVENT.LOGIN,
      'failure',
      { ipAddress: '10.0.0.1' },
      { reason: 'invalid_password' },
    );

    expect(log).toEqual({
      msg: 'auth.login failure',
      event: AUTH_AUDIT_EVENT.LOGIN,
      outcome: 'failure',
      ip: '10.0.0.1',
      reason: 'invalid_password',
    });
    expect(log).not.toHaveProperty('password');
    expect(log).not.toHaveProperty('accessToken');
    expect(log).not.toHaveProperty('refreshToken');
    expect(log).not.toHaveProperty('token');
  });
});
