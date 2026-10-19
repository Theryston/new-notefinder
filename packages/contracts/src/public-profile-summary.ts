import { z } from 'zod';

/**
 * The Summary section of a Profile (`GET /v1/users/:username/summary`): the
 * four public numbers a visitor sees. Served apart from the banner, so the
 * banner keeps its shape for every client that already reads it.
 */
export const publicProfileSummarySchema = z.object({
  // The current Streak, in Practice days.
  streakDays: z.number().int().min(0),
  // The User's saved Practice attempts, excluding those flagged as bleed.
  // `null` when the User hid Practice history from visitors: the counter
  // belongs to that section, so it never reaches a visitor.
  sungCount: z.number().int().min(0).nullable(),
  // The Tracks the User marked as favorites. `null` when the User hid Favorite
  // songs from visitors, for the same reason as `sungCount`.
  favoritesCount: z.number().int().min(0).nullable(),
  // Every Contribution the User made, of any kind.
  contributionsCount: z.number().int().min(0),
});

export type PublicProfileSummary = z.infer<typeof publicProfileSummarySchema>;
