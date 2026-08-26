import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { Comment } from '../interactions/entities/comment.entity';
import { Like, TargetType } from '../interactions/entities/like.entity';
import { Share } from '../interactions/entities/share.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { newlyMentionedUsernames } from '../common/utils';
import { NotificationDomainEventName } from '../notifications/events/notification-domain-events';
import { NotificationTargetType } from '../notifications/entities/notification.entity';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    @InjectRepository(Share)
    private readonly sharesRepository: Repository<Share>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(authorId: string, dto: CreatePostDto) {
    const content = dto.content?.trim() ?? '';
    const sharedPostId = dto.sharedPostId;

    if (!content && !sharedPostId) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Post requires content or a sharedPostId',
        'Write something before posting or reshare a post',
        HttpStatus.BAD_REQUEST,
      );
    }

    let resolvedSharedPostId: string | null = null;
    if (sharedPostId) {
      const original = await this.resolveRootPost(sharedPostId);
      resolvedSharedPostId = original.id;
    }

    const post = this.postsRepository.create({
      authorId,
      content,
      sharedPostId: resolvedSharedPostId,
    });

    await this.postsRepository.save(post);

    if (resolvedSharedPostId) {
      await this.recordShare(authorId, resolvedSharedPostId);
    }

    await this.emitMentionNotifications(authorId, content, '', post.id);

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

    const previousContent = post.content;
    post.content = dto.content;
    await this.postsRepository.save(post);

    await this.emitMentionNotifications(
      userId,
      post.content,
      previousContent,
      post.id,
    );

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
      relations: ['author', 'sharedPost', 'sharedPost.author'],
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
    const [withLikes] = await this.enrichWithLikes([formatted], currentUserId);
    const [withShares] = await this.enrichWithShares(
      [withLikes],
      currentUserId,
    );
    const [withCommentPreview] = await this.enrichWithCommentPreview([
      withShares,
    ]);
    return withCommentPreview;
  }

  async getFeed(query: PostQueryDto, currentUserId?: string) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const { authorId } = query;
    const skip = (page - 1) * limit;

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.sharedPost', 'sharedPost')
      .leftJoinAndSelect('sharedPost.author', 'sharedPostAuthor')
      .orderBy('post.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (authorId) {
      qb.where('post.authorId = :authorId', { authorId });
    }

    const [posts, total] = await qb.getManyAndCount();

    const items = posts.map((post) => this.formatPost(post));
    const withLikes = await this.enrichWithLikes(items, currentUserId);
    const withShares = await this.enrichWithShares(withLikes, currentUserId);
    const enrichedItems = await this.enrichWithCommentPreview(withShares);

    return {
      items: enrichedItems,
      total,
      page,
      limit,
    };
  }

  private formatPost(post: Post) {
    const shared = post.sharedPost;
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
      sharedPost: shared
        ? {
            id: shared.id,
            content: shared.content,
            author: shared.author
              ? {
                  id: shared.author.id,
                  username: shared.author.username,
                  displayName: shared.author.displayName,
                  avatarUrl: shared.author.avatarUrl,
                }
              : null,
            createdAt: shared.createdAt,
          }
        : null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private async resolveRootPost(postId: string): Promise<Post> {
    const visited = new Set<string>();
    let current = await this.postsRepository.findOne({
      where: { id: postId },
    });

    if (!current) {
      throw new BusinessException(
        ErrorCode.POST_NOT_FOUND,
        `Post with id "${postId}" not found`,
        'Post not found',
        HttpStatus.NOT_FOUND,
      );
    }

    while (current.sharedPostId && !visited.has(current.id)) {
      visited.add(current.id);
      const next = await this.postsRepository.findOne({
        where: { id: current.sharedPostId },
      });
      if (!next) {
        break;
      }
      current = next;
    }

    return current;
  }

  private async recordShare(userId: string, targetId: string) {
    const existing = await this.sharesRepository.findOne({
      where: { userId, targetId, targetType: TargetType.POST },
    });
    if (existing) {
      return;
    }

    await this.sharesRepository.save(
      this.sharesRepository.create({
        userId,
        targetId,
        targetType: TargetType.POST,
      }),
    );
  }

  private async enrichWithShares<T extends { id: string }>(
    items: T[],
    currentUserId?: string,
  ): Promise<(T & { sharesCount: number; isShared: boolean })[]> {
    if (items.length === 0) return [];

    const ids = items.map((i) => i.id);

    const countsRaw: { targetId: string; count: string }[] =
      await this.sharesRepository
        .createQueryBuilder('share')
        .select('share.targetId', 'targetId')
        .addSelect('COUNT(*)', 'count')
        .where('share.targetId IN (:...ids)', { ids })
        .andWhere('share.targetType = :type', { type: TargetType.POST })
        .groupBy('share.targetId')
        .getRawMany();

    const countMap = new Map(
      countsRaw.map((c) => [c.targetId, Number(c.count)]),
    );

    let sharedSet = new Set<string>();
    if (currentUserId) {
      const userShares = await this.sharesRepository.find({
        where: {
          userId: currentUserId,
          targetId: In(ids),
          targetType: TargetType.POST,
        },
      });
      sharedSet = new Set(userShares.map((s) => s.targetId));
    }

    return items.map((item) => ({
      ...item,
      sharesCount: countMap.get(item.id) ?? 0,
      isShared: sharedSet.has(item.id),
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

  private async emitMentionNotifications(
    actorId: string,
    nextContent: string,
    previousContent: string,
    postId: string,
  ) {
    const usernames = newlyMentionedUsernames(nextContent, previousContent);
    if (usernames.length === 0) {
      return;
    }

    await this.eventEmitter.emitAsync(
      NotificationDomainEventName.USER_MENTIONED,
      {
        actorId,
        usernames,
        targetType: NotificationTargetType.POST,
        postId,
        excerpt: nextContent,
      },
    );
  }
}
