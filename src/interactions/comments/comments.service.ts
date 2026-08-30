import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, IsNull, Repository } from 'typeorm';
import { Comment } from '../entities/comment.entity';
import { Like, TargetType } from '../entities/like.entity';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';
import { Article } from '../../articles/entities/article.entity';
import { FollowsService } from '../../users/follows.service';
import {
  CreateCommentDto,
  InteractionQueryDto,
  UpdateCommentDto,
} from '../dto';
import { PaginationQueryDto } from '../../common/dto';
import { extractMentionedUsernames } from '../../common/utils';
import { BusinessException } from '../../common/errors/business.exception';
import { ErrorCode } from '../../common/errors/error-codes.enum';
import { InteractionTargetValidatorService } from '../shared';
import { NotificationDomainEventName } from '../../notifications/events/notification-domain-events';
import { NotificationTargetType } from '../../notifications/entities/notification.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
    private readonly followsService: FollowsService,
    private readonly interactionTargetValidatorService: InteractionTargetValidatorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async addComment(currentUserId: string, dto: CreateCommentDto) {
    this.interactionTargetValidatorService.assertCommentTargetType(
      dto.targetType,
    );
    await this.interactionTargetValidatorService.ensureTargetExists(
      dto.targetId,
      dto.targetType,
    );

    if (dto.parentId) {
      await this.validateParentComment(
        dto.parentId,
        dto.targetId,
        dto.targetType,
      );
    }

    await this.validateMentionsForContext(
      currentUserId,
      dto.parentId,
      dto.targetId,
      dto.targetType,
      dto.content,
    );

    const comment = this.commentsRepository.create({
      authorId: currentUserId,
      targetId: dto.targetId,
      targetType: dto.targetType,
      content: dto.content,
      parentId: dto.parentId ?? null,
    });

    await this.commentsRepository.save(comment);

    const mentionedUserIds = await this.resolveMentionedUserIds(
      dto.content,
      currentUserId,
    );
    await this.emitMentionNotifications({
      actorId: currentUserId,
      content: dto.content,
      targetId: dto.targetId,
      targetType: dto.targetType,
      commentId: comment.id,
    });

    if (dto.parentId) {
      const parent = await this.commentsRepository.findOne({
        where: { id: dto.parentId },
        select: ['id', 'authorId'],
      });
      if (
        parent &&
        parent.authorId !== currentUserId &&
        !mentionedUserIds.has(parent.authorId)
      ) {
        this.eventEmitter.emit(NotificationDomainEventName.COMMENT_REPLIED, {
          targetId: dto.targetId,
          targetType: dto.targetType,
          parentCommentId: dto.parentId,
          replyCommentId: comment.id,
          replierId: currentUserId,
        });
      }
    } else if (dto.targetType === TargetType.POST) {
      const postAuthorId = await this.getTargetAuthorId(
        dto.targetId,
        dto.targetType,
      );
      if (
        postAuthorId &&
        postAuthorId !== currentUserId &&
        !mentionedUserIds.has(postAuthorId)
      ) {
        this.eventEmitter.emit(NotificationDomainEventName.POST_COMMENTED, {
          postId: dto.targetId,
          commentId: comment.id,
          commenterId: currentUserId,
        });
      }
    }

    return this.getCommentById(comment.id, currentUserId);
  }

  async updateComment(
    commentId: string,
    currentUserId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.commentsRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new BusinessException(
        ErrorCode.COMMENT_NOT_FOUND,
        `Comment with id "${commentId}" not found`,
        'Cannot update comment that does not exist. It may have been deleted.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (comment.authorId !== currentUserId) {
      throw new BusinessException(
        ErrorCode.COMMENT_UPDATE_FORBIDDEN,
        `User "${currentUserId}" cannot update comment "${commentId}" of author "${comment.authorId}"`,
        'You can only edit your own comments',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.validateMentionsForContext(
      currentUserId,
      comment.parentId ?? undefined,
      comment.targetId,
      comment.targetType,
      dto.content,
    );

    comment.content = dto.content;
    await this.commentsRepository.save(comment);

    return this.getCommentById(comment.id, currentUserId);
  }

  async deleteComment(commentId: string, currentUserId: string) {
    const comment = await this.commentsRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new BusinessException(
        ErrorCode.COMMENT_NOT_FOUND,
        `Comment with id "${commentId}" not found`,
        'Cannot delete comment that does not exist. It may have been deleted.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (comment.authorId !== currentUserId) {
      throw new BusinessException(
        ErrorCode.COMMENT_DELETE_FORBIDDEN,
        `User "${currentUserId}" cannot delete comment "${commentId}" of author "${comment.authorId}"`,
        'You can only delete your own comments',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.commentsRepository.remove(comment);

    return { message: 'Comment deleted' };
  }

  async getComments(query: InteractionQueryDto, currentUserId?: string) {
    this.interactionTargetValidatorService.assertCommentTargetType(
      query.targetType,
    );
    this.assertCommentsReadableByViewer(currentUserId, query.targetType);

    const { page, limit, targetId, targetType, parentId } = query;
    const skip = (page - 1) * limit;

    const where = parentId
      ? { targetId, targetType, parentId }
      : { targetId, targetType, parentId: IsNull() };
    const order = parentId
      ? ({ createdAt: 'ASC' } as const)
      : ({ createdAt: 'DESC' } as const);

    const [comments, total] = await this.commentsRepository.findAndCount({
      where: { ...where, author: { isActive: true } },
      relations: ['author'],
      skip,
      take: limit,
      order,
    });

    const items = await this.enrichComments(
      comments.map((comment) => this.formatComment(comment)),
      currentUserId,
    );

    return { items, total, page, limit };
  }

  async getCommentReplies(
    commentId: string,
    query: PaginationQueryDto,
    currentUserId?: string,
  ) {
    const parent = await this.commentsRepository.findOne({
      where: { id: commentId },
      relations: ['author'],
    });

    if (!parent || !parent.author?.isActive) {
      throw new BusinessException(
        ErrorCode.COMMENT_NOT_FOUND,
        `Comment with id "${commentId}" not found.`,
        'This thread does not exist. It may have been deleted.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.getComments(
      {
        page: query.page,
        limit: query.limit,
        targetId: parent.targetId,
        targetType: parent.targetType,
        parentId: parent.id,
      },
      currentUserId,
    );
  }

  async getCommentById(commentId: string, currentUserId?: string) {
    const comment = await this.commentsRepository.findOne({
      where: { id: commentId },
      relations: ['author'],
    });

    if (!comment || !comment.author?.isActive) {
      throw new BusinessException(
        ErrorCode.COMMENT_NOT_FOUND,
        `Comment with id "${commentId}" not found`,
        'Comment not found. It may have been deleted.',
        HttpStatus.NOT_FOUND,
      );
    }

    const [enriched] = await this.enrichComments(
      [this.formatComment(comment)],
      currentUserId,
    );
    return enriched;
  }

  async getCommentMentionCandidatesForReply(
    currentUserId: string,
    targetId: string,
    targetType: TargetType,
    parentId?: string,
    query?: string,
  ) {
    this.interactionTargetValidatorService.assertCommentTargetType(targetType);
    await this.interactionTargetValidatorService.ensureTargetExists(
      targetId,
      targetType,
    );

    const normalizedQuery = query?.trim().toLowerCase();

    // Tier A: contextual candidates (content author + thread participants)
    const contextualCandidates = await this.getContextualMentionUsers(
      targetId,
      targetType,
      parentId,
    );

    // Tier B: mutual follow users (only when query is provided)
    const mutualCandidates =
      currentUserId && normalizedQuery
        ? await this.followsService.searchMutualFollowUsers(
            currentUserId,
            normalizedQuery,
          )
        : [];

    // Merge and deduplicate (contextual first for stable ordering)
    const mergedMap = new Map<
      string,
      {
        id: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
      }
    >();

    for (const user of contextualCandidates) {
      if (!user?.id) continue;
      mergedMap.set(user.id, {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      });
    }

    for (const user of mutualCandidates) {
      if (!user?.id || mergedMap.has(user.id)) continue;
      mergedMap.set(user.id, {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      });
    }

    // Exclude the current user
    if (currentUserId) {
      mergedMap.delete(currentUserId);
    }

    let results = Array.from(mergedMap.values());

    // Prefix-filter all candidates when a query is provided
    if (normalizedQuery) {
      results = results.filter((user) => {
        const usernameMatch = user.username
          .toLowerCase()
          .startsWith(normalizedQuery);
        const displayNameMatch = (user.displayName ?? '')
          .toLowerCase()
          .startsWith(normalizedQuery);
        return usernameMatch || displayNameMatch;
      });
    }

    return results;
  }

  private assertCommentsReadableByViewer(
    currentUserId: string | undefined,
    targetType: TargetType,
  ) {
    if (currentUserId) {
      return;
    }
    if (targetType === TargetType.ARTICLE) {
      return;
    }
    throw new BusinessException(
      ErrorCode.AUTHENTICATION_ERROR,
      `Unauthenticated comment list for target type "${targetType}"`,
      'User not authenticated.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  private formatComment(comment: Comment) {
    return {
      id: comment.id,
      content: comment.content,
      targetId: comment.targetId,
      targetType: comment.targetType,
      parentId: comment.parentId,
      author: comment.author
        ? {
            id: comment.author.id,
            username: comment.author.username,
            displayName: comment.author.displayName,
            avatarUrl: comment.author.avatarUrl,
          }
        : null,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  private async enrichComments<
    T extends { id: string; createdAt: Date; content: string },
  >(items: T[], currentUserId?: string) {
    if (items.length === 0) return [];

    const ids = items.map((item) => item.id);

    const likesCountRaw: { targetId: string; count: string }[] =
      await this.likesRepository
        .createQueryBuilder('like')
        .select('like.targetId', 'targetId')
        .addSelect('COUNT(*)', 'count')
        .where('like.targetId IN (:...ids)', { ids })
        .andWhere('like.targetType = :type', { type: TargetType.COMMENT })
        .groupBy('like.targetId')
        .getRawMany();

    const repliesCountRaw: { parentId: string; count: string }[] =
      await this.commentsRepository
        .createQueryBuilder('comment')
        .select('comment.parentId', 'parentId')
        .addSelect('COUNT(*)', 'count')
        .where('comment.parentId IN (:...ids)', { ids })
        .groupBy('comment.parentId')
        .getRawMany();

    const likesCountMap = new Map(
      likesCountRaw.map((row) => [row.targetId, Number(row.count)]),
    );
    const repliesCountMap = new Map(
      repliesCountRaw.map((row) => [row.parentId, Number(row.count)]),
    );

    let likedSet = new Set<string>();
    if (currentUserId) {
      const liked = await this.likesRepository.find({
        where: {
          userId: currentUserId,
          targetType: TargetType.COMMENT,
          targetId: In(ids),
        },
      });
      likedSet = new Set(liked.map((like) => like.targetId));
    }

    const mentionUsernames = Array.from(
      new Set(
        items.flatMap((item) => extractMentionedUsernames(item.content)),
      ),
    );
    const mentionUsers = mentionUsernames.length
      ? await this.usersRepository
          .createQueryBuilder('user')
          .select(['user.id', 'user.username', 'user.displayName', 'user.avatarUrl'])
          .where('LOWER(user.username) IN (:...usernames)', {
            usernames: mentionUsernames.map((username) => username.toLowerCase()),
          })
          .getMany()
      : [];
    const mentionUserMap = new Map(
      mentionUsers.map((user) => [user.username.toLowerCase(), user]),
    );

    return items.map((item) => ({
      ...item,
      likesCount: likesCountMap.get(item.id) ?? 0,
      isLiked: likedSet.has(item.id),
      repliesCount: repliesCountMap.get(item.id) ?? 0,
      mentionedUsers: extractMentionedUsernames(item.content)
        .map((username) => mentionUserMap.get(username.toLowerCase()))
        .filter((user): user is User => !!user)
        .map((user) => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        })),
    }));
  }

  private async validateMentionsForContext(
    currentUserId: string,
    parentId: string | undefined,
    targetId: string,
    targetType: TargetType,
    content: string,
  ) {
    const usernames = extractMentionedUsernames(content);
    if (usernames.length === 0) {
      return;
    }

    const allowedUserIds = new Set<string>();

    const authorId = await this.getTargetAuthorId(targetId, targetType);
    if (authorId) {
      allowedUserIds.add(authorId);
    }

    if (parentId) {
      const threadUsers = await this.getThreadMentionUsers(
        targetId,
        targetType,
        parentId,
      );
      for (const user of threadUsers) {
        allowedUserIds.add(user.id);
      }
    }

    const mutualUsers =
      await this.followsService.getMutualFollowUsers(currentUserId);
    for (const user of mutualUsers) {
      allowedUserIds.add(user.id);
    }

    const users = usernames.length
      ? await this.usersRepository
          .createQueryBuilder('user')
          .select(['user.id', 'user.username'])
          .where('LOWER(user.username) IN (:...usernames)', {
            usernames: usernames.map((username) => username.toLowerCase()),
          })
          .getMany()
      : [];
    const usernameToUser = new Map(
      users.map((user) => [user.username.toLowerCase(), user]),
    );

    // Unknown @tokens are treated as plain text and are allowed.
    const blockedUsernames = usernames.filter((username) => {
      const user = usernameToUser.get(username.toLowerCase());
      if (!user) return false;
      if (user.id === currentUserId) return true;
      return !allowedUserIds.has(user.id);
    });

    if (blockedUsernames.length > 0) {
      throw new BusinessException(
        ErrorCode.COMMENT_MENTION_NOT_ALLOWED,
        `Users mentioned outside reply context: ${blockedUsernames.join(', ')}`,
        'You can only tag mutual followers, thread participants, and not yourself',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async validateParentComment(
    parentId: string,
    targetId: string,
    targetType: TargetType,
  ) {
    const parent = await this.commentsRepository.findOne({
      where: { id: parentId },
    });

    if (!parent) {
      throw new BusinessException(
        ErrorCode.COMMENT_PARENT_INVALID,
        `Parent comment "${parentId}" not found`,
        'This thread does not exist. It may have been deleted.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (parent.targetId !== targetId || parent.targetType !== targetType) {
      throw new BusinessException(
        ErrorCode.COMMENT_PARENT_INVALID,
        `Parent comment "${parentId}" target mismatch`,
        'This thread is not related to the target post.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (parent.parentId) {
      throw new BusinessException(
        ErrorCode.COMMENT_PARENT_INVALID,
        `Parent comment "${parentId}" is already a reply`,
        'You can only reply to top-level comments',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async getContextualMentionUsers(
    targetId: string,
    targetType: TargetType,
    parentId?: string,
  ) {
    const userIds = new Set<string>();

    const authorId = await this.getTargetAuthorId(targetId, targetType);
    if (authorId) {
      userIds.add(authorId);
    }

    // If reply, include parent comment author + sibling reply authors
    if (parentId) {
      const parent = await this.commentsRepository.findOne({
        where: { id: parentId, targetId, targetType },
      });

      if (parent) {
        userIds.add(parent.authorId);

        const replyAuthorRows: { authorId: string }[] =
          await this.commentsRepository
            .createQueryBuilder('comment')
            .select('DISTINCT comment.authorId', 'authorId')
            .where('comment.parentId = :parentId', { parentId })
            .getRawMany();

        for (const row of replyAuthorRows) {
          userIds.add(row.authorId);
        }
      }
    }

    const ids = Array.from(userIds);
    if (ids.length === 0) return [];

    return this.usersRepository.find({
      where: { id: In(ids) },
      select: ['id', 'username', 'displayName', 'avatarUrl'],
      order: { username: 'ASC' },
    });
  }

  private async getTargetAuthorId(
    targetId: string,
    targetType: TargetType,
  ): Promise<string | null> {
    if (targetType === TargetType.POST) {
      const post = await this.postsRepository.findOne({
        where: { id: targetId },
        select: ['id', 'authorId'],
      });
      return post?.authorId ?? null;
    }

    if (targetType === TargetType.ARTICLE) {
      const article = await this.articlesRepository.findOne({
        where: { id: targetId },
        select: ['id', 'authorId'],
      });
      return article?.authorId ?? null;
    }

    return null;
  }

  private async getThreadMentionUsers(
    targetId: string,
    targetType: TargetType,
    parentId: string,
  ) {
    const parent = await this.commentsRepository.findOne({
      where: { id: parentId },
    });

    if (!parent) {
      throw new BusinessException(
        ErrorCode.COMMENT_PARENT_INVALID,
        `Parent comment "${parentId}" not found`,
        'This thread does not exist. It may have been deleted.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (parent.targetId !== targetId || parent.targetType !== targetType) {
      throw new BusinessException(
        ErrorCode.COMMENT_PARENT_INVALID,
        `Parent comment "${parentId}" target mismatch`,
        'This thread is not related to this content.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const replyAuthorRows: { authorId: string }[] =
      await this.commentsRepository
        .createQueryBuilder('comment')
        .select('DISTINCT comment.authorId', 'authorId')
        .where('comment.parentId = :parentId', { parentId })
        .getRawMany();

    const allowedIds = Array.from(
      new Set([parent.authorId, ...replyAuthorRows.map((row) => row.authorId)]),
    );

    if (allowedIds.length === 0) {
      return [];
    }

    return this.usersRepository.find({
      where: { id: In(allowedIds) },
      select: ['id', 'username', 'displayName', 'avatarUrl'],
      order: { username: 'ASC' },
    });
  }

  private async resolveMentionedUserIds(
    content: string,
    actorId: string,
  ): Promise<Set<string>> {
    const usernames = extractMentionedUsernames(content);
    if (usernames.length === 0) {
      return new Set();
    }

    const users = await this.usersRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.username'])
      .where('LOWER(user.username) IN (:...usernames)', {
        usernames: usernames.map((username) => username.toLowerCase()),
      })
      .getMany();

    return new Set(
      users.filter((user) => user.id !== actorId).map((user) => user.id),
    );
  }

  private async emitMentionNotifications(params: {
    actorId: string;
    content: string;
    targetId: string;
    targetType: TargetType;
    commentId: string;
  }) {
    const usernames = extractMentionedUsernames(params.content);
    if (usernames.length === 0) {
      return;
    }

    const article =
      params.targetType === TargetType.ARTICLE
        ? await this.articlesRepository.findOne({
            where: { id: params.targetId },
            select: ['id', 'slug'],
          })
        : null;

    await this.eventEmitter.emitAsync(
      NotificationDomainEventName.USER_MENTIONED,
      {
        actorId: params.actorId,
        usernames,
        targetType:
          params.targetType === TargetType.ARTICLE
            ? NotificationTargetType.ARTICLE
            : NotificationTargetType.POST,
        postId:
          params.targetType === TargetType.POST ? params.targetId : undefined,
        articleSlug: article?.slug,
        commentId: params.commentId,
        excerpt: params.content,
      },
    );
  }
}
