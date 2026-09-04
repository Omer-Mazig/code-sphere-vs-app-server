import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { PostImage } from './entities/post-image.entity';
import { Like } from '../interactions/entities/like.entity';
import { Comment } from '../interactions/entities/comment.entity';
import { Share } from '../interactions/entities/share.entity';
import { UsersModule } from '../users/users.module';
import { TopicsModule } from '../topics/topics.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, PostImage, Like, Comment, Share]),
    UsersModule,
    TopicsModule,
    MediaModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
