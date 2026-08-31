import {
  Controller,
  Get,
  Header,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import {
  ApiEnvelopeCreatedResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';
import { MediaObjectResponseDto } from './dto/media-object-response.dto';
import { MediaFilePipe } from './media-file.pipe';
import { MediaService } from './media.service';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiEnvelopeCreatedResponse(MediaObjectResponseDto)
  @ApiStandardErrorResponses()
  upload(
    @CurrentUser() userId: string,
    @UploadedFile(MediaFilePipe) file: Express.Multer.File,
  ) {
    return this.mediaService.upload(userId, file);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, max-age=3600')
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({
    description: 'Raw image bytes. Not wrapped in the JSON success envelope.',
    content: {
      'image/jpeg': { schema: { type: 'string', format: 'binary' } },
      'image/png': { schema: { type: 'string', format: 'binary' } },
      'image/gif': { schema: { type: 'string', format: 'binary' } },
      'image/webp': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiStandardErrorResponses()
  async getById(@Param('id') id: string) {
    const object = await this.mediaService.getObject(id);
    return new StreamableFile(object.body, {
      type: object.mimeType,
      disposition: 'inline',
      length: object.byteSize,
    });
  }
}
