import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Share } from '../entities/share.entity';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [TypeOrmModule.forFeature([Share])],
  controllers: [SharesController],
  providers: [SharesService],
  exports: [SharesService],
})
export class SharesModule {}
