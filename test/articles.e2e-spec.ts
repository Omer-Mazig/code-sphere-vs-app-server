import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ErrorCode } from '../src/common/errors/error-codes.enum';
import { createTestingApp, resetDatabase } from './testing-app';
import {
  api,
  bearer,
  http,
  registerVerifiedUser,
} from './test-helpers';

const PREFIX = api();

describe('Articles HTTP (e2e)', () => {
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

  it('searches published articles by title and markdown body', async () => {
    const author = await registerVerifiedUser(app, 'srch');
    const header = bearer(author.session.accessToken);

    const titleHit = await http(app)
      .post(`${PREFIX}/articles`)
      .set(header)
      .send({
        title: 'Visible generics',
        content: 'unrelated body',
        isPublished: true,
      })
      .expect(201);

    const bodyHit = await http(app)
      .post(`${PREFIX}/articles`)
      .set(header)
      .send({
        title: 'Other note',
        content: '## Why uniqueBodyToken matters\n\nIt lives only here.',
        isPublished: true,
      })
      .expect(201);

    await http(app)
      .post(`${PREFIX}/articles`)
      .set(header)
      .send({
        title: 'Draft uniqueBodyToken',
        content: 'uniqueBodyToken in a draft',
        isPublished: false,
      })
      .expect(201);

    const byTitle = await http(app)
      .get(`${PREFIX}/articles`)
      .query({ search: 'generics', isPublished: 'true' })
      .expect(200);
    expect(byTitle.body.payload.items.map((item: { id: string }) => item.id)).toEqual([
      titleHit.body.payload.id,
    ]);

    const byBody = await http(app)
      .get(`${PREFIX}/articles`)
      .query({ search: 'uniqueBodyToken', isPublished: 'true' })
      .expect(200);
    expect(byBody.body.payload.items.map((item: { id: string }) => item.id)).toEqual([
      bodyHit.body.payload.id,
    ]);
  });

  it('pages published articles with meta.totalPages and hasNextPage', async () => {
    const author = await registerVerifiedUser(app, 'page');
    const header = bearer(author.session.accessToken);

    for (let index = 0; index < 3; index += 1) {
      await http(app)
        .post(`${PREFIX}/articles`)
        .set(header)
        .send({
          title: `Paged article ${index}`,
          content: 'body',
          isPublished: true,
        })
        .expect(201);
    }

    const page1 = await http(app)
      .get(`${PREFIX}/articles`)
      .query({ isPublished: 'true', page: 1, limit: 2 })
      .expect(200);
    expect(page1.body.payload.items).toHaveLength(2);
    expect(page1.body.payload.meta).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNextPage: true,
      }),
    );

    const page2 = await http(app)
      .get(`${PREFIX}/articles`)
      .query({ isPublished: 'true', page: 2, limit: 2 })
      .expect(200);
    expect(page2.body.payload.items).toHaveLength(1);
    expect(page2.body.payload.meta).toEqual(
      expect.objectContaining({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNextPage: false,
      }),
    );
    expect(page2.body.payload.items[0].id).not.toBe(
      page1.body.payload.items[0].id,
    );
    expect(page2.body.payload.items[0].id).not.toBe(
      page1.body.payload.items[1].id,
    );
  });

  it('lists distinct authors of published articles', async () => {
    const publishedAuthor = await registerVerifiedUser(app, 'puba');
    const draftAuthor = await registerVerifiedUser(app, 'drfa');
    const secondAuthor = await registerVerifiedUser(app, 'secb');

    await http(app)
      .post(`${PREFIX}/articles`)
      .set(bearer(publishedAuthor.session.accessToken))
      .send({
        title: 'Published one',
        content: 'body',
        isPublished: true,
      })
      .expect(201);

    await http(app)
      .post(`${PREFIX}/articles`)
      .set(bearer(publishedAuthor.session.accessToken))
      .send({
        title: 'Published two',
        content: 'body',
        isPublished: true,
      })
      .expect(201);

    await http(app)
      .post(`${PREFIX}/articles`)
      .set(bearer(secondAuthor.session.accessToken))
      .send({
        title: 'Second voice',
        content: 'body',
        isPublished: true,
      })
      .expect(201);

    await http(app)
      .post(`${PREFIX}/articles`)
      .set(bearer(draftAuthor.session.accessToken))
      .send({
        title: 'Only a draft',
        content: 'body',
        isPublished: false,
      })
      .expect(201);

    const authors = await http(app).get(`${PREFIX}/articles/authors`).expect(200);
    const ids = authors.body.payload.map((author: { id: string }) => author.id);
    expect(ids).toHaveLength(2);
    expect(ids).toEqual(
      expect.arrayContaining([
        publishedAuthor.session.user.id,
        secondAuthor.session.user.id,
      ]),
    );
    expect(ids).not.toContain(draftAuthor.session.user.id);
  });

  it('lets the author update and delete an article and blocks everyone else', async () => {
    const author = await registerVerifiedUser(app, 'aown');
    const other = await registerVerifiedUser(app, 'aintr');
    const authorHeader = bearer(author.session.accessToken);
    const otherHeader = bearer(other.session.accessToken);

    const created = await http(app)
      .post(`${PREFIX}/articles`)
      .set(authorHeader)
      .send({
        title: 'Original title',
        content: 'original markdown',
        isPublished: true,
      })
      .expect(201);
    const articleId = created.body.payload.id as string;
    const slug = created.body.payload.slug as string;

    await http(app)
      .patch(`${PREFIX}/articles/${articleId}`)
      .set(otherHeader)
      .send({ content: 'stolen' })
      .expect(403)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.ARTICLE_UPDATE_FORBIDDEN);
      });

    await http(app)
      .delete(`${PREFIX}/articles/${articleId}`)
      .set(otherHeader)
      .expect(403)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.ARTICLE_DELETE_FORBIDDEN);
      });

    await http(app)
      .patch(`${PREFIX}/articles/${articleId}`)
      .send({ content: 'anonymous' })
      .expect(401);

    const updated = await http(app)
      .patch(`${PREFIX}/articles/${articleId}`)
      .set(authorHeader)
      .send({
        title: 'Original title',
        content: 'revised markdown',
        isPublished: true,
      })
      .expect(200);
    expect(updated.body.payload.id).toBe(articleId);
    expect(updated.body.payload.slug).toBe(slug);
    expect(updated.body.payload.content).toBe('revised markdown');

    const listed = await http(app)
      .get(`${PREFIX}/articles`)
      .query({ search: 'revised markdown', isPublished: 'true' })
      .expect(200);
    expect(listed.body.payload.items.map((item: { id: string }) => item.id)).toEqual(
      [articleId],
    );

    await http(app)
      .delete(`${PREFIX}/articles/${articleId}`)
      .set(authorHeader)
      .expect(200);

    await http(app)
      .get(`${PREFIX}/articles/${slug}`)
      .expect(404)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.ARTICLE_NOT_FOUND);
      });
  });

  it('hides unpublished articles from everyone except the author', async () => {
    const author = await registerVerifiedUser(app, 'adft');
    const other = await registerVerifiedUser(app, 'avwr');
    const authorHeader = bearer(author.session.accessToken);

    const draft = await http(app)
      .post(`${PREFIX}/articles`)
      .set(authorHeader)
      .send({
        title: 'Secret draft',
        content: 'not public yet',
        isPublished: false,
      })
      .expect(201);
    const slug = draft.body.payload.slug as string;
    const articleId = draft.body.payload.id as string;

    await http(app)
      .get(`${PREFIX}/articles/${slug}`)
      .expect(404)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.ARTICLE_NOT_FOUND);
      });

    await http(app)
      .get(`${PREFIX}/articles/${slug}`)
      .set(bearer(other.session.accessToken))
      .expect(404)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.ARTICLE_NOT_FOUND);
      });

    const own = await http(app)
      .get(`${PREFIX}/articles/${slug}`)
      .set(authorHeader)
      .expect(200);
    expect(own.body.payload.id).toBe(articleId);
    expect(own.body.payload.isPublished).toBe(false);
  });
});
