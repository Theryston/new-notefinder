import { z } from 'zod';

/**
 * The sections of a public Profile the owner can hide from visitors. Each one
 * has its own read (`/v1/users/:username/...`), so a hidden one is refused
 * there and its data never leaves the API for anyone but the owner.
 */
export const profileSectionSchema = z.enum([
  'summary',
  'practiceHistory',
  'favorites',
]);

export type ProfileSection = z.infer<typeof profileSectionSchema>;

/** Whether each section is shown to visitors. Every section is visible by default. */
export const profileVisibilitySchema = z.object({
  summary: z.boolean(),
  practiceHistory: z.boolean(),
  favorites: z.boolean(),
});

export type ProfileVisibility = z.infer<typeof profileVisibilitySchema>;

/**
 * `PATCH /v1/me/profile-visibility`: a partial update, so an absent section
 * keeps its stored flag. The response is the full set of flags.
 */
export const updateProfileVisibilityBodySchema =
  profileVisibilitySchema.partial();

export type UpdateProfileVisibilityBody = z.infer<
  typeof updateProfileVisibilityBodySchema
>;
