import { Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SeedService } from './seed.service';
import { Permissions } from '../common/decorators';
import { RoleType } from '../common/types';

@ApiTags('Seed')
@Controller('dev/seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Permissions(RoleType.PUBLIC)
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

  @Permissions(RoleType.PUBLIC)
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
