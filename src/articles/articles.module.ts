import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { Article } from './entities/article.entity';
import { Like } from '../interactions/entities/like.entity';
import { Comment } from '../interactions/entities/comment.entity';
import { UsersModule } from '../users/users.module';
import { TopicsModule } from '../topics/topics.module';
import { MediaModule } from '../media/media.module';
import { SavedModule } from '../saved/saved.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article, Like, Comment]),
    UsersModule,
    TopicsModule,
    MediaModule,
    SavedModule,
  ],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
