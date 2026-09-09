import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
