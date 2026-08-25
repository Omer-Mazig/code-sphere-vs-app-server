import { IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_POLICY_MESSAGE,
} from './password.constraints';

export class ResetPasswordDto {
  @ApiProperty({ example: 'a1b2c3d4...' })
  @IsString()
  @MinLength(1)
  token: string;

  @ApiProperty({
    example: 'Password123',
    minLength: PASSWORD_MIN_LENGTH,
    description: PASSWORD_POLICY_MESSAGE,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_POLICY_MESSAGE })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_POLICY_MESSAGE })
  password: string;
}
