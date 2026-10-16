import { z } from 'zod';

import {
  octaveModeSchema,
  practiceDifficultySchema,
} from './practice-attempts.js';

// What follows the signed-in User across devices (`GET` and
// `PATCH /v1/me/practice-preferences`). Visitors keep the same values on the
// device; the per-Track transposition and the latency calibration always stay
// on the device.

/** The User's practice preferences. */
export const practicePreferencesSchema = z.object({
  difficulty: practiceDifficultySchema.default('NORMAL'),
  octaveMode: octaveModeSchema.default('ANY'),
  guideMelody: z.boolean().default(false),
  countIn: z.boolean().default(true),
});

export type PracticePreferences = z.infer<typeof practicePreferencesSchema>;

/** `PATCH /v1/me/practice-preferences`: whichever preferences change. */
export const updatePracticePreferencesBodySchema =
  practicePreferencesSchema.partial();

export type UpdatePracticePreferencesBody = z.infer<
  typeof updatePracticePreferencesBodySchema
>;
