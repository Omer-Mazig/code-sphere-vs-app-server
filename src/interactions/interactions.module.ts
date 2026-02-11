import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InteractionsController } from './interactions.controller';
import { Like } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { Share } from './entities/share.entity';
import { Post } from '../posts/entities/post.entity';
import { Article } from '../articles/entities/article.entity';
import { User } from '../users/entities/user.entity';
import { InteractionsService } from './interactions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Like, Comment, Share, Post, Article, User]),
  ],
  controllers: [InteractionsController],
  providers: [InteractionsService],
  exports: [InteractionsService],
})
export class InteractionsModule {}
