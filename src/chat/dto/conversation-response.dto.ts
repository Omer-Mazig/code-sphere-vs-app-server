import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserPreviewResponseDto } from '../../users/dto/user-response.dto';
import { ChatMessageResponseDto } from './chat-message-response.dto';

export class ConversationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: UserPreviewResponseDto })
  otherUser!: UserPreviewResponseDto;

  @ApiPropertyOptional({ type: ChatMessageResponseDto, nullable: true })
  lastMessage!: ChatMessageResponseDto | null;

  @ApiProperty()
  unreadCount!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastReadAt!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: "The other participant's last-read time, for receipts.",
  })
  otherLastReadAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
