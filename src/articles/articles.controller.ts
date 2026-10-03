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
  ArticleListAuthorResponseDto,
  ArticleResponseDto,
} from './dto/article-response.dto';
import { Public, CurrentUser, Paginated } from '../common/decorators';
import {
  ApiEnvelopeArrayOkResponse,
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
  list(
    @Query() query: ArticleQueryDto,
    @CurrentUser() currentUserId: string | undefined,
  ) {
    return this.articlesService.list(query, currentUserId);
  }

  // Must be declared before ":slug" so static paths are not captured as a param
  @Get('suggestions')
  @Public()
  @Paginated()
  @ApiEnvelopePaginatedOkResponse(ArticleResponseDto)
  @ApiStandardErrorResponses()
  getSuggestions(
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUserId: string | undefined,
  ) {
    return this.articlesService.getSuggestions(query, currentUserId);
  }

  @Get('authors')
  @Public()
  @ApiEnvelopeArrayOkResponse(ArticleListAuthorResponseDto)
  @ApiStandardErrorResponses()
  listPublishedAuthors() {
    return this.articlesService.listPublishedAuthors();
  }

  @Get('me/drafts')
  @Paginated()
  @ApiEnvelopePaginatedOkResponse(ArticleResponseDto)
  @ApiStandardErrorResponses()
  listMyDrafts(
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUserId: string,
  ) {
    return this.articlesService.listMyDrafts(currentUserId, query);
  }

  @Get(':slug')
  @Public()
  @ApiParam({ name: 'slug', type: String })
  @ApiEnvelopeOkResponse(ArticleResponseDto)
  @ApiStandardErrorResponses()
  getBySlug(
    @Param('slug') slug: string,
    @CurrentUser() currentUserId: string | undefined,
  ) {
    return this.articlesService.getBySlug(slug, currentUserId);
  }

  @Post()
  @ApiEnvelopeCreatedResponse(ArticleResponseDto)
  @ApiStandardErrorResponses()
  create(@CurrentUser() currentUserId: string, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(currentUserId, dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(ArticleResponseDto)
  @ApiStandardErrorResponses()
  update(
    @Param('id') id: string,
    @CurrentUser() currentUserId: string,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, currentUserId, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiEnvelopeOkResponse(ArticleDeletedResponseDto)
  @ApiStandardErrorResponses()
  delete(@Param('id') id: string, @CurrentUser() currentUserId: string) {
    return this.articlesService.delete(id, currentUserId);
  }
}
