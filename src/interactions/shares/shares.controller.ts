import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators';
import { LikeDto } from '../dto';
import { SharesService } from './shares.service';

@ApiTags('Interactions')
@Controller('interactions/shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  share(@CurrentUser() userId: string, @Body() dto: LikeDto) {
    return this.sharesService.share(userId, dto.targetId, dto.targetType);
  }

  @Get('count')
  @Public()
  getSharesCount(@Query() query: LikeDto) {
    return this.sharesService.getSharesCount(query.targetId, query.targetType);
  }
}
