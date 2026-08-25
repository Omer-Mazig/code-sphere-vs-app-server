import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestingApp, resetDatabase } from './testing-app';
import {
  api,
  bearer,
  http,
  registerVerifiedUser,
} from './test-helpers';

const PREFIX = api();

describe('Profile PATCH HTTP (e2e)', () => {
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

  it('updates only sent fields, ignores empty strings, and clears with null', async () => {
    const registered = await registerVerifiedUser(app, 'prof');
    const header = bearer(registered.session.accessToken);

    await http(app)
      .patch(`${PREFIX}/users/me`)
      .set(header)
      .send({
        displayName: 'Ada Lovelace',
        bio: 'Mathematician',
        location: 'London',
        website: 'https://ada.dev',
        github: 'ada',
        avatarUrl: 'https://example.com/ada.png',
      })
      .expect(200);

    const afterPartial = await http(app)
      .patch(`${PREFIX}/users/me`)
      .set(header)
      .send({
        location: 'Manchester',
        bio: '',
        website: undefined,
      })
      .expect(200);

    expect(afterPartial.body.payload).toEqual(
      expect.objectContaining({
        displayName: 'Ada Lovelace',
        bio: 'Mathematician',
        location: 'Manchester',
        website: 'https://ada.dev',
        github: 'ada',
        avatarUrl: 'https://example.com/ada.png',
      }),
    );

    const afterClear = await http(app)
      .patch(`${PREFIX}/users/me`)
      .set(header)
      .send({
        bio: null,
        location: null,
        website: null,
        github: null,
        avatarUrl: null,
      })
      .expect(200);

    expect(afterClear.body.payload).toEqual(
      expect.objectContaining({
        displayName: 'Ada Lovelace',
        bio: null,
        location: null,
        website: null,
        github: null,
        avatarUrl: null,
      }),
    );
  });

  it('does not clear displayName when null or blank is sent', async () => {
    const registered = await registerVerifiedUser(app, 'name');
    const header = bearer(registered.session.accessToken);

    await http(app)
      .patch(`${PREFIX}/users/me`)
      .set(header)
      .send({ displayName: 'Kept Name' })
      .expect(200);

    const afterNull = await http(app)
      .patch(`${PREFIX}/users/me`)
      .set(header)
      .send({ displayName: null })
      .expect(200);
    expect(afterNull.body.payload.displayName).toBe('Kept Name');

    const afterBlank = await http(app)
      .patch(`${PREFIX}/users/me`)
      .set(header)
      .send({ displayName: '   ' })
      .expect(200);
    expect(afterBlank.body.payload.displayName).toBe('Kept Name');
  });
});
