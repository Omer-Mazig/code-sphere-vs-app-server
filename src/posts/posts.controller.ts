import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { PaginationQueryDto } from '../common/dto';
import {
  PostDeletedResponseDto,
  PostResponseDto,
} from './dto/post-response.dto';
import { CurrentUser, Paginated } from '../common/decorators';
import {
  ApiEnvelopeCreatedResponse,
  ApiEnvelopeOkResponse,
  ApiEnvelopePaginatedOkResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';
import { BusinessException } from 'src/common';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @Paginated()
  @ApiEnvelopePaginatedOkResponse(PostResponseDto)
  @ApiStandardErrorResponses()
  getFeed(@Query() query: PostQueryDto, @CurrentUser() currentUserId: string) {
    return this.postsService.getFeed(query, currentUserId);
  }

  @Get('me/drafts')
  @Paginated()
  @ApiEnvelopePaginatedOkResponse(PostResponseDto)
  @ApiStandardErrorResponses()
  getMyDrafts(
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUserId: string,
  ) {
    return this.postsService.getMyDrafts(currentUserId, query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(PostResponseDto)
  @ApiStandardErrorResponses()
  getById(@Param('id') id: string, @CurrentUser() currentUserId: string) {
    return this.postsService.getById(id, currentUserId);
  }

  @Post()
  @ApiEnvelopeCreatedResponse(PostResponseDto)
  @ApiStandardErrorResponses()
  create(@CurrentUser() currentUserId: string, @Body() dto: CreatePostDto) {
    return this.postsService.create(currentUserId, dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(PostResponseDto)
  @ApiStandardErrorResponses()
  update(
    @Param('id') id: string,
    @CurrentUser() currentUserId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, currentUserId, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(PostDeletedResponseDto)
  @ApiStandardErrorResponses()
  delete(@Param('id') id: string, @CurrentUser() currentUserId: string) {
    return this.postsService.delete(id, currentUserId);
  }
}
