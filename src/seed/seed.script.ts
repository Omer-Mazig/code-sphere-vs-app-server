/**
 * Standalone seed script.
 *
 * Uses NestFactory.createApplicationContext() which boots the DI container
 * WITHOUT starting an HTTP server — so all HTTP middleware (including the
 * DevelopmentWaitMiddleware), guards, and pipes are completely bypassed.
 *
 * Run with:  npm run seed
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedService } from './seed.service';

async function bootstrap() {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
  }

  console.log('Bootstrapping application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const seedService = app.get(SeedService);

  console.log('Clearing existing data...');
  await seedService.clearAllData();
  console.log('Data cleared.');

  console.log('Seeding database...');
  const result = await seedService.run();

  console.log('Seed complete:');
  console.log(`  Users:    ${result.users}`);
  console.log(`  Follows:  ${result.follows}`);
  console.log(`  Posts:    ${result.posts}`);
  console.log(`  Articles: ${result.articles}`);
  console.log(`  Likes:    ${result.likes}`);
  console.log(`  Comments: ${result.comments}`);
  console.log(`  Shares:   ${result.shares}`);

  await app.close();
}

bootstrap().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
