import { z } from 'zod';

/**
 * Route param for `GET /v1/users/:username`. Any case is accepted: the lookup
 * is case-insensitive, and the web redirects mixed-case paths to lowercase.
 * Not validated against the username rules, so an impossible name is a plain
 * 404 instead of a 400 the web would show as an error.
 */
export const publicProfileParamSchema = z.object({
  username: z.string().min(1).max(128),
});

export type PublicProfileParam = z.infer<typeof publicProfileParamSchema>;

/**
 * The public banner of a Profile (`GET /v1/users/:username`): only what any
 * visitor may see. Sections are added by later slices and are never sent to
 * visitors when hidden by their owner.
 */
export const publicProfileSchema = z.object({
  username: z.string().min(1),
  name: z.string().min(1),
  image: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;
