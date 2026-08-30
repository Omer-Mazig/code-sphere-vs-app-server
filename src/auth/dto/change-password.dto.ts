import { IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_POLICY_MESSAGE,
} from './password.constraints';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Password123' })
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty({
    example: 'Password456',
    minLength: PASSWORD_MIN_LENGTH,
    description: PASSWORD_POLICY_MESSAGE,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_POLICY_MESSAGE })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_POLICY_MESSAGE })
  newPassword: string;
}
