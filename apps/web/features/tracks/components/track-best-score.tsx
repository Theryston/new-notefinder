'use client';

import { SessionUserBoundary } from '@/features/auth/components/session-user';

import { BestScoreState } from './best-score-state';

/**
 * The best score of the title row. Like the heart, it is session-dependent:
 * only a signed-in User with a saved attempt at the current difficulty gets
 * one, and there is no placeholder while the session loads.
 */
export function TrackBestScore({ trackId }: { trackId: string }) {
  return (
    <SessionUserBoundary
      render={(user) => (user ? <BestScoreState trackId={trackId} /> : null)}
    />
  );
}
