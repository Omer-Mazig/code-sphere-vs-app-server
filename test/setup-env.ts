import { config as loadEnv } from 'dotenv';

loadEnv({ quiet: true });

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'code_sphere_test';
process.env.LOG_LEVEL = 'silent';
process.env.EMAIL_PROVIDER = 'console';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
