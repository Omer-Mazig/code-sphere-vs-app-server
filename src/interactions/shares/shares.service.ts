import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Share } from '../entities/share.entity';
import { TargetType } from '../entities/like.entity';

@Injectable()
export class SharesService {
  constructor(
    @InjectRepository(Share)
    private readonly sharesRepository: Repository<Share>,
  ) {}

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
}
