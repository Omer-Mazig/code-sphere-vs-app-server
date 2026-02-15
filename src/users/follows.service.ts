import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { User } from './entities/user.entity';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './users.service';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';

export type MutualFollowUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followsRepository: Repository<Follow>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
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

  async getMutualFollowUsers(
    currentUserId: string,
  ): Promise<MutualFollowUser[]> {
    const rows: { userId: string }[] = await this.followsRepository
      .createQueryBuilder('f1')
      .innerJoin(
        Follow,
        'f2',
        'f1.followingId = f2.followerId AND f2.followingId = :currentUserId',
        { currentUserId },
      )
      .select('f1.followingId', 'userId')
      .where('f1.followerId = :currentUserId', { currentUserId })
      .andWhere('f1.followingId <> :currentUserId', { currentUserId })
      .getRawMany();

    const mutualIds = Array.from(new Set(rows.map((row) => row.userId)));
    if (mutualIds.length === 0) return [];

    const users = await this.usersRepository.find({
      where: { id: In(mutualIds) },
      select: ['id', 'username', 'displayName', 'avatarUrl'],
      order: { username: 'ASC' },
    });

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    }));
  }

  async searchMutualFollowUsers(
    currentUserId: string,
    query: string,
  ): Promise<MutualFollowUser[]> {
    const mutualUsers = await this.getMutualFollowUsers(currentUserId);
    const search = query.toLowerCase();

    return mutualUsers.filter((user) => {
      const usernameMatch = user.username.toLowerCase().startsWith(search);
      const displayNameMatch = (user.displayName ?? '')
        .toLowerCase()
        .startsWith(search);
      return usernameMatch || displayNameMatch;
    });
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
    const whereColumn = relation === 'follower' ? 'followingId' : 'followerId';

    const [follows, total] = await this.followsRepository
      .createQueryBuilder('follow')
      .leftJoinAndSelect(`follow.${relation}`, relation)
      .where(`follow.${whereColumn} = :targetUserId`, { targetUserId })
      .orderBy(`${relation}.displayName`, 'ASC', 'NULLS LAST')
      .addOrderBy(`${relation}.username`, 'ASC')
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
