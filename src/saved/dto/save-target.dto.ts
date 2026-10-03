import { IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SavedTargetType } from '../entities/saved-item.entity';

export class SaveTargetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetId: string;

  @ApiProperty({ enum: SavedTargetType, enumName: 'SavedTargetType' })
  @IsEnum(SavedTargetType)
  targetType: SavedTargetType;
}
