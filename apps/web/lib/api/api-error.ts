import type {
  ApiError as ApiErrorBody,
  ApiErrorCode,
} from '@notefinder/contracts';

// Types only, on purpose: the query client (in every page's first-load
// JavaScript) imports `ApiError`, so this file must not pull in Zod. Parsing
// an error response lives in `error-response.ts`.

/**
 * Error thrown by the API clients. `code` is stable and meant to be
 * translated (`errors.<code>`); `message` is for logs only, never for users.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly details: unknown;

  constructor(body: ApiErrorBody, options?: ErrorOptions) {
    super(body.message, options);
    this.name = 'ApiError';
    this.statusCode = body.statusCode;
    this.code = body.code;
    this.details = body.details;
  }

  toJSON(): ApiErrorBody {
    return {
      statusCode: this.statusCode,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export function internalApiError(message: string, cause?: unknown): ApiError {
  return new ApiError(
    { statusCode: 500, code: 'INTERNAL_ERROR', message },
    { cause },
  );
}
