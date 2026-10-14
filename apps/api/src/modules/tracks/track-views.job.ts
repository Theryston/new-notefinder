import { z } from 'zod';

export const TRACK_TRENDING_QUEUE = 'track-trending';
export const UPDATE_TRACK_TRENDING_JOB = 'update-track-trending';

export const updateTrackTrendingJobSchema = z.object({
  trackId: z.string().min(1).max(128),
});

export const trendingJobId = (trackId: string) => `trending-${trackId}`;
