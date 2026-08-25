import { ApiProperty } from '@nestjs/swagger';

export class NotificationStreamPingEventDto {
  @ApiProperty({ type: String, format: 'date-time' })
  timestamp!: string;
}
