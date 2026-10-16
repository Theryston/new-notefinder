'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { useScoring } from '../hooks/use-scoring';
import { useMicState } from '../stores/mic-store';

const ScoreResult = dynamic(
  () => import('./score-result').then((module) => module.ScoreResult),
  { ssr: false },
);

export function ScoreFeedback({
  scoring,
}: {
  scoring: ReturnType<typeof useScoring>;
}) {
  const t = useTranslations('practice.scoring');
  const micOn = useMicState((state) => state.status === 'on');
  const { summary, latest, result } = scoring.snapshot;
  return (
    <>
      {micOn && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p role="status" data-testid="score-readout">
            {latest ? t(latest) : t('waiting')}
            {' · '}
            {t(summary.loop ? 'sectionScore' : 'liveScore', {
              percent: Math.round(summary.accuracy * 100),
              count: summary.judged,
            })}
          </p>
          <Button variant="outline" size="sm" onClick={scoring.stop}>
            {t('stop')}
          </Button>
        </div>
      )}
      {result !== null && <ScoreResult scoring={scoring} />}
    </>
  );
}
