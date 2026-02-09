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
import { Public, CurrentUser } from '../common/decorators';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @Public()
  list(
    @Query() query: ArticleQueryDto,
    @CurrentUser() currentUserId: string,
  ) {
    return this.articlesService.list(query, currentUserId);
  }

  @Get(':slug')
  @Public()
  getBySlug(
    @Param('slug') slug: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.articlesService.getBySlug(slug, currentUserId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() dto: CreateArticleDto,
  ) {
    return this.articlesService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, userId, dto);
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    return this.articlesService.delete(id, userId);
  }
}
