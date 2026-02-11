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
import { ApiTags } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { Public, CurrentUser, Paginated } from '../common/decorators';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @Public()
  @Paginated()
  getFeed(
    @Query() query: PostQueryDto,
    @CurrentUser() currentUserId: string,
  ) {
    return this.postsService.getFeed(query, currentUserId);
  }

  @Get(':id')
  @Public()
  getById(
    @Param('id') id: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.postsService.getById(id, currentUserId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, userId, dto);
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    return this.postsService.delete(id, userId);
  }
}
