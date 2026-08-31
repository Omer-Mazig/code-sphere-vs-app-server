import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalMediaStorage } from './local-media-storage';

const KEY = '550e8400-e29b-41d4-a716-446655440000.png';
const BODY = Buffer.from('png-bytes');

describe('LocalMediaStorage', () => {
  let uploadDir: string;
  let storage: LocalMediaStorage;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'cs-media-local-'));
    storage = new LocalMediaStorage({
      get: () => uploadDir,
    } as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('writes, reads, and deletes an object by storage key', async () => {
    await storage.put({
      key: KEY,
      body: BODY,
      contentType: 'image/png',
    });

    await expect(storage.get(KEY)).resolves.toEqual(BODY);

    await storage.delete(KEY);
    await expect(storage.get(KEY)).resolves.toBeNull();
  });

  it('rejects path-like keys', async () => {
    await expect(
      storage.put({
        key: '../secret.png',
        body: BODY,
        contentType: 'image/png',
      }),
    ).rejects.toThrow(/Unsafe media storage key/);
  });
});
