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

describe('Article media HTTP (e2e)', () => {
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

  async function uploadPng(accessToken: string, filename: string) {
    const uploaded = await http(app)
      .post(`${PREFIX}/media`)
      .set(bearer(accessToken))
      .attach('file', PNG_1X1, {
        filename,
        contentType: 'image/png',
      })
      .expect(201);
    return uploaded.body.payload as { id: string; url: string };
  }

  it('creates an article with an uploaded cover and stores inline markdown media urls', async () => {
    const { session } = await registerVerifiedUser(app, 'acov');
    const auth = bearer(session.accessToken);
    const cover = await uploadPng(session.accessToken, 'cover.png');
    const inline = await uploadPng(session.accessToken, 'inline.png');

    const created = await http(app)
      .post(`${PREFIX}/articles`)
      .set(auth)
      .send({
        title: 'Cover and inline images',
        content: `## Intro\n\n![diagram](${inline.url})`,
        coverImageUrl: cover.url,
        isPublished: true,
      })
      .expect(201);

    expect(created.body.payload.coverImageUrl).toBe(cover.url);
    expect(created.body.payload.content).toContain(`![diagram](${inline.url})`);

    const fetched = await http(app)
      .get(`${PREFIX}/articles/${created.body.payload.slug}`)
      .expect(200);
    expect(fetched.body.payload.coverImageUrl).toBe(cover.url);
    expect(fetched.body.payload.content).toContain(inline.url);

    await http(app).get(cover.url).expect(200);
  });

  it('rejects a cover that is not an uploaded media path or https url', async () => {
    const { session } = await registerVerifiedUser(app, 'abad');
    const response = await http(app)
      .post(`${PREFIX}/articles`)
      .set(bearer(session.accessToken))
      .send({
        title: 'Bad cover',
        content: 'body',
        coverImageUrl: 'javascript:alert(1)',
        isPublished: true,
      })
      .expect(400);

    expect(response.body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('replaces a cover and best-effort-deletes the previous media object', async () => {
    const { session } = await registerVerifiedUser(app, 'aswp');
    const auth = bearer(session.accessToken);
    const first = await uploadPng(session.accessToken, 'first.png');
    const second = await uploadPng(session.accessToken, 'second.png');

    const created = await http(app)
      .post(`${PREFIX}/articles`)
      .set(auth)
      .send({
        title: 'Swap cover',
        content: 'body',
        coverImageUrl: first.url,
        isPublished: true,
      })
      .expect(201);

    await http(app)
      .patch(`${PREFIX}/articles/${created.body.payload.id}`)
      .set(auth)
      .send({ coverImageUrl: second.url })
      .expect(200);

    await http(app).get(second.url).expect(200);
    await http(app).get(first.url).expect(404);
  });

  it('clears the cover with null and 404s the old media object', async () => {
    const { session } = await registerVerifiedUser(app, 'aclr');
    const auth = bearer(session.accessToken);
    const cover = await uploadPng(session.accessToken, 'clear.png');

    const created = await http(app)
      .post(`${PREFIX}/articles`)
      .set(auth)
      .send({
        title: 'Clear cover',
        content: 'body',
        coverImageUrl: cover.url,
        isPublished: true,
      })
      .expect(201);

    const cleared = await http(app)
      .patch(`${PREFIX}/articles/${created.body.payload.id}`)
      .set(auth)
      .send({ coverImageUrl: null })
      .expect(200);

    expect(cleared.body.payload.coverImageUrl).toBeNull();
    await http(app).get(cover.url).expect(404);
  });

  it('deletes cover media when the article is deleted', async () => {
    const { session } = await registerVerifiedUser(app, 'adel');
    const auth = bearer(session.accessToken);
    const cover = await uploadPng(session.accessToken, 'gone.png');

    const created = await http(app)
      .post(`${PREFIX}/articles`)
      .set(auth)
      .send({
        title: 'Delete with cover',
        content: 'body',
        coverImageUrl: cover.url,
        isPublished: true,
      })
      .expect(201);

    await http(app)
      .delete(`${PREFIX}/articles/${created.body.payload.id}`)
      .set(auth)
      .expect(200);

    await http(app).get(cover.url).expect(404);
  });
});
