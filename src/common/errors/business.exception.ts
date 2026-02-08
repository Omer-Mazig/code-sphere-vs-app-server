import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes.enum';

export class BusinessException extends HttpException {
  public readonly errorCode: ErrorCode;
  public readonly internalMessage: string;
  public readonly clientMessage: string;
  public readonly httpStatus: HttpStatus;

  constructor(
    errorCode: ErrorCode,
    internalMessage: string,
    clientMessage?: string,
    httpStatus: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ errorCode, message: internalMessage }, httpStatus);
    this.errorCode = errorCode;
    this.internalMessage = internalMessage;
    this.clientMessage = clientMessage ?? 'An error occurred';
    this.httpStatus = httpStatus;
  }
}
