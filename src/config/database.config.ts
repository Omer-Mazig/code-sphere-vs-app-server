import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'code_sphere',
    synchronize: nodeEnv !== 'production',
  };
});
