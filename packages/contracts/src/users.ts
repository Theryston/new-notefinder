import { z } from 'zod';

import { nameSchema } from './auth.js';
import { AVATAR_MAX_BYTES } from './avatar-rules.js';

export const userRoleSchema = z.enum(['USER', 'ADMIN']);

export type UserRole = z.infer<typeof userRoleSchema>;

/**
 * The signed-in user (`GET /v1/me`). Only what the user may see about
 * themselves: never password hashes, sessions or provider tokens.
 */
export const currentUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  // Null until a user who signed up with Google picks one.
  username: z.string().nullable(),
  image: z.string().nullable(),
  role: userRoleSchema,
  createdAt: z.iso.datetime({ offset: true }),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

/**
 * `PATCH /v1/me`, sent as `multipart/form-data`: the Name, and optionally a
 * new Avatar as a file part named `avatar`. Nothing else can change here: the
 * Username is chosen once and never edited.
 *
 * Only the size is checked by the schema. Which image types are accepted is
 * decided from the file's content (`AVATAR_MIME_TYPES` is what the pickers
 * offer), since the MIME type a client declares can be anything.
 */
export const updateMeBodySchema = z.object({
  name: nameSchema,
  avatar: z.file().max(AVATAR_MAX_BYTES).optional(),
});

export type UpdateMeBody = z.infer<typeof updateMeBodySchema>;
