import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileFieldUpdates, toProfileUpdates } from './profile-updates';
import { UsersService } from './users.service';
import { FollowsService } from './follows.service';
import { BlocksService } from './blocks.service';
import { AuthService } from '../auth/auth.service';
import { Post } from '../posts/entities/post.entity';
import { Article } from '../articles/entities/article.entity';
import { MediaService } from '../media/media.service';
import { parseMediaObjectIdFromUrl } from '../media/media-object-url';
import { BusinessException, ErrorCode } from '../common/errors';

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly followsService: FollowsService,
    private readonly blocksService: BlocksService,
    private readonly authService: AuthService,
    private readonly mediaService: MediaService,
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
      isBlocked: false,
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

    const [{ followersCount, followingCount }, isFollowing, isBlocked, contentCounts] =
      await Promise.all([
        this.followsService.getCounts(targetUserId),
        currentUserId
          ? this.followsService.isFollowing(currentUserId, targetUserId)
          : Promise.resolve(false),
        currentUserId
          ? this.blocksService.isBlocked(currentUserId, targetUserId)
          : Promise.resolve(false),
        this.getContentCounts(targetUserId, { includeUnpublished: false }),
      ]);

    return {
      ...this.formatProfile(user, { includeEmail: false }),
      followersCount,
      followingCount,
      ...contentCounts,
      isFollowing,
      isBlocked,
    };
  }

  async updateMyProfile(currentUserId: string, dto: UpdateProfileDto) {
    const updates = toProfileUpdates(dto);
    if (Object.keys(updates).length > 0) {
      const user = await this.usersService.findUserOrFail(currentUserId);
      await this.releaseReplacedMedia(user, updates, currentUserId);
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

  private async releaseReplacedMedia(
    user: User,
    updates: ProfileFieldUpdates,
    userId: string,
  ) {
    if ('avatarUrl' in updates) {
      await this.deleteOwnedMediaAt(user.avatarUrl, updates.avatarUrl, userId);
    }
    if ('coverImageUrl' in updates) {
      await this.deleteOwnedMediaAt(
        user.coverImageUrl,
        updates.coverImageUrl,
        userId,
      );
    }
  }

  private async deleteOwnedMediaAt(
    previousUrl: string | null | undefined,
    nextUrl: string | null | undefined,
    userId: string,
  ) {
    const previousId = parseMediaObjectIdFromUrl(previousUrl);
    const nextId = parseMediaObjectIdFromUrl(nextUrl);
    if (!previousId || previousId === nextId) {
      return;
    }

    try {
      await this.mediaService.delete(previousId, userId);
    } catch (error) {
      const errorCode =
        error instanceof BusinessException ? error.errorCode : undefined;
      if (
        errorCode === ErrorCode.MEDIA_NOT_FOUND ||
        errorCode === ErrorCode.AUTHORIZATION_ERROR
      ) {
        return;
      }
      this.logger.warn({
        msg: 'Failed to delete replaced profile media',
        previousId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private formatProfile(user: User, options: { includeEmail: boolean }) {
    return {
      id: user.id,
      ...(options.includeEmail && { email: user.email }),
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      coverImageUrl: user.coverImageUrl,
      website: user.website,
      github: user.github,
      location: user.location,
      createdAt: user.createdAt,
    };
  }
}
