import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import {
  ApiEnvelopeOkResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';
import { HealthIndicatorDto, HealthResponseDto } from './dto';

@ApiTags('Health')
@ApiExtraModels(HealthIndicatorDto)
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiEnvelopeOkResponse(HealthResponseDto)
  @ApiStandardErrorResponses()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
