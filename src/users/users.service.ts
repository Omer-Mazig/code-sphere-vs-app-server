import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Follow } from './entities/follow.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { createPaginatedResponse } from '../common/dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Follow)
    private readonly followsRepository: Repository<Follow>,
  ) {}

  async getProfile(userId: string, currentUserId?: string) {
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

    const followersCount = await this.followsRepository.count({
      where: { followingId: userId },
    });

    const followingCount = await this.followsRepository.count({
      where: { followerId: userId },
    });

    let isFollowing = false;
    if (currentUserId && currentUserId !== userId) {
      const follow = await this.followsRepository.findOne({
        where: { followerId: currentUserId, followingId: userId },
      });
      isFollowing = !!follow;
    }

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
      followersCount,
      followingCount,
      isFollowing,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
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

    Object.assign(user, dto);
    await this.usersRepository.save(user);

    return this.getProfile(userId);
  }

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BusinessException(
        ErrorCode.CANNOT_FOLLOW_SELF,
        `User "${followerId}" tried to follow themselves`,
        'You cannot follow yourself',
        HttpStatus.BAD_REQUEST,
      );
    }

    const targetUser = await this.usersRepository.findOne({
      where: { id: followingId },
    });

    if (!targetUser) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        `User with id "${followingId}" not found`,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const existingFollow = await this.followsRepository.findOne({
      where: { followerId, followingId },
    });

    if (existingFollow) {
      throw new BusinessException(
        ErrorCode.USER_ALREADY_FOLLOWED,
        `User "${followerId}" already follows "${followingId}"`,
        'You are already following this user',
        HttpStatus.CONFLICT,
      );
    }

    const follow = this.followsRepository.create({
      followerId,
      followingId,
    });

    await this.followsRepository.save(follow);

    return { message: 'Followed successfully' };
  }

  async unfollowUser(followerId: string, followingId: string) {
    const follow = await this.followsRepository.findOne({
      where: { followerId, followingId },
    });

    if (!follow) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOLLOWED,
        `User "${followerId}" does not follow "${followingId}"`,
        'You are not following this user',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.followsRepository.remove(follow);

    return { message: 'Unfollowed successfully' };
  }

  async getFollowers(userId: string, query: UserQueryDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [follows, total] = await this.followsRepository.findAndCount({
      where: { followingId: userId },
      relations: ['follower'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const items = follows.map((f) => ({
      id: f.follower.id,
      username: f.follower.username,
      displayName: f.follower.displayName,
      avatarUrl: f.follower.avatarUrl,
      bio: f.follower.bio,
      followedAt: f.createdAt,
    }));

    return createPaginatedResponse(items, total, page, limit);
  }

  async getFollowing(userId: string, query: UserQueryDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [follows, total] = await this.followsRepository.findAndCount({
      where: { followerId: userId },
      relations: ['following'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const items = follows.map((f) => ({
      id: f.following.id,
      username: f.following.username,
      displayName: f.following.displayName,
      avatarUrl: f.following.avatarUrl,
      bio: f.following.bio,
      followedAt: f.createdAt,
    }));

    return createPaginatedResponse(items, total, page, limit);
  }
}
