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

describe('Content HTTP (e2e)', () => {
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

  it('serves a public paginated feed and rejects unauthenticated writes', async () => {
    const feed = await http(app).get(`${PREFIX}/posts`).expect(200);

    expect(feed.body.payload).toEqual(
      expect.objectContaining({
        items: [],
        meta: expect.objectContaining({
          total: 0,
          page: 1,
          hasNextPage: false,
        }),
      }),
    );
    expect(feed.body.requestId).toEqual(expect.any(String));

    const create = await http(app)
      .post(`${PREFIX}/posts`)
      .send({ content: 'nope' });
    expect(create.status).toBe(401);
    expect(create.body.errorCode).toBe(ErrorCode.AUTHENTICATION_ERROR);
  });

  it('lets an author manage a post and blocks everyone else', async () => {
    const author = await registerVerifiedUser(app, 'own');
    const other = await registerVerifiedUser(app, 'intr');

    const created = await http(app)
      .post(`${PREFIX}/posts`)
      .set(bearer(author.session.accessToken))
      .send({ content: 'shipped it' })
      .expect(201);

    const postId = created.body.payload.id;
    expect(created.body.payload.author.username).toBe(author.user.username);

    await http(app)
      .patch(`${PREFIX}/posts/${postId}`)
      .set(bearer(other.session.accessToken))
      .send({ content: 'stolen' })
      .expect(403)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.POST_UPDATE_FORBIDDEN);
      });

    await http(app)
      .post(`${PREFIX}/interactions/likes`)
      .set(bearer(other.session.accessToken))
      .send({ targetId: postId, targetType: 'POST' })
      .expect(201);

    await http(app)
      .post(`${PREFIX}/interactions/likes`)
      .set(bearer(other.session.accessToken))
      .send({ targetId: postId, targetType: 'POST' })
      .expect(409)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.ALREADY_LIKED);
      });

    await http(app)
      .post(`${PREFIX}/users/${author.session.user.id}/follow`)
      .set(bearer(author.session.accessToken))
      .expect(400)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.CANNOT_FOLLOW_SELF);
      });
  });
});
