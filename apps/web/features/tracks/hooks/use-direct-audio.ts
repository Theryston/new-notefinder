import { trackAudioSchema } from '@notefinder/contracts';
import { useQuery } from '@tanstack/react-query';

import { browserApi } from '@/lib/api/browser';

/** Authorization is checked again by the API; ordinary listeners never ask. */
export function useDirectAudio(trackId: string, admin: boolean) {
  return useQuery({
    queryKey: ['track-direct-audio', trackId],
    queryFn: ({ signal }) =>
      browserApi(`/tracks/${trackId}/audio`, {
        schema: trackAudioSchema,
        signal,
      }),
    enabled: admin,
    retry: false,
    gcTime: 0,
  });
}
