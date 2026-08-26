import { HttpException, HttpStatus } from '@nestjs/common';
import type { ValidationFieldError } from './flatten-validation-errors';

export class RequestValidationException extends HttpException {
  constructor(readonly details: ValidationFieldError[]) {
    super('Invalid request data', HttpStatus.BAD_REQUEST);
  }
}
