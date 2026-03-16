import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../../posts/entities/post.entity';
import { Article } from '../../articles/entities/article.entity';
import { Comment } from '../entities/comment.entity';
import { TargetType } from '../entities/like.entity';
import { BusinessException } from '../../common/errors/business.exception';
import { ErrorCode } from '../../common/errors/error-codes.enum';

@Injectable()
export class InteractionTargetValidatorService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
  ) {}

  assertCommentTargetType(targetType: TargetType) {
    if (targetType === TargetType.COMMENT) {
      throw new BusinessException(
        ErrorCode.COMMENT_TARGET_INVALID,
        'Comment target type cannot be COMMENT',
        'Comments can only target posts or articles',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async ensureTargetExists(targetId: string, targetType: TargetType) {
    if (targetType === TargetType.POST) {
      const post = await this.postsRepository.findOne({
        where: { id: targetId },
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
}
