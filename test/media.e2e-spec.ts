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

const JPEG_STUB = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

describe('Media HTTP (e2e)', () => {
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

  it('uploads a PNG and serves the bytes to an authenticated caller', async () => {
    const { session } = await registerVerifiedUser(app, 'media');
    const auth = bearer(session.accessToken);

    const uploaded = await http(app)
      .post(`${PREFIX}/media`)
      .set(auth)
      .attach('file', PNG_1X1, {
        filename: 'dot.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(uploaded.body.payload).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        url: `/api/media/${uploaded.body.payload.id}`,
        mimeType: 'image/png',
        byteSize: PNG_1X1.length,
      }),
    );

    const fetched = await http(app)
      .get(uploaded.body.payload.url)
      .set(auth)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(fetched.headers['content-type']).toMatch(/image\/png/);
    expect(
      Buffer.isBuffer(fetched.body) ? fetched.body : Buffer.from(fetched.body),
    ).toEqual(PNG_1X1);

    const publicFetch = await http(app)
      .get(uploaded.body.payload.url)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(
      Buffer.isBuffer(publicFetch.body)
        ? publicFetch.body
        : Buffer.from(publicFetch.body),
    ).toEqual(PNG_1X1);
  });

  it('uploads a JPEG the same way', async () => {
    const { session } = await registerVerifiedUser(app, 'jpeg');
    const auth = bearer(session.accessToken);

    const uploaded = await http(app)
      .post(`${PREFIX}/media`)
      .set(auth)
      .attach('file', JPEG_STUB, {
        filename: 'dot.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    expect(uploaded.body.payload.mimeType).toBe('image/jpeg');
  });

  it('rejects unauthenticated uploads', async () => {
    await http(app)
      .post(`${PREFIX}/media`)
      .attach('file', PNG_1X1, {
        filename: 'dot.png',
        contentType: 'image/png',
      })
      .expect(401)
      .expect((res) => {
        expect(res.body.errorCode).toBe(ErrorCode.AUTHENTICATION_ERROR);
      });
  });

  it('rejects a non-image upload', async () => {
    const { session } = await registerVerifiedUser(app, 'txt');
    const auth = bearer(session.accessToken);

    const response = await http(app)
      .post(`${PREFIX}/media`)
      .set(auth)
      .attach('file', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    expect(response.body.errorCode).toBe(ErrorCode.MEDIA_INVALID_TYPE);
  });

  it('rejects an oversize upload', async () => {
    const { session } = await registerVerifiedUser(app, 'big');
    const auth = bearer(session.accessToken);
    const oversized = Buffer.concat([JPEG_STUB, Buffer.alloc(3000, 0xff)]);

    const response = await http(app)
      .post(`${PREFIX}/media`)
      .set(auth)
      .attach('file', oversized, {
        filename: 'big.jpg',
        contentType: 'image/jpeg',
      })
      .expect(413);

    expect(response.body.errorCode).toBe(ErrorCode.MEDIA_TOO_LARGE);
  });

  it('returns not found for an unknown media id', async () => {
    const { session } = await registerVerifiedUser(app, 'miss');
    const auth = bearer(session.accessToken);

    const response = await http(app)
      .get(`${PREFIX}/media/550e8400-e29b-41d4-a716-446655440000`)
      .set(auth)
      .expect(404);

    expect(response.body.errorCode).toBe(ErrorCode.MEDIA_NOT_FOUND);
  });
});
