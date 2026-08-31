import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestingApp, resetDatabase } from './testing-app';
import { api, bearer, http, registerVerifiedUser } from './test-helpers';

const PREFIX = api();

type NotificationItem = {
  id: string;
  type: string;
  isRead: boolean;
  payload: {
    actorCount?: number;
    actorIds?: string[];
    actorName?: string;
  };
};

async function listNotifications(
  app: INestApplication,
  accessToken: string,
) {
  const response = await http(app)
    .get(`${PREFIX}/notifications`)
    .set(bearer(accessToken))
    .expect(200);
  return response.body.payload.items as NotificationItem[];
}

async function waitForNotifications(
  app: INestApplication,
  accessToken: string,
  predicate: (items: NotificationItem[]) => boolean,
) {
  let items: NotificationItem[] = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    items = await listNotifications(app, accessToken);
    if (predicate(items)) {
      return items;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return items;
}

describe('Collapsed unread notifications HTTP (e2e)', () => {
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

  it('collapses likes on one unread post and starts a new row after read', async () => {
    const author = await registerVerifiedUser(app, 'auth');
    const likerA = await registerVerifiedUser(app, 'lka');
    const likerB = await registerVerifiedUser(app, 'lkb');
    const authorHeader = bearer(author.session.accessToken);

    const post = await http(app)
      .post(`${PREFIX}/posts`)
      .set(authorHeader)
      .send({ content: 'please like this' })
      .expect(201);
    const postId = post.body.payload.id as string;

    await http(app)
      .post(`${PREFIX}/interactions/likes`)
      .set(bearer(likerA.session.accessToken))
      .send({ targetId: postId, targetType: 'POST' })
      .expect(201);

    await http(app)
      .post(`${PREFIX}/interactions/likes`)
      .set(bearer(likerB.session.accessToken))
      .send({ targetId: postId, targetType: 'POST' })
      .expect(201);

    const collapsed = await waitForNotifications(
      app,
      author.session.accessToken,
      (items) => items.length === 1 && items[0]?.payload.actorCount === 2,
    );

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].type).toBe('POST_LIKED');
    expect(collapsed[0].payload.actorCount).toBe(2);

    await http(app)
      .patch(`${PREFIX}/notifications/${collapsed[0].id}/read`)
      .set(authorHeader)
      .expect(200);

    const likerC = await registerVerifiedUser(app, 'lkc');
    await http(app)
      .post(`${PREFIX}/interactions/likes`)
      .set(bearer(likerC.session.accessToken))
      .send({ targetId: postId, targetType: 'POST' })
      .expect(201);

    const afterRead = await waitForNotifications(
      app,
      author.session.accessToken,
      (items) => items.length === 2,
    );

    expect(afterRead).toHaveLength(2);
    expect(afterRead.map((item) => item.type)).toEqual([
      'POST_LIKED',
      'POST_LIKED',
    ]);
    expect(afterRead[0].isRead).toBe(false);
    expect(afterRead[0].payload.actorCount).toBe(1);
    expect(afterRead[1].isRead).toBe(true);
    expect(afterRead[1].payload.actorCount).toBe(2);
  });

  it('does not collapse mentions or comment replies', async () => {
    const author = await registerVerifiedUser(app, 'ownr');
    const alice = await registerVerifiedUser(app, 'alic');
    const bob = await registerVerifiedUser(app, 'bobb');
    const authorHeader = bearer(author.session.accessToken);

    const post = await http(app)
      .post(`${PREFIX}/posts`)
      .set(authorHeader)
      .send({ content: 'open thread' })
      .expect(201);
    const postId = post.body.payload.id as string;

    await http(app)
      .post(`${PREFIX}/interactions/comments`)
      .set(bearer(alice.session.accessToken))
      .send({
        targetId: postId,
        targetType: 'POST',
        content: `@${author.user.username} first`,
      })
      .expect(201);

    await http(app)
      .post(`${PREFIX}/interactions/comments`)
      .set(bearer(bob.session.accessToken))
      .send({
        targetId: postId,
        targetType: 'POST',
        content: `@${author.user.username} second`,
      })
      .expect(201);

    const mentions = await waitForNotifications(
      app,
      author.session.accessToken,
      (items) => items.filter((item) => item.type === 'USER_MENTIONED').length === 2,
    );
    expect(mentions.map((item) => item.type)).toEqual([
      'USER_MENTIONED',
      'USER_MENTIONED',
    ]);

    const parent = await http(app)
      .post(`${PREFIX}/interactions/comments`)
      .set(authorHeader)
      .send({
        targetId: postId,
        targetType: 'POST',
        content: 'parent',
      })
      .expect(201);
    const parentId = parent.body.payload.id as string;

    await http(app)
      .post(`${PREFIX}/interactions/comments`)
      .set(bearer(alice.session.accessToken))
      .send({
        targetId: postId,
        targetType: 'POST',
        parentId,
        content: 'reply one',
      })
      .expect(201);

    await http(app)
      .post(`${PREFIX}/interactions/comments`)
      .set(bearer(bob.session.accessToken))
      .send({
        targetId: postId,
        targetType: 'POST',
        parentId,
        content: 'reply two',
      })
      .expect(201);

    const withReplies = await waitForNotifications(
      app,
      author.session.accessToken,
      (items) =>
        items.filter((item) => item.type === 'COMMENT_REPLIED').length === 2,
    );
    expect(
      withReplies.filter((item) => item.type === 'COMMENT_REPLIED'),
    ).toHaveLength(2);
  });
});
