import { apiErrorSchema } from '@notefinder/contracts';

import { ApiError } from './api-error';

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
