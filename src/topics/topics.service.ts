import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BusinessException, ErrorCode } from '../common/errors';
import { ArticleTopic } from './entities/article-topic.entity';
import { PostTopic } from './entities/post-topic.entity';
import { Topic } from './entities/topic.entity';
import { UserFollowedTopic } from './entities/user-followed-topic.entity';
import { MAX_TOPICS_PER_ITEM } from './topics.constants';

export type TopicPreview = {
  id: string;
  slug: string;
  name: string;
};

@Injectable()
export class TopicsService {
  constructor(
    @InjectRepository(Topic)
    private readonly topicsRepository: Repository<Topic>,
    @InjectRepository(UserFollowedTopic)
    private readonly followedTopicsRepository: Repository<UserFollowedTopic>,
    @InjectRepository(PostTopic)
    private readonly postTopicsRepository: Repository<PostTopic>,
    @InjectRepository(ArticleTopic)
    private readonly articleTopicsRepository: Repository<ArticleTopic>,
  ) {}

  async list(currentUserId?: string) {
    const topics = await this.topicsRepository.find({
      order: { name: 'ASC' },
    });
    const followed = await this.followedSet(
      currentUserId,
      topics.map((topic) => topic.id),
    );

    return topics.map((topic) =>
      this.formatTopic(topic, followed.has(topic.id)),
    );
  }

  async getBySlug(slug: string, currentUserId?: string) {
    const topic = await this.topicsRepository.findOne({ where: { slug } });
    if (!topic) {
      throw new BusinessException(
        ErrorCode.TOPIC_NOT_FOUND,
        `Topic slug "${slug}" was not found`,
        'Topic not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const [followed, postCount, articleCount, followerCount] =
      await Promise.all([
        this.followedSet(currentUserId, [topic.id]),
        this.postTopicsRepository.count({ where: { topicId: topic.id } }),
        this.articleTopicsRepository
          .createQueryBuilder('articleTopic')
          .innerJoin('articleTopic.article', 'article')
          .where('articleTopic.topicId = :topicId', { topicId: topic.id })
          .andWhere('article.isPublished = :isPublished', { isPublished: true })
          .getCount(),
        this.followedTopicsRepository.count({ where: { topicId: topic.id } }),
      ]);

    return {
      ...this.formatTopic(topic, followed.has(topic.id)),
      postCount,
      articleCount,
      followerCount,
    };
  }

  async follow(currentUserId: string, topicId: string) {
    await this.findTopicOrFail(topicId);

    const existing = await this.followedTopicsRepository.findOne({
      where: { userId: currentUserId, topicId },
    });
    if (existing) {
      throw new BusinessException(
        ErrorCode.TOPIC_ALREADY_FOLLOWED,
        `User "${currentUserId}" already follows topic "${topicId}"`,
        'You are already following this topic',
        HttpStatus.CONFLICT,
      );
    }

    await this.followedTopicsRepository.save(
      this.followedTopicsRepository.create({
        userId: currentUserId,
        topicId,
      }),
    );

    return { message: 'Followed successfully' };
  }

  async unfollow(currentUserId: string, topicId: string) {
    const existing = await this.followedTopicsRepository.findOne({
      where: { userId: currentUserId, topicId },
    });
    if (!existing) {
      throw new BusinessException(
        ErrorCode.TOPIC_NOT_FOLLOWED,
        `User "${currentUserId}" does not follow topic "${topicId}"`,
        'You are not following this topic',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.followedTopicsRepository.remove(existing);
    return { message: 'Unfollowed successfully' };
  }

  async resolveTopicIds(topicIds: string[] | undefined): Promise<string[]> {
    if (topicIds === undefined) {
      return [];
    }

    const uniqueIds = [...new Set(topicIds)];
    if (uniqueIds.length > MAX_TOPICS_PER_ITEM) {
      throw new BusinessException(
        ErrorCode.TOPIC_TOO_MANY,
        `Received ${uniqueIds.length} topic ids; max is ${MAX_TOPICS_PER_ITEM}`,
        `Pick at most ${MAX_TOPICS_PER_ITEM} topics`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (uniqueIds.length === 0) {
      return [];
    }

    const topics = await this.topicsRepository.find({
      where: { id: In(uniqueIds) },
    });
    if (topics.length !== uniqueIds.length) {
      throw new BusinessException(
        ErrorCode.TOPIC_NOT_FOUND,
        `Unknown topic ids among "${uniqueIds.join(', ')}"`,
        'One or more topics were not found',
        HttpStatus.BAD_REQUEST,
      );
    }

    return uniqueIds;
  }

  async replacePostTopics(postId: string, topicIds: string[]) {
    await this.postTopicsRepository.delete({ postId });
    if (topicIds.length === 0) {
      return;
    }
    await this.postTopicsRepository.save(
      topicIds.map((topicId) =>
        this.postTopicsRepository.create({ postId, topicId }),
      ),
    );
  }

  async replaceArticleTopics(articleId: string, topicIds: string[]) {
    await this.articleTopicsRepository.delete({ articleId });
    if (topicIds.length === 0) {
      return;
    }
    await this.articleTopicsRepository.save(
      topicIds.map((topicId) =>
        this.articleTopicsRepository.create({ articleId, topicId }),
      ),
    );
  }

  async topicsByPostIds(
    postIds: string[],
  ): Promise<Map<string, TopicPreview[]>> {
    if (postIds.length === 0) {
      return new Map();
    }
    return this.groupPreviews(
      postIds,
      await this.postTopicsRepository.find({
        where: { postId: In(postIds) },
        relations: ['topic'],
      }),
      (row) => row.postId,
    );
  }

  async topicsByArticleIds(
    articleIds: string[],
  ): Promise<Map<string, TopicPreview[]>> {
    if (articleIds.length === 0) {
      return new Map();
    }
    return this.groupPreviews(
      articleIds,
      await this.articleTopicsRepository.find({
        where: { articleId: In(articleIds) },
        relations: ['topic'],
      }),
      (row) => row.articleId,
    );
  }

  private async findTopicOrFail(id: string): Promise<Topic> {
    const topic = await this.topicsRepository.findOne({ where: { id } });
    if (!topic) {
      throw new BusinessException(
        ErrorCode.TOPIC_NOT_FOUND,
        `Topic "${id}" was not found`,
        'Topic not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return topic;
  }

  private async followedSet(
    currentUserId: string | undefined,
    topicIds: string[],
  ): Promise<Set<string>> {
    if (!currentUserId || topicIds.length === 0) {
      return new Set();
    }

    const rows = await this.followedTopicsRepository.find({
      where: { userId: currentUserId, topicId: In(topicIds) },
      select: ['topicId'],
    });
    return new Set(rows.map((row) => row.topicId));
  }

  private groupPreviews<T extends { topic: Topic }>(
    ownerIds: string[],
    rows: T[],
    ownerId: (row: T) => string,
  ): Map<string, TopicPreview[]> {
    const map = new Map<string, TopicPreview[]>(ownerIds.map((id) => [id, []]));
    for (const row of rows) {
      const list = map.get(ownerId(row));
      if (!list) {
        continue;
      }
      list.push(this.formatPreview(row.topic));
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }

  private formatPreview(topic: Topic): TopicPreview {
    return {
      id: topic.id,
      slug: topic.slug,
      name: topic.name,
    };
  }

  private formatTopic(topic: Topic, isFollowed: boolean) {
    return {
      ...this.formatPreview(topic),
      description: topic.description,
      isFollowed,
    };
  }
}
