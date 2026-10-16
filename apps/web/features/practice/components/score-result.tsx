'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { useScoring } from '../hooks/use-scoring';

/**
 * The sheet of a finished run: the accuracy and "Try again". Whatever the
 * run means for the account (the best saved score, or the invite to sign in
 * that keeps the run waiting) is drawn by the Track page above, which owns
 * the session and the Track state.
 */
export function ScoreResult({
  scoring,
  renderAttemptStatus,
}: {
  scoring: ReturnType<typeof useScoring>;
  renderAttemptStatus?: () => ReactNode;
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
        {renderAttemptStatus?.()}
        <Button onClick={scoring.retry}>{t('tryAgain')}</Button>
      </DialogContent>
    </Dialog>
  );
}
