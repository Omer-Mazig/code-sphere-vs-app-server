import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { AuthPayload } from './auth.types';
import { EmailService } from '../email';

type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  refreshTokenId: string;
};

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const GENERIC_VERIFICATION_SENT_MESSAGE =
  'If an account exists and is unverified, a new email has been sent.';

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
    private readonly emailService: EmailService,
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

    if (!user.isActive) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        `User with email "${payload.email}" is inactive`,
        'Account disabled',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.emailVerified) {
      // Same public response as unknown/wrong password so login cannot
      // be used to enumerate registered-but-unverified emails.
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        `User with email "${payload.email}" has not verified their email`,
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

  async register(payload: RegisterDto) {
    const existingEmail = await this.usersRepository.findOne({
      where: { email: payload.email },
    });

    if (existingEmail) {
      throw new BusinessException(
        ErrorCode.USER_EMAIL_EXISTS,
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
        ErrorCode.USER_USERNAME_EXISTS,
        `Username "${payload.username}" is taken`,
        'This username is already taken',
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const verification = this.createEmailVerification();

    const user = this.usersRepository.create({
      email: payload.email,
      passwordHash,
      username: payload.username,
      displayName: payload.displayName,
      isActive: true,
      emailVerified: false,
      emailVerificationTokenHash: verification.tokenHash,
      emailVerificationExpiresAt: verification.expiresAt,
    });

    await this.usersRepository.save(user);

    const verificationUrl = this.emailService.buildVerificationUrl(
      verification.token,
    );
    await this.emailService.sendVerificationEmail(user.email, verificationUrl);

    return {
      message: 'Check your email to verify your account before signing in.',
      email: user.email,
      ...(this.emailService.shouldExposeVerificationUrl() && {
        verificationUrl,
      }),
    };
  }

  async verifyEmail(
    token: string,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    if (!token) {
      throw new BusinessException(
        ErrorCode.EMAIL_VERIFICATION_TOKEN_INVALID,
        'Email verification token missing',
        'This verification link is invalid',
        HttpStatus.BAD_REQUEST,
      );
    }

    const tokenHash = this.hashToken(token);
    const user = await this.usersRepository.findOne({
      where: { emailVerificationTokenHash: tokenHash },
    });

    if (!user) {
      throw new BusinessException(
        ErrorCode.EMAIL_VERIFICATION_TOKEN_INVALID,
        'Email verification token not found',
        'This verification link is invalid or has already been used',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt <= new Date()
    ) {
      throw new BusinessException(
        ErrorCode.EMAIL_VERIFICATION_TOKEN_EXPIRED,
        `Email verification token expired for user "${user.id}"`,
        'This verification link has expired. Request a new one.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!user.emailVerified) {
      user.emailVerified = true;
      await this.usersRepository.save(user);
    }

    const tokens = await this.issueTokens(user, metadata);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    };
  }

  async resendVerification(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user || user.emailVerified) {
      return { message: GENERIC_VERIFICATION_SENT_MESSAGE };
    }

    const verification = this.createEmailVerification();
    user.emailVerificationTokenHash = verification.tokenHash;
    user.emailVerificationExpiresAt = verification.expiresAt;
    await this.usersRepository.save(user);

    const verificationUrl = this.emailService.buildVerificationUrl(
      verification.token,
    );
    await this.emailService.sendVerificationEmail(user.email, verificationUrl);

    return {
      message: GENERIC_VERIFICATION_SENT_MESSAGE,
      ...(this.emailService.shouldExposeVerificationUrl() && {
        verificationUrl,
      }),
    };
  }

  async refresh(
    refreshToken: string | undefined,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    if (!refreshToken) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Refresh token missing',
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const decoded = this.verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Refresh token signature invalid',
        'Unauthorized',
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
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (decoded.sub !== storedToken.userId) {
      await this.revokeAllTokensForUser(storedToken.userId);
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Refresh token subject mismatch',
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (storedToken.revokedAt) {
      await this.revokeAllTokensForUser(storedToken.userId);
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Refresh token reused',
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (storedToken.expiresAt <= new Date()) {
      await this.revokeToken(storedToken);
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'Refresh token expired',
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.usersRepository.findOne({
      where: { id: storedToken.userId },
    });

    if (!user || !user.isActive || !user.emailVerified) {
      await this.revokeAllTokensForUser(storedToken.userId);
      throw new BusinessException(
        ErrorCode.AUTHENTICATION_ERROR,
        'User not available for refresh',
        'Unauthorized',
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
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Access token secret is not set',
        'Something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    try {
      return this.jwtService.verify<AuthPayload>(token, {
        secret: this.accessTokenSecret,
      });
    } catch {
      return null;
    }
  }

  private createEmailVerification() {
    const token = randomBytes(32).toString('hex');
    return {
      token,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    };
  }

  private async issueTokens(
    user: User,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<TokenBundle> {
    if (!this.accessTokenSecret) {
      throw new BusinessException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Access token secret is not set',
        'Something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (!this.refreshTokenSecret) {
      throw new BusinessException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Refresh token secret is not set',
        'Something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
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
    };
  }

  private verifyRefreshToken(token: string): { sub: string } | null {
    if (!this.refreshTokenSecret) {
      throw new BusinessException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Refresh token secret is not set',
        'Something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    try {
      const payload = this.jwtService.verify<{ sub?: string }>(token, {
        secret: this.refreshTokenSecret,
      });
      if (!payload.sub) {
        return null;
      }
      return { sub: payload.sub };
    } catch {
      return null;
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
