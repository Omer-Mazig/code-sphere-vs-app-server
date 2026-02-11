import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { User } from './entities/user.entity';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './users.service';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followsRepository: Repository<Follow>,
    private readonly usersService: UsersService,
  ) {}

  // ── Commands ───────────────────────────────────────────────────────

  async followUser(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new BusinessException(
        ErrorCode.CANNOT_FOLLOW_SELF,
        `User "${currentUserId}" tried to follow themselves`,
        'You cannot follow yourself',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.usersService.findUserOrFail(targetUserId);

    const existingFollow = await this.followsRepository.findOne({
      where: { followerId: currentUserId, followingId: targetUserId },
    });

    if (existingFollow) {
      throw new BusinessException(
        ErrorCode.USER_ALREADY_FOLLOWED,
        `User "${currentUserId}" already follows "${targetUserId}"`,
        'You are already following this user',
        HttpStatus.CONFLICT,
      );
    }

    const follow = this.followsRepository.create({
      followerId: currentUserId,
      followingId: targetUserId,
    });

    await this.followsRepository.save(follow);

    return { message: 'Followed successfully' };
  }

  async unfollowUser(currentUserId: string, targetUserId: string) {
    const follow = await this.followsRepository.findOne({
      where: { followerId: currentUserId, followingId: targetUserId },
    });

    if (!follow) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOLLOWED,
        `User "${currentUserId}" does not follow "${targetUserId}"`,
        'You are not following this user',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.followsRepository.remove(follow);

    return { message: 'Unfollowed successfully' };
  }

  // ── Queries ────────────────────────────────────────────────────────

  async getFollowers(targetUserId: string, query: UserQueryDto) {
    return this.getPaginatedFollowUsers('follower', targetUserId, query);
  }

  async getFollowing(targetUserId: string, query: UserQueryDto) {
    return this.getPaginatedFollowUsers('following', targetUserId, query);
  }

  async getCounts(
    targetUserId: string,
  ): Promise<{ followersCount: number; followingCount: number }> {
    // To get followers we filter by followingId (target is being followed).
    // To get following we filter by followerId (target is doing the following).
    const [followersCount, followingCount] = await Promise.all([
      this.followsRepository.count({ where: { followingId: targetUserId } }),
      this.followsRepository.count({ where: { followerId: targetUserId } }),
    ]);

    return { followersCount, followingCount };
  }

  async isFollowing(
    currentUserId: string,
    targetUserId: string,
  ): Promise<boolean> {
    if (currentUserId === targetUserId) return false;

    const follow = await this.followsRepository.findOne({
      where: { followerId: currentUserId, followingId: targetUserId },
    });

    return !!follow;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private async getPaginatedFollowUsers(
    relation: 'follower' | 'following',
    targetUserId: string,
    query: UserQueryDto,
  ) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    // "follower" → people who follow targetUserId → filter by followingId
    // "following" → people targetUserId follows → filter by followerId
    const whereColumn =
      relation === 'follower' ? 'followingId' : 'followerId';

    const [follows, total] = await this.followsRepository
      .createQueryBuilder('follow')
      .leftJoinAndSelect(`follow.${relation}`, relation)
      .where(`follow.${whereColumn} = :targetUserId`, { targetUserId })
      .orderBy(
        `LOWER(COALESCE("${relation}"."displayName", "${relation}"."username"))`,
        'ASC',
      )
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const items = follows.map((f) =>
      this.formatFollowUser(f[relation], f.createdAt),
    );

    return { items, total, page, limit };
  }

  private formatFollowUser(user: User, followedAt: Date) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      followedAt,
    };
  }
}
