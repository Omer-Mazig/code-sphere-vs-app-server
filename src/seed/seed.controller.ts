import { Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SeedService } from './seed.service';
import { Public } from '../common/decorators';
import {
  ApiEnvelopeOkResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';
import { SeedClearResponseDto, SeedRunResponseDto } from './dto/seed-response.dto';

@ApiTags('Seed')
@Controller('dev/seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Public()
  @Post()
  @ApiEnvelopeOkResponse(SeedRunResponseDto)
  @ApiStandardErrorResponses()
  async seed() {
    if (process.env.NODE_ENV === 'production') {
      throw new HttpException(
        'Seeding is disabled in production',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.seedService.run();
  }

  @Public()
  @Post('clear')
  @ApiEnvelopeOkResponse(SeedClearResponseDto)
  @ApiStandardErrorResponses()
  async clear() {
    if (process.env.NODE_ENV === 'production') {
      throw new HttpException(
        'Seeding is disabled in production',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.seedService.clearAllData();
  }
}
