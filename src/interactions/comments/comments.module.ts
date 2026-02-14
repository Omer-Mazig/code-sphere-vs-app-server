import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from '../entities/comment.entity';
import { Like } from '../entities/like.entity';
import { User } from '../../users/entities/user.entity';
import { Follow } from '../../users/entities/follow.entity';
import { Post } from '../../posts/entities/post.entity';
import { Article } from '../../articles/entities/article.entity';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { InteractionTargetValidatorService } from '../shared';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, Like, User, Follow, Post, Article]),
  ],
  controllers: [CommentsController],
  providers: [CommentsService, InteractionTargetValidatorService],
  exports: [CommentsService],
})
export class CommentsModule {}
