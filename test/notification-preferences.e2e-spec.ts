import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestingApp, resetDatabase } from './testing-app';
import { api, bearer, http, registerVerifiedUser } from './test-helpers';

const PREFIX = api();

async function listNotifications(
  app: INestApplication,
  accessToken: string,
) {
  const response = await http(app)
    .get(`${PREFIX}/notifications`)
    .set(bearer(accessToken))
    .expect(200);
  return response.body.payload.items as { type: string }[];
}

async function waitForNotificationCount(
  app: INestApplication,
  accessToken: string,
  count: number,
) {
  let items: { type: string }[] = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    items = await listNotifications(app, accessToken);
    if (items.length === count) {
      return items;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return items;
}

const ALL_ENABLED = {
  mentions: true,
  comments: true,
  likes: true,
  newFollowers: true,
};

describe('Notification preferences HTTP (e2e)', () => {
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

  it('returns all-enabled defaults and honors a muted type', async () => {
    const author = await registerVerifiedUser(app, 'pref');
    const liker = await registerVerifiedUser(app, 'liker');
    const authorHeader = bearer(author.session.accessToken);
    const likerHeader = bearer(liker.session.accessToken);

    const initial = await http(app)
      .get(`${PREFIX}/users/me/notification-preferences`)
      .set(authorHeader)
      .expect(200);
    expect(initial.body.payload).toEqual(ALL_ENABLED);

    const updated = await http(app)
      .patch(`${PREFIX}/users/me/notification-preferences`)
      .set(authorHeader)
      .send({ likes: false })
      .expect(200);
    expect(updated.body.payload).toEqual({
      ...ALL_ENABLED,
      likes: false,
    });

    const persisted = await http(app)
      .get(`${PREFIX}/users/me/notification-preferences`)
      .set(authorHeader)
      .expect(200);
    expect(persisted.body.payload).toEqual({
      ...ALL_ENABLED,
      likes: false,
    });

    const mutedPost = await http(app)
      .post(`${PREFIX}/posts`)
      .set(authorHeader)
      .send({ content: 'mute likes on this post' })
      .expect(201);

    await http(app)
      .post(`${PREFIX}/interactions/likes`)
      .set(likerHeader)
      .send({ targetId: mutedPost.body.payload.id, targetType: 'POST' })
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await listNotifications(app, author.session.accessToken)).toHaveLength(
      0,
    );

    await http(app)
      .patch(`${PREFIX}/users/me/notification-preferences`)
      .set(authorHeader)
      .send({ likes: true })
      .expect(200);

    const enabledPost = await http(app)
      .post(`${PREFIX}/posts`)
      .set(authorHeader)
      .send({ content: 'likes are on again' })
      .expect(201);

    await http(app)
      .post(`${PREFIX}/interactions/likes`)
      .set(likerHeader)
      .send({ targetId: enabledPost.body.payload.id, targetType: 'POST' })
      .expect(201);

    const afterEnable = await waitForNotificationCount(
      app,
      author.session.accessToken,
      1,
    );
    expect(afterEnable).toHaveLength(1);
    expect(afterEnable[0].type).toBe('POST_LIKED');
  });
});
