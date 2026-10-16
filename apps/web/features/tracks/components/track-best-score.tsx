'use client';

import { useQuery } from '@tanstack/react-query';

import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { BestScorePill } from '@/features/practice/components/best-score-pill';

import { trackUserStateQueryOptions } from '../track-user-state-query';

/**
 * The best score of the title row. Like the heart, it is session-dependent:
 * only a signed-in User with a saved attempt at the current difficulty gets
 * one, and there is no placeholder while the session loads. The pill itself
 * belongs to the practice feature (the difficulty lives there); this only
 * reads the Track state and hands it over.
 */
export function TrackBestScore({ trackId }: { trackId: string }) {
  return (
    <SessionUserBoundary
      render={(user) => (user ? <BestScoreState trackId={trackId} /> : null)}
    />
  );
}

function BestScoreState({ trackId }: { trackId: string }) {
  const state = useQuery(trackUserStateQueryOptions(trackId));
  return <BestScorePill bestScores={state.data?.bestScores} />;
}
