import { Controller, HttpStatus, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { SeedService } from './seed.service';
import { Public } from '../common/decorators';
import { BusinessException, ErrorCode } from '../common/errors';
import {
  ApiEnvelopeOkResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';
import {
  SeedClearResponseDto,
  SeedRunResponseDto,
} from './dto/seed-response.dto';

@ApiTags('Seed')
@Controller('dev/seed')
export class SeedController {
  constructor(
    private readonly seedService: SeedService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post()
  @ApiEnvelopeOkResponse(SeedRunResponseDto)
  @ApiStandardErrorResponses()
  async seed() {
    this.assertSeedEnabled();
    return this.seedService.run();
  }

  @Public()
  @Post('clear')
  @ApiEnvelopeOkResponse(SeedClearResponseDto)
  @ApiStandardErrorResponses()
  async clear() {
    this.assertSeedEnabled();
    return this.seedService.clearAllData();
  }

  private assertSeedEnabled() {
    const isProduction = this.configService.get<boolean>(
      'app.isProduction',
      false,
    );
    const enableSeed = this.configService.get<boolean>('app.enableSeed', false);

    if (isProduction || !enableSeed) {
      throw new BusinessException(
        ErrorCode.SEED_DISABLED,
        'HTTP seed/clear is disabled for this environment',
        'Seeding is disabled',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
