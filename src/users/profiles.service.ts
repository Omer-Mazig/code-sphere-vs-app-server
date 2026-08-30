import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { toProfileUpdates } from './profile-updates';
import { UsersService } from './users.service';
import { FollowsService } from './follows.service';
import { AuthService } from '../auth/auth.service';
import { Post } from '../posts/entities/post.entity';
import { Article } from '../articles/entities/article.entity';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly usersService: UsersService,
    private readonly followsService: FollowsService,
    private readonly authService: AuthService,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
  ) {}

  async getMyProfile(currentUserId: string) {
    const user = await this.usersService.findUserOrFail(currentUserId);

    const [{ followersCount, followingCount }, contentCounts] =
      await Promise.all([
        this.followsService.getCounts(currentUserId),
        this.getContentCounts(currentUserId, { includeUnpublished: true }),
      ]);

    return {
      ...this.formatProfile(user, { includeEmail: true }),
      followersCount,
      followingCount,
      ...contentCounts,
      isFollowing: false,
    };
  }

  async getPreview(targetUserId: string) {
    const user = await this.usersService.findUserOrFail(targetUserId);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }

  async getProfile(targetUserId: string, currentUserId?: string) {
    const user = await this.usersService.findUserOrFail(targetUserId);

    const [{ followersCount, followingCount }, isFollowing, contentCounts] =
      await Promise.all([
        this.followsService.getCounts(targetUserId),
        currentUserId
          ? this.followsService.isFollowing(currentUserId, targetUserId)
          : Promise.resolve(false),
        this.getContentCounts(targetUserId, { includeUnpublished: false }),
      ]);

    return {
      ...this.formatProfile(user, { includeEmail: false }),
      followersCount,
      followingCount,
      ...contentCounts,
      isFollowing,
    };
  }

  async updateMyProfile(currentUserId: string, dto: UpdateProfileDto) {
    const updates = toProfileUpdates(dto);
    if (Object.keys(updates).length > 0) {
      await this.usersService.updateUser(currentUserId, updates);
    }
    return this.getMyProfile(currentUserId);
  }

  async deactivateMyAccount(currentUserId: string) {
    await this.usersService.deactivateUser(currentUserId);
    await this.authService.deleteAllTokensForUser(currentUserId);
    return { message: 'Account deactivated' };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private async getContentCounts(
    authorId: string,
    options: { includeUnpublished: boolean },
  ) {
    const [postsCount, articlesCount] = await Promise.all([
      this.postsRepository.count({ where: { authorId } }),
      this.articlesRepository.count({
        where: options.includeUnpublished
          ? { authorId }
          : { authorId, isPublished: true },
      }),
    ]);

    return { postsCount, articlesCount };
  }

  private formatProfile(user: User, options: { includeEmail: boolean }) {
    return {
      id: user.id,
      ...(options.includeEmail && { email: user.email }),
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      website: user.website,
      github: user.github,
      location: user.location,
      createdAt: user.createdAt,
    };
  }
}
