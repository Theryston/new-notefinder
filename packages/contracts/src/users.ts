import { z } from 'zod';

import { nameSchema } from './auth.js';
import { AVATAR_MAX_BYTES } from './avatar-rules.js';

export const userRoleSchema = z.enum(['USER', 'ADMIN']);

export type UserRole = z.infer<typeof userRoleSchema>;

/**
 * The Daily target presets a User can pick, in seconds (5, 10, 15 and
 * 30 minutes). The only values ever stored: anything else is rejected.
 */
export const DAILY_PRACTICE_TARGET_SECONDS = [300, 600, 900, 1800] as const;

export type DailyPracticeTargetSeconds =
  (typeof DAILY_PRACTICE_TARGET_SECONDS)[number];

/** One of the four presets, never a custom value. */
export const dailyPracticeTargetSecondsSchema = z.union([
  z.literal(300),
  z.literal(600),
  z.literal(900),
  z.literal(1800),
]);

/**
 * The stored value as one of the presets: anything that is not a preset
 * (including null and missing) reads as null, which clients show as the
 * fallback. The column predates the presets, so a legacy row may hold any
 * integer; narrowing happens at the read boundary, never by migration.
 */
export const asDailyPracticeTargetSeconds = (
  seconds: number | null | undefined,
): DailyPracticeTargetSeconds | null =>
  DAILY_PRACTICE_TARGET_SECONDS.find((preset) => preset === seconds) ?? null;

/**
 * The target of a User who never picked one. The read response carries null
 * for them (and omits the key for older cached responses); both read as
 * this, like the 5-minute fallback the streak always used.
 */
export const DEFAULT_DAILY_PRACTICE_TARGET_SECONDS: DailyPracticeTargetSeconds = 300;

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
  // Null until the User picks one in Edit profile.
  dailyPracticeTargetSeconds: dailyPracticeTargetSecondsSchema.nullish(),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

/**
 * `PATCH /v1/me`, sent as `multipart/form-data`: the Name, optionally a new
 * Avatar as a file part named `avatar`, and optionally the Daily target as
 * the text part `dailyPracticeTargetSeconds` (multipart carries text, so the
 * API coerces it to a number before this schema sees it). An absent target
 * leaves the stored one alone. Nothing else can change here: the Username
 * is chosen once and never edited.
 *
 * Only the size is checked by the schema. Which image types are accepted is
 * decided from the file's content (`AVATAR_MIME_TYPES` is what the pickers
 * offer), since the MIME type a client declares can be anything.
 */
export const updateMeBodySchema = z.object({
  name: nameSchema,
  avatar: z.file().max(AVATAR_MAX_BYTES).optional(),
  dailyPracticeTargetSeconds: dailyPracticeTargetSecondsSchema.optional(),
});

export type UpdateMeBody = z.infer<typeof updateMeBodySchema>;
