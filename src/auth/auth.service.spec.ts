import { HttpStatus, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { AUTH_AUDIT_EVENT } from './auth-audit';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';

const ACCESS_SECRET = 'test-access-secret';
const REFRESH_SECRET = 'test-refresh-secret';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    username: 'ada',
    displayName: 'Ada',
    passwordHash: bcrypt.hashSync('Password1', 4),
    isActive: true,
    emailVerified: true,
    emailVerificationTokenHash: null,
    emailVerificationExpiresAt: null,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    avatarUrl: null,
    bio: null,
    website: null,
    github: null,
    location: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

function createService() {
  const usersRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'user-1', ...value })),
  };
  const updateExecute = jest.fn();
  const refreshTokensRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'rt-1', ...value })),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: updateExecute,
    })),
  };
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const values: Record<string, unknown> = {
        'auth.accessTokenSecret': ACCESS_SECRET,
        'auth.refreshTokenSecret': REFRESH_SECRET,
        'auth.accessTokenTtlSeconds': 900,
        'auth.refreshTokenTtlSeconds': 60 * 60,
        'auth.refreshCookieName': 'refresh_token',
      };
      return values[key] ?? fallback;
    }),
  };
  const emailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    buildVerificationUrl: jest.fn(
      (token: string) => `http://localhost:5173/auth/verify-email?token=${token}`,
    ),
    buildPasswordResetUrl: jest.fn(
      (token: string) =>
        `http://localhost:5173/auth/reset-password?token=${token}`,
    ),
    shouldExposeVerificationUrl: jest.fn(() => true),
  };

  const service = new AuthService(
    usersRepository as never,
    refreshTokensRepository as never,
    configService as never,
    new JwtService({}),
    emailService as never,
  );

  return {
    service,
    usersRepository,
    refreshTokensRepository,
    updateExecute,
    emailService,
  };
}

