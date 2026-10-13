import type { UserTrackState } from '@notefinder/contracts';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { type RequestErrorMessage, requestErrorMessage } from './request-error';

/** What `applyFavorite` saves for `rollbackFavorite`: the state before the tap. */
export type FavoriteSnapshot = { previous: UserTrackState | undefined };

/**
 * Writes the new favorite state into the cache before the request goes out,
 * so the heart flips at once, and returns what to put back on a failure.
 */
export async function applyFavorite(
  queryClient: QueryClient,
  key: QueryKey,
  favorite: boolean,
): Promise<FavoriteSnapshot> {
  // A read in flight would land after the write and undo it.
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<UserTrackState>(key);
  queryClient.setQueryData<UserTrackState>(key, { isFavorite: favorite });
  return { previous };
}

/** Puts the state from before the tap back; returns the message to toast. */
export function rollbackFavorite(
  queryClient: QueryClient,
  key: QueryKey,
  snapshot: FavoriteSnapshot | undefined,
  error: unknown,
): RequestErrorMessage {
  queryClient.setQueryData<UserTrackState>(key, snapshot?.previous);
  return requestErrorMessage(error);
}

/** Reads the state again once the request settles, whatever its outcome. */
export function settleFavorite(
  queryClient: QueryClient,
  key: QueryKey,
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: key });
}
