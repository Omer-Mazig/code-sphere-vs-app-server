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

  it('rejects an unauthenticated feed and unauthenticated writes', async () => {
    const feed = await http(app).get(`${PREFIX}/posts`).expect(401);
    expect(feed.body.errorCode).toBe(ErrorCode.AUTHENTICATION_ERROR);

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

  it('honors feed limit for the global and author feeds', async () => {
    const author = await registerVerifiedUser(app, 'feed');
    const authHeader = bearer(author.session.accessToken);

    for (let index = 0; index < 12; index += 1) {
      await http(app)
        .post(`${PREFIX}/posts`)
        .set(authHeader)
        .send({ content: `post ${index}` })
        .expect(201);
    }

    const defaultFeed = await http(app)
      .get(`${PREFIX}/posts`)
      .set(authHeader)
      .expect(200);
    expect(defaultFeed.body.payload.items).toHaveLength(12);
    expect(defaultFeed.body.payload.meta.limit).toBe(20);
    expect(defaultFeed.body.payload.meta.total).toBe(12);
    expect(defaultFeed.body.payload.meta.hasNextPage).toBe(false);

    const limitedFeed = await http(app)
      .get(`${PREFIX}/posts`)
      .set(authHeader)
      .query({ limit: 10 })
      .expect(200);
    expect(limitedFeed.body.payload.items).toHaveLength(10);
    expect(limitedFeed.body.payload.meta.limit).toBe(10);
    expect(limitedFeed.body.payload.meta.total).toBe(12);
    expect(limitedFeed.body.payload.meta.hasNextPage).toBe(true);

    const authorFeed = await http(app)
      .get(`${PREFIX}/posts`)
      .set(authHeader)
      .query({ authorId: author.session.user.id, limit: 10 })
      .expect(200);
    expect(authorFeed.body.payload.items).toHaveLength(10);
    expect(authorFeed.body.payload.meta.limit).toBe(10);
    expect(authorFeed.body.payload.meta.total).toBe(12);
  });

  it('records a share and lets a user reshare a post as a new post', async () => {
    const author = await registerVerifiedUser(app, 'orig');
    const sharer = await registerVerifiedUser(app, 'shrr');
    const authorHeader = bearer(author.session.accessToken);
    const sharerHeader = bearer(sharer.session.accessToken);

    const original = await http(app)
      .post(`${PREFIX}/posts`)
      .set(authorHeader)
      .send({ content: 'please reshare me' })
      .expect(201);
    const originalId = original.body.payload.id as string;
    expect(original.body.payload.sharesCount).toBe(0);
    expect(original.body.payload.isShared).toBe(false);
    expect(original.body.payload.sharedPost).toBeNull();

    await http(app)
      .post(`${PREFIX}/interactions/shares`)
      .set(sharerHeader)
      .send({ targetId: originalId, targetType: 'POST' })
      .expect(201);

    const afterCopy = await http(app)
      .get(`${PREFIX}/posts/${originalId}`)
      .set(sharerHeader)
      .expect(200);
    expect(afterCopy.body.payload.sharesCount).toBe(1);
    expect(afterCopy.body.payload.isShared).toBe(true);

    await http(app)
      .post(`${PREFIX}/interactions/shares`)
      .set(sharerHeader)
      .send({ targetId: originalId, targetType: 'POST' })
      .expect(201);

    const afterSecondCopy = await http(app)
      .get(`${PREFIX}/posts/${originalId}`)
      .set(sharerHeader)
      .expect(200);
    expect(afterSecondCopy.body.payload.sharesCount).toBe(1);

    const reshare = await http(app)
      .post(`${PREFIX}/posts`)
      .set(sharerHeader)
      .send({ content: 'worth amplifying', sharedPostId: originalId })
      .expect(201);

    expect(reshare.body.payload.content).toBe('worth amplifying');
    expect(reshare.body.payload.sharedPost).toEqual(
      expect.objectContaining({
        id: originalId,
        content: 'please reshare me',
      }),
    );

    const originalAfterReshare = await http(app)
      .get(`${PREFIX}/posts/${originalId}`)
      .set(sharerHeader)
      .expect(200);
    expect(originalAfterReshare.body.payload.sharesCount).toBe(1);

    const nested = await http(app)
      .post(`${PREFIX}/posts`)
      .set(authorHeader)
      .send({ sharedPostId: reshare.body.payload.id })
      .expect(201);
    expect(nested.body.payload.content).toBe('');
    expect(nested.body.payload.sharedPost.id).toBe(originalId);

    await http(app)
      .post(`${PREFIX}/posts`)
      .set(sharerHeader)
      .send({})
      .expect(400)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      });

    await http(app)
      .post(`${PREFIX}/posts`)
      .set(sharerHeader)
      .send({ sharedPostId: '00000000-0000-4000-8000-000000000000' })
      .expect(404)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.POST_NOT_FOUND);
      });
  });

  it('embeds isFollowing on content authors without extra profile lookups', async () => {
    const author = await registerVerifiedUser(app, 'faut');
    const viewer = await registerVerifiedUser(app, 'fview');
    const authorHeader = bearer(author.session.accessToken);
    const viewerHeader = bearer(viewer.session.accessToken);

    const createdPost = await http(app)
      .post(`${PREFIX}/posts`)
      .set(authorHeader)
      .send({ content: 'follow me on the feed' })
      .expect(201);
    const postId = createdPost.body.payload.id as string;
    expect(createdPost.body.payload.author.isFollowing).toBe(false);

    await http(app)
      .post(`${PREFIX}/articles`)
      .set(authorHeader)
      .send({
        title: 'Follow me in articles',
        content: [{ type: 'paragraph', content: 'hello' }],
        isPublished: true,
      })
      .expect(201);

    const guestFeed = await http(app).get(`${PREFIX}/posts`).expect(401);
    expect(guestFeed.body.errorCode).toBe(ErrorCode.AUTHENTICATION_ERROR);

    const ownFeed = await http(app)
      .get(`${PREFIX}/posts`)
      .set(authorHeader)
      .expect(200);
    expect(ownFeed.body.payload.items[0].author.isFollowing).toBe(false);

    const ownDetail = await http(app)
      .get(`${PREFIX}/posts/${postId}`)
      .set(authorHeader)
      .expect(200);
    expect(ownDetail.body.payload.author.isFollowing).toBe(false);

    const beforeFollow = await http(app)
      .get(`${PREFIX}/posts`)
      .set(viewerHeader)
      .expect(200);
    expect(beforeFollow.body.payload.items[0].author.isFollowing).toBe(false);

    await http(app)
      .post(`${PREFIX}/users/${author.session.user.id}/follow`)
      .set(viewerHeader)
      .expect(201);

    const afterFollow = await http(app)
      .get(`${PREFIX}/posts`)
      .set(viewerHeader)
      .expect(200);
    expect(afterFollow.body.payload.items[0].author.isFollowing).toBe(true);

    const afterFollowDetail = await http(app)
      .get(`${PREFIX}/posts/${postId}`)
      .set(viewerHeader)
      .expect(200);
    expect(afterFollowDetail.body.payload.author.isFollowing).toBe(true);

    const articles = await http(app)
      .get(`${PREFIX}/articles`)
      .set(viewerHeader)
      .expect(200);
    expect(articles.body.payload.items[0].author.isFollowing).toBe(true);
  });

  it('lets guests read article comments but not post comments', async () => {
    const author = await registerVerifiedUser(app, 'cmtg');
    const authorHeader = bearer(author.session.accessToken);

    const post = await http(app)
      .post(`${PREFIX}/posts`)
      .set(authorHeader)
      .send({ content: 'private discussion' })
      .expect(201);
    const postId = post.body.payload.id as string;

    const article = await http(app)
      .post(`${PREFIX}/articles`)
      .set(authorHeader)
      .send({
        title: 'Public discussion',
        content: [{ type: 'paragraph', content: 'hello' }],
        isPublished: true,
      })
      .expect(201);
    const articleId = article.body.payload.id as string;

    await http(app)
      .post(`${PREFIX}/interactions/comments`)
      .set(authorHeader)
      .send({
        targetId: postId,
        targetType: 'POST',
        content: 'post comment',
      })
      .expect(201);

    await http(app)
      .post(`${PREFIX}/interactions/comments`)
      .set(authorHeader)
      .send({
        targetId: articleId,
        targetType: 'ARTICLE',
        content: 'article comment',
      })
      .expect(201);

    const guestPostComments = await http(app)
      .get(`${PREFIX}/interactions/comments`)
      .query({ targetId: postId, targetType: 'POST' })
      .expect(401);
    expect(guestPostComments.body.errorCode).toBe(
      ErrorCode.AUTHENTICATION_ERROR,
    );

    const guestArticleComments = await http(app)
      .get(`${PREFIX}/interactions/comments`)
      .query({ targetId: articleId, targetType: 'ARTICLE' })
      .expect(200);
    expect(guestArticleComments.body.payload.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: 'article comment' }),
      ]),
    );
  });
});
