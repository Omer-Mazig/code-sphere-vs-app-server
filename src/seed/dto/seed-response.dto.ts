import { ApiProperty } from '@nestjs/swagger';

export class SeedRunResponseDto {
  @ApiProperty()
  users!: number;

  @ApiProperty()
  follows!: number;

  @ApiProperty()
  posts!: number;

  @ApiProperty()
  articles!: number;

  @ApiProperty()
  likes!: number;

  @ApiProperty()
  comments!: number;

  @ApiProperty()
  shares!: number;
}

export class SeedClearResponseDto {
  @ApiProperty()
  cleared!: boolean;
}
