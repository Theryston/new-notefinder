import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { ApiError } from '@notefinder/contracts';
import type { z } from 'zod';
import { ZodValidationException } from '../zod/zod-validation.pipe.js';
import { AppException, errorCodeFromHttpStatus } from './app-exception.js';

const INTERNAL_ERROR: ApiError = {
  statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  code: 'INTERNAL_ERROR',
  message: 'Internal server error',
};

type HttpLikeError = { statusCode: number; message: string };

/**
 * Errors from Express middleware (e.g. body-parser's malformed JSON) follow
 * the `http-errors` shape; `expose` marks the message as safe for clients.
 */
const isExposedHttpError = (error: unknown): error is HttpLikeError =>
  typeof error === 'object' &&
  error !== null &&
  'expose' in error &&
  error.expose === true &&
  'statusCode' in error &&
  typeof error.statusCode === 'number' &&
  error.statusCode >= 400 &&
  error.statusCode < 500 &&
  'message' in error &&
  typeof error.message === 'string';

const serializeIssues = (error: z.ZodError) =>
  error.issues.map((issue) => ({
    ...issue,
    path: issue.path.map((segment) =>
      typeof segment === 'symbol' ? segment.toString() : segment,
    ),
  }));

/**
 * Converts anything thrown into the `apiErrorSchema` envelope. Returns
 * `shouldLog` for server-side failures, whose details must never be sent.
 */
export const toApiError = (
  exception: unknown,
): { error: ApiError; shouldLog: boolean } => {
  if (exception instanceof AppException) {
    const error = exception.toApiError();
    return { error, shouldLog: error.statusCode >= 500 };
  }
  if (exception instanceof ZodValidationException) {
    return {
      error: {
        statusCode: exception.getStatus(),
        code: 'VALIDATION_FAILED',
        message: exception.message,
        details: {
          location: exception.location,
          issues: serializeIssues(exception.zodError),
        },
      },
      shouldLog: false,
    };
  }
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    if (statusCode >= 500) {
      return { error: { ...INTERNAL_ERROR, statusCode }, shouldLog: true };
    }
    return {
      error: {
        statusCode,
        code: errorCodeFromHttpStatus(statusCode),
        message: exception.message,
      },
      shouldLog: false,
    };
  }
  if (isExposedHttpError(exception)) {
    return {
      error: {
        statusCode: exception.statusCode,
        code: errorCodeFromHttpStatus(exception.statusCode),
        message: exception.message,
      },
      shouldLog: false,
    };
  }
  return { error: INTERNAL_ERROR, shouldLog: true };
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { error, shouldLog } = toApiError(exception);
    if (shouldLog) {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Non-error thrown',
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    if (host.getType() !== 'http') {
      return;
    }
    const { httpAdapter } = this.httpAdapterHost;
    const response: unknown = host.switchToHttp().getResponse();
    if (httpAdapter.isHeadersSent(response)) {
      httpAdapter.end(response);
      return;
    }
    httpAdapter.reply(response, error, error.statusCode);
  }
}
