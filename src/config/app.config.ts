import { registerAs } from '@nestjs/config';

const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : defaultCorsOrigins,
}));
