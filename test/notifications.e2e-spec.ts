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

describe('Mention notifications HTTP (e2e)', () => {
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

  it('notifies mentioned users from posts, published articles, and comments', async () => {
    const author = await registerVerifiedUser(app, 'auth');
    const mentioned = await registerVerifiedUser(app, 'ment');
    const authorHeader = bearer(author.session.accessToken);
    const mentionedHeader = bearer(mentioned.session.accessToken);

    await http(app)
      .post(`${PREFIX}/posts`)
      .set(authorHeader)
      .send({
        content: `hey @${mentioned.user.username} @${mentioned.user.username} and @${author.user.username}`,
      })
      .expect(201);

    const postMentions = await http(app)
      .get(`${PREFIX}/notifications`)
      .set(mentionedHeader)
      .expect(200);
    expect(postMentions.body.payload.items).toHaveLength(1);
    expect(postMentions.body.payload.items[0]).toEqual(
      expect.objectContaining({
        type: 'USER_MENTIONED',
        targetType: 'POST',
      }),
    );

    const selfNotifications = await http(app)
      .get(`${PREFIX}/notifications`)
      .set(authorHeader)
      .expect(200);
    expect(selfNotifications.body.payload.items).toHaveLength(0);

    const createdArticle = await http(app)
      .post(`${PREFIX}/articles`)
      .set(authorHeader)
      .send({
        title: 'Draft with a mention',
        content: [{ type: 'paragraph', content: `@${mentioned.user.username}` }],
        isPublished: false,
      })
      .expect(201);

    const afterDraft = await http(app)
      .get(`${PREFIX}/notifications`)
      .set(mentionedHeader)
      .expect(200);
    expect(afterDraft.body.payload.items).toHaveLength(1);

    await http(app)
      .patch(`${PREFIX}/articles/${createdArticle.body.payload.id}`)
      .set(authorHeader)
      .send({ isPublished: true })
      .expect(200);

    const afterPublish = await http(app)
      .get(`${PREFIX}/notifications`)
      .set(mentionedHeader)
      .expect(200);
    expect(afterPublish.body.payload.items).toHaveLength(2);
    expect(afterPublish.body.payload.items[0]).toEqual(
      expect.objectContaining({
        type: 'USER_MENTIONED',
        targetType: 'ARTICLE',
        payload: expect.objectContaining({
          articleSlug: createdArticle.body.payload.slug,
        }),
      }),
    );

    const mentionedPost = await http(app)
      .post(`${PREFIX}/posts`)
      .set(mentionedHeader)
      .send({ content: 'open for comments' })
      .expect(201);

    await http(app)
      .post(`${PREFIX}/interactions/comments`)
      .set(authorHeader)
      .send({
        targetId: mentionedPost.body.payload.id,
        targetType: 'POST',
        content: `see this @${mentioned.user.username}`,
      })
      .expect(201);

    const afterComment = await http(app)
      .get(`${PREFIX}/notifications`)
      .set(mentionedHeader)
      .expect(200);
    expect(afterComment.body.payload.items).toHaveLength(3);
    expect(afterComment.body.payload.items[0]).toEqual(
      expect.objectContaining({
        type: 'USER_MENTIONED',
        targetType: 'POST',
        payload: expect.objectContaining({
          postId: mentionedPost.body.payload.id,
          commentId: expect.any(String),
        }),
      }),
    );
  });

  it('sends only a mention notification when the post author is tagged in a comment', async () => {
    const author = await registerVerifiedUser(app, 'ownr');
    const commenter = await registerVerifiedUser(app, 'cmt');
    const authorHeader = bearer(author.session.accessToken);
    const commenterHeader = bearer(commenter.session.accessToken);

    const post = await http(app)
      .post(`${PREFIX}/posts`)
      .set(authorHeader)
      .send({ content: 'shipped it' })
      .expect(201);

    await http(app)
      .post(`${PREFIX}/interactions/comments`)
      .set(commenterHeader)
      .send({
        targetId: post.body.payload.id,
        targetType: 'POST',
        content: `@${author.user.username} nice work`,
      })
      .expect(201);

    const notifications = await http(app)
      .get(`${PREFIX}/notifications`)
      .set(authorHeader)
      .expect(200);

    expect(notifications.body.payload.items.map((item: { type: string }) => item.type)).toEqual(
      ['USER_MENTIONED'],
    );
  });
});
