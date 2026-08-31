import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException, ErrorCode } from '../common/errors';
import {
  bufferMatchesImageMime,
  DEFAULT_MEDIA_MAX_BYTES,
  isAllowedImageMime,
} from './media.constants';

@Injectable()
export class MediaFilePipe implements PipeTransform<
  Express.Multer.File | undefined,
  Express.Multer.File
> {
  constructor(private readonly configService: ConfigService) {}

  transform(file: Express.Multer.File | undefined): Express.Multer.File {
    if (!file) {
      throw new BusinessException(
        ErrorCode.MEDIA_FILE_REQUIRED,
        'Upload was missing a file field',
        'A file is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const maxBytes = this.configService.get<number>(
      'media.maxBytes',
      DEFAULT_MEDIA_MAX_BYTES,
    );

    if (file.size > maxBytes) {
      throw new BusinessException(
        ErrorCode.MEDIA_TOO_LARGE,
        `Upload size ${file.size} exceeded max ${maxBytes}`,
        'File is too large',
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    if (!isAllowedImageMime(file.mimetype)) {
      throw new BusinessException(
        ErrorCode.MEDIA_INVALID_TYPE,
        `Rejected upload with mimetype "${file.mimetype}"`,
        'File must be a JPEG, PNG, GIF, or WebP image',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!file.buffer || !bufferMatchesImageMime(file.buffer, file.mimetype)) {
      throw new BusinessException(
        ErrorCode.MEDIA_INVALID_TYPE,
        `Upload bytes did not match mimetype "${file.mimetype}"`,
        'File must be a JPEG, PNG, GIF, or WebP image',
        HttpStatus.BAD_REQUEST,
      );
    }

    return file;
  }
}
