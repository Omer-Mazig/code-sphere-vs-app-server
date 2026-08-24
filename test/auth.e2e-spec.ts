import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ErrorCode } from '../src/common/errors/error-codes.enum';
import { createTestingApp, resetDatabase } from './testing-app';
import {
  agent,
  api,
  http,
  readCookie,
  tokenFromVerificationUrl,
  uniqueUser,
} from './test-helpers';

const PREFIX = api();
const COOKIE_NAME = process.env.REFRESH_TOKEN_COOKIE_NAME ?? 'refresh_token';

describe('Auth HTTP (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestingApp());
  });

  afterEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a weak password on register', async () => {
    const response = await http(app)
      .post(`${PREFIX}/auth/register`)
      .send({
        email: 'weak@example.com',
        username: 'weakuser',
        displayName: 'Weak',
        password: 'password',
      });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('requires email verification before login and then issues a session', async () => {
    const user = uniqueUser('e2e');
    const register = await http(app)
      .post(`${PREFIX}/auth/register`)
      .send(user)
      .expect(201);

    expect(register.body.payload.accessToken).toBeUndefined();
    expect(register.body.payload.verificationUrl).toEqual(expect.any(String));

    await http(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: user.email, password: user.password })
      .expect(403)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.EMAIL_NOT_VERIFIED);
      });

    const token = tokenFromVerificationUrl(register.body.payload.verificationUrl);
    const session = agent(app);
    const verified = await session
      .post(`${PREFIX}/auth/verify-email`)
      .send({ token })
      .expect(200);

    expect(verified.body.payload.accessToken).toEqual(expect.any(String));
    expect(verified.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining(`${COOKIE_NAME}=`)]),
    );

    const me = await session
      .get(`${PREFIX}/users/me`)
      .set('Authorization', `Bearer ${verified.body.payload.accessToken}`)
      .expect(200);
    expect(me.body.payload.email).toBe(user.email);

    const publicProfile = await http(app)
      .get(`${PREFIX}/users/${verified.body.payload.user.id}`)
      .expect(200);
    expect(publicProfile.body.payload.email).toBeUndefined();
  });

  it('rotates the refresh cookie and rejects reuse of the previous token', async () => {
    const user = uniqueUser('ref');
    const register = await http(app)
      .post(`${PREFIX}/auth/register`)
      .send(user)
      .expect(201);
    const token = tokenFromVerificationUrl(register.body.payload.verificationUrl);

    const session = agent(app);
    const verified = await session
      .post(`${PREFIX}/auth/verify-email`)
      .send({ token })
      .expect(200);
    const originalRefresh = readCookie(verified, COOKIE_NAME);
    expect(originalRefresh).toBeTruthy();

    await session.post(`${PREFIX}/auth/refresh`).expect(200);

    await http(app)
      .post(`${PREFIX}/auth/refresh`)
      .set('Cookie', `${COOKIE_NAME}=${originalRefresh}`)
      .expect(401);

    await session.post(`${PREFIX}/auth/logout`).expect(200);
    await session.post(`${PREFIX}/auth/refresh`).expect(401);
  });
});
