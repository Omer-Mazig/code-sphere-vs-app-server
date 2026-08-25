import { IsString, MaxLength, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiPropertyOptional({ example: 'Just shipped a new feature!' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({
    description: 'Original post to reshare. Commentary may be empty.',
  })
  @IsOptional()
  @IsUUID()
  sharedPostId?: string;
}
