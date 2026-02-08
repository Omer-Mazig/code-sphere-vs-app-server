import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from './entities/article.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleQueryDto } from './dto/article-query.dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { createPaginatedResponse } from '../common/dto';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
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

    return this.getById(article.id);
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

    return this.getById(article.id);
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

  async getById(articleId: string) {
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

    return this.formatArticle(article);
  }

  async getBySlug(slug: string) {
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

    return this.formatArticle(article);
  }

  async list(query: ArticleQueryDto) {
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

    return createPaginatedResponse(items, total, page, limit);
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
