import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Like, TargetType } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { Share } from './entities/share.entity';
import { Post } from '../posts/entities/post.entity';
import { Article } from '../articles/entities/article.entity';
import { User } from '../users/entities/user.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { InteractionQueryDto } from './dto/interaction-query.dto';
import { PaginationQueryDto } from '../common/dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';

const MAX_COMMENT_DEPTH = 2;
const USERNAME_MENTION_REGEX = /@([a-zA-Z0-9_-]{3,30})/g;

@Injectable()
export class InteractionsService {
  constructor(
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    @InjectRepository(Share)
    private readonly sharesRepository: Repository<Share>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  // --- Likes ---

  async like(userId: string, targetId: string, targetType: TargetType) {
    await this.ensureTargetExists(targetId, targetType);

    const existing = await this.likesRepository.findOne({
      where: { userId, targetId, targetType },
    });

    if (existing) {
      throw new BusinessException(
        ErrorCode.ALREADY_LIKED,
        `User "${userId}" already liked ${targetType} "${targetId}"`,
        'You have already liked this',
        HttpStatus.CONFLICT,
      );
    }

    const like = this.likesRepository.create({
      userId,
      targetId,
      targetType,
    });

    await this.likesRepository.save(like);

    return { message: 'Liked successfully' };
  }

  async unlike(userId: string, targetId: string, targetType: TargetType) {
    const existing = await this.likesRepository.findOne({
      where: { userId, targetId, targetType },
    });

    if (!existing) {
      throw new BusinessException(
        ErrorCode.NOT_LIKED,
        `User "${userId}" has not liked ${targetType} "${targetId}"`,
        'You have not liked this',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.likesRepository.remove(existing);

    return { message: 'Unliked successfully' };
  }

  async getLikesCount(targetId: string, targetType: TargetType) {
    const count = await this.likesRepository.count({
      where: { targetId, targetType },
    });

    return { count };
  }

  async isLiked(userId: string, targetId: string, targetType: TargetType) {
    const like = await this.likesRepository.findOne({
      where: { userId, targetId, targetType },
    });

    return { isLiked: !!like };
  }

  // --- Comments ---

  async addComment(authorId: string, dto: CreateCommentDto) {
    this.assertCommentTargetType(dto.targetType);
    await this.ensureTargetExists(dto.targetId, dto.targetType);

    let depth = 0;
    if (dto.parentId) {
      const parent = await this.commentsRepository.findOne({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new BusinessException(
          ErrorCode.COMMENT_PARENT_INVALID,
          `Parent comment "${dto.parentId}" not found`,
          'Invalid parent comment',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (
        parent.targetId !== dto.targetId ||
        parent.targetType !== dto.targetType
      ) {
        throw new BusinessException(
          ErrorCode.COMMENT_PARENT_INVALID,
          `Parent comment "${dto.parentId}" target mismatch`,
          'Invalid parent comment',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (parent.depth >= MAX_COMMENT_DEPTH) {
        throw new BusinessException(
          ErrorCode.COMMENT_DEPTH_EXCEEDED,
          `Comment reply depth exceeded for parent "${dto.parentId}"`,
          'Maximum reply depth reached',
          HttpStatus.BAD_REQUEST,
        );
      }

      depth = parent.depth + 1;
    }

    await this.validateMentionsForPost(dto.targetId, dto.targetType, dto.content);

    const comment = this.commentsRepository.create({
      authorId,
      targetId: dto.targetId,
      targetType: dto.targetType,
      content: dto.content,
      parentId: dto.parentId ?? null,
      depth,
    });

    await this.commentsRepository.save(comment);

    return this.getCommentById(comment.id, authorId);
  }

  async updateComment(
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.commentsRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new BusinessException(
        ErrorCode.COMMENT_NOT_FOUND,
        `Comment with id "${commentId}" not found`,
        'Comment not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (comment.authorId !== userId) {
      throw new BusinessException(
        ErrorCode.COMMENT_UPDATE_FORBIDDEN,
        `User "${userId}" cannot update comment "${commentId}"`,
        'You can only edit your own comments',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.validateMentionsForPost(
      comment.targetId,
      comment.targetType,
      dto.content,
    );

    comment.content = dto.content;
    await this.commentsRepository.save(comment);

    return this.getCommentById(comment.id, userId);
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.commentsRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new BusinessException(
        ErrorCode.COMMENT_NOT_FOUND,
        `Comment with id "${commentId}" not found`,
        'Comment not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (comment.authorId !== userId) {
      throw new BusinessException(
        ErrorCode.COMMENT_DELETE_FORBIDDEN,
        `User "${userId}" cannot delete comment "${commentId}"`,
        'You can only delete your own comments',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.commentsRepository.remove(comment);

    return { message: 'Comment deleted' };
  }

  async getComments(query: InteractionQueryDto, currentUserId?: string) {
    this.assertCommentTargetType(query.targetType);

    const { page, limit, targetId, targetType, parentId } = query;
    const skip = (page - 1) * limit;

    const where = parentId
      ? { targetId, targetType, parentId }
      : { targetId, targetType, parentId: IsNull() };

    const order = parentId ? ({ createdAt: 'ASC' } as const) : ({ createdAt: 'DESC' } as const);

    const [comments, total] = await this.commentsRepository.findAndCount({
      where,
      relations: ['author'],
      skip,
      take: limit,
      order,
    });

    const items = await this.enrichComments(
      comments.map((c) => this.formatComment(c)),
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
    });

    if (!parent) {
      throw new BusinessException(
        ErrorCode.COMMENT_NOT_FOUND,
        `Comment with id "${commentId}" not found`,
        'Comment not found',
        HttpStatus.NOT_FOUND,
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

    if (!comment) {
      throw new BusinessException(
        ErrorCode.COMMENT_NOT_FOUND,
        `Comment with id "${commentId}" not found`,
        'Comment not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const [enriched] = await this.enrichComments(
      [this.formatComment(comment)],
      currentUserId,
    );

    return enriched;
  }

  // --- Shares ---

  async share(userId: string, targetId: string, targetType: TargetType) {
    const existing = await this.sharesRepository.findOne({
      where: { userId, targetId, targetType },
    });

    if (existing) {
      return { message: 'Already shared' };
    }

    const share = this.sharesRepository.create({
      userId,
      targetId,
      targetType,
    });

    await this.sharesRepository.save(share);

    return { message: 'Shared successfully' };
  }

  async getSharesCount(targetId: string, targetType: TargetType) {
    const count = await this.sharesRepository.count({
      where: { targetId, targetType },
    });

    return { count };
  }

  // --- Helpers ---

  private formatComment(comment: Comment) {
    return {
      id: comment.id,
      content: comment.content,
      targetId: comment.targetId,
      targetType: comment.targetType,
      parentId: comment.parentId,
      depth: comment.depth,
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
    T extends { id: string; createdAt: Date; depth: number },
  >(items: T[], currentUserId?: string) {
    if (items.length === 0) return [];

    const ids = items.map((i) => i.id);

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

    return items.map((item) => ({
      ...item,
      likesCount: likesCountMap.get(item.id) ?? 0,
      isLiked: likedSet.has(item.id),
      repliesCount: repliesCountMap.get(item.id) ?? 0,
    }));
  }

  private assertCommentTargetType(targetType: TargetType) {
    if (targetType === TargetType.COMMENT) {
      throw new BusinessException(
        ErrorCode.COMMENT_TARGET_INVALID,
        'Comment target type cannot be COMMENT',
        'Comments can only target posts or articles',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async ensureTargetExists(targetId: string, targetType: TargetType) {
    if (targetType === TargetType.POST) {
      const post = await this.postsRepository.findOne({ where: { id: targetId } });
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

    if (targetType === TargetType.ARTICLE) {
      const article = await this.articlesRepository.findOne({
        where: { id: targetId },
      });
      if (!article) {
        throw new BusinessException(
          ErrorCode.ARTICLE_NOT_FOUND,
          `Article "${targetId}" not found`,
          'Article not found',
          HttpStatus.NOT_FOUND,
        );
      }
      return;
    }

    const comment = await this.commentsRepository.findOne({
      where: { id: targetId },
    });
    if (!comment) {
      throw new BusinessException(
        ErrorCode.COMMENT_NOT_FOUND,
        `Comment "${targetId}" not found`,
        'Comment not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async validateMentionsForPost(
    targetId: string,
    targetType: TargetType,
    content: string,
  ) {
    if (targetType !== TargetType.POST) {
      return;
    }

    const usernames = this.extractMentionedUsernames(content);
    if (usernames.length === 0) {
      return;
    }

    const users = await this.usersRepository.find({
      where: { username: In(usernames) },
      select: ['id', 'username'],
    });
    const usernameToUser = new Map(users.map((user) => [user.username, user]));

    const missingUsernames = usernames.filter(
      (username) => !usernameToUser.has(username),
    );
    if (missingUsernames.length > 0) {
      throw new BusinessException(
        ErrorCode.COMMENT_MENTION_NOT_ALLOWED,
        `Mentioned users not found: ${missingUsernames.join(', ')}`,
        'You can only tag users who commented on this post',
        HttpStatus.BAD_REQUEST,
      );
    }

    const commenterRows: { authorId: string }[] = await this.commentsRepository
      .createQueryBuilder('comment')
      .select('DISTINCT comment.authorId', 'authorId')
      .where('comment.targetId = :targetId', { targetId })
      .andWhere('comment.targetType = :targetType', {
        targetType: TargetType.POST,
      })
      .getRawMany();

    const commenterIds = new Set(commenterRows.map((row) => row.authorId));
    const blockedUsernames = usernames.filter((username) => {
      const user = usernameToUser.get(username);
      return !user || !commenterIds.has(user.id);
    });

    if (blockedUsernames.length > 0) {
      throw new BusinessException(
        ErrorCode.COMMENT_MENTION_NOT_ALLOWED,
        `Users mentioned without prior post comment: ${blockedUsernames.join(', ')}`,
        'You can only tag users who commented on this post',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private extractMentionedUsernames(content: string): string[] {
    const usernames = new Set<string>();
    let match = USERNAME_MENTION_REGEX.exec(content);

    while (match) {
      usernames.add(match[1]);
      match = USERNAME_MENTION_REGEX.exec(content);
    }

    USERNAME_MENTION_REGEX.lastIndex = 0;
    return Array.from(usernames);
  }
}
