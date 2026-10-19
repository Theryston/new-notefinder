'use client';

import {
  type ProfileSection,
  type ProfileVisibility,
  profileVisibilitySchema,
} from '@notefinder/contracts';
import { queryOptions } from '@tanstack/react-query';

import { browserApi } from '@/lib/api/browser';

import { profileKeys } from './query-keys';

/**
 * The owner's section flags, read in the browser once the session says the
 * viewer owns the Profile (the public shell is cached and has none of them).
 */
export function profileVisibilityQueryOptions() {
  return queryOptions({
    queryKey: profileKeys.visibility(),
    queryFn: () =>
      browserApi('/me/profile-visibility', {
        schema: profileVisibilitySchema,
      }),
    staleTime: 5 * 60_000,
  });
}

/**
 * Saves one section's flag (`PATCH /v1/me/profile-visibility`) and returns all
 * the flags. A failure rejects, so the caller can roll its optimistic change back.
 */
export function saveSectionVisibility(
  section: ProfileSection,
  visible: boolean,
): Promise<ProfileVisibility> {
  return browserApi('/me/profile-visibility', {
    method: 'PATCH',
    body: { [section]: visible },
    schema: profileVisibilitySchema,
  });
}
