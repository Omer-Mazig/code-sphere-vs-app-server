import { ApiProperty } from '@nestjs/swagger';

export class MediaObjectResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: 'Authenticated GET path for the stored image.',
    example: '/api/media/550e8400-e29b-41d4-a716-446655440000',
  })
  url!: string;

  @ApiProperty({ example: 'image/png' })
  mimeType!: string;

  @ApiProperty({ example: 248 })
  byteSize!: number;
}
