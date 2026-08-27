import { registerAs } from '@nestjs/config';

const defaultCorsOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export const appConfig = registerAs('app', () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  return {
    nodeEnv,
    isProduction,
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
      : defaultCorsOrigins,
    enableSeed: process.env.ENABLE_SEED === 'true',
    trustProxy: process.env.TRUST_PROXY === 'true',
  };
});
