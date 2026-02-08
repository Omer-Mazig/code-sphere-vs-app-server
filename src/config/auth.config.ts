import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  accessTokenSecret: process.env.JWT_ACCESS_SECRET,
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET,
  accessTokenTtlSeconds: parseInt(
    process.env.JWT_ACCESS_TTL_SECONDS ?? '900',
    10,
  ),
  refreshTokenTtlSeconds: parseInt(
    process.env.JWT_REFRESH_TTL_SECONDS ?? `${60 * 60 * 24 * 30}`,
    10,
  ),
  refreshCookieName:
    process.env.REFRESH_TOKEN_COOKIE_NAME ?? 'refresh_token',
}));
