import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SavedItem, SavedTargetType } from './entities/saved-item.entity';
import { Post } from '../posts/entities/post.entity';
import { Article } from '../articles/entities/article.entity';
import { PaginationQueryDto } from '../common/dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

type AuthorPreview = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

@Injectable()
export class SavedService {
  constructor(
    @InjectRepository(SavedItem)
    private readonly savedRepository: Repository<SavedItem>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
  ) {}

  async save(userId: string, targetId: string, targetType: SavedTargetType) {
    if (targetType === SavedTargetType.EVENT) {
      return { message: 'Saved successfully' };
    }

    await this.ensurePublishedTarget(targetId, targetType);

    const existing = await this.savedRepository.findOne({
      where: { userId, targetId, targetType },
    });
    if (existing) {
      throw new BusinessException(
        ErrorCode.ALREADY_SAVED,
        `User "${userId}" already saved ${targetType} "${targetId}"`,
        'You have already saved this',
        HttpStatus.CONFLICT,
      );
    }

    const saved = this.savedRepository.create({ userId, targetId, targetType });
    await this.savedRepository.save(saved);
    return { message: 'Saved successfully' };
  }

  async unsave(userId: string, targetId: string, targetType: SavedTargetType) {
    if (targetType === SavedTargetType.EVENT) {
      return { message: 'Removed from saved' };
    }

    const existing = await this.savedRepository.findOne({
      where: { userId, targetId, targetType },
    });
    if (!existing) {
      throw new BusinessException(
        ErrorCode.NOT_SAVED,
        `User "${userId}" has not saved ${targetType} "${targetId}"`,
        'You have not saved this',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.savedRepository.remove(existing);
    return { message: 'Removed from saved' };
  }

  async list(userId: string, query: PaginationQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * limit;

    const [rows, total] = await this.savedRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const postIds = rows
      .filter((row) => row.targetType === SavedTargetType.POST)
      .map((row) => row.targetId);
    const articleIds = rows
      .filter((row) => row.targetType === SavedTargetType.ARTICLE)
      .map((row) => row.targetId);

    const [posts, articles] = await Promise.all([
      postIds.length
        ? this.postsRepository.find({
            where: { id: In(postIds), isPublished: true },
            relations: ['author'],
          })
        : Promise.resolve([]),
      articleIds.length
        ? this.articlesRepository.find({
            where: { id: In(articleIds), isPublished: true },
            relations: ['author'],
          })
        : Promise.resolve([]),
    ]);

    const postsById = new Map(posts.map((post) => [post.id, post]));
    const articlesById = new Map(articles.map((article) => [article.id, article]));

    const items = rows.map((row) => {
      const post = postsById.get(row.targetId);
      const article = articlesById.get(row.targetId);
      return {
        id: row.id,
        targetType: row.targetType,
        targetId: row.targetId,
        post:
          row.targetType === SavedTargetType.POST && post
            ? {
                id: post.id,
                content: post.content,
                author: this.formatAuthor(post.author),
                createdAt: post.createdAt,
              }
            : null,
        article:
          row.targetType === SavedTargetType.ARTICLE && article
            ? {
                id: article.id,
                title: article.title,
                slug: article.slug,
                author: this.formatAuthor(article.author),
                createdAt: article.createdAt,
              }
            : null,
        createdAt: row.createdAt,
      };
    });

    return { items, total, page, limit };
  }

  async savedIdSet(
    userId: string | undefined,
    targetType: SavedTargetType,
    targetIds: string[],
  ): Promise<Set<string>> {
    if (!userId || targetIds.length === 0) {
      return new Set();
    }

    const rows = await this.savedRepository.find({
      where: { userId, targetType, targetId: In(targetIds) },
      select: ['targetId'],
    });
    return new Set(rows.map((row) => row.targetId));
  }

  private async ensurePublishedTarget(
    targetId: string,
    targetType: SavedTargetType,
  ) {
    if (targetType === SavedTargetType.POST) {
      const post = await this.postsRepository.findOne({
        where: { id: targetId, isPublished: true },
      });
      if (!post) {
        throw new BusinessException(
          ErrorCode.POST_NOT_FOUND,
          `Post "${targetId}" not found`,
          'Post not found',
          HttpStatus.NOT_FOUND,
        );
      }
      return;
    }

    const article = await this.articlesRepository.findOne({
      where: { id: targetId, isPublished: true },
    });
    if (!article) {
      throw new BusinessException(
        ErrorCode.ARTICLE_NOT_FOUND,
        `Article "${targetId}" not found`,
        'Article not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private formatAuthor(
    author: {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      isActive?: boolean;
    } | null,
  ): AuthorPreview | null {
    if (!author || !author.isActive) return null;
    return {
      id: author.id,
      username: author.username,
      displayName: author.displayName,
      avatarUrl: author.avatarUrl,
    };
  }
}
