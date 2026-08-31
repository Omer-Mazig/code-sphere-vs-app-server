import { registerAs } from '@nestjs/config';

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export const mediaConfig = registerAs('media', () => ({
  driver: process.env.MEDIA_DRIVER ?? 'local',
  uploadDir: process.env.MEDIA_UPLOAD_DIR ?? 'uploads',
  maxBytes: parseInt(
    process.env.MEDIA_MAX_BYTES ?? String(DEFAULT_MAX_BYTES),
    10,
  ),
  s3: {
    bucket: process.env.MEDIA_S3_BUCKET ?? '',
    region: process.env.MEDIA_S3_REGION ?? '',
    accessKeyId: process.env.MEDIA_S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.MEDIA_S3_SECRET_ACCESS_KEY ?? '',
  },
}));
