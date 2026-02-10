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
    ]),
  ],
  providers: [SeedService],
  controllers: [SeedController],
})
export class SeedModule {}
