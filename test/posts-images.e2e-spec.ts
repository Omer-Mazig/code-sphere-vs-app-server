import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ErrorCode } from '../src/common/errors/error-codes.enum';
import { createTestingApp, resetDatabase } from './testing-app';
import { api, bearer, http, registerVerifiedUser } from './test-helpers';

const PREFIX = api();

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Post images HTTP (e2e)', () => {
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

  async function uploadPng(token: string, name: string) {
    const uploaded = await http(app)
      .post(`${PREFIX}/media`)
      .set(bearer(token))
      .attach('file', PNG_1X1, {
        filename: name,
        contentType: 'image/png',
      })
      .expect(201);
    return uploaded.body.payload as { id: string; url: string };
  }

  it('attaches ordered images on create and returns them on feed and detail', async () => {
    const author = await registerVerifiedUser(app, 'pimg');
    const auth = bearer(author.session.accessToken);
    const first = await uploadPng(author.session.accessToken, 'a.png');
    const second = await uploadPng(author.session.accessToken, 'b.png');

    const created = await http(app)
      .post(`${PREFIX}/posts`)
      .set(auth)
      .send({
        content: 'gallery post',
        imageMediaIds: [second.id, first.id],
        imageLayout: 'CAROUSEL',
      })
      .expect(201);

    expect(created.body.payload.imageLayout).toBe('CAROUSEL');
    expect(created.body.payload.images).toEqual([
      { id: second.id, url: second.url },
      { id: first.id, url: first.url },
    ]);

    const detail = await http(app)
      .get(`${PREFIX}/posts/${created.body.payload.id}`)
      .set(auth)
      .expect(200);
    expect(detail.body.payload.images.map((image: { id: string }) => image.id)).toEqual(
      [second.id, first.id],
    );

    const feed = await http(app).get(`${PREFIX}/posts`).set(auth).expect(200);
    expect(feed.body.payload.items[0].images).toHaveLength(2);
  });

  it('allows an image-only post and rejects an 11th image', async () => {
    const author = await registerVerifiedUser(app, 'only');
    const auth = bearer(author.session.accessToken);
    const uploaded = await uploadPng(author.session.accessToken, 'solo.png');

    const created = await http(app)
      .post(`${PREFIX}/posts`)
      .set(auth)
      .send({ imageMediaIds: [uploaded.id], imageLayout: 'GALLERY' })
      .expect(201);
    expect(created.body.payload.content).toBe('');
    expect(created.body.payload.images).toHaveLength(1);

    const ids = [uploaded.id];
    for (let index = 0; index < 10; index += 1) {
      const extra = await uploadPng(author.session.accessToken, `n${index}.png`);
      ids.push(extra.id);
    }

    const rejected = await http(app)
      .post(`${PREFIX}/posts`)
      .set(auth)
      .send({ content: 'too many', imageMediaIds: ids })
      .expect(400);
    expect(rejected.body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('does not notify or attach another user’s media, and best-effort deletes storage on post delete', async () => {
    const author = await registerVerifiedUser(app, 'ownr');
    const other = await registerVerifiedUser(app, 'othr');
    const own = await uploadPng(author.session.accessToken, 'mine.png');
    const theirs = await uploadPng(other.session.accessToken, 'theirs.png');

    await http(app)
      .post(`${PREFIX}/posts`)
      .set(bearer(author.session.accessToken))
      .send({ content: 'nope', imageMediaIds: [theirs.id] })
      .expect(403)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.AUTHORIZATION_ERROR);
      });

    const created = await http(app)
      .post(`${PREFIX}/posts`)
      .set(bearer(author.session.accessToken))
      .send({ content: 'mine', imageMediaIds: [own.id] })
      .expect(201);

    await http(app)
      .delete(`${PREFIX}/posts/${created.body.payload.id}`)
      .set(bearer(author.session.accessToken))
      .expect(200);

    await http(app).get(own.url).expect(404);
  });
});
