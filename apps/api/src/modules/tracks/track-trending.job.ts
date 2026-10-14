import { z } from 'zod';

// The trending score of a Track is recomputed by a delayed job after its views
// change, one pending job per Track: the views of the next minutes join that
// job instead of each queuing a recomputation (the legacy app waited the same
// 15 minutes).

export const TRACK_TRENDING_QUEUE = 'track-trending';
export const REFRESH_TRENDING_SCORE_JOB = 'refresh-trending-score';

/** How long the job waits, so many views cost one recomputation. */
export const TRENDING_SCORE_DELAY_MS = 15 * 60 * 1000;

export const refreshTrendingScoreJobSchema = z.object({
  trackId: z.string().min(1).max(128),
});

export type RefreshTrendingScoreJob = z.infer<
  typeof refreshTrendingScoreJobSchema
>;

/**
 * Keyed by the Track: while its job waits, queuing another one changes
 * nothing. (A custom ID may not contain a colon.)
 */
export const trendingJobId = (trackId: string) => `track-trending-${trackId}`;
