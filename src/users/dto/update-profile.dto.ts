import { IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'Full-stack developer',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsUrl()
  website?: string | null;

  @ApiPropertyOptional({
    example: 'johndoe',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  github?: string | null;

  @ApiPropertyOptional({
    example: 'San Francisco, CA',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string | null;
}
