import 'server-only';

import {
  type TrackProcessingState,
  trackProcessingStateSchema,
} from '@notefinder/contracts';
import { cache } from 'react';

import { serverApi } from '@/lib/api/server';
import { entityOutcomeFromError } from '@/lib/entity-route';

/**
 * What the Processing read answers: the state, or a domain outcome the route
 * acts on (a legacy ID moves, an unknown one is missing). Outcomes are data, as
 * on the album route, so the page can redirect or 404 on them instead of
 * showing an error.
 */
export type TrackProcessingResult =
  | { status: 'found'; state: TrackProcessingState }
  | { status: 'moved'; newId: string }
  | { status: 'missing' };

/**
 * The Processing state of a Track, read on every request and never cached: it
 * changes while the Track processes. `cache` shares one read between the
 * metadata and the page of the same render.
 */
export const getTrackProcessingResult = cache(
  async (trackId: string): Promise<TrackProcessingResult> => {
    try {
      return {
        status: 'found',
        state: await serverApi(
          `/tracks/${encodeURIComponent(trackId)}/processing`,
          { schema: trackProcessingStateSchema },
        ),
      };
    } catch (error) {
      const outcome = entityOutcomeFromError(error);
      if (outcome) return outcome;
      throw error;
    }
  },
);
