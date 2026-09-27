import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError, ApiErrorCode } from '@notefinder/contracts';

export const API_ERROR_HTTP_STATUS = {
  BAD_REQUEST: HttpStatus.BAD_REQUEST,
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
} as const satisfies Record<ApiErrorCode, HttpStatus>;

/**
 * Maps an HTTP status to the closest error code, for errors that were not
 * raised as an {@link AppException} (Nest built-ins, body parser, …).
 */
export const errorCodeFromHttpStatus = (status: number): ApiErrorCode => {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
  }
};

/**
 * Expected failure raised by services. The global exception filter turns it
 * into the `apiErrorSchema` envelope; `message` is for developers only,
 * clients translate `code`.
 */
export class AppException extends HttpException {
  readonly code: ApiErrorCode;
  readonly details: unknown;
  private readonly body: ApiError;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    const statusCode = API_ERROR_HTTP_STATUS[code];
    const body: ApiError = { statusCode, code, message };
    if (details !== undefined) {
      body.details = details;
    }
    super(body, statusCode);
    this.code = code;
    this.details = details;
    this.body = body;
  }

  toApiError(): ApiError {
    return this.body;
  }
}
