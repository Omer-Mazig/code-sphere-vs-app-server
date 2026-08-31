import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException, ErrorCode } from '../common/errors';
import type { MediaPutInput, MediaStorage } from './media-storage.interface';

@Injectable()
export class S3MediaStorage implements MediaStorage {
  constructor(private readonly configService: ConfigService) {}

  async put(_input: MediaPutInput): Promise<void> {
    this.fail();
  }

  async get(_key: string): Promise<Buffer | null> {
    this.fail();
  }

  async delete(_key: string): Promise<void> {
    this.fail();
  }

  private fail(): never {
    const configured = this.isConfigured();
    throw new BusinessException(
      ErrorCode.MEDIA_STORAGE_NOT_CONFIGURED,
      configured
        ? 'S3 media storage is not implemented yet'
        : 'S3 media storage is not configured',
      'Media storage is not configured',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private isConfigured(): boolean {
    const bucket = this.configService.get<string>('media.s3.bucket', '');
    const region = this.configService.get<string>('media.s3.region', '');
    const accessKeyId = this.configService.get<string>(
      'media.s3.accessKeyId',
      '',
    );
    const secretAccessKey = this.configService.get<string>(
      'media.s3.secretAccessKey',
      '',
    );
    return Boolean(bucket && region && accessKeyId && secretAccessKey);
  }
}
