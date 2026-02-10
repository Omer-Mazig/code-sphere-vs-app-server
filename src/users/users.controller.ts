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
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { Public, CurrentUser } from '../common/decorators';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── Profile ────────────────────────────────────────────────────────

  @Get('me')
  getMyProfile(@CurrentUser() currentUserId: string) {
    return this.usersService.getMyProfile(currentUserId);
  }

  @Get(':id')
  @Public()
  getProfile(
    @Param('id') targetUserId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.usersService.getProfile(targetUserId, currentUserId);
  }

  @Patch('me')
  updateMyProfile(
    @CurrentUser() currentUserId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMyProfile(currentUserId, dto);
  }

  // ── Follow ─────────────────────────────────────────────────────────

  @Post(':id/follow')
  followUser(
    @CurrentUser() currentUserId: string,
    @Param('id') targetUserId: string,
  ) {
    return this.usersService.followUser(currentUserId, targetUserId);
  }

  @Delete(':id/follow')
  unfollowUser(
    @CurrentUser() currentUserId: string,
    @Param('id') targetUserId: string,
  ) {
    return this.usersService.unfollowUser(currentUserId, targetUserId);
  }

  // ── Followers / Following ──────────────────────────────────────────

  @Get(':id/followers')
  @Public()
  getFollowers(
    @Param('id') targetUserId: string,
    @Query() query: UserQueryDto,
  ) {
    return this.usersService.getFollowers(targetUserId, query);
  }

  @Get(':id/following')
  @Public()
  getFollowing(
    @Param('id') targetUserId: string,
    @Query() query: UserQueryDto,
  ) {
    return this.usersService.getFollowing(targetUserId, query);
  }
}
