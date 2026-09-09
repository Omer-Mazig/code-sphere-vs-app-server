import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBlock } from './entities/user-block.entity';
import { UsersService } from './users.service';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';

@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(UserBlock)
    private readonly blocksRepository: Repository<UserBlock>,
    private readonly usersService: UsersService,
  ) {}

  async blockUser(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new BusinessException(
        ErrorCode.CANNOT_BLOCK_SELF,
        `User "${currentUserId}" tried to block themselves`,
        'You cannot block yourself',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.usersService.findUserOrFail(targetUserId);

    const existing = await this.blocksRepository.findOne({
      where: { blockerId: currentUserId, blockedId: targetUserId },
    });

    if (existing) {
      throw new BusinessException(
        ErrorCode.USER_ALREADY_BLOCKED,
        `User "${currentUserId}" already blocked "${targetUserId}"`,
        'You have already blocked this user',
        HttpStatus.CONFLICT,
      );
    }

    const block = this.blocksRepository.create({
      blockerId: currentUserId,
      blockedId: targetUserId,
    });
    await this.blocksRepository.save(block);

    return { message: 'User blocked' };
  }

  async unblockUser(currentUserId: string, targetUserId: string) {
    const block = await this.blocksRepository.findOne({
      where: { blockerId: currentUserId, blockedId: targetUserId },
    });

    if (!block) {
      throw new BusinessException(
        ErrorCode.USER_NOT_BLOCKED,
        `User "${currentUserId}" has not blocked "${targetUserId}"`,
        'You have not blocked this user',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.blocksRepository.remove(block);
    return { message: 'User unblocked' };
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    if (blockerId === blockedId) {
      return false;
    }
    const block = await this.blocksRepository.findOne({
      where: { blockerId, blockedId },
    });
    return Boolean(block);
  }

  /** True when the recipient has blocked the sender (they cannot DM). */
  async isMessagingBlocked(
    senderId: string,
    recipientId: string,
  ): Promise<boolean> {
    return this.isBlocked(recipientId, senderId);
  }
}
