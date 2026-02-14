import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Like } from '../entities/like.entity';
import { Post } from '../../posts/entities/post.entity';
import { Article } from '../../articles/entities/article.entity';
import { Comment } from '../entities/comment.entity';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';
import { InteractionTargetValidatorService } from '../shared';

@Module({
  imports: [TypeOrmModule.forFeature([Like, Post, Article, Comment])],
  controllers: [LikesController],
  providers: [LikesService, InteractionTargetValidatorService],
  exports: [LikesService],
})
export class LikesModule {}
