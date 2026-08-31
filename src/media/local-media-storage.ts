import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, isAbsolute, join, resolve } from 'path';
import { isSafeStorageKey } from './media.constants';
import type { MediaPutInput, MediaStorage } from './media-storage.interface';

@Injectable()
export class LocalMediaStorage implements MediaStorage {
  constructor(private readonly configService: ConfigService) {}

  async put(input: MediaPutInput): Promise<void> {
    const dest = this.resolveKeyPath(input.key);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, input.body);
  }

  async get(key: string): Promise<Buffer | null> {
    const dest = this.resolveKeyPath(key);
    try {
      return await readFile(dest);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const dest = this.resolveKeyPath(key);
    try {
      await unlink(dest);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  private resolveKeyPath(key: string): string {
    if (!isSafeStorageKey(key)) {
      throw new Error(`Unsafe media storage key "${key}"`);
    }

    const root = this.uploadRoot();
    const dest = resolve(root, key);
    const prefix = root.endsWith('/') ? root : `${root}/`;
    if (dest !== root && !dest.startsWith(prefix)) {
      throw new Error(`Media path escaped upload directory for key "${key}"`);
    }
    return dest;
  }

  private uploadRoot(): string {
    const uploadDir = this.configService.get<string>(
      'media.uploadDir',
      'uploads',
    );
    const absolute = isAbsolute(uploadDir)
      ? uploadDir
      : join(process.cwd(), uploadDir);
    return resolve(absolute);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}
