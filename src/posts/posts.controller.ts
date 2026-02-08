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
import { Permissions, CurrentUser } from '../common/decorators';
import { RoleType } from '../common/types';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @Permissions(RoleType.PUBLIC)
  getFeed(@Query() query: PostQueryDto) {
    return this.postsService.getFeed(query);
  }

  @Get(':id')
  @Permissions(RoleType.PUBLIC)
  getById(@Param('id') id: string) {
    return this.postsService.getById(id);
  }

  @Post()
  @Permissions(RoleType.USER, RoleType.ADMIN)
  create(
    @CurrentUser() userId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.create(userId, dto);
  }

  @Patch(':id')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  update(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, userId, dto);
  }

  @Delete(':id')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  delete(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    return this.postsService.delete(id, userId);
  }
}
