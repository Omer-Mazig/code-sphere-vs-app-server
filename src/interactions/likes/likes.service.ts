import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Like, TargetType } from '../entities/like.entity';
import { BusinessException } from '../../common/errors/business.exception';
import { ErrorCode } from '../../common/errors/error-codes.enum';
import { InteractionTargetValidatorService } from '../shared';
import { NotificationDomainEventName } from '../../notifications/events/notification-domain-events';

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    private readonly interactionTargetValidatorService: InteractionTargetValidatorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async like(userId: string, targetId: string, targetType: TargetType) {
    await this.interactionTargetValidatorService.ensureTargetExists(
      targetId,
      targetType,
    );

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

    switch (targetType) {
      case TargetType.POST:
        await this.eventEmitter.emitAsync(
          NotificationDomainEventName.POST_LIKED,
          {
            postId: targetId,
            likerId: userId,
          },
        );
        break;
      case TargetType.ARTICLE:
        await this.eventEmitter.emitAsync(
          NotificationDomainEventName.ARTICLE_LIKED,
          {
            articleId: targetId,
            likerId: userId,
          },
        );
        break;
    }

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
}
