import { Body, Controller, Delete, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Paginated } from '../common/decorators';
import { PaginationQueryDto } from '../common/dto';
import {
  ApiEnvelopeCreatedResponse,
  ApiEnvelopeOkResponse,
  ApiEnvelopePaginatedOkResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';
import { SaveTargetDto, SavedActionResponseDto, SavedItemResponseDto } from './dto';
import { SavedService } from './saved.service';

@ApiTags('Saved')
@Controller('me/saved')
export class SavedController {
  constructor(private readonly savedService: SavedService) {}

  @Get()
  @Paginated()
  @ApiEnvelopePaginatedOkResponse(SavedItemResponseDto)
  @ApiStandardErrorResponses()
  list(
    @CurrentUser() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.savedService.list(userId, query);
  }

  @Post()
  @ApiEnvelopeCreatedResponse(SavedActionResponseDto)
  @ApiStandardErrorResponses()
  save(@CurrentUser() userId: string, @Body() dto: SaveTargetDto) {
    return this.savedService.save(userId, dto.targetId, dto.targetType);
  }

  @Delete()
  @HttpCode(200)
  @ApiEnvelopeOkResponse(SavedActionResponseDto)
  @ApiStandardErrorResponses()
  unsave(@CurrentUser() userId: string, @Body() dto: SaveTargetDto) {
    return this.savedService.unsave(userId, dto.targetId, dto.targetType);
  }
}
