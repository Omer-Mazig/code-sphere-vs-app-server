import { Injectable } from '@nestjs/common';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';
import { FollowsService } from './follows.service';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly usersService: UsersService,
    private readonly followsService: FollowsService,
  ) {}

  async getMyProfile(currentUserId: string) {
    const user = await this.usersService.findUserOrFail(currentUserId);

    const { followersCount, followingCount } =
      await this.followsService.getCounts(currentUserId);

    return {
      ...this.formatProfile(user, { includeEmail: true }),
      followersCount,
      followingCount,
      isFollowing: false,
    };
  }

  async getProfile(targetUserId: string, currentUserId?: string) {
    const user = await this.usersService.findUserOrFail(targetUserId);

    const [{ followersCount, followingCount }, isFollowing] = await Promise.all(
      [
        this.followsService.getCounts(targetUserId),
        currentUserId
          ? this.followsService.isFollowing(currentUserId, targetUserId)
          : Promise.resolve(false),
      ],
    );

    return {
      ...this.formatProfile(user, { includeEmail: false }),
      followersCount,
      followingCount,
      isFollowing,
    };
  }

  async updateMyProfile(currentUserId: string, dto: UpdateProfileDto) {
    await this.usersService.updateUser(currentUserId, dto);
    return this.getMyProfile(currentUserId);
  }

  // ── Helpers ────────────────────────────────────────────────────────

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
