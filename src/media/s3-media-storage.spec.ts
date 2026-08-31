import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { S3MediaStorage } from './s3-media-storage';

describe('S3MediaStorage', () => {
  it('throws not-configured when S3 env is missing', async () => {
    const storage = new S3MediaStorage({
      get: () => '',
    } as unknown as ConfigService);

    try {
      await storage.put({
        key: '550e8400-e29b-41d4-a716-446655440000.png',
        body: Buffer.from('x'),
        contentType: 'image/png',
      });
      fail('expected BusinessException');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).errorCode).toBe(
        ErrorCode.MEDIA_STORAGE_NOT_CONFIGURED,
      );
      expect((error as BusinessException).httpStatus).toBe(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  });

  it('still throws when S3 env is present because the driver is a stub', async () => {
    const storage = new S3MediaStorage({
      get: () => 'present',
    } as unknown as ConfigService);

    await expect(
      storage.get('550e8400-e29b-41d4-a716-446655440000.png'),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.MEDIA_STORAGE_NOT_CONFIGURED,
    });
  });
});
