import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { Like } from '../interactions/entities/like.entity';
import { Comment } from '../interactions/entities/comment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Post, Like, Comment])],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
