import type {
  BestPracticeScores,
  PracticeDifficulty,
} from '@notefinder/contracts';

/**
 * The User's best saved score at a difficulty, or null where no run was
 * saved there. The pill reads the difficulty itself; this only picks the
 * number.
 */
export function bestScoreAt(
  bestScores: BestPracticeScores | undefined,
  difficulty: PracticeDifficulty,
): number | null {
  return bestScores?.[difficulty] ?? null;
}
