import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { PostImage } from './entities/post-image.entity';
import { Comment } from '../interactions/entities/comment.entity';
import { Like, TargetType } from '../interactions/entities/like.entity';
import { Share } from '../interactions/entities/share.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { PaginationQueryDto } from '../common/dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { newlyMentionedUsernames } from '../common/utils';
import { NotificationDomainEventName } from '../notifications/events/notification-domain-events';
import { NotificationTargetType } from '../notifications/entities/notification.entity';
import { FollowsService } from '../users/follows.service';
import { TopicsService } from '../topics/topics.service';
import { MediaService } from '../media/media.service';
import { PostTopic } from '../topics/entities/post-topic.entity';
import { MAX_POST_IMAGES, PostImageLayout } from './posts.constants';
import { SavedService } from '../saved/saved.service';
import { SavedTargetType } from '../saved/entities/saved-item.entity';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(PostImage)
    private readonly postImagesRepository: Repository<PostImage>,
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    @InjectRepository(Share)
    private readonly sharesRepository: Repository<Share>,
    private readonly followsService: FollowsService,
    private readonly topicsService: TopicsService,
    private readonly mediaService: MediaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly savedService: SavedService,
  ) {}

  async create(currentUserId: string, dto: CreatePostDto) {
    const content = dto.content?.trim() ?? '';
    const sharedPostId = dto.sharedPostId;
    const imageMediaIds = dto.imageMediaIds ?? [];

    if (!content && !sharedPostId && imageMediaIds.length === 0) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Post requires content, images, or a sharedPostId',
        'Write something, attach an image, or reshare a post',
        HttpStatus.BAD_REQUEST,
      );
    }

    let resolvedSharedPostId: string | null = null;
    if (sharedPostId) {
      const original = await this.resolveRootPost(sharedPostId);
      resolvedSharedPostId = original.id;
    }

    const isPublished = dto.isPublished ?? true;
    const post = this.postsRepository.create({
      authorId: currentUserId,
      content,
      sharedPostId: resolvedSharedPostId,
      imageLayout: dto.imageLayout ?? PostImageLayout.GALLERY,
      isPublished,
    });

    await this.postsRepository.save(post);

    if (imageMediaIds.length > 0) {
      await this.replacePostImages(post.id, currentUserId, imageMediaIds);
    }

    if (dto.topicIds !== undefined) {
      const topicIds = await this.topicsService.resolveTopicIds(dto.topicIds);
      await this.topicsService.replacePostTopics(post.id, topicIds);
    }

    if (resolvedSharedPostId) {
      await this.recordShare(currentUserId, resolvedSharedPostId);
    }

    if (isPublished) {
      await this.emitMentionNotifications(currentUserId, content, '', post.id);
    }

    return this.getById(post.id, currentUserId);
  }

  async update(postId: string, currentUserId: string, dto: UpdatePostDto) {
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

    if (post.authorId !== currentUserId) {
      throw new BusinessException(
        ErrorCode.POST_UPDATE_FORBIDDEN,
        `User "${currentUserId}" cannot update post "${postId}"`,
        'You can only edit your own posts',
        HttpStatus.FORBIDDEN,
      );
    }

    const previousContent = post.content;
    const wasPublished = post.isPublished;
    const nextImageIds =
      dto.imageMediaIds ??
      (
        await this.postImagesRepository.find({
          where: { postId: post.id },
          select: ['mediaId'],
        })
      ).map((row) => row.mediaId);

    const nextPublished = dto.isPublished ?? post.isPublished;
    if (
      nextPublished &&
      !dto.content.trim() &&
      !post.sharedPostId &&
      nextImageIds.length === 0
    ) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        `Post "${postId}" cannot be empty`,
        'Write something or attach an image',
        HttpStatus.BAD_REQUEST,
      );
    }

    post.content = dto.content;
    post.isPublished = nextPublished;
    if (dto.imageLayout !== undefined) {
      post.imageLayout = dto.imageLayout;
    }
    await this.postsRepository.save(post);

    if (dto.imageMediaIds !== undefined) {
      await this.replacePostImages(post.id, currentUserId, dto.imageMediaIds);
    }

    if (dto.topicIds !== undefined) {
      const topicIds = await this.topicsService.resolveTopicIds(dto.topicIds);
      await this.topicsService.replacePostTopics(post.id, topicIds);
    }

    if (nextPublished) {
      await this.emitMentionNotifications(
        currentUserId,
        post.content,
        wasPublished ? previousContent : '',
        post.id,
      );
    }

    return this.getById(post.id, currentUserId);
  }

  async delete(postId: string, currentUserId: string) {
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

    if (post.authorId !== currentUserId) {
      throw new BusinessException(
        ErrorCode.POST_DELETE_FORBIDDEN,
        `User "${currentUserId}" cannot delete post "${postId}"`,
        'You can only delete your own posts',
        HttpStatus.FORBIDDEN,
      );
    }

    const imageRows = await this.postImagesRepository.find({
      where: { postId },
      select: ['mediaId'],
    });

    await this.postsRepository.remove(post);

    for (const row of imageRows) {
      await this.deleteOwnedMediaBestEffort(row.mediaId, currentUserId);
    }

    return { message: 'Post deleted' };
  }

  async getById(postId: string, currentUserId?: string) {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['author', 'sharedPost', 'sharedPost.author'],
    });

    if (
      !post ||
      !post.author?.isActive ||
      (!post.isPublished && post.authorId !== currentUserId)
    ) {
      throw new BusinessException(
        ErrorCode.POST_NOT_FOUND,
        `Post with id "${postId}" not found`,
        'Post not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const formatted = this.formatPost(post);
    const [withTopics] = await this.enrichWithTopics([formatted]);
    const [withImages] = await this.enrichWithImages([withTopics]);
    const [withLikes] = await this.enrichWithLikes([withImages], currentUserId);
    const [withShares] = await this.enrichWithShares(
      [withLikes],
      currentUserId,
    );
    const [withCommentPreview] = await this.enrichWithCommentPreview([
      withShares,
    ]);
    const [enriched] = await this.enrichWithFollowing(
      [withCommentPreview],
      currentUserId,
    );
    return enriched;
  }

  async getFeed(query: PostQueryDto, currentUserId?: string) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const { authorId, topicId } = query;
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

    if (topicId) {
      qb.innerJoin(
        PostTopic,
        'postTopic',
        'postTopic.postId = post.id AND postTopic.topicId = :topicId',
        { topicId },
      );
    }

    qb.andWhere('author.isActive = :isActive', { isActive: true });
    qb.andWhere('post.isPublished = :isPublished', { isPublished: true });

    const [posts, total] = await qb.getManyAndCount();

    const items = posts.map((post) => this.formatPost(post));
    const withTopics = await this.enrichWithTopics(items);
    const withImages = await this.enrichWithImages(withTopics);
    const withLikes = await this.enrichWithLikes(withImages, currentUserId);
    const withShares = await this.enrichWithShares(withLikes, currentUserId);
    const withCommentPreview = await this.enrichWithCommentPreview(withShares);
    const enrichedItems = await this.enrichWithFollowing(
      withCommentPreview,
      currentUserId,
    );

    return {
      items: enrichedItems,
      total,
      page,
      limit,
    };
  }

  async getMyDrafts(currentUserId: string, query: PaginationQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * limit;

    const [posts, total] = await this.postsRepository.findAndCount({
      where: { authorId: currentUserId, isPublished: false },
      relations: ['author', 'sharedPost', 'sharedPost.author'],
      order: { updatedAt: 'DESC' },
      skip,
      take: limit,
    });

    const items = posts.map((post) => this.formatPost(post));
    const withTopics = await this.enrichWithTopics(items);
    const withImages = await this.enrichWithImages(withTopics);
    const withLikes = await this.enrichWithLikes(withImages, currentUserId);
    const withShares = await this.enrichWithShares(withLikes, currentUserId);
    const withCommentPreview = await this.enrichWithCommentPreview(withShares);
    const enrichedItems = await this.enrichWithFollowing(
      withCommentPreview,
      currentUserId,
    );

    return { items: enrichedItems, total, page, limit };
  }

  private formatPost(post: Post) {
    const shared = post.sharedPost;
    return {
      id: post.id,
      content: post.content,
      isPublished: post.isPublished,
      imageLayout: post.imageLayout ?? PostImageLayout.GALLERY,
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

  private async enrichWithTopics<T extends { id: string }>(items: T[]) {
    const map = await this.topicsService.topicsByPostIds(
      items.map((item) => item.id),
    );
    return items.map((item) => ({
      ...item,
      topics: map.get(item.id) ?? [],
    }));
  }

  private async enrichWithImages<
    T extends {
      id: string;
      sharedPost?: { id: string } | null;
    },
  >(items: T[]) {
    const ids = [
      ...new Set(
        items.flatMap((item) =>
          [item.id, item.sharedPost?.id].filter((id): id is string =>
            Boolean(id),
          ),
        ),
      ),
    ];
    const map = await this.imagesByPostIds(ids);

    return items.map((item) => ({
      ...item,
      images: map.get(item.id) ?? [],
      ...(item.sharedPost
        ? {
            sharedPost: {
              ...item.sharedPost,
              images: map.get(item.sharedPost.id) ?? [],
            },
          }
        : {}),
    }));
  }

  private async imagesByPostIds(postIds: string[]) {
    const map = new Map<string, { id: string; url: string }[]>();
    if (postIds.length === 0) {
      return map;
    }

    const rows = await this.postImagesRepository.find({
      where: { postId: In(postIds) },
      order: { position: 'ASC' },
    });

    for (const row of rows) {
      const images = map.get(row.postId) ?? [];
      images.push({
        id: row.mediaId,
        url: this.mediaService.publicUrl(row.mediaId),
      });
      map.set(row.postId, images);
    }

    return map;
  }

  private async replacePostImages(
    postId: string,
    currentUserId: string,
    mediaIds: string[],
  ) {
    if (mediaIds.length > MAX_POST_IMAGES) {
      throw new BusinessException(
        ErrorCode.POST_IMAGES_LIMIT,
        `Post "${postId}" cannot attach ${mediaIds.length} images`,
        `You can attach up to ${MAX_POST_IMAGES} images`,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.mediaService.requireOwned(mediaIds, currentUserId);

    const previous = await this.postImagesRepository.find({
      where: { postId },
    });

    await this.postImagesRepository.delete({ postId });

    if (mediaIds.length > 0) {
      await this.postImagesRepository.save(
        mediaIds.map((mediaId, position) =>
          this.postImagesRepository.create({ postId, mediaId, position }),
        ),
      );
    }

    const nextIds = new Set(mediaIds);
    for (const row of previous) {
      if (!nextIds.has(row.mediaId)) {
        await this.deleteOwnedMediaBestEffort(row.mediaId, currentUserId);
      }
    }
  }

  private async deleteOwnedMediaBestEffort(
    mediaId: string,
    currentUserId: string,
  ) {
    try {
      await this.mediaService.delete(mediaId, currentUserId);
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
        msg: 'Failed to delete post image media',
        mediaId,
        userId: currentUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

  private async recordShare(currentUserId: string, targetId: string) {
    const existing = await this.sharesRepository.findOne({
      where: { userId: currentUserId, targetId, targetType: TargetType.POST },
    });
    if (existing) {
      return;
    }

    await this.sharesRepository.save(
      this.sharesRepository.create({
        userId: currentUserId,
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
  ): Promise<(T & { likesCount: number; isLiked: boolean; isSaved: boolean })[]> {
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

    const savedSet = await this.savedService.savedIdSet(
      currentUserId,
      SavedTargetType.POST,
      ids,
    );

    return items.map((item) => ({
      ...item,
      likesCount: countMap.get(item.id) ?? 0,
      isLiked: likedSet.has(item.id),
      isSaved: savedSet.has(item.id),
    }));
  }

  private async enrichWithCommentPreview<T extends { id: string }>(items: T[]) {
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
          targetType: TargetType.POST,
        })
        .andWhere('author.isActive = :isActive', { isActive: true })
        .groupBy('comment.targetId')
        .getRawMany();

    const countMap = new Map(
      countsRaw.map((row) => [row.targetId, Number(row.count)]),
    );

    const latestComments = await this.commentsRepository.find({
      where: {
        targetId: In(ids),
        targetType: TargetType.POST,
        author: { isActive: true },
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

  private async enrichWithFollowing<
    T extends {
      author: { id: string } | null;
      sharedPost?: { author: { id: string } | null } | null;
      latestComment?: { author: { id: string } | null } | null;
    },
  >(items: T[], currentUserId?: string): Promise<T[]> {
    if (items.length === 0) {
      return [];
    }

    const authorIds = items.flatMap((item) =>
      [
        item.author?.id,
        item.sharedPost?.author?.id,
        item.latestComment?.author?.id,
      ].filter((id): id is string => Boolean(id)),
    );
    const followingSet = await this.followsService.followingSet(
      currentUserId,
      authorIds,
    );

    const withFlag = <A extends { id: string }>(
      author: A | null,
    ): (A & { isFollowing: boolean }) | null => {
      if (!author) {
        return null;
      }
      return { ...author, isFollowing: followingSet.has(author.id) };
    };

    return items.map((item) => ({
      ...item,
      author: withFlag(item.author),
      ...(item.sharedPost
        ? {
            sharedPost: {
              ...item.sharedPost,
              author: withFlag(item.sharedPost.author),
            },
          }
        : {}),
      ...(item.latestComment
        ? {
            latestComment: {
              ...item.latestComment,
              author: withFlag(item.latestComment.author),
            },
          }
        : {}),
    }));
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
