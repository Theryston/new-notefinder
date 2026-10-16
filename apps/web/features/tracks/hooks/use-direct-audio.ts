import type { TrackAudio } from '@notefinder/contracts';
import { useQuery } from '@tanstack/react-query';

import { trackKeys } from '../query-keys';

/** Authorization is checked again by the API; ordinary listeners never ask. */
export function useDirectAudio(trackId: string, admin: boolean) {
  return useQuery({
    queryKey: trackKeys.directAudio(trackId),
    queryFn: async ({ signal }): Promise<TrackAudio> => {
      const [{ trackAudioSchema }, { browserApi }] = await Promise.all([
        import('@notefinder/contracts'),
        import('@/lib/api/browser'),
      ]);
      return browserApi(`/tracks/${trackId}/audio`, {
        schema: trackAudioSchema,
        signal,
      });
    },
    enabled: admin,
    retry: false,
    gcTime: 0,
  });
}
