import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ErrorCode } from '../src/common/errors/error-codes.enum';
import { Topic } from '../src/topics/entities/topic.entity';
import { MAX_TOPICS_PER_ITEM } from '../src/topics/topics.constants';
import { createTestingApp, resetDatabase } from './testing-app';
import { api, bearer, http, registerVerifiedUser } from './test-helpers';

const PREFIX = api();

async function insertTopic(
  dataSource: DataSource,
  slug: string,
  name = slug,
) {
  return dataSource.getRepository(Topic).save({
    slug,
    name,
    description: `${name} description`,
  });
}

describe('Topics HTTP (e2e)', () => {
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

  it('lists curated topics and isFollowed for the signed-in viewer', async () => {
    const topic = await insertTopic(dataSource, 'typescript', 'TypeScript');
    const guest = await http(app).get(`${PREFIX}/topics`).expect(200);
    expect(guest.body.payload).toEqual([
      expect.objectContaining({
        id: topic.id,
        slug: 'typescript',
        name: 'TypeScript',
        isFollowed: false,
      }),
    ]);

    const user = await registerVerifiedUser(app, 'top');
    await http(app)
      .post(`${PREFIX}/topics/${topic.id}/follow`)
      .set(bearer(user.session.accessToken))
      .expect(200);

    const authed = await http(app)
      .get(`${PREFIX}/topics`)
      .set(bearer(user.session.accessToken))
      .expect(200);
    expect(authed.body.payload[0].isFollowed).toBe(true);

    await http(app)
      .post(`${PREFIX}/topics/${topic.id}/follow`)
      .set(bearer(user.session.accessToken))
      .expect(409)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.TOPIC_ALREADY_FOLLOWED);
      });

    await http(app)
      .delete(`${PREFIX}/topics/${topic.id}/follow`)
      .set(bearer(user.session.accessToken))
      .expect(200);

    await http(app)
      .delete(`${PREFIX}/topics/${topic.id}/follow`)
      .set(bearer(user.session.accessToken))
      .expect(400)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.TOPIC_NOT_FOLLOWED);
      });
  });

  it('attaches topics to posts, filters the list, and rejects invented ids', async () => {
    const typescript = await insertTopic(dataSource, 'typescript', 'TypeScript');
    const react = await insertTopic(dataSource, 'react', 'React');
    const author = await registerVerifiedUser(app, 'tag');

    const created = await http(app)
      .post(`${PREFIX}/posts`)
      .set(bearer(author.session.accessToken))
      .send({
        content: 'typed hooks',
        topicIds: [typescript.id, react.id],
      })
      .expect(201);

    expect(
      created.body.payload.topics.map((topic: { slug: string }) => topic.slug).sort(),
    ).toEqual(['react', 'typescript']);
    expect(created.body.payload.topics).toHaveLength(2);

    const filtered = await http(app)
      .get(`${PREFIX}/posts`)
      .query({ topicId: typescript.id })
      .set(bearer(author.session.accessToken))
      .expect(200);
    expect(filtered.body.payload.items).toHaveLength(1);
    expect(filtered.body.payload.items[0].id).toBe(created.body.payload.id);

    const unknownTopic = '00000000-0000-4000-8000-000000000099';
    const empty = await http(app)
      .get(`${PREFIX}/posts`)
      .query({ topicId: unknownTopic })
      .set(bearer(author.session.accessToken))
      .expect(200);
    expect(empty.body.payload.items).toHaveLength(0);

    await http(app)
      .post(`${PREFIX}/posts`)
      .set(bearer(author.session.accessToken))
      .send({
        content: 'nope',
        topicIds: [unknownTopic],
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.TOPIC_NOT_FOUND);
      });

    const tooMany = Array.from(
      { length: MAX_TOPICS_PER_ITEM + 1 },
      (_, index) => `00000000-0000-4000-8000-00000000000${index}`,
    );
    await http(app)
      .post(`${PREFIX}/posts`)
      .set(bearer(author.session.accessToken))
      .send({ content: 'too many', topicIds: tooMany })
      .expect(400);
  });

  it('filters articles by topicId without changing unfiltered lists', async () => {
    const typescript = await insertTopic(dataSource, 'typescript', 'TypeScript');
    const author = await registerVerifiedUser(app, 'art');

    const tagged = await http(app)
      .post(`${PREFIX}/articles`)
      .set(bearer(author.session.accessToken))
      .send({
        title: 'TS handbook',
        content: 'body',
        isPublished: true,
        topicIds: [typescript.id],
      })
      .expect(201);
    expect(tagged.body.payload.topics).toEqual([
      expect.objectContaining({ id: typescript.id, slug: 'typescript' }),
    ]);

    await http(app)
      .post(`${PREFIX}/articles`)
      .set(bearer(author.session.accessToken))
      .send({
        title: 'Untagged note',
        content: 'body',
        isPublished: true,
      })
      .expect(201);

    const filtered = await http(app)
      .get(`${PREFIX}/articles`)
      .query({ topicId: typescript.id, isPublished: 'true' })
      .expect(200);
    expect(filtered.body.payload.items).toHaveLength(1);
    expect(filtered.body.payload.items[0].id).toBe(tagged.body.payload.id);
  });

  it('returns a topic hub payload by slug', async () => {
    const topic = await insertTopic(dataSource, 'rust', 'Rust');
    const guest = await http(app).get(`${PREFIX}/topics/rust`).expect(200);
    expect(guest.body.payload).toEqual(
      expect.objectContaining({
        id: topic.id,
        slug: 'rust',
        name: 'Rust',
        isFollowed: false,
        postCount: 0,
        articleCount: 0,
        followerCount: 0,
      }),
    );

    await http(app).get(`${PREFIX}/topics/no-such-topic`).expect(404).expect((res) => {
      expect(res.body.errorCode).toBe(ErrorCode.TOPIC_NOT_FOUND);
    });
  });
});
