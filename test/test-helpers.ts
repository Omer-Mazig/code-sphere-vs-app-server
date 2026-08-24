import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AuthService } from '../src/auth/auth.service';

export const TEST_PASSWORD = 'Password1';

export function api() {
  return '/api';
}

export function uniqueUser(prefix: string) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    email: `${prefix}-${suffix}@example.com`,
    username: `${prefix}${suffix}`.slice(0, 30),
    displayName: prefix,
    password: TEST_PASSWORD,
  };
}

export function tokenFromVerificationUrl(url: string) {
  return new URL(url).searchParams.get('token') ?? '';
}

export async function registerVerifiedUser(
  app: INestApplication,
  prefix = 'user',
) {
  const authService = app.get(AuthService);
  const user = uniqueUser(prefix);
  const registered = await authService.register(user);
  const token = tokenFromVerificationUrl(registered.verificationUrl ?? '');
  const session = await authService.verifyEmail(token, {});
  return { user, session };
}

export function bearer(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export function http(app: INestApplication) {
  return request(app.getHttpServer());
}

export function agent(app: INestApplication) {
  return request.agent(app.getHttpServer());
}

export function readCookie(
  response: request.Response,
  name: string,
): string | undefined {
  const header = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) {
    return undefined;
  }
  return match.split(';')[0]?.slice(`${name}=`.length);
}
