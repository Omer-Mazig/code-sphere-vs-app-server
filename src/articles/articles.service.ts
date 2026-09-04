import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, Repository } from 'typeorm';
import { Article } from './entities/article.entity';
import { Like, TargetType } from '../interactions/entities/like.entity';
import { Comment } from '../interactions/entities/comment.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleQueryDto } from './dto/article-query.dto';
import { PaginationQueryDto } from '../common/dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { flattenRichText, newlyMentionedUsernames } from '../common/utils';
import { NotificationDomainEventName } from '../notifications/events/notification-domain-events';
import { NotificationTargetType } from '../notifications/entities/notification.entity';
import { FollowsService } from '../users/follows.service';
import { TopicsService } from '../topics/topics.service';
import { ArticleTopic } from '../topics/entities/article-topic.entity';
import { MediaService } from '../media/media.service';
import { parseMediaObjectIdFromUrl } from '../media/media-object-url';

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    private readonly followsService: FollowsService,
    private readonly topicsService: TopicsService,
    private readonly mediaService: MediaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(authorId: string, dto: CreateArticleDto) {
    const slug = this.generateSlug(dto.title);

    const existingSlug = await this.articlesRepository.findOne({
      where: { slug },
    });

    if (existingSlug) {
      throw new BusinessException(
        ErrorCode.ARTICLE_SLUG_EXISTS,
        `Article with slug "${slug}" already exists`,
        'An article with a similar title already exists',
        HttpStatus.CONFLICT,
      );
    }

    const article = this.articlesRepository.create({
      authorId,
      title: dto.title,
      slug,
      content: dto.content,
      coverImageUrl: dto.coverImageUrl,
      isPublished: dto.isPublished ?? false,
    });

    await this.articlesRepository.save(article);

    if (dto.topicIds !== undefined) {
      const topicIds = await this.topicsService.resolveTopicIds(dto.topicIds);
      await this.topicsService.replaceArticleTopics(article.id, topicIds);
    }

    await this.emitMentionNotifications({
      actorId: authorId,
      nextContent: flattenRichText(article.content),
      previousContent: '',
      isVisible: article.isPublished,
      articleSlug: article.slug,
    });

    return this.getById(article.id, authorId);
  }

  async update(articleId: string, userId: string, dto: UpdateArticleDto) {
    const article = await this.articlesRepository.findOne({
      where: { id: articleId },
    });

    if (!article) {
      throw new BusinessException(
        ErrorCode.ARTICLE_NOT_FOUND,
        `Article with id "${articleId}" not found`,
        'Article not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (article.authorId !== userId) {
      throw new BusinessException(
        ErrorCode.ARTICLE_UPDATE_FORBIDDEN,
        `User "${userId}" cannot update article "${articleId}"`,
        'You can only edit your own articles',
        HttpStatus.FORBIDDEN,
      );
    }

    const previousPublished = article.isPublished;
    const previousContent = flattenRichText(article.content);
    const definedUpdates = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as UpdateArticleDto;
    const nextPublished = definedUpdates.isPublished ?? article.isPublished;
    const nextContent = flattenRichText(
      definedUpdates.content ?? article.content,
    );

    if (dto.title && dto.title !== article.title) {
      const newSlug = this.generateSlug(dto.title);
      const existingSlug = await this.articlesRepository.findOne({
        where: { slug: newSlug },
      });

      if (existingSlug && existingSlug.id !== articleId) {
        throw new BusinessException(
          ErrorCode.ARTICLE_SLUG_EXISTS,
          `Article with slug "${newSlug}" already exists`,
          'An article with a similar title already exists',
          HttpStatus.CONFLICT,
        );
      }

      article.slug = newSlug;
    }

    const previousCover = article.coverImageUrl;
    const { topicIds: _topicIds, ...entityUpdates } = definedUpdates;
    Object.assign(article, entityUpdates);
    await this.articlesRepository.save(article);

    if (dto.coverImageUrl !== undefined) {
      await this.deleteReplacedCoverBestEffort(
        previousCover,
        article.coverImageUrl,
        userId,
      );
    }

    if (dto.topicIds !== undefined) {
      const topicIds = await this.topicsService.resolveTopicIds(dto.topicIds);
      await this.topicsService.replaceArticleTopics(article.id, topicIds);
    }

    await this.emitMentionNotifications({
      actorId: userId,
      nextContent,
      previousContent: previousPublished ? previousContent : '',
      isVisible: nextPublished,
      articleSlug: article.slug,
    });

    return this.getById(article.id, userId);
  }

  async delete(articleId: string, userId: string) {
    const article = await this.articlesRepository.findOne({
      where: { id: articleId },
    });

    if (!article) {
      throw new BusinessException(
        ErrorCode.ARTICLE_NOT_FOUND,
        `Article with id "${articleId}" not found`,
        'Article not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (article.authorId !== userId) {
      throw new BusinessException(
        ErrorCode.ARTICLE_DELETE_FORBIDDEN,
        `User "${userId}" cannot delete article "${articleId}"`,
        'You can only delete your own articles',
        HttpStatus.FORBIDDEN,
      );
    }

    const coverUrl = article.coverImageUrl;
    await this.articlesRepository.remove(article);
    await this.deleteReplacedCoverBestEffort(coverUrl, null, userId);

    return { message: 'Article deleted' };
  }

  async getById(articleId: string, currentUserId?: string) {
    const article = await this.articlesRepository.findOne({
      where: { id: articleId },
      relations: ['author'],
    });

    if (!article || !article.author?.isActive) {
      throw new BusinessException(
        ErrorCode.ARTICLE_NOT_FOUND,
        `Article with id "${articleId}" not found`,
        'Article not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const formatted = this.formatArticle(article);
    const [withTopics] = await this.enrichWithTopics([formatted]);
    const [withLikes] = await this.enrichWithLikes([withTopics], currentUserId);
    const [withComments] = await this.enrichWithCommentCounts([withLikes]);
    const [enriched] = await this.enrichWithFollowing(
      [withComments],
      currentUserId,
    );
    return enriched;
  }

  async getBySlug(slug: string, currentUserId?: string) {
    const article = await this.articlesRepository.findOne({
      where: { slug },
      relations: ['author'],
    });

    if (!article || !article.author?.isActive) {
      throw new BusinessException(
        ErrorCode.ARTICLE_NOT_FOUND,
        `Article with slug "${slug}" not found`,
        'Article not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!article.isPublished && article.authorId !== currentUserId) {
      throw new BusinessException(
        ErrorCode.ARTICLE_NOT_FOUND,
        `Unpublished article "${slug}" requested by "${currentUserId ?? 'guest'}"`,
        'Article not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const formatted = this.formatArticle(article);
    const [withTopics] = await this.enrichWithTopics([formatted]);
    const [withLikes] = await this.enrichWithLikes([withTopics], currentUserId);
    const [withComments] = await this.enrichWithCommentCounts([withLikes]);
    const [enriched] = await this.enrichWithFollowing(
      [withComments],
      currentUserId,
    );
    return enriched;
  }

  async list(query: ArticleQueryDto, currentUserId?: string) {
    const { page, limit, authorId, search, isPublished, topicId } = query;
    const skip = (page - 1) * limit;

    const qb = this.articlesRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .orderBy('article.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (authorId) {
      qb.andWhere('article.authorId = :authorId', { authorId });
    }

    if (search) {
      qb.andWhere(
        '(article.title ILIKE :search OR article.content ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (isPublished !== undefined) {
      qb.andWhere('article.isPublished = :isPublished', { isPublished });
    }

    if (topicId) {
      qb.innerJoin(
        ArticleTopic,
        'articleTopic',
        'articleTopic.articleId = article.id AND articleTopic.topicId = :topicId',
        { topicId },
      );
    }

    qb.andWhere('author.isActive = :isActive', { isActive: true });

    const [articles, total] = await qb.getManyAndCount();

    const items = articles.map((article) => this.formatArticle(article));
    const withTopics = await this.enrichWithTopics(items);
    const withLikes = await this.enrichWithLikes(withTopics, currentUserId);
    const withComments = await this.enrichWithCommentCounts(withLikes);
    const enrichedItems = await this.enrichWithFollowing(
      withComments,
      currentUserId,
    );

    return { items: enrichedItems, total, page, limit };
  }

  async listPublishedAuthors() {
    const rows = await this.articlesRepository
      .createQueryBuilder('article')
      .innerJoin('article.author', 'author')
      .where('article.isPublished = :isPublished', { isPublished: true })
      .andWhere('author.isActive = :isActive', { isActive: true })
      .select('author.id', 'id')
      .addSelect('author.username', 'username')
      .addSelect('author.displayName', 'displayName')
      .addSelect('author.avatarUrl', 'avatarUrl')
      .groupBy('author.id')
      .addGroupBy('author.username')
      .addGroupBy('author.displayName')
      .addGroupBy('author.avatarUrl')
      .orderBy('author.username', 'ASC')
      .getRawMany<{
        id: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
      }>();

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
    }));
  }

  async getSuggestions(query: PaginationQueryDto, currentUserId?: string) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    // Rank published articles by engagement (likes + comments), newest first as tiebreaker
    const idQb = this.articlesRepository
      .createQueryBuilder('article')
      // targetId columns are varchar while article.id is uuid — cast for the join
      .leftJoin(
        Like,
        'articleLike',
        'articleLike.targetId = CAST(article.id AS TEXT) AND articleLike.targetType = :likeTargetType',
        { likeTargetType: TargetType.ARTICLE },
      )
      .leftJoin(
        Comment,
        'articleComment',
        'articleComment.targetId = CAST(article.id AS TEXT) AND articleComment.targetType = :commentTargetType',
        { commentTargetType: TargetType.ARTICLE },
      )
      .select('article.id', 'id')
      .innerJoin('article.author', 'author')
      .where('article.isPublished = :isPublished', { isPublished: true })
      .andWhere('author.isActive = :authorActive', { authorActive: true })
      .groupBy('article.id')
      .orderBy(
        'COUNT(DISTINCT articleLike.id) + COUNT(DISTINCT articleComment.id)',
        'DESC',
      )
      .addOrderBy('article.createdAt', 'DESC')
      .offset(skip)
      .limit(limit);

    const countQb = this.articlesRepository
      .createQueryBuilder('article')
      .innerJoin('article.author', 'author')
      .where('article.isPublished = :isPublished', { isPublished: true })
      .andWhere('author.isActive = :authorActive', { authorActive: true });

    if (currentUserId) {
      idQb.andWhere('article.authorId <> :currentUserId', { currentUserId });
      countQb.andWhere('article.authorId <> :currentUserId', { currentUserId });
    }

    const [idRows, total] = await Promise.all([
      idQb.getRawMany<{ id: string }>(),
      countQb.getCount(),
    ]);

    const ids = idRows.map((row) => row.id);
    if (ids.length === 0) {
      return { items: [], total, page, limit };
    }

    const articles = await this.articlesRepository.find({
      where: { id: In(ids) },
      relations: ['author'],
    });
    const articlesById = new Map(articles.map((a) => [a.id, a]));
    const ordered = ids
      .map((id) => articlesById.get(id))
      .filter((a): a is Article => a !== undefined);

    const items = ordered.map((article) => this.formatArticle(article));
    const withTopics = await this.enrichWithTopics(items);
    const withLikes = await this.enrichWithLikes(withTopics, currentUserId);
    const withComments = await this.enrichWithCommentCounts(withLikes);
    const enrichedItems = await this.enrichWithFollowing(
      withComments,
      currentUserId,
    );

    return { items: enrichedItems, total, page, limit };
  }

  private formatArticle(article: Article) {
    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      coverImageUrl: article.coverImageUrl,
      isPublished: article.isPublished,
      author: article.author
        ? {
            id: article.author.id,
            username: article.author.username,
            displayName: article.author.displayName,
            avatarUrl: article.author.avatarUrl,
          }
        : null,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  }

  private async enrichWithTopics<T extends { id: string }>(items: T[]) {
    const map = await this.topicsService.topicsByArticleIds(
      items.map((item) => item.id),
    );
    return items.map((item) => ({
      ...item,
      topics: map.get(item.id) ?? [],
    }));
  }

  private async enrichWithLikes<T extends { id: string }>(
    items: T[],
    currentUserId?: string,
  ): Promise<(T & { likesCount: number; isLiked: boolean })[]> {
    if (items.length === 0) return [];

    const ids = items.map((i) => i.id);

    const countsRaw: { targetId: string; count: string }[] =
      await this.likesRepository
        .createQueryBuilder('like')
        .select('like.targetId', 'targetId')
        .addSelect('COUNT(*)', 'count')
        .where('like.targetId IN (:...ids)', { ids })
        .andWhere('like.targetType = :type', { type: TargetType.ARTICLE })
        .groupBy('like.targetId')
        .getRawMany();

    const countMap = new Map(
      countsRaw.map((c) => [c.targetId, Number(c.count)]),
    );

    let likedSet = new Set<string>();
    if (currentUserId) {
      const userLikes = await this.likesRepository.find({
        where: {
          userId: currentUserId,
          targetId: In(ids),
          targetType: TargetType.ARTICLE,
        },
      });
      likedSet = new Set(userLikes.map((l) => l.targetId));
    }

    return items.map((item) => ({
      ...item,
      likesCount: countMap.get(item.id) ?? 0,
      isLiked: likedSet.has(item.id),
    }));
  }

  private async enrichWithCommentCounts<T extends { id: string }>(
    items: T[],
  ): Promise<(T & { commentsCount: number })[]> {
    if (items.length === 0) return [];

    const ids = items.map((item) => item.id);

    const countsRaw: { targetId: string; count: string }[] =
      await this.commentsRepository
        .createQueryBuilder('comment')
        .innerJoin('comment.author', 'author')
        .select('comment.targetId', 'targetId')
        .addSelect('COUNT(*)', 'count')
        .where('comment.targetId IN (:...ids)', { ids })
        .andWhere('comment.targetType = :targetType', {
          targetType: TargetType.ARTICLE,
        })
        .andWhere('author.isActive = :isActive', { isActive: true })
        .groupBy('comment.targetId')
        .getRawMany();

    const countMap = new Map(
      countsRaw.map((row) => [row.targetId, Number(row.count)]),
    );

    return items.map((item) => ({
      ...item,
      commentsCount: countMap.get(item.id) ?? 0,
    }));
  }

  private async enrichWithFollowing<
    T extends { author: { id: string } | null },
  >(items: T[], currentUserId?: string): Promise<T[]> {
    if (items.length === 0) {
      return [];
    }

    const authorIds = items
      .map((item) => item.author?.id)
      .filter((id): id is string => Boolean(id));
    const followingSet = await this.followsService.followingSet(
      currentUserId,
      authorIds,
    );

    return items.map((item) => ({
      ...item,
      author: item.author
        ? {
            ...item.author,
            isFollowing: followingSet.has(item.author.id),
          }
        : null,
    }));
  }

  private generateSlug(title: string): string {
    return (
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now().toString(36)
    );
  }

  private async deleteReplacedCoverBestEffort(
    previousUrl: string | null | undefined,
    nextUrl: string | null | undefined,
    userId: string,
  ) {
    const previousId = parseMediaObjectIdFromUrl(previousUrl);
    const nextId = parseMediaObjectIdFromUrl(nextUrl);
    if (!previousId || previousId === nextId) {
      return;
    }

    try {
      await this.mediaService.delete(previousId, userId);
    } catch (error) {
      const errorCode =
        error instanceof BusinessException ? error.errorCode : undefined;
      if (
        errorCode === ErrorCode.MEDIA_NOT_FOUND ||
        errorCode === ErrorCode.AUTHORIZATION_ERROR
      ) {
        return;
      }
      this.logger.warn({
        msg: 'Failed to delete replaced article cover media',
        previousId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async emitMentionNotifications(params: {
    actorId: string;
    nextContent: string;
    previousContent: string;
    isVisible: boolean;
    articleSlug: string;
  }) {
    if (!params.isVisible) {
      return;
    }

    const usernames = newlyMentionedUsernames(
      params.nextContent,
      params.previousContent,
    );
    if (usernames.length === 0) {
      return;
    }

    await this.eventEmitter.emitAsync(
      NotificationDomainEventName.USER_MENTIONED,
      {
        actorId: params.actorId,
        usernames,
        targetType: NotificationTargetType.ARTICLE,
        articleSlug: params.articleSlug,
        excerpt: params.nextContent,
      },
    );
  }
}
