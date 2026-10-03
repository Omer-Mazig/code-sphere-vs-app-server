import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import { BusinessException, ErrorCode } from '../common/errors';
import { MediaObjectResponseDto } from './dto/media-object-response.dto';
import { MediaObject } from './entities/media-object.entity';
import { extensionForImageMime } from './media.constants';
import { MEDIA_STORAGE, type MediaStorage } from './media-storage.interface';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(MediaObject)
    private readonly mediaRepository: Repository<MediaObject>,
    @Inject(MEDIA_STORAGE)
    private readonly storage: MediaStorage,
    private readonly configService: ConfigService,
  ) {}

  async upload(
    uploaderId: string,
    file: Express.Multer.File,
  ): Promise<MediaObjectResponseDto> {
    const extension = extensionForImageMime(file.mimetype);
    if (!extension) {
      throw new BusinessException(
        ErrorCode.MEDIA_INVALID_TYPE,
        `No extension mapped for mimetype "${file.mimetype}"`,
        'File must be a JPEG, PNG, GIF, or WebP image',
        HttpStatus.BAD_REQUEST,
      );
    }

    const storageKey = `${randomUUID()}.${extension}`;
    await this.storage.put({
      key: storageKey,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const saved = await this.mediaRepository.save(
      this.mediaRepository.create({
        storageKey,
        mimeType: file.mimetype,
        byteSize: file.size,
        uploaderId,
      }),
    );

    return this.formatMedia(saved);
  }

  publicUrl(id: string): string {
    const apiPrefix = this.configService.get<string>('app.apiPrefix', 'api');
    return `/${apiPrefix}/media/${id}`;
  }

  async requireOwned(ids: string[], uploaderId: string): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const unique = [...new Set(ids)];
    const rows = await this.mediaRepository.find({
      where: { id: In(unique) },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    for (const id of unique) {
      const row = byId.get(id);
      if (!row) {
        throw this.notFound(id);
      }
      if (row.uploaderId !== uploaderId) {
        throw new BusinessException(
          ErrorCode.AUTHORIZATION_ERROR,
          `User "${uploaderId}" cannot attach media "${id}"`,
          'You can only attach your own uploads',
          HttpStatus.FORBIDDEN,
        );
      }
    }
  }

  async getObject(
    id: string,
  ): Promise<{ body: Buffer; mimeType: string; byteSize: number }> {
    const row = await this.mediaRepository.findOne({ where: { id } });
    if (!row) {
      throw this.notFound(id);
    }

    const body = await this.storage.get(row.storageKey);
    if (!body) {
      throw this.notFound(id);
    }

    return {
      body,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
    };
  }

  async delete(id: string, currentUserId: string): Promise<void> {
    const row = await this.mediaRepository.findOne({ where: { id } });
    if (!row) {
      throw this.notFound(id);
    }

    if (row.uploaderId !== currentUserId) {
      throw new BusinessException(
        ErrorCode.AUTHORIZATION_ERROR,
        `User "${currentUserId}" cannot delete media "${id}"`,
        'You can only delete your own uploads',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.storage.delete(row.storageKey);
    await this.mediaRepository.remove(row);
  }

  private formatMedia(row: MediaObject): MediaObjectResponseDto {
    return {
      id: row.id,
      url: this.publicUrl(row.id),
      mimeType: row.mimeType,
      byteSize: row.byteSize,
    };
  }

  private notFound(id: string): BusinessException {
    return new BusinessException(
      ErrorCode.MEDIA_NOT_FOUND,
      `Media object "${id}" was not found`,
      'Media not found',
      HttpStatus.NOT_FOUND,
    );
  }
}