describe('AuthService', () => {
  const metadata = { ipAddress: '127.0.0.1', userAgent: 'jest' };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('login', () => {
    it('rejects unknown, wrong-password, and unverified users with safe messages', async () => {
      const { service, usersRepository } = createService();

      usersRepository.findOne.mockResolvedValueOnce(null);
      await expect(
        service.login({ email: 'ada@example.com', password: 'Password1' }, metadata),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.AUTHENTICATION_ERROR,
        clientMessage: 'Invalid credentials',
        httpStatus: HttpStatus.UNAUTHORIZED,
      });

      usersRepository.findOne.mockResolvedValueOnce(buildUser());
      await expect(
        service.login({ email: 'ada@example.com', password: 'Wrong1' }, metadata),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.AUTHENTICATION_ERROR,
        clientMessage: 'Invalid credentials',
      });

      usersRepository.findOne.mockResolvedValueOnce(
        buildUser({ emailVerified: false }),
      );
      await expect(
        service.login({ email: 'ada@example.com', password: 'Password1' }, metadata),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.AUTHENTICATION_ERROR,
        clientMessage: 'Invalid credentials',
        httpStatus: HttpStatus.UNAUTHORIZED,
      });
    });

    it('reactivates an inactive user and issues tokens', async () => {
      const { service, usersRepository } = createService();
      const inactive = buildUser({ isActive: false });
      usersRepository.findOne.mockResolvedValue(inactive);

      const result = await service.login(
        { email: 'ada@example.com', password: 'Password1' },
        metadata,
      );

      expect(usersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1', isActive: true }),
      );
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
    });

    it('issues tokens for a verified active user', async () => {
      const { service, usersRepository } = createService();
      usersRepository.findOne.mockResolvedValue(buildUser());

      const result = await service.login(
        { email: 'ada@example.com', password: 'Password1' },
        metadata,
      );

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.user).toMatchObject({
        id: 'user-1',
        email: 'ada@example.com',
        username: 'ada',
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('changePassword', () => {
    it('updates the hash, revokes other sessions, and issues a new session', async () => {
      const { service, usersRepository, refreshTokensRepository } =
        createService();
      const user = buildUser();
      usersRepository.findOne.mockResolvedValue(user);

      const result = await service.changePassword(
        user.id,
        { currentPassword: 'Password1', newPassword: 'Password2' },
        metadata,
      );

      expect(usersRepository.save).toHaveBeenCalled();
      const saved = usersRepository.save.mock.calls[0][0] as User;
      expect(await bcrypt.compare('Password2', saved.passwordHash)).toBe(true);
      expect(refreshTokensRepository.delete).toHaveBeenCalledWith({
        userId: user.id,
      });
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
    });

    it('rejects a wrong current password without changing the hash', async () => {
      const { service, usersRepository, updateExecute } = createService();
      const user = buildUser();
      usersRepository.findOne.mockResolvedValue(user);

      await expect(
        service.changePassword(
          user.id,
          { currentPassword: 'Wrong1', newPassword: 'Password2' },
          metadata,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.AUTHENTICATION_ERROR,
        clientMessage: 'Invalid credentials',
        httpStatus: HttpStatus.UNAUTHORIZED,
      });

      expect(usersRepository.save).not.toHaveBeenCalled();
      expect(updateExecute).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('creates an unverified user and does not issue a session', async () => {
      const { service, usersRepository, refreshTokensRepository, emailService } =
        createService();
      usersRepository.findOne.mockResolvedValue(null);

      const result = await service.register({
        email: 'ada@example.com',
        password: 'Password1',
        username: 'ada',
        displayName: 'Ada',
      });

      expect(usersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ada@example.com',
          emailVerified: false,
          isActive: true,
        }),
      );
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
      expect(refreshTokensRepository.save).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        email: 'ada@example.com',
      });
      expect(result).toHaveProperty('verificationUrl');
      expect(result).not.toHaveProperty('accessToken');
    });
  });

  describe('refresh', () => {
    it('revokes every token for the user when a revoked token is reused', async () => {
      const {
        service,
        usersRepository,
        refreshTokensRepository,
        updateExecute,
      } = createService();
      const user = buildUser();
      usersRepository.findOne.mockResolvedValue(user);
      const login = await service.login(
        { email: user.email, password: 'Password1' },
        metadata,
      );

      refreshTokensRepository.findOne.mockResolvedValue({
        id: 'rt-old',
        userId: user.id,
        tokenHash: hashToken(login.refreshToken),
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      } as RefreshToken);

      await expect(
        service.refresh(login.refreshToken, metadata),
      ).rejects.toBeInstanceOf(BusinessException);

      expect(updateExecute).toHaveBeenCalled();
    });

    it('rotates a valid refresh token', async () => {
      const { service, usersRepository, refreshTokensRepository } =
        createService();
      usersRepository.findOne.mockResolvedValue(buildUser());
      const first = await service.login(
        { email: 'ada@example.com', password: 'Password1' },
        metadata,
      );

      const stored = {
        id: 'rt-old',
        userId: 'user-1',
        tokenHash: hashToken(first.refreshToken),
        revokedAt: null as Date | null,
        expiresAt: new Date(Date.now() + 60_000),
        replacedByTokenId: undefined as string | undefined,
      };
      refreshTokensRepository.findOne.mockResolvedValue(stored);
      refreshTokensRepository.save.mockImplementation(async (value) => {
        if (typeof value === 'object' && value && !('id' in value && value.id)) {
          Object.assign(value, { id: 'rt-1' });
        }
        return value;
      });

      const rotated = await service.refresh(first.refreshToken, metadata);

      expect(rotated.refreshToken).not.toBe(first.refreshToken);
      expect(stored.revokedAt).toBeInstanceOf(Date);
      expect(stored.replacedByTokenId).toBe('rt-1');
    });
  });

  describe('forgotPassword / resetPassword', () => {
    it('always returns a generic message and does not reveal missing emails', async () => {
      const { service, usersRepository, emailService } = createService();
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.forgotPassword('ghost@example.com')).resolves.toEqual(
        {
          message: expect.stringContaining('If an account exists'),
        },
      );
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('emails a reset link for an active user and exposes the URL in non-prod', async () => {
      const { service, usersRepository, emailService } = createService();
      usersRepository.findOne.mockResolvedValue(buildUser());

      const result = await service.forgotPassword('ada@example.com');

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
      expect(usersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordResetTokenHash: expect.any(String),
          passwordResetExpiresAt: expect.any(Date),
        }),
      );
      expect(result).toHaveProperty('resetUrl');
    });

    it('rejects invalid and expired reset tokens, then updates password and revokes sessions', async () => {
      const { service, usersRepository, updateExecute } = createService();

      await expect(service.resetPassword('', 'Password1')).rejects.toMatchObject(
        {
          errorCode: ErrorCode.PASSWORD_RESET_TOKEN_INVALID,
        },
      );

      usersRepository.findOne.mockResolvedValueOnce(null);
      await expect(
        service.resetPassword('missing', 'Password1'),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.PASSWORD_RESET_TOKEN_INVALID,
      });

      usersRepository.findOne.mockResolvedValueOnce(
        buildUser({
          passwordResetTokenHash: hashToken('expired-token'),
          passwordResetExpiresAt: new Date(Date.now() - 1000),
        }),
      );
      await expect(
        service.resetPassword('expired-token', 'Password1'),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.PASSWORD_RESET_TOKEN_EXPIRED,
      });

      const user = buildUser({
        passwordResetTokenHash: hashToken('valid-token'),
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      });
      usersRepository.findOne.mockResolvedValueOnce(user);

      await expect(
        service.resetPassword('valid-token', 'Password2'),
      ).resolves.toMatchObject({
        message: expect.stringContaining('Password updated'),
      });
      expect(user.passwordResetTokenHash).toBeNull();
      expect(user.passwordResetExpiresAt).toBeNull();
      expect(updateExecute).toHaveBeenCalled();
    });
  });

  describe('audit logging', () => {
    const auditMeta = {
      ipAddress: '203.0.113.8',
      userAgent: 'audit-agent',
      requestId: 'req-audit-1',
    };

    function auditEntries() {
      return jest
        .mocked(Logger.prototype.log)
        .mock.calls.map((args) => args[0])
        .filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === 'object' &&
            'event' in value,
        );
    }

    it('logs login success and refresh issued without tokens or passwords', async () => {
      const { service, usersRepository } = createService();
      usersRepository.findOne.mockResolvedValue(buildUser());

      const result = await service.login(
        { email: 'ada@example.com', password: 'Password1' },
        auditMeta,
      );

      expect(auditEntries()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: AUTH_AUDIT_EVENT.LOGIN,
            outcome: 'success',
            userId: 'user-1',
            ip: auditMeta.ipAddress,
            userAgent: auditMeta.userAgent,
            requestId: auditMeta.requestId,
          }),
          expect.objectContaining({
            event: AUTH_AUDIT_EVENT.REFRESH,
            outcome: 'issued',
            userId: 'user-1',
            requestId: auditMeta.requestId,
          }),
        ]),
      );

      const serialized = JSON.stringify(auditEntries());
      expect(serialized).not.toContain('Password1');
      expect(serialized).not.toContain(result.accessToken);
      expect(serialized).not.toContain(result.refreshToken);
    });

    it('logs login failures internally while keeping the generic client message', async () => {
      const { service, usersRepository } = createService();

      usersRepository.findOne.mockResolvedValueOnce(null);
      await expect(
        service.login(
          { email: 'ghost@example.com', password: 'Password1' },
          auditMeta,
        ),
      ).rejects.toMatchObject({
        clientMessage: 'Invalid credentials',
      });
      expect(auditEntries()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: AUTH_AUDIT_EVENT.LOGIN,
            outcome: 'failure',
            reason: 'user_not_found',
            requestId: auditMeta.requestId,
          }),
        ]),
      );
      expect(auditEntries()[0]).not.toHaveProperty('userId');

      jest.mocked(Logger.prototype.log).mockClear();
      usersRepository.findOne.mockResolvedValueOnce(
        buildUser({ emailVerified: false }),
      );
      await expect(
        service.login(
          { email: 'ada@example.com', password: 'Password1' },
          auditMeta,
        ),
      ).rejects.toMatchObject({
        clientMessage: 'Invalid credentials',
      });
      expect(auditEntries()).toEqual([
        expect.objectContaining({
          event: AUTH_AUDIT_EVENT.LOGIN,
          outcome: 'failure',
          userId: 'user-1',
          reason: 'email_unverified',
        }),
      ]);
    });

    it('logs register, verify, resend, password reset, logout, and refresh outcomes', async () => {
      const { service, usersRepository, refreshTokensRepository } =
        createService();
      usersRepository.findOne.mockResolvedValue(null);

      await service.register(
        {
          email: 'ada@example.com',
          password: 'Password1',
          username: 'ada',
          displayName: 'Ada',
        },
        auditMeta,
      );
      expect(auditEntries()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: AUTH_AUDIT_EVENT.REGISTER,
            outcome: 'success',
            requestId: auditMeta.requestId,
          }),
        ]),
      );

      jest.mocked(Logger.prototype.log).mockClear();
      await service.resendVerification('ghost@example.com', auditMeta);
      expect(auditEntries()).toEqual([
        expect.objectContaining({
          event: AUTH_AUDIT_EVENT.RESEND_VERIFICATION,
          outcome: 'noop',
          reason: 'unknown_email',
        }),
      ]);

      jest.mocked(Logger.prototype.log).mockClear();
      await service.forgotPassword('ghost@example.com', auditMeta);
      expect(auditEntries()).toEqual([
        expect.objectContaining({
          event: AUTH_AUDIT_EVENT.PASSWORD_RESET_REQUEST,
          outcome: 'noop',
          reason: 'unknown_email',
        }),
      ]);

      jest.mocked(Logger.prototype.log).mockClear();
      await expect(service.verifyEmail('', auditMeta)).rejects.toBeInstanceOf(
        BusinessException,
      );
      expect(auditEntries()).toEqual([
        expect.objectContaining({
          event: AUTH_AUDIT_EVENT.VERIFY_EMAIL,
          outcome: 'failure',
          reason: 'missing_token',
        }),
      ]);

      jest.mocked(Logger.prototype.log).mockClear();
      const resetUser = buildUser({
        passwordResetTokenHash: hashToken('valid-token'),
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      });
      usersRepository.findOne.mockResolvedValueOnce(resetUser);
      await service.resetPassword('valid-token', 'Password2', auditMeta);
      expect(auditEntries()).toEqual([
        expect.objectContaining({
          event: AUTH_AUDIT_EVENT.PASSWORD_RESET,
          outcome: 'success',
          userId: 'user-1',
        }),
      ]);
      const resetSerialized = JSON.stringify(auditEntries());
      expect(resetSerialized).not.toContain('valid-token');
      expect(resetSerialized).not.toContain('Password2');

      jest.mocked(Logger.prototype.log).mockClear();
      usersRepository.findOne.mockResolvedValue(buildUser());
      const login = await service.login(
        { email: 'ada@example.com', password: 'Password1' },
        auditMeta,
      );
      jest.mocked(Logger.prototype.log).mockClear();
      refreshTokensRepository.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: hashToken(login.refreshToken),
      } as RefreshToken);
      await service.logout(login.refreshToken, auditMeta);
      expect(auditEntries()).toEqual([
        expect.objectContaining({
          event: AUTH_AUDIT_EVENT.LOGOUT,
          outcome: 'success',
          userId: 'user-1',
        }),
      ]);
      expect(JSON.stringify(auditEntries())).not.toContain(login.refreshToken);

      jest.mocked(Logger.prototype.log).mockClear();
      const stored = {
        id: 'rt-old',
        userId: 'user-1',
        tokenHash: hashToken(login.refreshToken),
        revokedAt: null as Date | null,
        expiresAt: new Date(Date.now() + 60_000),
        replacedByTokenId: undefined as string | undefined,
      };
      refreshTokensRepository.findOne.mockResolvedValue(stored);
      refreshTokensRepository.save.mockImplementation(async (value) => {
        if (typeof value === 'object' && value && !('id' in value && value.id)) {
          Object.assign(value, { id: 'rt-1' });
        }
        return value;
      });
      await service.refresh(login.refreshToken, auditMeta);
      expect(auditEntries()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: AUTH_AUDIT_EVENT.REFRESH,
            outcome: 'issued',
          }),
          expect.objectContaining({
            event: AUTH_AUDIT_EVENT.REFRESH,
            outcome: 'rotated',
            userId: 'user-1',
          }),
        ]),
      );

      jest.mocked(Logger.prototype.log).mockClear();
      refreshTokensRepository.findOne.mockResolvedValue({
        ...stored,
        revokedAt: new Date(),
      });
      await expect(
        service.refresh(login.refreshToken, auditMeta),
      ).rejects.toBeInstanceOf(BusinessException);
      expect(auditEntries()).toEqual([
        expect.objectContaining({
          event: AUTH_AUDIT_EVENT.REFRESH,
          outcome: 'reuse_detected',
          userId: 'user-1',
        }),
      ]);
    });
  });

  describe('purgeExpiredRefreshTokens', () => {
    it('deletes expired or revoked refresh tokens', async () => {
      const { service, refreshTokensRepository } = createService();
      refreshTokensRepository.delete.mockResolvedValue({ affected: 3 });

      await expect(service.purgeExpiredRefreshTokens()).resolves.toBe(3);
      expect(refreshTokensRepository.delete).toHaveBeenCalledWith([
        { expiresAt: expect.anything() },
        { revokedAt: expect.anything() },
      ]);
    });
  });
});
