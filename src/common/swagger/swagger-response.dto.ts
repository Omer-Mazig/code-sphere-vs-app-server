import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorCode } from '../errors';

export class ApiEnvelopeMetaDto {
  @ApiPropertyOptional({
    description: 'API version returned by the server.',
    example: '1.0',
  })
  apiVersion?: string;

  @ApiPropertyOptional({
    description: 'Server-side processing time in milliseconds.',
    example: 24,
  })
  processingTimeMs?: number;
}

export class ApiEnvelopeWarningDto {
  @ApiProperty({
    description: 'Machine-readable warning code.',
    example: 'DEPRECATED_FIELD',
  })
  code!: string;

  @ApiProperty({
    description: 'Human-readable warning message.',
    example: 'The "foo" field is deprecated and will be removed.',
  })
  message!: string;
}

export class PaginatedMetaDto {
  @ApiProperty({ example: 128 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 7 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;
}

export class ValidationFieldErrorDto {
  @ApiProperty({ example: 'password' })
  field!: string;

  @ApiProperty({
    example: 'Password must be at least 8 characters and contain at least one letter and one number',
  })
  message!: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ example: 'GET' })
  method!: string;

  @ApiProperty({
    description: 'Domain error code emitted by the backend.',
    enum: ErrorCode,
    enumName: 'ErrorCode',
    example: ErrorCode.RESOURCE_NOT_FOUND,
  })
  errorCode!: ErrorCode;

  @ApiProperty({ example: 'The requested resource was not found' })
  message!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-02-15T21:10:35.120Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    type: [ValidationFieldErrorDto],
    description:
      'Per-field validation errors. Present on request-pipe VALIDATION_ERROR responses.',
  })
  details?: ValidationFieldErrorDto[];
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message!: string;
}
