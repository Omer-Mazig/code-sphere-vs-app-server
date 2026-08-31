import { config as loadEnv } from 'dotenv';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

loadEnv({ quiet: true });

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'code_sphere_test';
process.env.LOG_LEVEL = 'silent';
process.env.EMAIL_PROVIDER = 'console';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MEDIA_DRIVER ??= 'local';
process.env.MEDIA_MAX_BYTES ??= '2048';
process.env.MEDIA_UPLOAD_DIR ??= mkdtempSync(join(tmpdir(), 'cs-media-e2e-'));
