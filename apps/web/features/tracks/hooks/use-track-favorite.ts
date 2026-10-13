'use client';

import type { UserTrackState } from '@notefinder/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { trackKeys } from '../query-keys';
import { requestErrorMessage } from '../request-error';
import { setTrackFavorite } from '../track-user-state-query';

/**
 * Favorites or unfavorites a Track. The heart flips at once (the cached
 * state is written before the request) and flips back when the request fails,
 * with a toast translated from the API's error code.
 */
export function useTrackFavorite(trackId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations();
  const key = trackKeys.userState(trackId);

  return useMutation({
    mutationFn: (favorite: boolean) => setTrackFavorite(trackId, favorite),
    onMutate: async (favorite) => {
      // A read in flight would land after the write and undo it.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<UserTrackState>(key);
      queryClient.setQueryData<UserTrackState>(key, { isFavorite: favorite });
      return { previous };
    },
    onError: (error, _favorite, context) => {
      queryClient.setQueryData<UserTrackState>(key, context?.previous);
      const message = requestErrorMessage(error);
      toast.error(t(message.key, message.values));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
