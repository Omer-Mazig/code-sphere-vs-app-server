import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Share } from '../entities/share.entity';
import { Post } from '../../posts/entities/post.entity';
import { Article } from '../../articles/entities/article.entity';
import { Comment } from '../entities/comment.entity';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';
import { InteractionTargetValidatorService } from '../shared';

@Module({
  imports: [TypeOrmModule.forFeature([Share, Post, Article, Comment])],
  controllers: [SharesController],
  providers: [SharesService, InteractionTargetValidatorService],
  exports: [SharesService],
})
export class SharesModule {}
