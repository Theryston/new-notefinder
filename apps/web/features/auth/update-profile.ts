import {
  type ApiErrorCode,
  type CurrentUser,
  currentUserSchema,
  type UpdateMeBody,
} from '@notefinder/contracts';

import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser';

export type UpdateProfileResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; code: ApiErrorCode };

/**
 * Saves the profile with `PATCH /v1/me`. Multipart, like the API expects: the
 * Avatar, when there is one, is a further part of the same request. Never
 * throws: a failure comes back as the code whose message the form shows.
 *
 * Load it on demand (`import()`): it pulls in Zod and the API client, which
 * the page doesn't need until the first save.
 */
export async function updateProfile(
  body: UpdateMeBody,
): Promise<UpdateProfileResult> {
  const form = new FormData();
  form.set('name', body.name);
  if (body.avatar) form.set('avatar', body.avatar);
  try {
    const user = await browserApi('/me', {
      method: 'PATCH',
      body: form,
      schema: currentUserSchema,
    });
    return { ok: true, user };
  } catch (error) {
    return {
      ok: false,
      code: error instanceof ApiError ? error.code : 'INTERNAL_ERROR',
    };
  }
}
