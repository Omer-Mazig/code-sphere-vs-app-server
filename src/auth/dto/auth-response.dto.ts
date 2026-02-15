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
