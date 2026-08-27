import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestingApp } from './testing-app';
import { api, http } from './test-helpers';

const PREFIX = api();

describe('Health HTTP (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestingApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 when Postgres is up and does not leak connection details', async () => {
    const response = await http(app).get(`${PREFIX}/health`);

    expect(response.status).toBe(200);
    expect(response.body.payload).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' } },
    });

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/postgres:\/\//);
    const password =
      'password' in dataSource.options
        ? String(dataSource.options.password ?? '')
        : '';
    if (password) {
      expect(serialized).not.toContain(password);
    }
  });
});
