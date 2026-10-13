import { z } from 'zod';

// What the signed-in User has with one Track: `GET /v1/me/tracks/:trackId`.
// It depends on the session, so the web reads it in the browser while the
// Track page itself stays cached. Later tickets add the best scores here.

/**
 * The User's state on a Track. `isFavorite` is whether the Track is in the
 * User's favorites (`PUT` and `DELETE /v1/me/favorites/:trackId` change it).
 */
export const userTrackStateSchema = z.object({
  isFavorite: z.boolean(),
});

export type UserTrackState = z.infer<typeof userTrackStateSchema>;
