import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../common/swagger';

export class AuthUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;
}

export class AuthSessionResponseDto {
  @ApiProperty({ type: AuthUserResponseDto })
  user!: AuthUserResponseDto;

  @ApiProperty()
  accessToken!: string;
}

export class LogoutResponseDto extends MessageResponseDto {}

export class RegisterResponseDto {
  @ApiProperty({
    example: 'Check your email to verify your account before signing in.',
  })
  message!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({
    required: false,
    description:
      'Present only in non-production so the verification link can be opened without SMTP.',
  })
  verificationUrl?: string;
}

export class ResendVerificationResponseDto {
  @ApiProperty({
    example:
      'If an account exists and is unverified, a new email has been sent.',
  })
  message!: string;

  @ApiProperty({
    required: false,
    description:
      'Present only in non-production when a verification email was issued.',
  })
  verificationUrl?: string;
}
