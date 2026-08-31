import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  IsUrl,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PROFILE_IMAGE_REF_PATTERN } from '../../media/media-object-url';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'John Doe',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string | null;

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
    example: '/api/media/550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
    type: String,
    description:
      'Uploaded media path from POST /media, an https URL, or null to clear.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2048)
  @Matches(PROFILE_IMAGE_REF_PATTERN, {
    message: 'Must be an uploaded image or a valid URL',
  })
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    example: '/api/media/550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
    type: String,
    description:
      'Uploaded media path from POST /media, an https URL, or null to clear.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2048)
  @Matches(PROFILE_IMAGE_REF_PATTERN, {
    message: 'Must be an uploaded image or a valid URL',
  })
  coverImageUrl?: string | null;

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
