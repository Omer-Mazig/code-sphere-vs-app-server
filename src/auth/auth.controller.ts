import { Controller, Post, Body, Req, Res, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../common/decorators';
import {
  ApiEnvelopeCreatedResponse,
  ApiEnvelopeOkResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';
import {
  AuthSessionResponseDto,
  ForgotPasswordResponseDto,
  LogoutResponseDto,
  RegisterResponseDto,
  ResendVerificationResponseDto,
  ResetPasswordResponseDto,
} from './dto/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiEnvelopeOkResponse(AuthSessionResponseDto)
  @ApiStandardErrorResponses()
  async login(
    @Body() payload: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(payload, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('register')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiEnvelopeCreatedResponse(RegisterResponseDto)
  @ApiStandardErrorResponses()
  async register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Post('verify-email')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiEnvelopeOkResponse(AuthSessionResponseDto)
  @ApiStandardErrorResponses()
  async verifyEmail(
    @Body() payload: VerifyEmailDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyEmail(payload.token, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiEnvelopeOkResponse(ResendVerificationResponseDto)
  @ApiStandardErrorResponses()
  async resendVerification(@Body() payload: ResendVerificationDto) {
    return this.authService.resendVerification(payload.email);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiEnvelopeOkResponse(ForgotPasswordResponseDto)
  @ApiStandardErrorResponses()
  async forgotPassword(@Body() payload: ForgotPasswordDto) {
    return this.authService.forgotPassword(payload.email);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiEnvelopeOkResponse(ResetPasswordResponseDto)
  @ApiStandardErrorResponses()
  async resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload.token, payload.password);
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiEnvelopeOkResponse(AuthSessionResponseDto)
  @ApiStandardErrorResponses()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieName = this.authService.getRefreshCookieName();
    const refreshToken = this.readCookie(req, cookieName);

    const result = await this.authService.refresh(refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @Public()
  @HttpCode(200)
  @ApiEnvelopeOkResponse(LogoutResponseDto)
  @ApiStandardErrorResponses()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = this.authService.getRefreshCookieName();
    const refreshToken = this.readCookie(req, cookieName);

    await this.authService.logout(refreshToken);

    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return { message: 'Logged out' };
  }

  private readCookie(req: Request, name: string): string | undefined {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[name];
    return typeof value === 'string' ? value : undefined;
  }

  private setRefreshCookie(
    res: Response,
    refreshToken: string,
    expiresAt: Date,
  ) {
    const cookieName = this.authService.getRefreshCookieName();
    res.cookie(cookieName, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      expires: expiresAt,
    });
  }
}
