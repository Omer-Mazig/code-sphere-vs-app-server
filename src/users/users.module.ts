import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ProfilesService } from './profiles.service';
import { FollowsService } from './follows.service';
import { Follow } from './entities/follow.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Follow]), AuthModule],
  controllers: [UsersController],
  providers: [UsersService, ProfilesService, FollowsService],
  exports: [UsersService],
})
export class UsersModule {}
