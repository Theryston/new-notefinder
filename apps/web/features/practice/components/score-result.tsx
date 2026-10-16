'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { useScoring } from '../hooks/use-scoring';

export function ScoreResult({
  scoring,
}: {
  scoring: ReturnType<typeof useScoring>;
}) {
  const t = useTranslations('practice.scoring');
  const result = scoring.snapshot.result;
  return (
    <Dialog
      open={result !== null}
      onOpenChange={(open) => {
        if (!open) scoring.session.dismiss();
      }}
    >
      <DialogContent closeLabel={t('close')}>
        <DialogTitle>{t('result')}</DialogTitle>
        <DialogDescription>{t('resultDescription')}</DialogDescription>
        <p
          className="font-mono text-4xl tabular-nums"
          data-testid="result-accuracy"
        >
          {t('accuracy', {
            percent: Math.round((result?.accuracy ?? 0) * 100),
          })}
        </p>
        <p>{t('judged', { count: result?.judged ?? 0 })}</p>
        <Button onClick={scoring.retry}>{t('tryAgain')}</Button>
      </DialogContent>
    </Dialog>
  );
}
