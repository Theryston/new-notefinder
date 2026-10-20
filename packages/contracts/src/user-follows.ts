import { z } from 'zod';

/**
 * Route param of `PUT` and `DELETE /v1/me/following/:userId`: the User the
 * signed-in User follows or stops following, by User ID.
 */
export const followedUserParamSchema = z.object({
  userId: z.string().min(1).max(128),
});

export type FollowedUserParam = z.infer<typeof followedUserParamSchema>;

/**
 * `GET /v1/users/:username/follow`: what the signed-in viewer has with the
 * Profile's User. `userId` is the ID the follow writes take; it is only sent
 * to a signed-in viewer, never on the public banner.
 */
export const profileFollowSchema = z.object({
  userId: z.string().min(1),
  isFollowing: z.boolean(),
});

export type ProfileFollow = z.infer<typeof profileFollowSchema>;
