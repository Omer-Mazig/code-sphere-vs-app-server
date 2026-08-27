import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('pings the database and returns the terminus result', async () => {
    const result = {
      status: 'ok' as const,
      info: { database: { status: 'up' as const } },
      error: {},
      details: { database: { status: 'up' as const } },
    };
    const pingCheck = jest.fn().mockResolvedValue({
      database: { status: 'up' },
    });
    const check = jest.fn(async (indicators: Array<() => Promise<unknown>>) => {
      await indicators[0]();
      return result;
    });

    const controller = new HealthController(
      { check } as unknown as HealthCheckService,
      { pingCheck } as unknown as TypeOrmHealthIndicator,
    );

    await expect(controller.check()).resolves.toEqual(result);
    expect(pingCheck).toHaveBeenCalledWith('database');
    expect(JSON.stringify(result)).not.toMatch(/postgres:\/\//);
  });
});
