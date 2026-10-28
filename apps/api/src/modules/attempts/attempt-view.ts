import type { PracticeAttempt } from '@vozzify/contracts';
import { practiceSpeedSchema } from '@vozzify/contracts';
import type { PracticeAttemptRow } from './attempts.repository.js';

/** A saved run as the API answers it, timestamps as ISO 8601 text. */
export const toPracticeAttempt = (
  row: PracticeAttemptRow,
): PracticeAttempt => ({
  id: row.id,
  trackId: row.trackId,
  difficulty: row.difficulty,
  octaveMode: row.octaveMode,
  transposeSemitones: row.transposeSemitones,
  // The database keeps a float; only the dock's speeds ever get in (the
  // request schema refused the rest), so this re-check cannot fail.
  speed: practiceSpeedSchema.parse(row.speed),
  accuracy: row.accuracy,
  coverage: row.coverage,
  forwardSkip: row.forwardSkip,
  bleedSuspected: row.bleedSuspected,
  startedAt: row.startedAt.toISOString(),
  endedAt: row.endedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
});
