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
import { Permissions, CurrentUser } from '../common/decorators';
import { RoleType } from '../common/types';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @Permissions(RoleType.PUBLIC)
  getProfile(
    @Param('id') id: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.usersService.getProfile(id, currentUserId);
  }

  @Patch('me')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  updateProfile(
    @CurrentUser() userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post(':id/follow')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  followUser(
    @CurrentUser() followerId: string,
    @Param('id') followingId: string,
  ) {
    return this.usersService.followUser(followerId, followingId);
  }

  @Delete(':id/follow')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  unfollowUser(
    @CurrentUser() followerId: string,
    @Param('id') followingId: string,
  ) {
    return this.usersService.unfollowUser(followerId, followingId);
  }

  @Get(':id/followers')
  @Permissions(RoleType.PUBLIC)
  getFollowers(
    @Param('id') userId: string,
    @Query() query: UserQueryDto,
  ) {
    return this.usersService.getFollowers(userId, query);
  }

  @Get(':id/following')
  @Permissions(RoleType.PUBLIC)
  getFollowing(
    @Param('id') userId: string,
    @Query() query: UserQueryDto,
  ) {
    return this.usersService.getFollowing(userId, query);
  }
}
