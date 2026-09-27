import {
  type ApiError as ApiErrorBody,
  type ApiErrorCode,
  apiErrorSchema,
} from '@notefinder/contracts';

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

/** Builds an `ApiError` from a non-2xx response, even if it isn't JSON. */
export async function apiErrorFromResponse(
  response: Response,
): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = apiErrorSchema.safeParse(body);

  if (parsed.success) return new ApiError(parsed.data);

  return new ApiError({
    statusCode: response.status,
    code: 'INTERNAL_ERROR',
    message: `Unexpected ${response.status} response from the API`,
  });
}
