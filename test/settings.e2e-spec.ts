import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ErrorCode } from '../src/common/errors/error-codes.enum';
import { User } from '../src/users/entities/user.entity';
import { createTestingApp, resetDatabase } from './testing-app';
import {
  agent,
  api,
  bearer,
  http,
  readCookie,
  registerVerifiedUser,
  TEST_PASSWORD,
} from './test-helpers';

const PREFIX = api();
const COOKIE_NAME = process.env.REFRESH_TOKEN_COOKIE_NAME ?? 'refresh_token';

describe('Settings HTTP (e2e)', () => {
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

  it('changes the password, keeps this session, and revokes other refresh tokens', async () => {
    const { user } = await registerVerifiedUser(app, 'pwd');
    const nextPassword = 'Password2';

    const sessionA = agent(app);
    const loginA = await sessionA
      .post(`${PREFIX}/auth/login`)
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);

    const sessionB = agent(app);
    await sessionB
      .post(`${PREFIX}/auth/login`)
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);

    const changed = await sessionA
      .post(`${PREFIX}/auth/change-password`)
      .set(bearer(loginA.body.payload.accessToken))
      .send({ currentPassword: TEST_PASSWORD, newPassword: nextPassword })
      .expect(200);

    expect(changed.body.payload.accessToken).toEqual(expect.any(String));
    const newRefresh = readCookie(changed, COOKIE_NAME);
    expect(newRefresh).toBeTruthy();

    await sessionB.post(`${PREFIX}/auth/refresh`).expect(401);
    await http(app)
      .post(`${PREFIX}/auth/refresh`)
      .set('Cookie', `${COOKIE_NAME}=${newRefresh}`)
      .expect(200);

    await http(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(401);

    await http(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: user.email, password: nextPassword })
      .expect(200);
  });

  it('rejects a wrong current password without changing the hash', async () => {
    const { user, session } = await registerVerifiedUser(app, 'wrong');
    const users = dataSource.getRepository(User);
    const before = await users.findOneByOrFail({ email: user.email });

    await http(app)
      .post(`${PREFIX}/auth/change-password`)
      .set(bearer(session.accessToken))
      .send({ currentPassword: 'WrongPass1', newPassword: 'Password2' })
      .expect(401)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.AUTHENTICATION_ERROR);
        expect(res.body.message).toBe('Invalid credentials');
      });

    const after = await users.findOneByOrFail({ email: user.email });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('deactivates without deleting, hides the profile, revokes sessions, and reactivates on login', async () => {
    const { user, session } = await registerVerifiedUser(app, 'deact');
    const userId = session.user.id;
    const users = dataSource.getRepository(User);

    await http(app)
      .post(`${PREFIX}/users/me/deactivate`)
      .set(bearer(session.accessToken))
      .expect(200)
      .expect((res) => {
        expect(res.body.payload.message).toEqual(expect.any(String));
      });

    const deactivated = await users.findOneByOrFail({ id: userId });
    expect(deactivated).toBeTruthy();
    expect(deactivated.isActive).toBe(false);

    await http(app).get(`${PREFIX}/users/${userId}/preview`).expect(404);
    await http(app)
      .post(`${PREFIX}/auth/refresh`)
      .set('Cookie', `${COOKIE_NAME}=${session.refreshToken}`)
      .expect(401);

    await http(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);

    const reactivated = await users.findOneByOrFail({ id: userId });
    expect(reactivated.isActive).toBe(true);

    const preview = await http(app)
      .get(`${PREFIX}/users/${userId}/preview`)
      .expect(200);
    expect(preview.body.payload.id).toBe(userId);
  });
});
