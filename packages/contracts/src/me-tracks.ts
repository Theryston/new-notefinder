import { z } from 'zod';

// What the signed-in User has with one Track: `GET /v1/me/tracks/:trackId`.
// It depends on the session, so the web reads it in the browser while the
// Track page itself stays cached.

/**
 * The User's state on a Track. `isFavorite` is whether the Track is in the
 * User's favorites (`PUT` and `DELETE /v1/me/favorites/:trackId` change it).
 */
export const userTrackStateSchema = z.object({
  isFavorite: z.boolean(),
});

export type UserTrackState = z.infer<typeof userTrackStateSchema>;

/**
 * The User's best accuracy (hit notes divided by judged notes, 0 to 1) on a
 * Track per difficulty, or null where they have no saved attempt. Saved
 * attempts are the only ones that count, so a visitor's unsaved runs never
 * show here.
 */
export const bestPracticeScoresSchema = z.object({
  EASY: z.number().min(0).max(1).nullable(),
  NORMAL: z.number().min(0).max(1).nullable(),
  HARD: z.number().min(0).max(1).nullable(),
});

export type BestPracticeScores = z.infer<typeof bestPracticeScoresSchema>;

/**
 * The User's state on a Track with their practice best: what the title row
 * reads to show the score to beat at the current difficulty. Kept separate
 * from {@link userTrackStateSchema} so the favorite shape never changes.
 *
 * A response without best scores still parses (as no scores yet), so the
 * favorite never stalls on the scores: they are a bonus beside it, and the
 * heart stays usable while they load or fail.
 */
export const trackPracticeStateSchema = userTrackStateSchema.extend({
  bestScores: bestPracticeScoresSchema.default({
    EASY: null,
    NORMAL: null,
    HARD: null,
  }),
});

export type TrackPracticeState = z.infer<typeof trackPracticeStateSchema>;
