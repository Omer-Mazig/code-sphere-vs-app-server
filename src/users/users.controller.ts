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
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { FollowsService } from './follows.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserQueryDto } from './dto/user-query.dto';
import {
  FollowActionResponseDto,
  FollowUserResponseDto,
  UserProfileResponseDto,
} from './dto/user-response.dto';
import { Public, CurrentUser, Paginated } from '../common/decorators';
import {
  ApiEnvelopeOkResponse,
  ApiEnvelopePaginatedOkResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly followsService: FollowsService,
  ) {}

  // ── Profile ────────────────────────────────────────────────────────

  @Get('me')
  @ApiEnvelopeOkResponse(UserProfileResponseDto)
  @ApiStandardErrorResponses()
  getMyProfile(@CurrentUser() currentUserId: string) {
    return this.profilesService.getMyProfile(currentUserId);
  }

  @Get(':id')
  @Public()
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(UserProfileResponseDto)
  @ApiStandardErrorResponses()
  getProfile(
    @Param('id') targetUserId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.profilesService.getProfile(targetUserId, currentUserId);
  }

  @Patch('me')
  @ApiEnvelopeOkResponse(UserProfileResponseDto)
  @ApiStandardErrorResponses()
  updateMyProfile(
    @CurrentUser() currentUserId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.updateMyProfile(currentUserId, dto);
  }

  // ── Follow ─────────────────────────────────────────────────────────

  @Post(':id/follow')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(FollowActionResponseDto)
  @ApiStandardErrorResponses()
  followUser(
    @CurrentUser() currentUserId: string,
    @Param('id') targetUserId: string,
  ) {
    return this.followsService.followUser(currentUserId, targetUserId);
  }

  @Delete(':id/follow')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(FollowActionResponseDto)
  @ApiStandardErrorResponses()
  unfollowUser(
    @CurrentUser() currentUserId: string,
    @Param('id') targetUserId: string,
  ) {
    return this.followsService.unfollowUser(currentUserId, targetUserId);
  }

  // ── Followers / Following ──────────────────────────────────────────

  @Get(':id/followers')
  @Public()
  @Paginated()
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopePaginatedOkResponse(FollowUserResponseDto)
  @ApiStandardErrorResponses()
  getFollowers(
    @Param('id') targetUserId: string,
    @Query() query: UserQueryDto,
  ) {
    return this.followsService.getFollowers(targetUserId, query);
  }

  @Get(':id/following')
  @Public()
  @Paginated()
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopePaginatedOkResponse(FollowUserResponseDto)
  @ApiStandardErrorResponses()
  getFollowing(
    @Param('id') targetUserId: string,
    @Query() query: UserQueryDto,
  ) {
    return this.followsService.getFollowing(targetUserId, query);
  }
}
