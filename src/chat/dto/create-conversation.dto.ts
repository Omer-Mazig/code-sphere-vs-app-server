import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({
    description: 'The other participant. Creates the 1:1 thread if it does not exist.',
  })
  @IsUUID()
  userId: string;
}
