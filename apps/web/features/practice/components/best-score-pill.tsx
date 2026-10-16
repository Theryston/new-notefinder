'use client';

import type { BestPracticeScores } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { bestScoreAt } from '../best-score';
import { useScoringSettings } from '../stores/scoring-settings';

/**
 * The User's best saved score at the current difficulty. The scores arrive
 * as a prop because the Track state lives on the Track page; the difficulty
 * is read here because it lives in this feature. Nothing renders until a run
 * is saved at the difficulty on screen.
 */
export function BestScorePill({
  bestScores,
}: {
  bestScores: BestPracticeScores | undefined;
}) {
  const t = useTranslations('practice.scoring');
  const difficulty = useScoringSettings((state) => state.difficulty);
  const best = bestScoreAt(bestScores, difficulty);
  if (best === null) return null;
  return (
    <span
      data-testid="best-score"
      title={t('bestScoreTitle', { difficulty: t(difficulty) })}
      className="shrink-0 rounded-full bg-secondary px-2 py-1 font-mono font-semibold text-muted-foreground text-xs tabular-nums"
    >
      {t('bestScore', { percent: Math.round(best * 100) })}
    </span>
  );
}
