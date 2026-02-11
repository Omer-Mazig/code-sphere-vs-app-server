import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like, TargetType } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { Share } from './entities/share.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { InteractionQueryDto } from './dto/interaction-query.dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';

@Injectable()
export class InteractionsService {
  constructor(
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    @InjectRepository(Share)
    private readonly sharesRepository: Repository<Share>,
  ) {}

  // --- Likes ---

  async like(userId: string, targetId: string, targetType: TargetType) {
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
    const comment = this.commentsRepository.create({
      authorId,
      targetId: dto.targetId,
      targetType: dto.targetType,
      content: dto.content,
      parentId: dto.parentId,
    });

    await this.commentsRepository.save(comment);

    return this.getCommentById(comment.id);
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

    comment.content = dto.content;
    await this.commentsRepository.save(comment);

    return this.getCommentById(comment.id);
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

  async getComments(query: InteractionQueryDto) {
    const { page, limit, targetId, targetType } = query;
    const skip = (page - 1) * limit;

    const [comments, total] = await this.commentsRepository.findAndCount({
      where: { targetId, targetType, parentId: undefined },
      relations: ['author'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const items = comments.map((c) => this.formatComment(c));

    return { items, total, page, limit };
  }

  async getCommentById(commentId: string) {
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

    return this.formatComment(comment);
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
}
