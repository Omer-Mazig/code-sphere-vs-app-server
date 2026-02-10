import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { FollowsService } from './follows.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { Public, CurrentUser } from '../common/decorators';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly followsService: FollowsService,
  ) {}

  // ── Profile ────────────────────────────────────────────────────────

  @Get('me')
  getMyProfile(@CurrentUser() currentUserId: string) {
    return this.profilesService.getMyProfile(currentUserId);
  }

  @Get(':id')
  @Public()
  getProfile(
    @Param('id') targetUserId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.profilesService.getProfile(targetUserId, currentUserId);
  }

  @Patch('me')
  updateMyProfile(
    @CurrentUser() currentUserId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.updateMyProfile(currentUserId, dto);
  }

  // ── Follow ─────────────────────────────────────────────────────────

  @Post(':id/follow')
  followUser(
    @CurrentUser() currentUserId: string,
    @Param('id') targetUserId: string,
  ) {
    return this.followsService.followUser(currentUserId, targetUserId);
  }

  @Delete(':id/follow')
  unfollowUser(
    @CurrentUser() currentUserId: string,
    @Param('id') targetUserId: string,
  ) {
    return this.followsService.unfollowUser(currentUserId, targetUserId);
  }

  // ── Followers / Following ──────────────────────────────────────────

  @Get(':id/followers')
  @Public()
  getFollowers(
    @Param('id') targetUserId: string,
    @Query() query: UserQueryDto,
  ) {
    return this.followsService.getFollowers(targetUserId, query);
  }

  @Get(':id/following')
  @Public()
  getFollowing(
    @Param('id') targetUserId: string,
    @Query() query: UserQueryDto,
  ) {
    return this.followsService.getFollowing(targetUserId, query);
  }
}
