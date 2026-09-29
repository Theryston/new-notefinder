import {
  type ApiErrorCode,
  currentUserSchema,
  type SetUsernameBody,
} from '@notefinder/contracts';

import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser';

import type { AuthClientError } from './auth-error';

// The API error codes whose message is about the username itself; the rest
// (rate limit, expired session, …) are told by status, like Better Auth's.
const USERNAME_ERROR_CODES: Partial<Record<ApiErrorCode, string>> = {
  CONFLICT: 'USERNAME_IS_ALREADY_TAKEN',
  VALIDATION_FAILED: 'INVALID_USERNAME',
};

/**
 * Sets the username of a user who has none yet (`PUT /v1/me/username`).
 * Answers in the shape the Better Auth client used before, so the setup step
 * keeps mapping failures with `authErrorCode`. Load it on submit only: it
 * brings the API client and the contracts along.
 */
export async function setUsername(
  body: SetUsernameBody,
): Promise<{ error: AuthClientError | null }> {
  try {
    await browserApi('/me/username', {
      method: 'PUT',
      body,
      schema: currentUserSchema,
    });
    return { error: null };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return {
      error: {
        code: USERNAME_ERROR_CODES[error.code],
        status: error.statusCode,
      },
    };
  }
}
