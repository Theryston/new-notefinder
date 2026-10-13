'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  applyFavorite,
  rollbackFavorite,
  settleFavorite,
} from '../favorite-optimistic';
import { trackKeys } from '../query-keys';
import { setTrackFavorite } from '../track-user-state-query';

/**
 * Favorites or unfavorites a Track. The heart flips at once (the cached
 * state is written before the request) and flips back when the request fails,
 * with a toast translated from the API's error code. The cache logic is in
 * `favorite-optimistic.ts`; this is the wiring.
 */
export function useTrackFavorite(trackId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations();
  const key = trackKeys.userState(trackId);

  return useMutation({
    mutationFn: (favorite: boolean) => setTrackFavorite(trackId, favorite),
    onMutate: (favorite) => applyFavorite(queryClient, key, favorite),
    onError: (error, _favorite, snapshot) => {
      const message = rollbackFavorite(queryClient, key, snapshot, error);
      toast.error(t(message.key, message.values));
    },
    onSettled: () => settleFavorite(queryClient, key),
  });
}
