import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

function createController(options: {
  isProduction?: boolean;
  enableSeed?: boolean;
}) {
  const seedService = {
    run: jest.fn().mockResolvedValue({ users: 1 }),
    clearAllData: jest.fn().mockResolvedValue({ cleared: true }),
  };
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const values: Record<string, unknown> = {
        'app.isProduction': options.isProduction ?? false,
        'app.enableSeed': options.enableSeed ?? false,
      };
      return values[key] ?? fallback;
    }),
  };

  const controller = new SeedController(
    seedService as unknown as SeedService,
    configService as unknown as ConfigService,
  );

  return { controller, seedService };
}

describe('SeedController', () => {
  it('rejects seed and clear when ENABLE_SEED is not set', async () => {
    const { controller, seedService } = createController({
      enableSeed: false,
    });

    await expect(controller.seed()).rejects.toMatchObject({
      errorCode: ErrorCode.SEED_DISABLED,
      httpStatus: HttpStatus.FORBIDDEN,
    });
    await expect(controller.clear()).rejects.toMatchObject({
      errorCode: ErrorCode.SEED_DISABLED,
    });
    expect(seedService.run).not.toHaveBeenCalled();
    expect(seedService.clearAllData).not.toHaveBeenCalled();
  });

  it('rejects seed in production even when ENABLE_SEED is true', async () => {
    const { controller, seedService } = createController({
      isProduction: true,
      enableSeed: true,
    });

    await expect(controller.seed()).rejects.toBeInstanceOf(BusinessException);
    expect(seedService.run).not.toHaveBeenCalled();
  });

  it('runs seed and clear when ENABLE_SEED is true outside production', async () => {
    const { controller, seedService } = createController({
      enableSeed: true,
    });

    await expect(controller.seed()).resolves.toEqual({ users: 1 });
    await expect(controller.clear()).resolves.toEqual({ cleared: true });
    expect(seedService.run).toHaveBeenCalled();
    expect(seedService.clearAllData).toHaveBeenCalled();
  });
});
