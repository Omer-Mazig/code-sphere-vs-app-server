import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticleTopic } from './entities/article-topic.entity';
import { PostTopic } from './entities/post-topic.entity';
import { Topic } from './entities/topic.entity';
import { UserFollowedTopic } from './entities/user-followed-topic.entity';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Topic,
      UserFollowedTopic,
      PostTopic,
      ArticleTopic,
    ]),
  ],
  controllers: [TopicsController],
  providers: [TopicsService],
  exports: [TopicsService],
})
export class TopicsModule {}
