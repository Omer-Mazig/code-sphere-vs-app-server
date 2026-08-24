import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
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
    buildVerificationUrl: jest.fn(
      (token: string) => `http://localhost:5173/auth/verify-email?token=${token}`,
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

  describe('login', () => {
    it('rejects unknown, wrong-password, inactive, and unverified users with safe messages', async () => {
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

      usersRepository.findOne.mockResolvedValueOnce(buildUser({ isActive: false }));
      await expect(
        service.login({ email: 'ada@example.com', password: 'Password1' }, metadata),
      ).rejects.toMatchObject({
        clientMessage: 'Account disabled',
      });

      usersRepository.findOne.mockResolvedValueOnce(
        buildUser({ emailVerified: false }),
      );
      await expect(
        service.login({ email: 'ada@example.com', password: 'Password1' }, metadata),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.EMAIL_NOT_VERIFIED,
        httpStatus: HttpStatus.FORBIDDEN,
      });
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
});
