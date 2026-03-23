import { ApiProperty } from '@nestjs/swagger';

export class StreamTokenResponseDto {
  @ApiProperty()
  streamToken!: string;
}

