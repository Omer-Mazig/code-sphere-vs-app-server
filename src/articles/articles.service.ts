import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Article } from './entities/article.entity';
import { Like, TargetType } from '../interactions/entities/like.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleQueryDto } from './dto/article-query.dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
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

    Object.assign(article, dto);
    await this.articlesRepository.save(article);

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

    await this.articlesRepository.remove(article);

    return { message: 'Article deleted' };
  }

  async getById(articleId: string, currentUserId?: string) {
    const article = await this.articlesRepository.findOne({
      where: { id: articleId },
      relations: ['author'],
    });

    if (!article) {
      throw new BusinessException(
        ErrorCode.ARTICLE_NOT_FOUND,
        `Article with id "${articleId}" not found`,
        'Article not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const formatted = this.formatArticle(article);
    const [enriched] = await this.enrichWithLikes(
      [formatted],
      currentUserId,
    );
    return enriched;
  }

  async getBySlug(slug: string, currentUserId?: string) {
    const article = await this.articlesRepository.findOne({
      where: { slug },
      relations: ['author'],
    });

    if (!article) {
      throw new BusinessException(
        ErrorCode.ARTICLE_NOT_FOUND,
        `Article with slug "${slug}" not found`,
        'Article not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const formatted = this.formatArticle(article);
    const [enriched] = await this.enrichWithLikes(
      [formatted],
      currentUserId,
    );
    return enriched;
  }

  async list(query: ArticleQueryDto, currentUserId?: string) {
    const { page, limit, authorId, search, isPublished } = query;
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
      qb.andWhere('article.title ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (isPublished !== undefined) {
      qb.andWhere('article.isPublished = :isPublished', { isPublished });
    }

    const [articles, total] = await qb.getManyAndCount();

    const items = articles.map((article) => this.formatArticle(article));
    const enrichedItems = await this.enrichWithLikes(items, currentUserId);

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
}
