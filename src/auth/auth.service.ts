import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { AuthPayload } from './auth.types';
import { RoleType } from '../common/types';

type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  refreshTokenId: string;
};

@Injectable()
export class AuthService {
  private readonly accessTokenSecret: string | undefined;
  private readonly refreshTokenSecret: string | undefined;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;
  private readonly refreshCookieName: string;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.accessTokenSecret = this.configService.get<string>(
      'auth.accessTokenSecret',
    );
    this.refreshTokenSecret = this.configService.get<string>(
      'auth.refreshTokenSecret',
    );
    this.accessTokenTtlSeconds = this.configService.get<number>(
      'auth.accessTokenTtlSeconds',
      900,
    );
    this.refreshTokenTtlSeconds = this.configService.get<number>(
      'auth.refreshTokenTtlSeconds',
      60 * 60 * 24 * 30,
    );
    this.refreshCookieName = this.configService.get<string>(
      'auth.refreshCookieName',
      'refresh_token',
    );
  }

  getRefreshCookieName() {
    return this.refreshCookieName;
  }

  async login(
    payload: LoginDto,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.usersRepository.findOne({
      where: { email: payload.email },
    });

    if (!user) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        `User with email "${payload.email}" not found`,
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.isActive) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        `User with email "${payload.email}" is inactive`,
        'Account disabled',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordMatches = await bcrypt.compare(
      payload.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        `Invalid credentials for "${payload.email}"`,
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tokens = await this.issueTokens(user, metadata);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    };
  }

  async register(
    payload: RegisterDto,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    const existingEmail = await this.usersRepository.findOne({
      where: { email: payload.email },
    });

    if (existingEmail) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        `User with email "${payload.email}" already exists`,
        'An account with this email already exists',
        HttpStatus.CONFLICT,
      );
    }

    const existingUsername = await this.usersRepository.findOne({
      where: { username: payload.username },
    });

    if (existingUsername) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        `Username "${payload.username}" is taken`,
        'This username is already taken',
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);

    const user = this.usersRepository.create({
      email: payload.email,
      passwordHash,
      username: payload.username,
      displayName: payload.displayName,
      roles: [RoleType.USER],
      isActive: true,
    });

    await this.usersRepository.save(user);

    const tokens = await this.issueTokens(user, metadata);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    };
  }

  async refresh(
    refreshToken: string,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    if (!refreshToken) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Refresh token missing',
        'Refresh token missing',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const decoded = this.verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Refresh token signature invalid',
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.refreshTokensRepository.findOne({
      where: { tokenHash },
    });

    if (!storedToken) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Refresh token not found',
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (decoded.sub !== storedToken.userId) {
      await this.revokeAllTokensForUser(storedToken.userId);
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Refresh token subject mismatch',
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (storedToken.revokedAt) {
      await this.revokeAllTokensForUser(storedToken.userId);
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Refresh token reused',
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (storedToken.expiresAt <= new Date()) {
      await this.revokeToken(storedToken);
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Refresh token expired',
        'Refresh token expired',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.usersRepository.findOne({
      where: { id: storedToken.userId },
    });

    if (!user || !user.isActive) {
      await this.revokeAllTokensForUser(storedToken.userId);
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'User not available for refresh',
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const nextTokens = await this.issueTokens(user, metadata);

    storedToken.revokedAt = new Date();
    storedToken.replacedByTokenId = nextTokens.refreshTokenId;
    await this.refreshTokensRepository.save(storedToken);

    return {
      user: this.sanitizeUser(user),
      accessToken: nextTokens.accessToken,
      refreshToken: nextTokens.refreshToken,
      refreshTokenExpiresAt: nextTokens.refreshTokenExpiresAt,
    };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return;
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.refreshTokensRepository.findOne({
      where: { tokenHash },
    });

    if (storedToken) {
      await this.revokeToken(storedToken);
    }
  }

  verifyAccessToken(token: string) {
    if (!this.accessTokenSecret) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Access token secret is not set',
        'Access token secret is not set',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    try {
      return this.jwtService.verify(token, {
        secret: this.accessTokenSecret,
      }) as AuthPayload;
    } catch {
      return null;
    }
  }

  private async issueTokens(
    user: User,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<TokenBundle> {
    if (!this.accessTokenSecret) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Access token secret is not set',
        'Access token secret is not set',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (!this.refreshTokenSecret) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Refresh token secret is not set',
        'Refresh token secret is not set',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
      } satisfies AuthPayload,
      {
        secret: this.accessTokenSecret,
        expiresIn: this.accessTokenTtlSeconds,
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        tokenId: randomBytes(16).toString('hex'),
      },
      {
        secret: this.refreshTokenSecret,
        expiresIn: this.refreshTokenTtlSeconds,
      },
    );

    const refreshTokenExpiresAt = new Date(
      Date.now() + this.refreshTokenTtlSeconds * 1000,
    );
    const tokenHash = this.hashToken(refreshToken);

    const refreshTokenEntity = this.refreshTokensRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt: refreshTokenExpiresAt,
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
    });

    await this.refreshTokensRepository.save(refreshTokenEntity);

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
      refreshTokenId: refreshTokenEntity.id,
    };
  }

  private async revokeToken(token: RefreshToken) {
    token.revokedAt = new Date();
    await this.refreshTokensRepository.save(token);
  }

  private async revokeAllTokensForUser(userId: string) {
    await this.refreshTokensRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('"userId" = :userId', { userId })
      .andWhere('"revokedAt" IS NULL')
      .execute();
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName ?? null,
      avatarUrl: user.avatarUrl ?? null,
      roles: user.roles,
    };
  }

  private verifyRefreshToken(token: string) {
    if (!this.refreshTokenSecret) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Refresh token secret is not set',
        'Refresh token secret is not set',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    try {
      return this.jwtService.verify(token, {
        secret: this.refreshTokenSecret,
      }) as {
        sub: string;
        tokenId: string;
      };
    } catch {
      return null;
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
