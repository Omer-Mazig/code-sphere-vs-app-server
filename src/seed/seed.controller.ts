import { Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SeedService } from './seed.service';
import { Public } from '../common/decorators';

@ApiTags('Seed')
@Controller('dev/seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Public()
  @Post()
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
