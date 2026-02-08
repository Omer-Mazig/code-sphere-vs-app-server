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
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleQueryDto } from './dto/article-query.dto';
import { Permissions, CurrentUser } from '../common/decorators';
import { RoleType } from '../common/types';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @Permissions(RoleType.PUBLIC)
  list(@Query() query: ArticleQueryDto) {
    return this.articlesService.list(query);
  }

  @Get(':slug')
  @Permissions(RoleType.PUBLIC)
  getBySlug(@Param('slug') slug: string) {
    return this.articlesService.getBySlug(slug);
  }

  @Post()
  @Permissions(RoleType.USER, RoleType.ADMIN)
  create(
    @CurrentUser() userId: string,
    @Body() dto: CreateArticleDto,
  ) {
    return this.articlesService.create(userId, dto);
  }

  @Patch(':id')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  update(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, userId, dto);
  }

  @Delete(':id')
  @Permissions(RoleType.USER, RoleType.ADMIN)
  delete(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    return this.articlesService.delete(id, userId);
  }
}
