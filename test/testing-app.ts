import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/app.setup';
import { ensureTestDatabase } from './ensure-test-database';

export async function createTestingApp(): Promise<{
  app: INestApplication;
  dataSource: DataSource;
}> {
  await ensureTestDatabase();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureHttpApp(app, app.get(ConfigService));
  await app.init();

  return {
    app,
    dataSource: app.get(DataSource),
  };
}

export async function resetDatabase(dataSource: DataSource) {
  const tables = dataSource.entityMetadatas.map(
    (entity) => `"${entity.tableName}"`,
  );
  if (tables.length === 0) {
    return;
  }
  await dataSource.query(`TRUNCATE TABLE ${tables.join(', ')} CASCADE`);
}
