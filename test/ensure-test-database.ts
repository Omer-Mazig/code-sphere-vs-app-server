import { Client } from 'pg';

const TEST_DATABASE = process.env.DB_NAME ?? 'code_sphere_test';

export async function ensureTestDatabase() {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: 'postgres',
  });

  try {
    await client.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot reach Postgres for tests (${message}). Start it with docker compose in code-sphere-server, then retry.`,
    );
  }

  try {
    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DATABASE],
    );
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${TEST_DATABASE}"`);
    }
  } finally {
    await client.end();
  }
}
