import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
import { MediaObject } from './entities/media-object.entity';
import { LocalMediaStorage } from './local-media-storage';
import { DEFAULT_MEDIA_MAX_BYTES } from './media.constants';
import { MediaController } from './media.controller';
import { MediaFilePipe } from './media-file.pipe';
import { MEDIA_STORAGE } from './media-storage.interface';
import { MediaService } from './media.service';
import { S3MediaStorage } from './s3-media-storage';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaObject]),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: configService.get<number>(
            'media.maxBytes',
            DEFAULT_MEDIA_MAX_BYTES,
          ),
        },
      }),
    }),
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaFilePipe,
    LocalMediaStorage,
    S3MediaStorage,
    {
      provide: MEDIA_STORAGE,
      inject: [ConfigService, LocalMediaStorage, S3MediaStorage],
      useFactory: (
        configService: ConfigService,
        localStorage: LocalMediaStorage,
        s3Storage: S3MediaStorage,
      ) => {
        const driver = configService.get<string>('media.driver', 'local');
        return driver === 's3' ? s3Storage : localStorage;
      },
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
