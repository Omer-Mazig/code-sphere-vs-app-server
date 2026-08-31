import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Post } from '../posts/entities/post.entity';
import { Article } from '../articles/entities/article.entity';
import { Follow } from '../users/entities/follow.entity';
import { Like } from '../interactions/entities/like.entity';
import { Comment } from '../interactions/entities/comment.entity';
import { Share } from '../interactions/entities/share.entity';
import { Topic } from '../topics/entities/topic.entity';
import { UserFollowedTopic } from '../topics/entities/user-followed-topic.entity';
import { PostTopic } from '../topics/entities/post-topic.entity';
import { ArticleTopic } from '../topics/entities/article-topic.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      Post,
      Article,
      Follow,
      Like,
      Comment,
      Share,
      Topic,
      UserFollowedTopic,
      PostTopic,
      ArticleTopic,
    ]),
  ],
  providers: [SeedService],
  controllers: [SeedController],
})
export class SeedModule {}
