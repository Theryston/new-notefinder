import { boolean, pgTable, text } from 'drizzle-orm/pg-core';
import { timestamps } from '../columns.js';
import { octaveMode, practiceDifficulty } from './practice-attempts.js';
import { users } from './users.js';

/**
 * What follows the signed-in User across devices: difficulty, octave mode,
 * guide melody and count-in. One row per User, written on the first change;
 * visitors keep the same values on the device and adopt these on sign-in.
 * The per-Track transposition and the latency calibration stay on the device
 * and are never stored here.
 *
 * Legacy mapping: none, like the attempts. The legacy app kept no
 * per-preference history: every imported user starts on the page defaults
 * and writes their row on the first change.
 */
export const userPracticePreferences = pgTable('user_practice_preferences', {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  difficulty: practiceDifficulty().notNull().default('NORMAL'),
  octaveMode: octaveMode().notNull().default('ANY'),
  guideMelody: boolean().notNull().default(false),
  countIn: boolean().notNull().default(true),
  ...timestamps,
});
