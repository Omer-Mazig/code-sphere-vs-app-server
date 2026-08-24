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
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleQueryDto } from './dto/article-query.dto';
import { PaginationQueryDto } from '../common/dto';
import {
  ArticleDeletedResponseDto,
  ArticleResponseDto,
} from './dto/article-response.dto';
import { Public, CurrentUser, Paginated } from '../common/decorators';
import {
  ApiEnvelopeCreatedResponse,
  ApiEnvelopeOkResponse,
  ApiEnvelopePaginatedOkResponse,
  ApiStandardErrorResponses,
} from '../common/swagger';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @Public()
  @Paginated()
  @ApiEnvelopePaginatedOkResponse(ArticleResponseDto)
  @ApiStandardErrorResponses()
  list(@Query() query: ArticleQueryDto, @CurrentUser() currentUserId: string) {
    return this.articlesService.list(query, currentUserId);
  }

  // Must be declared before ":slug" so "suggestions" is not captured as a param
  @Get('suggestions')
  @Public()
  @Paginated()
  @ApiEnvelopePaginatedOkResponse(ArticleResponseDto)
  @ApiStandardErrorResponses()
  getSuggestions(
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUserId: string,
  ) {
    return this.articlesService.getSuggestions(query, currentUserId);
  }

  @Get(':slug')
  @Public()
  @ApiParam({ name: 'slug', type: String })
  @ApiEnvelopeOkResponse(ArticleResponseDto)
  @ApiStandardErrorResponses()
  getBySlug(@Param('slug') slug: string, @CurrentUser() currentUserId: string) {
    return this.articlesService.getBySlug(slug, currentUserId);
  }

  @Post()
  @ApiEnvelopeCreatedResponse(ArticleResponseDto)
  @ApiStandardErrorResponses()
  create(@CurrentUser() userId: string, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(userId, dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(ArticleResponseDto)
  @ApiStandardErrorResponses()
  update(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(ArticleDeletedResponseDto)
  @ApiStandardErrorResponses()
  delete(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.articlesService.delete(id, userId);
  }
}
