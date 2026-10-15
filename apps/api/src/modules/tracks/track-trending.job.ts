import { z } from 'zod';

// The trending score of a Track is recomputed by a delayed job after its views
// change, so many views cost one recomputation (the legacy app waited the same
// 15 minutes). A daily repeatable job recomputes every scored Track, since the
// score's calendar windows roll with time, not only with views. See
// docs/adr/0009-trending-score-jobs.md.

export const TRACK_TRENDING_QUEUE = 'track-trending';
export const REFRESH_TRENDING_SCORE_JOB = 'refresh-trending-score';
export const REFRESH_SCORED_TRACKS_JOB = 'refresh-scored-tracks';

/** The repeatable job's scheduler ID and cron (every day at 00:00 UTC). */
export const SCORED_TRACKS_SCHEDULER_ID = 'refresh-scored-tracks-daily';
export const SCORED_TRACKS_CRON = '0 0 * * *';

/** How long the job waits, so many views cost one recomputation. */
export const TRENDING_SCORE_DELAY_MS = 15 * 60 * 1000;

export const refreshTrendingScoreJobSchema = z.object({
  trackId: z.string().min(1).max(128),
});

export type RefreshTrendingScoreJob = z.infer<
  typeof refreshTrendingScoreJobSchema
>;

/**
 * Keyed by the Track and the delay-long time slot of the view. Views in one
 * slot share the job, which runs after the slot ends so it sees all of them;
 * a view in the next slot gets a job of its own even while the previous one
 * is still running, so no view waits for more than two delays. (A custom ID
 * may not contain a colon.)
 */
export const trendingJobId = (trackId: string, now: number) =>
  `track-trending-${trackId}-${Math.floor(now / TRENDING_SCORE_DELAY_MS)}`;
