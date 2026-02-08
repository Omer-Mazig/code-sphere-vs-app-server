import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ example: 'Just shipped a new feature!' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}
