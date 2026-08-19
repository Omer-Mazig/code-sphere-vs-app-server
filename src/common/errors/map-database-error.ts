import { HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ErrorCode } from './error-codes.enum';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_NOT_NULL_VIOLATION = '23502';

export interface MappedDatabaseError {
  status: HttpStatus;
  errorCode: ErrorCode;
  clientMessage: string;
  internalMessage: string;
}

interface PostgresDriverError {
  code?: string;
  detail?: string;
  constraint?: string;
  table?: string;
  column?: string;
}

export function mapDatabaseError(
  exception: unknown,
): MappedDatabaseError | null {
  if (!(exception instanceof QueryFailedError)) {
    return null;
  }

  const driverError = exception.driverError as PostgresDriverError;
  const pgCode = driverError?.code;
  const table = driverError?.table;
  const column = driverError?.column;
  const constraint = driverError?.constraint;
  const detail = driverError?.detail;
  const columns = parseKeyColumns(detail);

  const internalMessage = [
    pgCode && `pgCode=${pgCode}`,
    table && `table=${table}`,
    column && `column=${column}`,
    constraint && `constraint=${constraint}`,
    detail,
  ]
    .filter(Boolean)
    .join(' ');

  if (pgCode === PG_UNIQUE_VIOLATION) {
    return mapUniqueViolation({
      table,
      columns,
      constraint,
      internalMessage: internalMessage || exception.message,
    });
  }

  if (pgCode === PG_FOREIGN_KEY_VIOLATION) {
    return {
      status: HttpStatus.BAD_REQUEST,
      errorCode: ErrorCode.VALIDATION_ERROR,
      clientMessage: 'Referenced resource does not exist',
      internalMessage: `Foreign key violation: ${internalMessage || exception.message}`,
    };
  }

  if (pgCode === PG_NOT_NULL_VIOLATION) {
    return {
      status: HttpStatus.BAD_REQUEST,
      errorCode: ErrorCode.VALIDATION_ERROR,
      clientMessage: 'Required field is missing',
      internalMessage: `Not-null violation: ${internalMessage || exception.message}`,
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
    clientMessage: 'An unexpected error occurred',
    internalMessage: `Database error: ${internalMessage || exception.message}`,
  };
}

function parseKeyColumns(detail?: string): string[] {
  if (!detail) {
    return [];
  }

  const match = detail.match(/Key \(([^)]+)\)=/i);
  if (!match?.[1]) {
    return [];
  }

  return match[1].split(',').map((column) => column.trim().replace(/"/g, ''));
}

function mapUniqueViolation(params: {
  table?: string;
  columns: string[];
  constraint?: string;
  internalMessage: string;
}): MappedDatabaseError {
  const columnSet = new Set(
    params.columns.map((column) => column.toLowerCase()),
  );
  const constraintName = params.constraint?.toLowerCase() ?? '';
  const tableName = params.table?.toLowerCase() ?? '';

  if (columnSet.has('email') || constraintName.includes('email')) {
    return {
      status: HttpStatus.CONFLICT,
      errorCode: ErrorCode.USER_EMAIL_EXISTS,
      clientMessage: 'An account with this email already exists',
      internalMessage: `Unique violation on email: ${params.internalMessage}`,
    };
  }

  if (columnSet.has('username') || constraintName.includes('username')) {
    return {
      status: HttpStatus.CONFLICT,
      errorCode: ErrorCode.USER_USERNAME_EXISTS,
      clientMessage: 'This username is already taken',
      internalMessage: `Unique violation on username: ${params.internalMessage}`,
    };
  }

  if (
    columnSet.has('slug') ||
    constraintName.includes('slug') ||
    tableName === 'articles'
  ) {
    return {
      status: HttpStatus.CONFLICT,
      errorCode: ErrorCode.ARTICLE_SLUG_EXISTS,
      clientMessage: 'An article with a similar title already exists',
      internalMessage: `Unique violation on slug: ${params.internalMessage}`,
    };
  }

  if (tableName === 'likes') {
    return {
      status: HttpStatus.CONFLICT,
      errorCode: ErrorCode.ALREADY_LIKED,
      clientMessage: 'Resource already liked',
      internalMessage: `Unique violation on likes: ${params.internalMessage}`,
    };
  }

  if (
    tableName === 'follows' ||
    (columnSet.has('followerid') && columnSet.has('followingid'))
  ) {
    return {
      status: HttpStatus.CONFLICT,
      errorCode: ErrorCode.USER_ALREADY_FOLLOWED,
      clientMessage: 'User is already followed',
      internalMessage: `Unique violation on follows: ${params.internalMessage}`,
    };
  }

  return {
    status: HttpStatus.CONFLICT,
    errorCode: ErrorCode.DUPLICATE_RESOURCE,
    clientMessage: 'Resource already exists',
    internalMessage: `Unique violation: ${params.internalMessage}`,
  };
}
