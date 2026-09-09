import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ProfilesService } from './profiles.service';
import { FollowsService } from './follows.service';
import { Follow } from './entities/follow.entity';
import { User } from './entities/user.entity';
import { UserBlock } from './entities/user-block.entity';
import { BlocksService } from './blocks.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MediaModule } from '../media/media.module';
import { Post } from '../posts/entities/post.entity';
import { Article } from '../articles/entities/article.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Follow, User, UserBlock, Post, Article]),
    AuthModule,
    NotificationsModule,
    MediaModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, ProfilesService, FollowsService, BlocksService],
  exports: [UsersService, FollowsService, BlocksService],
})
export class UsersModule {}
