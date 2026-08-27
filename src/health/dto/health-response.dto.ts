import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HealthIndicatorDto {
  @ApiProperty({ enum: ['up', 'down'] })
  status!: 'up' | 'down';
}

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'error', 'shutting_down'] })
  status!: 'ok' | 'error' | 'shutting_down';

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/HealthIndicatorDto' },
  })
  info?: Record<string, HealthIndicatorDto>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/HealthIndicatorDto' },
  })
  error?: Record<string, HealthIndicatorDto>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/HealthIndicatorDto' },
  })
  details?: Record<string, HealthIndicatorDto>;
}
