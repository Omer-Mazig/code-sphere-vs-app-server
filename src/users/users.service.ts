import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Follow } from './entities/follow.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { createPaginatedResponse } from '../common/dto';

type FollowersCount = number;
type FollowingCount = number;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Follow)
    private readonly followsRepository: Repository<Follow>,
  ) {}

  async getMyProfile(currentUserId: string) {
    const user = await this.findUserOrFail(currentUserId);

    const [followersCount, followingCount] =
      await this.getFollowersAndFollowingCounts(currentUserId);

    return {
      ...this.formatUser(user),
      followersCount,
      followingCount,
      isFollowing: false,
      createdAt: user.createdAt,
    };
  }

  async getProfile(targetUserId: string, currentUserId?: string) {
    const user = await this.findUserOrFail(targetUserId);

    const [followersCount, followingCount] =
      await this.getFollowersAndFollowingCounts(targetUserId);

    let isFollowing = false;
    if (currentUserId && currentUserId !== targetUserId) {
      const follow = await this.followsRepository.findOne({
        where: { followerId: currentUserId, followingId: targetUserId },
      });
      isFollowing = !!follow;
    }

    return {
      ...this.formatUser(user),
      followersCount,
      followingCount,
      isFollowing,
      createdAt: user.createdAt,
    };
  }

  async updateMyProfile(currentUserId: string, dto: UpdateProfileDto) {
    const user = await this.findUserOrFail(currentUserId);

    Object.assign(user, dto);
    await this.usersRepository.save(user);

    return this.getMyProfile(currentUserId);
  }

  async followUser(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new BusinessException(
        ErrorCode.CANNOT_FOLLOW_SELF,
        `User "${currentUserId}" tried to follow themselves`,
        'You cannot follow yourself',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.findUserOrFail(targetUserId);

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

  async getFollowers(targetUserId: string, query: UserQueryDto) {
    return this.getPaginatedFollowUsers('follower', targetUserId, query);
  }

  async getFollowing(targetUserId: string, query: UserQueryDto) {
    return this.getPaginatedFollowUsers('following', targetUserId, query);
  }

  private async findUserOrFail(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        `User with id "${userId}" not found`,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }

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

    return createPaginatedResponse(items, total, page, limit);
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

  private formatUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      website: user.website,
      github: user.github,
      location: user.location,
    };
  }

  private getFollowersAndFollowingCounts(
    userId: string,
  ): Promise<[FollowersCount, FollowingCount]> {
    // DEAR DEVELOPER, Dont be confused by the order of the counts.
    // To get followers we need to filter by followingId, and to get following we need to filter by followerId.
    // So it might look backward, but it's correct.
    return Promise.all([
      this.followsRepository.count({ where: { followingId: userId } }), // followers
      this.followsRepository.count({ where: { followerId: userId } }), // following
    ]);
  }
}
