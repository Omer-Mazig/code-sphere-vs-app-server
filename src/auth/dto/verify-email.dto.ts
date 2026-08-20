import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token from the confirmation link',
  })
  @IsString()
  @MinLength(1)
  token: string;
}
