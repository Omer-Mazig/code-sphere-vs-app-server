import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { MediaFilePipe } from './media-file.pipe';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function configService(maxBytes = 10 * 1024 * 1024): ConfigService {
  return {
    get: (_key: string, defaultValue?: number) => maxBytes ?? defaultValue,
  } as unknown as ConfigService;
}

function multerFile(
  overrides: Partial<Express.Multer.File> & {
    buffer: Buffer;
    mimetype: string;
  },
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'upload.bin',
    encoding: '7bit',
    size: overrides.buffer.length,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
    ...overrides,
  };
}

describe('MediaFilePipe', () => {
  const pipe = new MediaFilePipe(configService());

  it('accepts a PNG whose bytes match the declared type', () => {
    const file = multerFile({
      buffer: PNG_1X1,
      mimetype: 'image/png',
      originalname: 'dot.png',
    });

    expect(pipe.transform(file)).toBe(file);
  });

  it('rejects a missing file', () => {
    try {
      pipe.transform(undefined);
      fail('expected BusinessException');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).errorCode).toBe(
        ErrorCode.MEDIA_FILE_REQUIRED,
      );
      expect((error as BusinessException).httpStatus).toBe(
        HttpStatus.BAD_REQUEST,
      );
    }
  });

  it('rejects a non-image MIME type', () => {
    try {
      pipe.transform(
        multerFile({
          buffer: Buffer.from('hello'),
          mimetype: 'text/plain',
          originalname: 'notes.txt',
        }),
      );
      fail('expected BusinessException');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).errorCode).toBe(
        ErrorCode.MEDIA_INVALID_TYPE,
      );
    }
  });

  it('rejects bytes that do not match the declared image type', () => {
    try {
      pipe.transform(
        multerFile({
          buffer: Buffer.from('not an image at all!!'),
          mimetype: 'image/png',
          originalname: 'fake.png',
        }),
      );
      fail('expected BusinessException');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).errorCode).toBe(
        ErrorCode.MEDIA_INVALID_TYPE,
      );
    }
  });

  it('rejects a file over the configured size', () => {
    const smallPipe = new MediaFilePipe(configService(16));
    try {
      smallPipe.transform(
        multerFile({
          buffer: PNG_1X1,
          mimetype: 'image/png',
          originalname: 'dot.png',
        }),
      );
      fail('expected BusinessException');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).errorCode).toBe(
        ErrorCode.MEDIA_TOO_LARGE,
      );
      expect((error as BusinessException).httpStatus).toBe(
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
  });
});
