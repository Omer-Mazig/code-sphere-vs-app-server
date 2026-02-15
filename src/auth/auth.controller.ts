import { Controller, Post, Body, Req, Res, HttpCode } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../common/decorators';
import {
  ApiEnvelopeCreatedResponse,
  ApiEnvelopeOkResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';
import { AuthSessionResponseDto, LogoutResponseDto } from './dto/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(200)
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

    this.setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('register')
  @Public()
  @ApiEnvelopeCreatedResponse(AuthSessionResponseDto)
  @ApiStandardErrorResponses()
  async register(
    @Body() payload: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(payload, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiEnvelopeOkResponse(AuthSessionResponseDto)
  @ApiStandardErrorResponses()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieName = this.authService.getRefreshCookieName();
    const refreshToken = req.cookies?.[cookieName];

    const result = await this.authService.refresh(refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);

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
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieName = this.authService.getRefreshCookieName();
    const refreshToken = req.cookies?.[cookieName];

    await this.authService.logout(refreshToken);

    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return { message: 'Logged out' };
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
