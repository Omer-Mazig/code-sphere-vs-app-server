import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { configureHttpApp } from './app.setup';

function createApp(trustProxy: boolean) {
  const set = jest.fn();
  const app = {
    setGlobalPrefix: jest.fn(),
    useGlobalFilters: jest.fn(),
    use: jest.fn(),
    useGlobalPipes: jest.fn(),
    enableCors: jest.fn(),
    getHttpAdapter: () => ({
      getInstance: () => ({ set }),
    }),
  };

  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const values: Record<string, unknown> = {
        'app.apiPrefix': 'api',
        'app.isProduction': false,
        'app.nodeEnv': 'test',
        'app.corsOrigins': [],
        'app.trustProxy': trustProxy,
      };
      return values[key] ?? fallback;
    }),
  };

  configureHttpApp(
    app as unknown as INestApplication,
    configService as unknown as ConfigService,
  );

  return { set };
}

describe('configureHttpApp', () => {
  it('does not trust proxies by default', () => {
    const { set } = createApp(false);
    expect(set).not.toHaveBeenCalled();
  });

  it('trusts the first proxy hop when TRUST_PROXY is enabled', () => {
    const { set } = createApp(true);
    expect(set).toHaveBeenCalledWith('trust proxy', 1);
  });
});
