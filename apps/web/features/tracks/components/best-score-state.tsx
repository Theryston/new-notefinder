'use client';

import { useQuery } from '@tanstack/react-query';

import { BestScorePill } from '@/features/practice/components/best-score-pill';

import { trackUserStateQueryOptions } from '../track-user-state-query';

/**
 * The signed-in User's best saved score at the current difficulty, read
 * from the Track state. Shared by the title row and the result sheet; the
 * pill itself belongs to the practice feature (the difficulty lives there).
 */
export function BestScoreState({ trackId }: { trackId: string }) {
  const state = useQuery(trackUserStateQueryOptions(trackId));
  if (state.data === undefined) return null;
  return <BestScorePill bestScores={state.data.bestScores} />;
}
