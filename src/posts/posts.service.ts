import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { Comment } from '../interactions/entities/comment.entity';
import { Like, TargetType } from '../interactions/entities/like.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';

const DEFAULT_PAGE_SIZE = 3;

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
  ) {}

  async create(authorId: string, dto: CreatePostDto) {
    const post = this.postsRepository.create({
      authorId,
      content: dto.content,
    });

    await this.postsRepository.save(post);

    return this.getById(post.id, authorId);
  }

  async update(postId: string, userId: string, dto: UpdatePostDto) {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new BusinessException(
        ErrorCode.POST_NOT_FOUND,
        `Post with id "${postId}" not found`,
        'Post not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (post.authorId !== userId) {
      throw new BusinessException(
        ErrorCode.POST_UPDATE_FORBIDDEN,
        `User "${userId}" cannot update post "${postId}"`,
        'You can only edit your own posts',
        HttpStatus.FORBIDDEN,
      );
    }

    post.content = dto.content;
    await this.postsRepository.save(post);

    return this.getById(post.id, userId);
  }

  async delete(postId: string, userId: string) {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new BusinessException(
        ErrorCode.POST_NOT_FOUND,
        `Post with id "${postId}" not found`,
        'Post not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (post.authorId !== userId) {
      throw new BusinessException(
        ErrorCode.POST_DELETE_FORBIDDEN,
        `User "${userId}" cannot delete post "${postId}"`,
        'You can only delete your own posts',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.postsRepository.remove(post);

    return { message: 'Post deleted' };
  }

  async getById(postId: string, currentUserId?: string) {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['author'],
    });

    if (!post) {
      throw new BusinessException(
        ErrorCode.POST_NOT_FOUND,
        `Post with id "${postId}" not found`,
        'Post not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const formatted = this.formatPost(post);
    const [withLikes] = await this.enrichWithLikes(
      [formatted],
      currentUserId,
    );
    const [withCommentPreview] = await this.enrichWithCommentPreview([withLikes]);
    return withCommentPreview;
  }

  async getFeed(query: PostQueryDto, currentUserId?: string) {
    const { page, authorId } = query;
    const skip = (page - 1) * DEFAULT_PAGE_SIZE;

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .orderBy('post.createdAt', 'DESC')
      .skip(skip)
      .take(DEFAULT_PAGE_SIZE);

    if (authorId) {
      qb.where('post.authorId = :authorId', { authorId });
    }

    const [posts, total] = await qb.getManyAndCount();

    const items = posts.map((post) => this.formatPost(post));
    const withLikes = await this.enrichWithLikes(items, currentUserId);
    const enrichedItems = await this.enrichWithCommentPreview(withLikes);

    return {
      items: enrichedItems,
      total,
      page,
      limit: DEFAULT_PAGE_SIZE,
    };
  }

  private formatPost(post: Post) {
    return {
      id: post.id,
      content: post.content,
      author: post.author
        ? {
            id: post.author.id,
            username: post.author.username,
            displayName: post.author.displayName,
            avatarUrl: post.author.avatarUrl,
          }
        : null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
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
        .andWhere('like.targetType = :type', { type: TargetType.POST })
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
          targetType: TargetType.POST,
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

  private async enrichWithCommentPreview<T extends { id: string }>(items: T[]) {
    if (items.length === 0) return [];

    const ids = items.map((item) => item.id);

    const countsRaw: { targetId: string; count: string }[] =
      await this.commentsRepository
        .createQueryBuilder('comment')
        .select('comment.targetId', 'targetId')
        .addSelect('COUNT(*)', 'count')
        .where('comment.targetId IN (:...ids)', { ids })
        .andWhere('comment.targetType = :targetType', {
          targetType: TargetType.POST,
        })
        .groupBy('comment.targetId')
        .getRawMany();

    const countMap = new Map(
      countsRaw.map((row) => [row.targetId, Number(row.count)]),
    );

    const latestComments = await this.commentsRepository.find({
      where: {
        targetId: In(ids),
        targetType: TargetType.POST,
      },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });

    const latestMap = new Map<string, (typeof latestComments)[number]>();
    for (const comment of latestComments) {
      if (!latestMap.has(comment.targetId)) {
        latestMap.set(comment.targetId, comment);
      }
    }

    return items.map((item) => {
      const latestComment = latestMap.get(item.id);
      return {
        ...item,
        commentsCount: countMap.get(item.id) ?? 0,
        latestComment: latestComment
          ? {
              id: latestComment.id,
              content: latestComment.content,
              createdAt: latestComment.createdAt,
              author: latestComment.author
                ? {
                    id: latestComment.author.id,
                    username: latestComment.author.username,
                    displayName: latestComment.author.displayName,
                    avatarUrl: latestComment.author.avatarUrl,
                  }
                : null,
            }
          : null,
      };
    });
  }
}
