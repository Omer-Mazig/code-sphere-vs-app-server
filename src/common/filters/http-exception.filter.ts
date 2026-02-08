import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessException } from '../errors/business.exception';
import { ErrorCode } from '../errors/error-codes.enum';

interface ErrorResponse {
  statusCode: number;
  method: string;
  errorCode: ErrorCode;
  message: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status: number;
    let errorCode: ErrorCode;
    let clientMessage: string;
    let internalMessage: string;

    if (exception instanceof BusinessException) {
      status = exception.httpStatus;
      errorCode = exception.errorCode;
      clientMessage = exception.clientMessage;
      internalMessage = exception.internalMessage;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      errorCode = this.mapHttpStatusToErrorCode(status);
      clientMessage = this.getClientMessageForHttpException(exception);
      internalMessage = this.extractInternalMessage(exception);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
      clientMessage = 'An unexpected error occurred';
      internalMessage =
        exception instanceof Error ? exception.message : String(exception);
    }

    const timestamp = new Date().toISOString();

    this.logger.error({
      errorCode,
      internalMessage,
      path: request.url,
      method: request.method,
      timestamp,
      stack: exception instanceof Error ? exception.stack : undefined,
      body: request.body,
      query: request.query,
      params: request.params,
    });

    const errorResponse: ErrorResponse = {
      statusCode: status,
      method: request.method,
      errorCode,
      message: clientMessage,
      timestamp,
    };

    response.status(status).json(errorResponse);
  }

  private mapHttpStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.AUTHENTICATION_ERROR;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.RESOURCE_NOT_FOUND;
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.AUTHORIZATION_ERROR;
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR;
    }
  }

  private getClientMessageForHttpException(exception: HttpException): string {
    const status = exception.getStatus();

    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'Authentication required';
      case HttpStatus.NOT_FOUND:
        return 'The requested resource was not found';
      case HttpStatus.BAD_REQUEST:
        return 'Invalid request data';
      case HttpStatus.FORBIDDEN:
        return 'Access denied';
      default:
        return 'An unexpected error occurred';
    }
  }

  private extractInternalMessage(exception: HttpException): string {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (typeof response === 'object' && response !== null) {
      const responseObj = response as Record<string, unknown>;
      if (Array.isArray(responseObj.message)) {
        return responseObj.message.join('; ');
      }
      if (typeof responseObj.message === 'string') {
        return responseObj.message;
      }
    }

    return exception.message;
  }
}
