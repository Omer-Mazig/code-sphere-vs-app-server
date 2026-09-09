import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../common/swagger';

export class ChatUnreadCountResponseDto {
  @ApiProperty({
    description: 'Number of conversations with at least one unread message.',
  })
  count!: number;
}

export class ConversationDeletedResponseDto extends MessageResponseDto {}

export class ConversationReadResponseDto extends MessageResponseDto {}
