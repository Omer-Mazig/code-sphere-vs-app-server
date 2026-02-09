import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { createPaginatedResponse } from '../common/dto';

const DEFAULT_PAGE_SIZE = 3;

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  async create(authorId: string, dto: CreatePostDto) {
    const post = this.postsRepository.create({
      authorId,
      content: dto.content,
    });

    await this.postsRepository.save(post);

    return this.getById(post.id);
  }

  async update(postId: string, userId: string, dto: UpdatePostDto) {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new BusinessException(
        ErrorCode.POST_NOT_FOUND,
        `Post with id "${postId}" not found`,
        'Post not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (post.authorId !== userId) {
      throw new BusinessException(
        ErrorCode.POST_UPDATE_FORBIDDEN,
        `User "${userId}" cannot update post "${postId}"`,
        'You can only edit your own posts',
        HttpStatus.FORBIDDEN,
      );
    }

    post.content = dto.content;
    await this.postsRepository.save(post);

    return this.getById(post.id);
  }

  async delete(postId: string, userId: string) {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new BusinessException(
        ErrorCode.POST_NOT_FOUND,
        `Post with id "${postId}" not found`,
        'Post not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (post.authorId !== userId) {
      throw new BusinessException(
        ErrorCode.POST_DELETE_FORBIDDEN,
        `User "${userId}" cannot delete post "${postId}"`,
        'You can only delete your own posts',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.postsRepository.remove(post);

    return { message: 'Post deleted' };
  }

  async getById(postId: string) {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['author'],
    });

    if (!post) {
      throw new BusinessException(
        ErrorCode.POST_NOT_FOUND,
        `Post with id "${postId}" not found`,
        'Post not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.formatPost(post);
  }

  async getFeed(query: PostQueryDto) {
    const { page, authorId } = query;
    const skip = (page - 1) * DEFAULT_PAGE_SIZE;

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .orderBy('post.createdAt', 'DESC')
      .skip(skip)
      .take(DEFAULT_PAGE_SIZE);

    if (authorId) {
      qb.where('post.authorId = :authorId', { authorId });
    }

    const [posts, total] = await qb.getManyAndCount();

    const items = posts.map((post) => this.formatPost(post));

    return createPaginatedResponse(items, total, page, DEFAULT_PAGE_SIZE);
  }

  private formatPost(post: Post) {
    return {
      id: post.id,
      content: post.content,
      author: post.author
        ? {
            id: post.author.id,
            username: post.author.username,
            displayName: post.author.displayName,
            avatarUrl: post.author.avatarUrl,
          }
        : null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
