import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestingApp, resetDatabase } from './testing-app';
import { api, bearer, http, registerVerifiedUser } from './test-helpers';

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

  it('updates only sent fields and clears emptied or null fields', async () => {
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
        bio: null,
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

  it('clears displayName when null or blank is sent', async () => {
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
    expect(afterNull.body.payload.displayName).toBeNull();

    await http(app)
      .patch(`${PREFIX}/users/me`)
      .set(header)
      .send({ displayName: 'Restored' })
      .expect(200);

    const afterBlank = await http(app)
      .patch(`${PREFIX}/users/me`)
      .set(header)
      .send({ displayName: '   ' })
      .expect(200);
    expect(afterBlank.body.payload.displayName).toBeNull();
  });

  it('sets avatar and cover from an uploaded media path and clears them', async () => {
    const registered = await registerVerifiedUser(app, 'img');
    const header = bearer(registered.session.accessToken);
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    const avatarUpload = await http(app)
      .post(`${PREFIX}/media`)
      .set(header)
      .attach('file', png, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(201);
    const coverUpload = await http(app)
      .post(`${PREFIX}/media`)
      .set(header)
      .attach('file', png, { filename: 'cover.png', contentType: 'image/png' })
      .expect(201);

    const avatarUrl = avatarUpload.body.payload.url as string;
    const coverImageUrl = coverUpload.body.payload.url as string;

    const saved = await http(app)
      .patch(`${PREFIX}/users/me`)
      .set(header)
      .send({ avatarUrl, coverImageUrl })
      .expect(200);

    expect(saved.body.payload.avatarUrl).toBe(avatarUrl);
    expect(saved.body.payload.coverImageUrl).toBe(coverImageUrl);

    const cleared = await http(app)
      .patch(`${PREFIX}/users/me`)
      .set(header)
      .send({ avatarUrl: null, coverImageUrl: null })
      .expect(200);

    expect(cleared.body.payload.avatarUrl).toBeNull();
    expect(cleared.body.payload.coverImageUrl).toBeNull();
  });
});
